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
import {
  VERSION_RE,
  SCRIPT_START_RE,
  QUALIFIED_FN_RE,
  METHOD_DECL_RE,
  VAR_DECL_RE,
  VAR_REASSIGN_RE,
  COMPOUND_ASSIGN_RE,
  ELEM_REASSIGN_RE,
  ELEM_COMPOUND_RE,
  SIMPLE_ASSIGN_RE,
  TUPLE_DECL_RE,
  TUPLE_REASSIGN_RE,
  KEYWORDS,
  NAMESPACES,
  PSEUDO_VARS,
  WILDCARD_IDENT,
  IDENT,
} from '../core/constants';
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

export class SyntaxValidator implements ValidationModule {
  name = 'SyntaxValidator';

  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;
    this.astContext = this.getAstContext(context, config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.validateWithAst(this.astContext.ast);
    } else {
      this.validateWithLegacy();
    }

    this.validateOverallStructure();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: context.typeMap,
      scriptType: context.scriptType,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.usingAst = false;
  }

  private validateWithAst(program: ProgramNode): void {
    this.validateVersionDirectivesAst(program.directives);
    this.validateScriptDeclarationsAst(program.body);

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
      this.addWarning(line, column, 'Version directive should be on the first line.', 'PSW01');
    }

    if (primary.version < 5) {
      this.addWarning(line, column, `Pine version ${primary.version} is deprecated. Prefer v5 or v6.`, 'PSW02');
    }

    for (const duplicate of duplicates) {
      this.addError(
        duplicate.loc.start.line,
        duplicate.loc.start.column,
        'Multiple //@version directives. Only one allowed.',
        'PS002',
      );
    }
  }

  private validateScriptDeclarationsAst(body: ProgramNode['body']): void {
    const scriptDeclarations = body.filter(
      (statement): statement is ScriptDeclarationNode => statement.kind === 'ScriptDeclaration',
    );

    if (scriptDeclarations.length === 0) {
      return;
    }

    const [primary, ...duplicates] = scriptDeclarations;
    this.context.scriptType = primary.scriptType;

    const firstReal = this.context.cleanLines.findIndex((line) => line.trim() && !VERSION_RE.test(line));
    if (firstReal > -1 && !this.hasScriptDeclStartingAtOrSoon(this.context, firstReal)) {
      this.addInfo(
        firstReal + 1,
        1,
        'Consider placing the script declaration at the top for clarity.',
        'PSI01',
      );
    }

    for (const duplicate of duplicates) {
      if (duplicate.scriptType !== primary.scriptType) {
        this.addError(
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
    this.addError(
      node.loc.start.line,
      node.loc.start.column,
      `${label} name '${invalid}' conflicts with a Pine keyword.`,
      'PS006',
    );
  }

  private validateVariableDeclarationAst(node: VariableDeclarationNode): void {
    const name = node.identifier.name;
    if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
      this.addError(
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

    const operator = this.getAssignmentOperator(assignment);
    const left = assignment.left;

    if (left.kind === 'TupleExpression') {
      this.validateTupleAssignmentAst(assignment, operator ?? '');
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
        this.addError(
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
        this.addError(
          assignment.loc.start.line,
          assignment.loc.start.column,
          `Variable '${baseName}' not declared before ':=' on element.`,
          'PS016A',
        );
      } else if (operator && operator.length === 2 && operator.endsWith('=')) {
        const op = operator[0];
        this.addError(
          assignment.loc.start.line,
          assignment.loc.start.column,
          `Variable '${baseName}' not declared before '${op}=' on element.`,
          'PS017A',
        );
      }
    }
  }

  private validateTupleAssignmentAst(assignment: AssignmentStatementNode, operator: string): void {
    const tuple = assignment.left as TupleExpressionNode;
    if (operator.includes(':=')) {
      this.addError(
        assignment.loc.start.line,
        assignment.loc.start.column,
        'Tuple destructuring must use "=" (not ":=").',
        'PST03',
      );
    }

    const hasEmptySlot = tuple.elements.some((element) => element == null);
    if (hasEmptySlot) {
      this.addWarning(
        assignment.loc.start.line,
        tuple.loc.start.column,
        'Empty slot in destructuring tuple.',
        'PST02',
      );
    }
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
      this.addWarning(node.loc.start.line, node.loc.start.column, message, 'PSO01');
    }
  }

  private validateUnaryOperatorAst(node: UnaryExpressionNode): void {
    const operator = node.operator;
    if (operator === '!') {
      this.addWarning(
        node.loc.start.line,
        node.loc.start.column,
        "Operator '!' is not valid in Pine. Use 'not'.",
        'PSO01',
      );
      return;
    }

    if (operator === '++' || operator === '--' || operator === '~') {
      this.addWarning(
        node.loc.start.line,
        node.loc.start.column,
        `Operator '${operator}' is not valid in Pine Script.`,
        'PSO01',
      );
    }
  }

  private validateWithLegacy(): void {
    this.validateVersionDirectiveLegacy();
    this.validateScriptDeclarationLegacy();

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      this.validateLineLegacy(line, lineNum);
    }
  }

  private validateVersionDirectiveLegacy(): void {
    if (!this.context.hasVersion) {
      return;
    }

    const versionLine = this.context.firstVersionLine;
    if (versionLine && versionLine !== 1) {
      const sourceLines = this.context.rawLines?.length ? this.context.rawLines : this.context.cleanLines;
      const onlyCommentsAbove = sourceLines.slice(0, versionLine - 1).every((raw) => {
        const trimmed = (raw || '').trim();
        if (trimmed === '') return true;
        if (/^\/{2}/.test(trimmed)) return true;
        if (/^\/\*/.test(trimmed) || /^\*/.test(trimmed) || /^\*\//.test(trimmed)) return true;
        return false;
      });

      if (!onlyCommentsAbove) {
        this.addWarning(versionLine, 1, 'Version directive should be on the first line.', 'PSW01');
      }
    }
  }

  private validateScriptDeclarationLegacy(): void {
    if (!this.context.scriptType) {
      return;
    }

    const firstReal = this.context.cleanLines.findIndex((line) => line.trim() && !VERSION_RE.test(line));
    if (firstReal > -1 && !this.hasScriptDeclStartingAtOrSoon(this.context, firstReal)) {
      this.addInfo(
        firstReal + 1,
        1,
        'Consider placing the script declaration at the top for clarity.',
        'PSI01',
      );
    }
  }

  private validateLineLegacy(line: string, lineNum: number): void {
    const t = line.trim();
    if (t === '') return;

    const noStrings = this.stripStringsAndLineComment(line);

    if (VERSION_RE.test(line)) {
      this.validateVersionLineLegacy(line, lineNum);
      return;
    }

    if (SCRIPT_START_RE.test(line)) {
      this.validateScriptDeclLineLegacy(line, lineNum);
      return;
    }

    if (QUALIFIED_FN_RE.test(line) || METHOD_DECL_RE.test(line)) {
      this.validateFunctionDeclarationLegacy(line, lineNum);
    }

    if (VAR_DECL_RE.test(line)) {
      this.validateVariableDeclarationLegacy(line, lineNum);
    }

    if (VAR_REASSIGN_RE.test(line)) {
      this.validateReassignmentLegacy(line, lineNum);
    }

    if (COMPOUND_ASSIGN_RE.test(line)) {
      this.validateCompoundAssignmentLegacy(line, lineNum);
    }

    if (ELEM_REASSIGN_RE.test(noStrings)) {
      this.validateElementReassignmentLegacy(line, lineNum);
    }

    if (ELEM_COMPOUND_RE.test(noStrings)) {
      this.validateElementCompoundAssignmentLegacy(line, lineNum);
    }

    if (TUPLE_DECL_RE.test(line)) {
      this.validateTupleDeclarationLegacy(line, lineNum);
    }

    if (TUPLE_REASSIGN_RE.test(noStrings)) {
      this.validateTupleReassignmentLegacy(noStrings, lineNum);
    }

    this.validateFieldAssignmentOperatorsLegacy(line, lineNum);
    this.validateOperatorsLegacy(line, lineNum, noStrings);
    this.validateHistoryReferencesLegacy(noStrings, lineNum);
    this.validateNAComparisonsLegacy(noStrings, lineNum);
  }

  private validateVersionLineLegacy(line: string, lineNum: number): void {
    const m = line.match(VERSION_RE);
    if (!m) {
      return;
    }

    const v = parseInt(m[1], 10);
    if (this.context.firstVersionLine === null) {
      if (this.config.targetVersion && v !== this.config.targetVersion) {
        const sev = v < this.config.targetVersion ? 'error' : 'warning';
        this.addBySeverity(
          sev,
          lineNum,
          1,
          `Script declares //@version=${v} but targetVersion is ${this.config.targetVersion}.`,
          'PS001',
        );
      }
      if (v < 5) {
        this.addWarning(lineNum, 1, `Pine version ${v} is deprecated. Prefer v5 or v6.`, 'PSW02');
      }
    } else if (lineNum !== this.context.firstVersionLine) {
      this.addError(lineNum, 1, 'Multiple //@version directives. Only one allowed.', 'PS002');
    }
  }

  private validateScriptDeclLineLegacy(line: string, lineNum: number): void {
    const m = line.match(SCRIPT_START_RE);
    if (m) {
      const scriptType = m[1] as 'indicator' | 'strategy' | 'library';
      if (this.context.scriptType && this.context.scriptType !== scriptType) {
        this.addError(
          lineNum,
          1,
          `Multiple script declarations not allowed (already '${this.context.scriptType}').`,
          'PS004B',
        );
      }
    }
  }

  private validateFunctionDeclarationLegacy(line: string, lineNum: number): void {
    const funcMatch = line.match(QUALIFIED_FN_RE);
    const methMatch = line.match(METHOD_DECL_RE);

    if (funcMatch) {
      const name = funcMatch[1];
      if (KEYWORDS.has(name)) {
        this.addError(lineNum, line.indexOf(name) + 1, `Function name '${name}' conflicts with a Pine keyword.`, 'PS006');
      }
    } else if (methMatch) {
      const name = methMatch[1];
      if (KEYWORDS.has(name)) {
        this.addError(lineNum, line.indexOf(name) + 1, `Method name '${name}' conflicts with a Pine keyword.`, 'PS006');
      }
    }
  }

  private validateVariableDeclarationLegacy(line: string, lineNum: number): void {
    const decl = line.match(VAR_DECL_RE);
    if (decl) {
      const name = decl[1];
      if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
        this.addError(
          lineNum,
          line.indexOf(name) + 1,
          `Identifier '${name}' conflicts with a Pine keyword/builtin.`,
          'PS007',
        );
      }
    }
  }

  private validateReassignmentLegacy(line: string, lineNum: number): void {
    const m = line.match(VAR_REASSIGN_RE);
    if (!m) {
      return;
    }

    const varName = m[1];
    const udtFieldMatch = line.match(/^\s*this\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*/);
    if (udtFieldMatch) {
      return;
    }

    if (this.isMethodParameterLegacy(varName, lineNum)) {
      return;
    }

    const column = line.indexOf(varName) + 1;
    const nextChar = line[column - 1 + varName.length];
    const prevChar = column > 1 ? line[column - 2] : '';
    if (nextChar === '.' || prevChar === '.') {
      return;
    }

    if (!this.context.declaredVars.has(varName)) {
      this.addError(
        lineNum,
        column,
        `Variable '${varName}' not declared before ':='. Use '=' on first assignment.`,
        'PS016',
      );
    }
  }

  private validateCompoundAssignmentLegacy(line: string, lineNum: number): void {
    const comp = line.match(COMPOUND_ASSIGN_RE);
    if (comp) {
      const name = comp[1];
      if (!this.context.declaredVars.has(name)) {
        this.addError(
          lineNum,
          line.indexOf(name) + 1,
          `Variable '${name}' not declared before '${comp[2]}='. Use '=' for first assignment or declare it.`,
          'PS017',
        );
      }
    }
  }

  private validateElementReassignmentLegacy(line: string, lineNum: number): void {
    const elemReassign = this.stripStringsAndLineComment(line).match(ELEM_REASSIGN_RE);
    if (!elemReassign) {
      return;
    }

    const base = elemReassign[1];
    if (!this.context.declaredVars.has(base)) {
      this.addError(
        lineNum,
        line.indexOf(base) + 1,
        `Variable '${base}' not declared before ':=' on element.`,
        'PS016A',
      );
    }
  }

  private validateElementCompoundAssignmentLegacy(line: string, lineNum: number): void {
    const elemCompound = this.stripStringsAndLineComment(line).match(ELEM_COMPOUND_RE);
    if (!elemCompound) {
      return;
    }

    const base = elemCompound[1];
    const op = elemCompound[2];
    if (!this.context.declaredVars.has(base)) {
      this.addError(
        lineNum,
        line.indexOf(base) + 1,
        `Variable '${base}' not declared before '${op}=' on element.`,
        'PS017A',
      );
    }
  }

  private validateTupleDeclarationLegacy(line: string, lineNum: number): void {
    const tupleMatch = line.match(TUPLE_DECL_RE);
    if (!tupleMatch) {
      return;
    }

    const content = tupleMatch[1];
    if (/^\s*,|,\s*,|,\s*$/.test(content)) {
      this.addWarning(lineNum, line.indexOf('[') + 1, 'Empty slot in destructuring tuple.', 'PST02');
    }
  }

  private validateTupleReassignmentLegacy(noStrings: string, lineNum: number): void {
    if (TUPLE_REASSIGN_RE.test(noStrings)) {
      this.addError(lineNum, 1, 'Tuple destructuring must use "=" (not ":=").', 'PST03');
    }
  }

  private validateFieldAssignmentOperatorsLegacy(line: string, lineNum: number): void {
    const stripped = this.stripStrings(line);
    const fieldAssignRe = /\b((?:this)|[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?![=>])/g;
    const declaredVars = this.context.declaredVars ?? new Map<string, number>();
    let match: RegExpExecArray | null;

    while ((match = fieldAssignRe.exec(stripped)) !== null) {
      const base = match[1];
      const field = match[2];

      if (NAMESPACES.has(base) || KEYWORDS.has(base) || KEYWORDS.has(`${base}.${field}`)) {
        continue;
      }

      if (base !== 'this' && !declaredVars.has(base)) {
        continue;
      }

      const eqOffset = match[0].indexOf('=');
      const column = match.index + eqOffset + 1;

      this.addError(
        lineNum,
        column,
        `Use ':=' to assign to '${base}.${field}'. '=' is reserved for the first assignment.`,
        'PS016',
      );
    }
  }

  private validateOperatorsLegacy(line: string, lineNum: number, noStrings: string): void {
    const invalidOps = ['===', '!==', '++', '--', '^', '~'];
    for (const op of invalidOps) {
      let from = 0;
      while (true) {
        const idx = noStrings.indexOf(op, from);
        if (idx === -1) break;
        this.addWarning(lineNum, idx + 1, `Operator '${op}' is not valid in Pine Script.`, 'PSO01');
        from = idx + op.length;
      }
    }

    const logicalOps = ['&&', '||'];
    for (const op of logicalOps) {
      let from = 0;
      while (true) {
        const idx = noStrings.indexOf(op, from);
        if (idx === -1) break;
        this.addWarning(lineNum, idx + 1, `Operator '${op}' is not valid in Pine Script. Use 'and'/'or' instead.`, 'PSO01');
        from = idx + op.length;
      }
    }

    const bangScan = noStrings.replace(/!=/g, '  ');
    let p = bangScan.indexOf('!');
    while (p !== -1) {
      this.addWarning(lineNum, p + 1, "Operator '!' is not valid in Pine. Use 'not'.", 'PSO01');
      p = bangScan.indexOf('!', p + 1);
    }
  }

  private validateHistoryReferencesLegacy(noStrings: string, lineNum: number): void {
    const negHist = noStrings.match(/\[\s*-\d+\s*\]/);
    if (negHist) {
      this.addError(lineNum, (negHist.index ?? 0) + 1, 'Invalid history reference: negative indexes are not allowed.', 'PS024');
    }
  }

  private validateNAComparisonsLegacy(noStrings: string, lineNum: number): void {
    if (/(\bna\s*[!=]=)|([!=]=\s*na\b)/.test(noStrings)) {
      this.addWarning(
        lineNum,
        1,
        "Direct comparison with 'na' is unreliable. Use na(x), e.g., na(myValue).",
        'PS023',
        'Replace `x == na` with `na(x)` and `x != na` with `not na(x)`.',
      );
    }
  }

  private validateOverallStructure(): void {
    const hasContent = this.context.cleanLines.some((line) => line.trim() !== '');
    if (!hasContent) {
      this.addError(1, 1, 'Script is empty.', 'PS-EMPTY');
    }
  }

  private hasScriptDeclStartingAtOrSoon(context: ValidationContext, idx: number, lookahead = 6): boolean {
    for (let i = idx; i < Math.min(idx + lookahead, context.cleanLines.length); i++) {
      if (SCRIPT_START_RE.test(context.cleanLines[i])) return true;
      if (context.cleanLines[i].trim() && !/^[('"\s,)]/.test(context.cleanLines[i])) break;
    }
    return false;
  }

  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }

  private parseParameterList(params: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < params.length; i++) {
      const char = params[i];

      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  private extractParameterName(param: string): string {
    const match = param.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    return match ? match[1] : param.trim();
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  private isMethodParameterLegacy(varName: string, lineNum: number): boolean {
    for (let i = lineNum - 1; i >= 0; i--) {
      const line = this.context.cleanLines[i];

      const methodMatch = line.match(/^\s*method\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/);
      if (methodMatch) {
        const params = methodMatch[2];
        const paramList = this.parseParameterList(params);
        for (const param of paramList) {
          const paramName = this.extractParameterName(param);
          if (paramName === varName) {
            return true;
          }
        }

        if (varName === 'this') {
          return true;
        }
      }

      const currentIndent = this.getLineIndentation(line);
      const nextLineIndent = i < this.context.cleanLines.length - 1 ?
        this.getLineIndentation(this.context.cleanLines[i + 1]) : 0;

      if (currentIndent === 0 && nextLineIndent > 0) {
        break;
      }
    }

    return false;
  }

  private onlyCommentsAbove(line: number): boolean {
    const sourceLines = this.context.rawLines?.length ? this.context.rawLines : this.context.cleanLines;
    return sourceLines.slice(0, Math.max(0, line - 1)).every((raw) => {
      const trimmed = (raw || '').trim();
      if (trimmed === '') return true;
      if (/^\/{2}/.test(trimmed)) return true;
      if (/^\/\*/.test(trimmed) || /^\*/.test(trimmed) || /^\*\//.test(trimmed)) return true;
      return false;
    });
  }

  private isMethodDeclaration(node: FunctionDeclarationNode): boolean {
    const line = this.getLine(node.loc.start.line);
    return line.trimStart().startsWith('method ');
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

  private getAssignmentOperator(node: AssignmentStatementNode): string | null {
    const startLine = node.loc.start.line;
    const endLine = node.loc.end.line;
    if (startLine !== endLine) {
      return null;
    }

    const line = this.getLine(startLine);
    if (!line) {
      return null;
    }

    const leftEnd = node.left.loc?.end?.column ?? node.loc.start.column;
    const rightStart = node.right?.loc?.start?.column ?? node.loc.end.column;
    const slice = line.slice(Math.max(0, leftEnd - 1), Math.max(0, rightStart - 1));
    return slice.replace(/\s+/g, '');
  }

  private getLine(lineNumber: number): string {
    const lines = this.context.rawLines?.length ? this.context.rawLines : this.context.lines ?? [];
    return lines[lineNumber - 1] ?? '';
  }

  private addError(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private addBySeverity(
    severity: 'error' | 'warning',
    line: number,
    column: number,
    message: string,
    code: string,
  ): void {
    if (severity === 'error') {
      this.addError(line, column, message, code);
    } else {
      this.addWarning(line, column, message, code);
    }
  }

  private getAstContext(
    context: ValidationContext,
    config: ValidatorConfig,
  ): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(context) && context.ast ? context : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
