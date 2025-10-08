/**
 * Syntax Error Validator Module
 *
 * Consumes parser diagnostics and recovery metadata to surface
 * user-friendly PSV6 syntax errors and warnings with no dependence on
 * the legacy textual pre-checker.
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
import { Codes } from '../core/codes';
import { visit } from '../core/ast/traversal';
import type {
  ProgramNode,
  VariableDeclarationNode,
  FunctionDeclarationNode,
  CallExpressionNode,
  ArrayLiteralNode,
  TupleExpressionNode,
  IndexExpressionNode,
  BinaryExpressionNode,
  ConditionalExpressionNode,
  Node,
  ExpressionNode,
  MemberExpressionNode,
  VirtualToken,
} from '../core/ast/nodes';
import { VirtualTokenReason } from '../core/ast/virtual-tokens';

export class SyntaxErrorValidator implements ValidationModule {
  name = 'SyntaxErrorValidator';
  priority = 999;

  private helper = new ValidationHelper();
  private sourceCode = '';

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.helper.reset();

    this.sourceCode = this.getSourceCode(context);
    this.helper.setSourceCode(this.sourceCode);
    this.helper.setEnhanceErrors(config.enhanceErrors !== false);

    const astContext = this.isAstContext(context) ? context : null;
    if (!astContext || !astContext.astDiagnostics) {
      return this.helper.buildResult(context);
    }

    const syntaxErrors = convertAstDiagnosticsToErrors(astContext.astDiagnostics, this.sourceCode);
    this.helper.addErrors(syntaxErrors);

    if (astContext.ast) {
      const existingKeys = new Set(
        this.helper.errorList.map((error) => this.createErrorKey(error.line, error.column, error.code)),
      );
      const recoveryErrors = this.collectRecoveryErrors(astContext.ast, existingKeys);
      this.helper.addErrors(recoveryErrors);

      const indentationDiagnostics = Array.isArray(astContext.indentationDiagnostics)
        ? astContext.indentationDiagnostics
        : [];
      const freshIndentationDiagnostics = indentationDiagnostics.filter((diagnostic) => {
        const key = this.createErrorKey(diagnostic.line, diagnostic.column, diagnostic.code);
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });
      if (freshIndentationDiagnostics.length > 0) {
        this.helper.addErrors(freshIndentationDiagnostics);
      }
    }

    return this.helper.buildResult(context);
  }

  hasCriticalErrors(context: ValidationContext): boolean {
    const astContext = this.isAstContext(context) ? context : null;
    if (!astContext || !astContext.astDiagnostics) {
      return false;
    }
    return hasCriticalSyntaxErrors(astContext.astDiagnostics);
  }

  private collectRecoveryErrors(program: ProgramNode, existingKeys: Set<string>): ValidationError[] {
    const errors: ValidationError[] = [];

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
          const template = recovery.errors?.[0];
          this.pushRecoveryError(
            errors,
            declaration,
            recovery.virtualLParen ?? recovery.virtualRParen ?? null,
            {
              code: Codes.SYNTAX_MISSING_PARENS,
              message:
                template?.message ?? `Missing parentheses in function declaration '${functionName}'`,
              suggestion:
                template?.suggestion ??
                `Add parentheses after '${functionName}', even if there are no parameters (for example '${functionName}()').`,
            },
            existingKeys,
          );
        },
      },
      CallExpression: {
        enter: (path) => {
          const call = path.node as CallExpressionNode;
          const recovery = call.argumentRecovery;
          if (!recovery) {
            return;
          }

          const calleeName = this.getCallCalleeName(call);
          const isInputCall = typeof calleeName === 'string' && calleeName.startsWith('input.');
          const argumentPositionMap = new Map(
            (recovery.virtualArgumentDetails ?? []).map(({ token, position }) => [token, position]),
          );

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
            );
          });

          recovery.virtualArguments?.forEach((token) => {
            if (!token) {
              return;
            }
            const position = argumentPositionMap.get(token) ?? 'middle';
            if (position === 'trailing') {
              this.pushRecoveryError(
                errors,
                call,
                token,
                {
                  code: Codes.SYNTAX_TRAILING_COMMA,
                  message: 'Trailing comma before closing parenthesis',
                  suggestion: 'Remove the trailing comma or provide a parameter value.',
                },
                existingKeys,
              );
              return;
            }

            if (position === 'first') {
              const displayName = calleeName ?? 'function';
              const message = `Missing parameter in ${displayName}() call`;
              const suggestion = isInputCall
                ? `${displayName}() requires a default value as the first parameter (for example ${displayName}(10, "Label", ...)).`
                : 'Function calls cannot have empty parameters. Provide a value or expression as the first parameter.';
              this.pushRecoveryError(
                errors,
                call,
                token,
                {
                  code: Codes.SYNTAX_EMPTY_PARAM,
                  message,
                  suggestion,
                },
                existingKeys,
              );
              return;
            }

            this.pushRecoveryError(
              errors,
              call,
              token,
              {
                code: Codes.SYNTAX_EMPTY_PARAM,
                message: 'Empty parameter between commas',
                suggestion: 'Function calls cannot have empty parameters. Remove the extra comma or provide a value.',
              },
                existingKeys,
              );
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
            );
          }
        },
      },
      ArrayLiteral: {
        enter: (path) => {
          this.collectCollectionRecovery(errors, path.node as ArrayLiteralNode, existingKeys);
        },
      },
      TupleExpression: {
        enter: (path) => {
          this.collectCollectionRecovery(errors, path.node as TupleExpressionNode, existingKeys);
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
      );
    });

    recovery.virtualElements?.forEach((token) => {
      const template =
        token.reason === VirtualTokenReason.TRAILING_COMMA
          ? {
              code: Codes.SYNTAX_TRAILING_COMMA,
              message: 'Trailing comma without argument',
              suggestion: 'Remove the trailing comma or provide an element after it.',
            }
          : {
              code: Codes.SYNTAX_EMPTY_PARAM,
              message: 'Missing argument between commas',
              suggestion: 'Provide an element between these commas.',
            };
      this.pushRecoveryError(errors, node, token, template, existingKeys);
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
      );
    }
  }

  private pushRecoveryError(
    errors: ValidationError[],
    node: Node,
    token: VirtualToken | null | undefined,
    template: { code: string; message: string; suggestion?: string },
    existingKeys: Set<string>,
  ): void {
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

  private getTokenPosition(token: VirtualToken | null | undefined, node: Node): { line: number; column: number } {
    const line = token?.insertedAt?.line ?? token?.startLine ?? node.loc?.start.line ?? 1;
    const column = token?.insertedAt?.column ?? token?.startColumn ?? node.loc?.start.column ?? 1;
    return { line, column };
  }

  private createErrorKey(line: number, column: number, code?: string): string {
    return `${line}:${column}:${code ?? 'error'}`;
  }

  private getCallCalleeName(call: CallExpressionNode): string | null {
    return this.getExpressionName(call.callee);
  }

  private getExpressionName(expression: ExpressionNode | undefined): string | null {
    if (!expression) {
      return null;
    }

    switch (expression.kind) {
      case 'Identifier':
        return expression.name;
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        const objectName = this.getExpressionName(member.object as ExpressionNode);
        const propertyName = member.property.name;
        return objectName ? `${objectName}.${propertyName}` : propertyName;
      }
      default:
        return null;
    }
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

}
