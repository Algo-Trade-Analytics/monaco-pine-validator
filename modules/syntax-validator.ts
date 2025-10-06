/**
 * Syntax validation module for Pine Script v6
 * Handles basic syntax validation, script declarations, and structural checks
 */

import {
  type AstValidationContext,
  type ValidationContext,
  type ValidationError,
  type ValidationModule,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import { VERSION_RE, KEYWORDS, NAMESPACES, PSEUDO_VARS } from '../core/constants';
import { ensureAstContext } from '../core/ast/context-utils';
import { getSourceLines as computeSourceLines } from '../core/ast/source-utils';
import type { AstDiagnostics } from '../core/ast/types';
import {
  type AssignmentStatementNode,
  type BinaryExpressionNode,
  type ExpressionNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type IndexExpressionNode,
  type MemberExpressionNode,
  type ProgramNode,
  type ScriptDeclarationNode,
  type TupleExpressionNode,
  type UnaryExpressionNode,
  type VariableDeclarationNode,
  type VersionDirectiveNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import { PineLexer, LParen, RParen, LBracket, RBracket } from '../core/ast/parser/tokens';
import type { ILexingError, IToken } from 'chevrotain';

export class SyntaxValidator implements ValidationModule {
  name = 'SyntaxValidator';

  private helper = new ValidationHelper();
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private astDiagnostics: AstDiagnostics | null = null;

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.context = context;
    this.config = config;
    this.reset();
    this.astContext = this.getAstContext(context, config);
    this.astDiagnostics = this.getAstDiagnostics(context);

    if (!this.astContext?.ast) {
      this.validateTextFallback();
      this.reportParseDiagnostics();
      return this.buildResult();
    }

    this.validateWithAst(this.astContext.ast);
    this.validateOverallStructure();

    return this.buildResult();
  }

  private reset(): void {
    this.helper.reset();
    this.astContext = null;
    this.astDiagnostics = null;
  }

  private validateWithAst(program: ProgramNode): void {
    this.validateVersionDirectivesAst(program.directives);
    this.validateScriptDeclarationsAst(program);

    visit(program, {
      FunctionDeclaration: {
        enter: (path) => this.validateFunctionDeclarationAst(path.node as FunctionDeclarationNode),
      },
      VariableDeclaration: {
        enter: (path) => this.validateVariableDeclarationAst(path.node as VariableDeclarationNode),
      },
      AssignmentStatement: {
        enter: (path) => this.validateAssignmentAst(path as NodePath<AssignmentStatementNode>),
      },
      BinaryExpression: {
        enter: (path) => this.validateBinaryOperatorAst(path.node as BinaryExpressionNode),
      },
      UnaryExpression: {
        enter: (path) => this.validateUnaryOperatorAst(path.node as UnaryExpressionNode),
      },
    });
  }

  private validateVersionDirectivesAst(directives: VersionDirectiveNode[]): void {
    if (directives.length === 0) {
      return;
    }

    const [primary, ...duplicates] = directives;
    const line = primary.loc.start.line;
    const column = primary.loc.start.column;

    this.context.hasVersion = true;
    this.context.firstVersionLine = line;
    this.context.version = primary.version;

    if (this.config.targetVersion && primary.version !== this.config.targetVersion) {
      const severity = primary.version < this.config.targetVersion ? 'error' : 'warning';
      this.addBySeverity(
        severity,
        line,
        column,
        `Script declares //@version=${primary.version} but targetVersion is ${this.config.targetVersion}.`,
        'PS001',
      );
    }

    if (line !== 1 && !this.onlyCommentsAbove(line)) {
      this.helper.addWarning(line, column, 'Version directive should be on the first line.', 'PSW01');
    }

    if (primary.version < 5) {
      this.helper.addWarning(line, column, `Pine version ${primary.version} is deprecated. Prefer v5 or v6.`, 'PSW02');
    }

    for (const duplicate of duplicates) {
      this.helper.addError(
        duplicate.loc.start.line,
        duplicate.loc.start.column,
        'Multiple //@version directives. Only one allowed.',
        'PS002',
      );
    }
  }

  private validateScriptDeclarationsAst(program: ProgramNode): void {
    const scriptDeclarations = program.body.filter(
      (statement): statement is ScriptDeclarationNode => statement.kind === 'ScriptDeclaration',
    );

    if (scriptDeclarations.length === 0) {
      return;
    }

    const [primary, ...duplicates] = scriptDeclarations;
    this.context.scriptType = primary.scriptType;

    const firstStatement = this.getFirstStatementLine(program.body);
    if (firstStatement !== null && primary.loc.start.line !== firstStatement) {
      this.helper.addInfo(
        firstStatement,
        1,
        'Consider placing the script declaration at the top for clarity.',
        'PSI01',
      );
    }

    for (const duplicate of duplicates) {
      if (duplicate.scriptType !== primary.scriptType) {
        this.helper.addError(
          duplicate.loc.start.line,
          duplicate.loc.start.column,
          `Multiple script declarations not allowed (already '${primary.scriptType}').`,
          'PS004B',
        );
      }
    }
  }

  private validateFunctionDeclarationAst(node: FunctionDeclarationNode): void {
    const identifier = node.identifier;
    if (!identifier) {
      return;
    }

    const name = identifier.name;
    const parts = name.split('.');
    const invalid = parts.find((part) => KEYWORDS.has(part));
    if (!invalid) {
      return;
    }

    const isMethod = this.isMethodDeclaration(node);
    const label = isMethod ? 'Method' : 'Function';
    this.helper.addError(
      node.loc.start.line,
      node.loc.start.column,
      `${label} name '${invalid}' conflicts with a Pine keyword.`,
      'PS006',
    );
  }

  private validateVariableDeclarationAst(node: VariableDeclarationNode): void {
    const name = node.identifier.name;
    if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
      this.helper.addError(
        node.loc.start.line,
        node.loc.start.column,
        `Identifier '${name}' conflicts with a Pine keyword/builtin.`,
        'PS007',
      );
    }
  }

  private validateAssignmentAst(path: NodePath<AssignmentStatementNode>): void {
    const assignment = path.node;
    if (!assignment.left) {
      return;
    }

    const operator = assignment.operator ?? '=';
    const left = assignment.left;

    if (left.kind === 'TupleExpression') {
      this.validateTupleAssignmentAst(assignment, operator);
      return;
    }

    if (left.kind === 'MemberExpression') {
      const member = left as MemberExpressionNode;
      if (!member.computed && operator === '=') {
        const rootName = this.getMemberRoot(member);
        if (!rootName) {
          return;
        }
        const propertyName = member.property.name;
        if (NAMESPACES.has(rootName) || KEYWORDS.has(rootName) || KEYWORDS.has(`${rootName}.${propertyName}`)) {
          return;
        }
        if (rootName !== 'this' && !this.isIdentifierDeclared(rootName)) {
          return;
        }
        const target = `${rootName}.${propertyName}`;
        this.helper.addError(
          assignment.loc.start.line,
          assignment.loc.start.column,
          `Use ':=' to assign to '${target}'. '=' is reserved for the first assignment.`,
          'PS016',
        );
      }
      return;
    }

    if (left.kind === 'IndexExpression') {
      const baseName = this.getIndexBaseName(left as IndexExpressionNode);
      if (!baseName) {
        return;
      }
      const declared = this.isIdentifierDeclared(baseName);
      if (declared) {
        return;
      }

      if (operator === ':=') {
        this.helper.addError(
          assignment.loc.start.line,
          assignment.loc.start.column,
          `Variable '${baseName}' not declared before ':=' on element.`,
          'PS016A',
        );
      } else if (operator.length === 2 && operator.endsWith('=')) {
        const op = operator[0];
        this.helper.addError(
          assignment.loc.start.line,
          assignment.loc.start.column,
          `Variable '${baseName}' not declared before '${op}=' on element.`,
          'PS017A',
        );
      }
    }
  }

  private getFirstStatementLine(body: ProgramNode['body']): number | null {
    let firstLine: number | null = null;
    for (const statement of body) {
      const line = statement.loc?.start.line ?? null;
      if (line === null) {
        continue;
      }
      if (firstLine === null || line < firstLine) {
        firstLine = line;
      }
    }
    return firstLine;
  }

  private validateTupleAssignmentAst(assignment: AssignmentStatementNode, operator: string): void {
    const tuple = assignment.left as TupleExpressionNode;
    if (operator.includes(':=')) {
      this.helper.addError(
        assignment.loc.start.line,
        assignment.loc.start.column,
        'Tuple destructuring must use "=" (not ":=").',
        'PST03',
      );
    }

    const hasEmptySlot = tuple.elements.some((element) => this.isEmptyTupleElement(element));
    if (hasEmptySlot) {
      this.helper.addWarning(
        assignment.loc.start.line,
        tuple.loc.start.column,
        'Empty slot in destructuring tuple.',
        'PST02',
      );
    }
  }

  private isEmptyTupleElement(element: ExpressionNode | null): boolean {
    if (!element) {
      return true;
    }

    if (element.kind === 'NullLiteral') {
      const { start, end } = element.loc;
      if (start.line === end.line && start.column === end.column) {
        return true;
      }

      const [rangeStart, rangeEnd] = element.range;
      if (rangeStart === rangeEnd) {
        return true;
      }
    }

    return false;
  }

  private validateBinaryOperatorAst(node: BinaryExpressionNode): void {
    const invalidOps = new Map<string, string>([
      ['===', "Operator '===' is not valid in Pine Script."],
      ['!==', "Operator '!==' is not valid in Pine Script."],
      ['^', "Operator '^' is not valid in Pine Script."],
      ['&&', "Operator '&&' is not valid in Pine Script. Use 'and'/'or' instead."],
      ['||', "Operator '||' is not valid in Pine Script. Use 'and'/'or' instead."],
    ]);

    const message = invalidOps.get(node.operator);
    if (message) {
      this.helper.addWarning(node.loc.start.line, node.loc.start.column, message, 'PSO01');
    }
  }

  private validateUnaryOperatorAst(node: UnaryExpressionNode): void {
    const operator = node.operator;
    if (operator === '!') {
      this.helper.addWarning(
        node.loc.start.line,
        node.loc.start.column,
        "Operator '!' is not valid in Pine. Use 'not'.",
        'PSO01',
      );
      return;
    }

    if (operator === '++' || operator === '--' || operator === '~') {
      this.helper.addWarning(
        node.loc.start.line,
        node.loc.start.column,
        `Operator '${operator}' is not valid in Pine Script.`,
        'PSO01',
      );
    }
  }

  private validateOverallStructure(): void {
    const source = this.getSourceLines();
    const hasContent = source.some((line) => line.trim() !== '');
    if (!hasContent) {
      this.helper.addError(1, 1, 'Script is empty.', 'PS-EMPTY');
    }
  }

  private onlyCommentsAbove(line: number): boolean {
    const sourceLines = this.getSourceLines();
    return sourceLines.slice(0, Math.max(0, line - 1)).every((raw) => {
      const trimmed = (raw || '').trim();
      if (trimmed === '') return true;
      if (/^\/{2}/.test(trimmed)) return true;
      if (/^\/\*/.test(trimmed) || /^\*/.test(trimmed) || /^\*\//.test(trimmed)) return true;
      return false;
    });
  }

  private isMethodDeclaration(node: FunctionDeclarationNode): boolean {
    return Array.isArray(node.modifiers) && node.modifiers.includes('method');
  }

  private getMemberRoot(member: MemberExpressionNode): string | null {
    let current: ExpressionNode = member.object;
    while (current.kind === 'MemberExpression') {
      current = (current as MemberExpressionNode).object;
    }
    if (current.kind === 'Identifier') {
      return (current as IdentifierNode).name;
    }
    return null;
  }

  private getIndexBaseName(node: IndexExpressionNode): string | null {
    let current: ExpressionNode = node.object;
    while (current.kind === 'MemberExpression') {
      current = (current as MemberExpressionNode).object;
    }
    if (current.kind === 'Identifier') {
      return (current as IdentifierNode).name;
    }
    return null;
  }

  private isIdentifierDeclared(name: string): boolean {
    if (this.context.declaredVars.has(name) || this.context.typeMap.has(name)) {
      return true;
    }
    if (this.astContext) {
      const record = this.astContext.symbolTable.get(name);
      if (record && record.declarations.length > 0) {
        return true;
      }
    }
    return false;
  }


  private addBySeverity(
    severity: 'error' | 'warning',
    line: number,
    column: number,
    message: string,
    code: string,
  ): void {
    if (severity === 'error') {
      this.helper.addError(line, column, message, code);
    } else {
      this.helper.addWarning(line, column, message, code);
    }
  }

  private getAstContext(
    context: ValidationContext,
    config: ValidatorConfig,
  ): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    const ensured = ensureAstContext(context, config);
    if (ensured) {
      return ensured;
    }
    return isAstValidationContext(context) ? context : null;
  }

  private getAstDiagnostics(context: ValidationContext): AstDiagnostics | null {
    return isAstValidationContext(context) ? context.astDiagnostics ?? null : null;
  }

  private reportParseDiagnostics(): void {
    const diagnostics = this.astDiagnostics;
    if (!diagnostics || diagnostics.syntaxErrors.length === 0) {
      return;
    }

    for (const error of diagnostics.syntaxErrors) {
      const details = error.details;
      const line = details?.lineno ?? 1;
      const column = details?.offset ?? 1;
      const message = error.message || 'Syntax error detected.';
      this.helper.addWarning(line, column, message, 'PSV6-SYNTAX-ERROR');
    }
  }

  private validateTextFallback(): void {
    const source = this.getSourceText();
    if (!source.trim()) {
      return;
    }

    const lexResult = PineLexer.tokenize(source);

    this.reportLexErrors(lexResult.errors as ILexingError[]);

    type StackEntry = { token: IToken; char: '(' | '[' };
    const stack: StackEntry[] = [];

    for (const token of lexResult.tokens) {
      const tokenType = token.tokenType;
      if (tokenType === LParen) {
        stack.push({ token, char: '(' });
        continue;
      }
      if (tokenType === LBracket) {
        stack.push({ token, char: '[' });
        continue;
      }
      if (tokenType === RParen) {
        const last = stack.pop();
        if (!last || last.char !== '(') {
          this.helper.addError(
            token.startLine ?? 1,
            token.startColumn ?? 1,
            "Unexpected ')'.",
            'PSV6-SYNTAX-ERROR',
          );
        }
        continue;
      }
      if (tokenType === RBracket) {
        const last = stack.pop();
        if (!last || last.char !== '[') {
          this.helper.addError(
            token.startLine ?? 1,
            token.startColumn ?? 1,
            "Unexpected ']'.",
            'PSV6-SYNTAX-ERROR',
          );
        }
      }
    }

    while (stack.length > 0) {
      const unmatched = stack.pop()!;
      const closing = unmatched.char === '(' ? ')' : ']';
      this.helper.addError(
        unmatched.token.startLine ?? 1,
        unmatched.token.startColumn ?? 1,
        `Missing closing '${closing}' for opening '${unmatched.char}'.`,
        'PSV6-SYNTAX-ERROR',
      );
    }
  }

  private reportLexErrors(errors: ILexingError[]): void {
    if (!Array.isArray(errors) || errors.length === 0) {
      return;
    }
    for (const error of errors) {
      const line = error.line ?? 1;
      const column = error.column ?? 1;
      const message = error.message || 'Lexing error detected.';
      this.helper.addError(line, column, message, 'PSV6-LEXER-ERROR');
    }
  }

  private getSourceLines(): string[] {
    return computeSourceLines(this.context);
  }

  private getSourceText(): string {
    return this.getSourceLines().join('\n');
  }

  private buildResult(): ValidationResult {
    return this.helper.buildResult(this.context);
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
