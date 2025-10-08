/**
 * Syntax Error Validator Module
 *
 * Processes parser/syntax errors and converts them to user-friendly error messages.
 * This module runs FIRST to catch syntax errors before they cause cascading false errors.
 */

import type {
  ValidationModule,
  ValidationContext,
  ValidatorConfig,
  ValidationResult,
  AstValidationContext,
  ValidationError,
} from '../core/types';
import { ValidationHelper } from '../core/validation-helper';
import { convertAstDiagnosticsToErrors, hasCriticalSyntaxErrors } from '../core/ast/syntax-error-processor';
import { preCheckSyntax } from '../core/ast/syntax-pre-checker';
import { createAstDiagnostics } from '../core/ast/types';
import { Codes } from '../core/codes';
import { visit } from '../core/ast/traversal';
import type {
  ArrayLiteralNode,
  BinaryExpressionNode,
  CallExpressionNode,
  ConditionalExpressionNode,
  FunctionDeclarationNode,
  IndexExpressionNode,
  Node,
  TupleExpressionNode,
  VariableDeclarationNode,
} from '../core/ast/nodes';
import type { VirtualToken } from '../core/ast/virtual-tokens';
import { VirtualTokenReason } from '../core/ast/virtual-tokens';

type RecoveryTemplate = {
  code: string;
  message: string;
  suggestion?: string;
};

export class SyntaxErrorValidator implements ValidationModule {
  name = 'SyntaxErrorValidator';
  priority = 999; // HIGHEST priority - run before everything else

  private helper = new ValidationHelper();
  private sourceCode: string = '';

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.helper.reset();

    this.sourceCode = this.getSourceCode(context);
    this.helper.setSourceCode(this.sourceCode);
    this.helper.setEnhanceErrors(config.enhanceErrors !== false);

    const astContext = this.isAstContext(context) ? context : null;
    const targetVersion = config.targetVersion ?? 6;

    const preCheckErrors = preCheckSyntax(this.sourceCode, targetVersion);
    if (astContext) {
      this.attachPreCheckDiagnostics(astContext, preCheckErrors);
    }
    this.helper.addErrors(preCheckErrors);
    if (preCheckErrors.length > 0 && !astContext) {
      return this.helper.buildResult(context);
    }

    if (!astContext || !astContext.astDiagnostics) {
      return this.helper.buildResult(context);
    }

    const syntaxErrors = convertAstDiagnosticsToErrors(astContext.astDiagnostics, this.sourceCode);
    this.helper.addErrors(syntaxErrors);

    if (astContext.ast) {
      const existingKeys = new Set(
        this.helper.errorList.map((error) => this.createErrorKey(error.line, error.column, error.code)),
      );
      const existingCodes = new Set(
        this.helper.errorList
          .map((error) => error.code)
          .filter((code): code is string => Boolean(code)),
      );
      const recoveryErrors = this.collectRecoveryErrors(astContext, existingKeys, existingCodes);
      this.helper.addErrors(recoveryErrors);
    }

    return this.helper.buildResult(context);
  }

  /**
   * Check if there are critical syntax errors that should stop further validation
   */
  hasCriticalErrors(context: ValidationContext): boolean {
    const astContext = this.isAstContext(context) ? context : null;
    if (!astContext || !astContext.astDiagnostics) {
      return false;
    }
    const diagnostics = astContext.astDiagnostics as { preCheckErrors?: ValidationError[] };
    if (diagnostics.preCheckErrors && diagnostics.preCheckErrors.length > 0) {
      return true;
    }
    return hasCriticalSyntaxErrors(astContext.astDiagnostics);
  }

  private collectRecoveryErrors(
    astContext: AstValidationContext,
    existingKeys: Set<string>,
    existingCodes: Set<string>,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const program = astContext.ast;
    if (!program) {
      return errors;
    }

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          const declaration = path.node as VariableDeclarationNode;
          if (declaration.missingInitializerOperator && declaration.virtualInitializerOperator) {
            const name = declaration.identifier.name;
            this.pushRecoveryError(
              errors,
              declaration,
              declaration.virtualInitializerOperator,
              {
                code: Codes.SYNTAX_MISSING_EQUALS,
                message: `Missing '=' operator after variable '${name}'`,
                suggestion: `Assign a value using '${name} = ...'.`,
              },
              existingKeys,
              existingCodes,
            );
          }
        },
      },
      FunctionDeclaration: {
        enter: (path) => {
          const declaration = path.node as FunctionDeclarationNode;
          const recovery = declaration.functionRecovery?.missingParentheses;
          if (!recovery) {
            return;
          }
          const functionName = declaration.identifier?.name ?? 'function';
          const template: RecoveryTemplate = {
            code: Codes.SYNTAX_MISSING_PARENS,
            message: recovery.errors?.[0]?.message ?? `Missing parentheses in function declaration '${functionName}'`,
            suggestion:
              recovery.errors?.[0]?.suggestion ??
              `Add parentheses after '${functionName}', even if there are no parameters (for example '${functionName}()').`,
          };
          const token = recovery.virtualLParen ?? recovery.virtualRParen ?? null;
          this.pushRecoveryError(errors, declaration, token, template, existingKeys, existingCodes);
        },
      },
      CallExpression: {
        enter: (path) => {
          const call = path.node as CallExpressionNode;
          const recovery = call.argumentRecovery;
          if (!recovery) {
            return;
          }

          recovery.virtualSeparators?.forEach((token) => {
            this.pushRecoveryError(
              errors,
              call,
              token,
              {
                code: Codes.SYNTAX_MISSING_COMMA,
                message: 'Missing comma between function arguments',
                suggestion: 'Separate function arguments with commas.',
              },
              existingKeys,
              existingCodes,
            );
          });

          recovery.virtualArguments?.forEach((token) => {
            if (!token) {
              return;
            }
            const template: RecoveryTemplate =
              token.reason === VirtualTokenReason.TRAILING_COMMA
                ? {
                    code: Codes.SYNTAX_TRAILING_COMMA,
                    message: 'Trailing comma without argument',
                    suggestion: 'Remove the trailing comma or provide an argument after it.',
                  }
                : {
                    code: Codes.SYNTAX_EMPTY_PARAM,
                    message: 'Missing argument between commas',
                    suggestion: 'Provide an argument between these commas.',
                  };
            this.pushRecoveryError(errors, call, token, template, existingKeys, existingCodes);
          });

          if (recovery.virtualClosing) {
            this.pushRecoveryError(
              errors,
              call,
              recovery.virtualClosing,
              {
                code: Codes.SYNTAX_MISSING_CLOSING_PAREN,
                message: 'Missing closing parenthesis',
                suggestion: "Add ')' to complete the expression.",
              },
              existingKeys,
              existingCodes,
            );
          }
        },
      },
      ArrayLiteral: {
        enter: (path) => {
          this.collectCollectionRecovery(errors, path.node as ArrayLiteralNode, existingKeys, existingCodes);
        },
      },
      TupleExpression: {
        enter: (path) => {
          this.collectCollectionRecovery(errors, path.node as TupleExpressionNode, existingKeys, existingCodes);
        },
      },
      IndexExpression: {
        enter: (path) => {
          const expression = path.node as IndexExpressionNode;
          const recovery = expression.indexRecovery;
          if (recovery?.virtualClosing) {
            this.pushRecoveryError(
              errors,
              expression,
              recovery.virtualClosing,
              {
                code: Codes.SYNTAX_MISSING_BRACKET,
                message: 'Missing closing bracket',
                suggestion: 'Add "]" to close the collection.',
              },
              existingKeys,
              existingCodes,
            );
          }
        },
      },
      BinaryExpression: {
        enter: (path) => {
          const binary = path.node as BinaryExpressionNode;
          if (!binary.binaryRecovery) {
            return;
          }
          for (const recovery of binary.binaryRecovery) {
            const operator = recovery.operator ?? '?';
            this.pushRecoveryError(
              errors,
              binary,
              recovery.virtualOperand ?? null,
              {
                code: Codes.SYNTAX_MISSING_BINARY_OPERAND,
                message: `Missing expression after operator '${operator}'`,
                suggestion: `Provide an expression after '${operator}'.`,
              },
              existingKeys,
              existingCodes,
            );
          }
        },
      },
      ConditionalExpression: {
        enter: (path) => {
          const conditional = path.node as ConditionalExpressionNode;
          const recovery = conditional.conditionalRecovery;
          if (!recovery) {
            return;
          }
          this.pushRecoveryError(
            errors,
            conditional,
            recovery.virtualQuestion ?? recovery.virtualColon ?? null,
            {
              code: Codes.SYNTAX_CONDITIONAL_ORDER,
              message: "Incorrect conditional operator order. Use 'condition ? value_if_true : value_if_false'.",
              suggestion: "Swap the '?' and ':' operators so the question mark comes before the colon.",
            },
            existingKeys,
            existingCodes,
          );
        },
      },
    });

    return errors;
  }

  private collectCollectionRecovery(
    errors: ValidationError[],
    node: ArrayLiteralNode | TupleExpressionNode,
    existingKeys: Set<string>,
    existingCodes: Set<string>,
  ): void {
    const recovery = node.collectionRecovery;
    if (!recovery) {
      return;
    }

    recovery.virtualSeparators?.forEach((token) => {
      this.pushRecoveryError(
        errors,
        node,
        token,
        {
          code: Codes.SYNTAX_MISSING_COMMA,
          message: 'Missing comma between elements',
          suggestion: 'Separate elements with a comma.',
        },
        existingKeys,
        existingCodes,
      );
    });

    recovery.virtualElements?.forEach((token) => {
      const template: RecoveryTemplate =
        token.reason === VirtualTokenReason.TRAILING_COMMA
          ? {
              code: Codes.SYNTAX_TRAILING_COMMA,
              message: 'Trailing comma without argument',
              suggestion: 'Remove the trailing comma or provide an argument after it.',
            }
          : {
              code: Codes.SYNTAX_EMPTY_PARAM,
              message: 'Missing argument between commas',
              suggestion: 'Provide an argument between these commas.',
            };
      this.pushRecoveryError(errors, node, token, template, existingKeys, existingCodes);
    });

    if (recovery.virtualClosing) {
      this.pushRecoveryError(
        errors,
        node,
        recovery.virtualClosing,
        {
          code: Codes.SYNTAX_MISSING_BRACKET,
          message: 'Missing closing bracket',
          suggestion: 'Add "]" to close the collection.',
        },
        existingKeys,
        existingCodes,
      );
    }
  }

  private pushRecoveryError(
    errors: ValidationError[],
    node: Node,
    token: VirtualToken | null | undefined,
    template: RecoveryTemplate,
    existingKeys: Set<string>,
    existingCodes: Set<string>,
  ): void {
    if (template.code && existingCodes.has(template.code)) {
      return;
    }

    const { line, column } = this.getTokenPosition(token, node);
    const key = this.createErrorKey(line, column, template.code);
    if (existingKeys.has(key)) {
      return;
    }
    existingKeys.add(key);
    errors.push({
      line,
      column,
      message: template.message,
      severity: 'error',
      code: template.code,
      suggestion: template.suggestion,
    });
  }

  private createErrorKey(line: number, column: number, code?: string): string {
    return `${line}:${column}:${code ?? 'error'}`;
  }

  private getTokenPosition(token: VirtualToken | null | undefined, node: Node): { line: number; column: number } {
    const line = token?.insertedAt?.line ?? token?.startLine ?? node.loc?.start.line ?? 1;
    const column = token?.insertedAt?.column ?? token?.startColumn ?? node.loc?.start.column ?? 1;
    return { line, column };
  }

  private isAstContext(context: ValidationContext): context is AstValidationContext {
    return 'ast' in context && 'astDiagnostics' in context;
  }

  private getSourceCode(context: ValidationContext): string {
    if (context.lines && context.lines.length > 0) {
      return context.lines.join('\n');
    }
    if (context.cleanLines && context.cleanLines.length > 0) {
      return context.cleanLines.join('\n');
    }
    if (context.rawLines && context.rawLines.length > 0) {
      return context.rawLines.join('\n');
    }
    return context.sourceText ?? '';
  }

  private attachPreCheckDiagnostics(
    astContext: AstValidationContext,
    preCheckErrors: ValidationError[],
  ): void {
    if (!astContext.astDiagnostics) {
      astContext.astDiagnostics = createAstDiagnostics();
    }
    const diagnostics = astContext.astDiagnostics as { preCheckErrors?: ValidationError[] };
    diagnostics.preCheckErrors = preCheckErrors;
  }
}
