import {
  type AstValidationContext,
  type ValidationContext,
  type ValidationModule,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import {
  type AssignmentStatementNode,
  type ExpressionNode,
  type IdentifierNode,
  type IfStatementNode,
  type MemberExpressionNode,
  type ProgramNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';

type AssignmentOperator = '=' | ':=' | '+=' | '-=' | '*=' | '/=' | '%=';

interface DiagnosticEntry {
  line: number;
  column: number;
  message: string;
  code: string;
}

interface VaripDeclarationInfo {
  name: string;
  node: VariableDeclarationNode;
  initializer: ExpressionNode | null;
  line: number;
  column: number;
  inFunction: boolean;
  inLoop: boolean;
}

export class VaripValidator implements ValidationModule {
  name = 'VaripValidator';

  private errors: DiagnosticEntry[] = [];
  private warnings: DiagnosticEntry[] = [];
  private info: DiagnosticEntry[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  private astVaripDeclarations: VaripDeclarationInfo[] = [];
  private astVaripNames = new Set<string>();
  private astHandledVaripLines = new Set<number>();
  private astAssignmentErrorSites = new Set<string>();
  private astBarstateWarningSites = new Set<string>();

  getDependencies(): string[] {
    return ['SyntaxValidator', 'TypeValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    this.usingAst = Boolean(this.astContext?.ast);

    if (this.usingAst && this.astContext?.ast) {
      this.validateWithAst(this.astContext.ast);
    } else {
      this.validateWithLegacyHeuristics();
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors.map((error) => ({ ...error, severity: 'error' as const })),
      warnings: this.warnings.map((warning) => ({ ...warning, severity: 'warning' as const })),
      info: this.info.map((info) => ({ ...info, severity: 'info' as const })),
      typeMap: context.typeMap,
      scriptType: context.scriptType,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astVaripDeclarations = [];
    this.astVaripNames.clear();
    this.astHandledVaripLines.clear();
    this.astAssignmentErrorSites.clear();
    this.astBarstateWarningSites.clear();
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({ line, column, message, code });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({ line, column, message, code });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({ line, column, message, code });
  }

  private validateWithAst(program: ProgramNode): void {
    this.collectVaripDeclarations(program);
    this.validateVaripDeclarationsAst();
    this.validateVaripScopeAst();
    this.validateVaripAssignmentsAst(program);
    this.validateVaripPerformanceAst();
    this.validateVaripSyntaxFallbackAst();
  }

  private collectVaripDeclarations(program: ProgramNode): void {
    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          const node = (path as NodePath<VariableDeclarationNode>).node;
          if (node.declarationKind !== 'varip') {
            return;
          }

          const name = node.identifier.name;
          const { line, column } = node.loc.start;
          const inFunction = Boolean(findAncestor(path, (ancestor) => ancestor.node.kind === 'FunctionDeclaration'));
          const inLoop = Boolean(
            findAncestor(path, (ancestor) => ancestor.node.kind === 'ForStatement' || ancestor.node.kind === 'WhileStatement'),
          );

          this.astVaripDeclarations.push({
            name,
            node,
            initializer: node.initializer,
            line,
            column,
            inFunction,
            inLoop,
          });
          this.astVaripNames.add(name);
          this.astHandledVaripLines.add(line);
        },
      },
    });
  }

  private validateVaripDeclarationsAst(): void {
    for (const declaration of this.astVaripDeclarations) {
      const { initializer, line, column, name } = declaration;

      if (!initializer) {
        this.addError(
          line,
          column,
          'Invalid varip declaration syntax. Expected: varip <type> <name> = <value>',
          'PSV6-VARIP-SYNTAX',
        );
        this.addError(line, column, 'varip declaration must include an initial value', 'PSV6-VARIP-INITIAL-VALUE');
        continue;
      }

      if (!this.isLiteralInitializer(initializer)) {
        this.addWarning(
          line,
          column,
          `varip '${name}' should be initialized with a literal value for better performance`,
          'PSV6-VARIP-LITERAL-INIT',
        );
      }

      const metadata = this.astContext?.typeEnvironment.nodeTypes.get(initializer) ?? null;
      if (!metadata || metadata.kind === 'unknown') {
        this.addWarning(
          line,
          column,
          `Could not infer type for varip '${name}'. Consider explicit type declaration`,
          'PSV6-VARIP-TYPE-INFERENCE',
        );
      }

      if (name.length < 3) {
        this.addWarning(line, column, `varip '${name}' should have a more descriptive name`, 'PSV6-VARIP-NAMING');
      }

      if (!/^(intrabar|bar|count|state|flag|persist)/i.test(name)) {
        this.addInfo(
          line,
          column,
          `Consider using descriptive prefixes like 'intrabar_' or 'bar_' for varip variables`,
          'PSV6-VARIP-NAMING-SUGGESTION',
        );
      }
    }
  }

  private validateVaripScopeAst(): void {
    for (const declaration of this.astVaripDeclarations) {
      if (declaration.inFunction) {
        this.addError(
          declaration.line,
          declaration.column,
          'varip declarations are not allowed inside functions',
          'PSV6-VARIP-SCOPE-FUNCTION',
        );
      }

      if (declaration.inLoop) {
        this.addError(
          declaration.line,
          declaration.column,
          'varip declarations are not allowed inside loops',
          'PSV6-VARIP-SCOPE-LOOP',
        );
      }
    }
  }

  private validateVaripAssignmentsAst(program: ProgramNode): void {
    visit(program, {
      AssignmentStatement: {
        enter: (path) => {
          const statement = (path as NodePath<AssignmentStatementNode>).node;
          const left = statement.left;

          if (left.kind !== 'Identifier') {
            return;
          }

          const identifier = left as IdentifierNode;
          const name = identifier.name;
          if (!this.astVaripNames.has(name)) {
            return;
          }

          const { line, column } = identifier.loc.start;
          const operatorInfo = this.resolveAssignmentOperator(statement, left);
          const operator = operatorInfo?.operator ?? '=';

          if (operator !== ':=') {
            const siteKey = `${line}:${name}`;
            if (!this.astAssignmentErrorSites.has(siteKey)) {
              this.astAssignmentErrorSites.add(siteKey);
              this.addError(line, column, `varip '${name}' should use ':=' for assignment, not '${operator}'`, 'PSV6-VARIP-ASSIGNMENT');
            }
            return;
          }

          if (this.assignmentHasBarstateGuard(path as NodePath<AssignmentStatementNode>, statement)) {
            return;
          }

          const warningKey = `${line}:${name}`;
          if (this.astBarstateWarningSites.has(warningKey)) {
            return;
          }

          this.astBarstateWarningSites.add(warningKey);
          this.addWarning(
            line,
            column,
            `varip '${name}' modification should consider barstate conditions for proper intrabar behavior`,
            'PSV6-VARIP-BARSTATE',
          );
        },
      },
    });
  }

  private assignmentHasBarstateGuard(
    path: NodePath<AssignmentStatementNode>,
    statement: AssignmentStatementNode,
  ): boolean {
    if (statement.right && this.expressionContainsBarstateGuard(statement.right)) {
      return true;
    }

    let current: NodePath | null = path.parent;
    while (current) {
      if (current.node.kind === 'IfStatement') {
        const ifNode = current.node as IfStatementNode;
        if (this.expressionContainsBarstateGuard(ifNode.test)) {
          return true;
        }
      }
      current = current.parent;
    }

    const rawLine = this.context.rawLines?.[statement.loc.start.line - 1] ?? '';
    if (this.lineHasBarstateGuard(rawLine)) {
      return true;
    }

    const source = this.getNodeSource(statement);
    return this.lineHasBarstateGuard(source);
  }

  private expressionContainsBarstateGuard(expression: ExpressionNode): boolean {
    let found = false;
    visit(expression, {
      MemberExpression: {
        enter: (memberPath) => {
          if (found) {
            return false;
          }

          const member = (memberPath as NodePath<MemberExpressionNode>).node;
          if (member.computed || member.object.kind !== 'Identifier') {
            return;
          }

          const objectIdentifier = member.object as IdentifierNode;
          if (objectIdentifier.name !== 'barstate') {
            return;
          }

          const property = member.property as IdentifierNode;
          if (property.name === 'isconfirmed' || property.name === 'isnew') {
            found = true;
            return false;
          }
        },
      },
    });
    return found;
  }

  private lineHasBarstateGuard(line: string): boolean {
    return line.includes('barstate.isconfirmed') || line.includes('barstate.isnew');
  }

  private validateVaripPerformanceAst(): void {
    const varipCount = this.astVaripDeclarations.length;

    if (varipCount > 10) {
      this.addWarning(
        1,
        1,
        `High number of varip variables (${varipCount}). Consider if all are necessary for performance`,
        'PSV6-VARIP-PERFORMANCE',
      );
    }

    if (this.context.scriptType === 'strategy' && varipCount > 5) {
      this.addWarning(
        1,
        1,
        'Strategy scripts should minimize varip usage for better backtesting accuracy',
        'PSV6-VARIP-STRATEGY',
      );
    }
  }

  private validateVaripSyntaxFallbackAst(): void {
    const handledLines = this.astHandledVaripLines;

    for (let index = 0; index < this.context.cleanLines.length; index++) {
      const lineNumber = index + 1;
      if (handledLines.has(lineNumber)) {
        continue;
      }

      const line = this.context.cleanLines[index] ?? '';
      if (!/^\s*varip\b/.test(line)) {
        continue;
      }

      const hasValidTypedDeclaration = /^\s*varip\s+[A-Za-z_][A-Za-z0-9_]*\s+[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line);
      const hasValidUntypedDeclaration = /^\s*varip\s+[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line);

      if (hasValidTypedDeclaration || hasValidUntypedDeclaration) {
        continue;
      }

      this.addError(
        lineNumber,
        1,
        'Invalid varip declaration syntax. Expected: varip <type> <name> = <value>',
        'PSV6-VARIP-SYNTAX',
      );

      if (!line.includes('=')) {
        this.addError(lineNumber, 1, 'varip declaration must include an initial value', 'PSV6-VARIP-INITIAL-VALUE');
      }
    }
  }

  private validateWithLegacyHeuristics(): void {
    this.validateVaripDeclarationsLegacy();
    this.validateVaripUsageLegacy();
    this.validateVaripScopeLegacy();
    this.validateVaripPerformanceLegacy();
  }

  private validateVaripDeclarationsLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      if (!/^\s*varip\s*/.test(line)) {
        continue;
      }

      const typedMatch = line.match(/^\s*varip\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (typedMatch) {
        const varName = typedMatch[1];
        const initialValue = typedMatch[2];
        this.validateVaripSyntaxLegacy(line, lineNum);
        this.validateVaripTypeLegacy(varName, initialValue, lineNum);
        this.validateVaripNamingLegacy(varName, lineNum);
        continue;
      }

      const untypedMatch = line.match(/^\s*varip\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (untypedMatch) {
        const varName = untypedMatch[1];
        const initialValue = untypedMatch[2];
        this.validateVaripSyntaxLegacy(line, lineNum);
        this.validateVaripTypeLegacy(varName, initialValue, lineNum);
        this.validateVaripNamingLegacy(varName, lineNum);
        continue;
      }

      this.validateVaripSyntaxLegacy(line, lineNum);
    }
  }

  private validateVaripUsageLegacy(): void {
    const varipVariables = new Set<string>();

    for (const line of this.context.cleanLines) {
      const match = line.match(/^\s*varip\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (match) {
        varipVariables.add(match[1]);
        continue;
      }

      const untypedMatch = line.match(/^\s*varip\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (untypedMatch) {
        varipVariables.add(untypedMatch[1]);
      }
    }

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      for (const varName of varipVariables) {
        if (!line.includes(varName)) {
          continue;
        }

        if (/^\s*varip\s+/.test(line)) {
          continue;
        }

        if (line.includes(varName) && line.includes(':=')) {
          if (!line.includes('barstate.isconfirmed') && !line.includes('barstate.isnew')) {
            this.addWarning(
              lineNum,
              1,
              `varip '${varName}' modification should consider barstate conditions for proper intrabar behavior`,
              'PSV6-VARIP-BARSTATE',
            );
          }
        }

        if (line.includes(varName) && line.includes('=') && !/^\s*varip\s+/.test(line)) {
          const lineWithoutComments = line.replace(/\/\/.*$/, '').trim();
          const hasCompoundAssignment = lineWithoutComments.includes(':=');
          const assignmentPattern = new RegExp(`^\\s*${varName}\\s*=\\s*`);

          if (assignmentPattern.test(lineWithoutComments) && !hasCompoundAssignment) {
            this.addError(lineNum, 1, `varip '${varName}' should use ':=' for assignment, not '='`, 'PSV6-VARIP-ASSIGNMENT');
          }
        }
      }
    }
  }

  private validateVaripScopeLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      if (!line.includes('varip')) {
        continue;
      }

      if (this.isInsideFunctionLegacy(i)) {
        this.addError(lineNum, 1, 'varip declarations are not allowed inside functions', 'PSV6-VARIP-SCOPE-FUNCTION');
      }

      if (this.isInsideLoopLegacy(i)) {
        this.addError(lineNum, 1, 'varip declarations are not allowed inside loops', 'PSV6-VARIP-SCOPE-LOOP');
      }
    }
  }

  private validateVaripPerformanceLegacy(): void {
    const varipCount = this.countVaripDeclarationsLegacy();

    if (varipCount > 10) {
      this.addWarning(
        1,
        1,
        `High number of varip variables (${varipCount}). Consider if all are necessary for performance`,
        'PSV6-VARIP-PERFORMANCE',
      );
    }

    if (this.isStrategyScriptLegacy() && varipCount > 5) {
      this.addWarning(
        1,
        1,
        'Strategy scripts should minimize varip usage for better backtesting accuracy',
        'PSV6-VARIP-STRATEGY',
      );
    }
  }

  private validateVaripSyntaxLegacy(line: string, lineNum: number): void {
    if (!/^\s*varip\s+[A-Za-z_][A-Za-z0-9_]*\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*/.test(line)) {
      this.addError(
        lineNum,
        1,
        'Invalid varip declaration syntax. Expected: varip <type> <name> = <value>',
        'PSV6-VARIP-SYNTAX',
      );
    }

    if (!line.includes('=')) {
      this.addError(lineNum, 1, 'varip declaration must include an initial value', 'PSV6-VARIP-INITIAL-VALUE');
    }
  }

  private validateVaripTypeLegacy(varName: string, initialValue: string, lineNum: number): void {
    if (!this.isLiteralValueLegacy(initialValue)) {
      this.addWarning(
        lineNum,
        1,
        `varip '${varName}' should be initialized with a literal value for better performance`,
        'PSV6-VARIP-LITERAL-INIT',
      );
    }

    const inferredType = this.inferTypeFromValueLegacy(initialValue);
    if (inferredType === 'unknown') {
      this.addWarning(
        lineNum,
        1,
        `Could not infer type for varip '${varName}'. Consider explicit type declaration`,
        'PSV6-VARIP-TYPE-INFERENCE',
      );
    }
  }

  private validateVaripNamingLegacy(varName: string, lineNum: number): void {
    if (varName.length < 3) {
      this.addWarning(lineNum, 1, `varip '${varName}' should have a more descriptive name`, 'PSV6-VARIP-NAMING');
    }

    if (!/^(intrabar|bar|count|state|flag|persist)/i.test(varName)) {
      this.addInfo(
        lineNum,
        1,
        `Consider using descriptive prefixes like 'intrabar_' or 'bar_' for varip variables`,
        'PSV6-VARIP-NAMING-SUGGESTION',
      );
    }
  }

  private isInsideFunctionLegacy(lineIndex: number): boolean {
    let functionDepth = 0;

    for (let i = 0; i <= lineIndex; i++) {
      const line = this.context.cleanLines[i];
      if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*=>/.test(line)) {
        functionDepth++;
      }

      if (i === lineIndex) {
        return functionDepth > 0;
      }
    }

    return false;
  }

  private isInsideLoopLegacy(lineIndex: number): boolean {
    let loopDepth = 0;

    for (let i = 0; i <= lineIndex; i++) {
      const line = this.context.cleanLines[i];

      if (/^\s*for\s+\w+\s*=\s*\d+\s+to\s+\d+/.test(line) || /^\s*while\s+/.test(line)) {
        loopDepth++;
      }

      if (i === lineIndex) {
        return loopDepth > 0;
      }
    }

    return false;
  }

  private countVaripDeclarationsLegacy(): number {
    return this.context.cleanLines.filter((line) => /^\s*varip\s+/.test(line)).length;
  }

  private isStrategyScriptLegacy(): boolean {
    return this.context.cleanLines.some((line) => /^\s*strategy\s*\(/.test(line));
  }

  private isLiteralValueLegacy(value: string): boolean {
    const trimmed = value.trim();

    if (/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/.test(trimmed)) {
      return true;
    }

    if (trimmed === 'true' || trimmed === 'false') {
      return true;
    }

    if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'$/.test(trimmed)) {
      return true;
    }

    if (trimmed === 'na') {
      return true;
    }

    return false;
  }

  private inferTypeFromValueLegacy(value: string): string {
    const trimmed = value.trim();

    if (/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/.test(trimmed)) {
      return trimmed.includes('.') || /[eE]/.test(trimmed) ? 'float' : 'int';
    }

    if (trimmed === 'true' || trimmed === 'false') {
      return 'bool';
    }

    if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'$/.test(trimmed)) {
      return 'string';
    }

    if (trimmed === 'na') {
      return 'unknown';
    }

    return 'unknown';
  }

  private resolveAssignmentOperator(
    statement: AssignmentStatementNode,
    left: ExpressionNode,
  ): { operator: AssignmentOperator; rhs: string } | null {
    const rawLine = this.context.rawLines?.[statement.loc.start.line - 1] ?? '';
    const fromLine = this.resolveAssignmentOperatorFromLine(rawLine, left.loc.end.column);
    if (fromLine) {
      return fromLine;
    }

    const source = this.getNodeSource(statement);
    const match = source.match(/(:=|\+=|-=|\*=|\/=|%=|=)/);
    if (!match || match.index === undefined) {
      return null;
    }

    const operator = match[1] as AssignmentOperator;
    const rhs = source.slice(match.index + match[1].length);
    return { operator, rhs };
  }

  private resolveAssignmentOperatorFromLine(
    line: string,
    expressionEndColumn: number,
  ): { operator: AssignmentOperator; rhs: string } | null {
    if (!line) {
      return null;
    }

    const sliceStart = Math.max(0, Math.min(line.length, expressionEndColumn - 1));
    const afterLeft = line.slice(sliceStart);
    const match = afterLeft.match(/^(\s*)(:=|\+=|-=|\*=|\/=|%=|=)/);
    if (!match) {
      return null;
    }

    const operator = match[2] as AssignmentOperator;
    const rhs = afterLeft.slice(match[0].length);
    return { operator, rhs };
  }

  private isLiteralInitializer(initializer: ExpressionNode): boolean {
    switch (initializer.kind) {
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
        return true;
      default:
        return false;
    }
  }

  private getNodeSource(node: { loc: { start: { line: number; column: number }; end: { line: number; column: number } } }): string {
    const lines = this.context.rawLines ?? this.context.lines ?? [];
    const startLineIndex = Math.max(0, node.loc.start.line - 1);
    const endLineIndex = Math.max(0, node.loc.end.line - 1);

    if (startLineIndex === endLineIndex) {
      const line = lines[startLineIndex] ?? '';
      return line.slice(node.loc.start.column - 1, Math.max(node.loc.start.column - 1, node.loc.end.column - 1));
    }

    const parts: string[] = [];
    const firstLine = lines[startLineIndex] ?? '';
    parts.push(firstLine.slice(node.loc.start.column - 1));

    for (let index = startLineIndex + 1; index < endLineIndex; index++) {
      parts.push(lines[index] ?? '');
    }

    const lastLine = lines[endLineIndex] ?? '';
    parts.push(lastLine.slice(0, Math.max(0, node.loc.end.column - 1)));
    return parts.join('\n');
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }

    return 'ast' in this.context ? (this.context as AstValidationContext) : null;
  }
}
