import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
  type TypeInfo,
} from '../core/types';
import {
  type ArgumentNode,
  type AssignmentStatementNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ProgramNode,
  type VariableDeclarationNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';

interface Call {
  fn: string;
  line: number;
  column: number;
  args: string[];
}

export class PolylineFunctionsValidator implements ValidationModule {
  name = 'PolylineFunctionsValidator';
  priority = 86;

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  private calls: Call[] = [];
  private idVars: Set<string> = new Set();
  private typeMapUpdates: Map<string, TypeInfo> = new Map();

  getDependencies(): string[] {
    return ['FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;

    this.astContext = this.getAstContext(config);

    if (this.astContext?.ast) {
      this.collectPolylineDataFromAst(this.astContext.ast);
    } else {
      context.cleanLines.forEach((line, i) => this.scanLine(line, i + 1));
    }

    // best practices
    this.checkBestPractices();
    this.checkTooManyOperations();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: this.typeMapUpdates,
      scriptType: null
    };
  }

  private reset() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.calls = [];
    this.idVars.clear();
    this.typeMapUpdates.clear();
  }

  private collectPolylineDataFromAst(program: ProgramNode): void {
    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          this.registerAstPolylineDeclaration(path.node as VariableDeclarationNode);
        },
      },
      AssignmentStatement: {
        enter: (path) => {
          this.registerAstPolylineAssignment(path.node as AssignmentStatementNode);
        },
      },
      CallExpression: {
        enter: (path) => {
          this.processAstCall(path.node as CallExpressionNode);
        },
      },
    });
  }

  private processAstCall(call: CallExpressionNode): void {
    if (call.callee.kind !== 'MemberExpression') {
      return;
    }

    const member = call.callee as MemberExpressionNode;
    if (member.computed || !this.isPolylineMember(member)) {
      return;
    }

    const functionName = member.property.name;
    const args = call.args.map((argument) => this.getArgumentText(argument));
    const line = member.property.loc.start.line;
    const column = member.property.loc.start.column;

    this.calls.push({ fn: functionName, line, column, args });

    this.validateCall(functionName, args, line, column);
  }

  private registerAstPolylineDeclaration(declaration: VariableDeclarationNode): void {
    if (!declaration.initializer || declaration.initializer.kind !== 'CallExpression') {
      return;
    }

    const call = declaration.initializer as CallExpressionNode;
    if (!this.isPolylineNewCall(call)) {
      return;
    }

    this.registerPolylineIdentifier(declaration.identifier);
  }

  private registerAstPolylineAssignment(assignment: AssignmentStatementNode): void {
    if (!assignment.right || assignment.right.kind !== 'CallExpression') {
      return;
    }

    const call = assignment.right as CallExpressionNode;
    if (!this.isPolylineNewCall(call)) {
      return;
    }

    const identifier = this.extractAssignedIdentifier(assignment.left);
    if (!identifier) {
      return;
    }

    this.registerPolylineIdentifier(identifier);
  }

  private registerPolylineIdentifier(identifier: IdentifierNode): void {
    const name = identifier.name;
    if (!name) {
      return;
    }

    this.idVars.add(name);

    const line = identifier.loc?.start.line ?? 1;
    const column = identifier.loc?.start.column ?? 1;

    const typeInfo: TypeInfo = {
      type: 'unknown',
      isConst: false,
      isSeries: false,
      declaredAt: { line, column },
      usages: [],
    };

    this.typeMapUpdates.set(name, typeInfo);
    if (this.context.typeMap) {
      this.context.typeMap.set(name, typeInfo);
    }
  }

  private isPolylineMember(member: MemberExpressionNode): boolean {
    if (member.computed) {
      return false;
    }
    return this.isPolylineIdentifier(member.object);
  }

  private isPolylineIdentifier(expression: ExpressionNode): boolean {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name === 'polyline';
    }
    return false;
  }

  private isPolylineNewCall(call: CallExpressionNode): boolean {
    if (call.callee.kind !== 'MemberExpression') {
      return false;
    }

    const member = call.callee as MemberExpressionNode;
    return !member.computed && this.isPolylineIdentifier(member.object) && member.property.name === 'new';
  }

  private extractAssignedIdentifier(expression: ExpressionNode): IdentifierNode | null {
    if (expression.kind === 'Identifier') {
      return expression as IdentifierNode;
    }
    return null;
  }

  private scanLine(line: string, lineNum: number) {
    const re = /\bpolyline\.(\w+)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const fn = m[1];
      const openIdx = m.index + m[0].length - 1;
      const argsStr = this.extractBalanced(line, openIdx) ?? '';
      const args = this.splitArgs(argsStr);
      const col = m.index + 1;
      this.calls.push({ fn, line: lineNum, column: col, args });
      this.validateCall(fn, args, lineNum, col);
    }

    // Track variables assigned from polyline.new/copy so we can validate IDs later
    try {
      const assignNew = line.match(/^\s*(?:var\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(:=|=)\s*polyline\.new\s*\(/);
      if (assignNew) {
        this.idVars.add(assignNew[1]);
        this.typeMapUpdates.set(assignNew[1], {
          type: 'unknown',
          isConst: false,
          isSeries: false,
          declaredAt: { line: lineNum, column: 1 },
          usages: []
        });
      }
    } catch {}
  }

  private validateCall(fn: string, args: string[], line: number, column: number) {
    switch (fn) {
      case 'new':
        if (args.length < 1) {
          this.addError(line, column, 'polyline.new requires points array parameter', 'PSV6-POLYLINE-NEW-PARAMS');
          return;
        }
        if (!this.isArrayArg(args[0])) {
          this.addWarning(line, column, 'polyline.new points should be an array', 'PSV6-POLYLINE-NEW-POINTS-TYPE');
        } else {
          // Heuristic: points should be an array of line references
          const pointsCheck = this.isPointsArrayOfLines(args[0]);
          if (!pointsCheck.ok) {
            this.addWarning(line, column, pointsCheck.message, pointsCheck.code);
          }
        }
        // optional style,color,width
        this.addInfo(line, column, 'Polyline created', 'PSV6-POLYLINE-NEW-INFO');
        break;
      case 'delete':
        if (args.length < 1) {
          this.addError(line, column, 'polyline.delete requires (id)', 'PSV6-POLYLINE-DELETE-PARAMS');
          return;
        }
        this.validateIdArg(args[0], line, column);
        if (args[0].trim() === 'na') {
          this.addError(line, column, 'polyline id cannot be na', 'PSV6-POLYLINE-ID-NA');
        } else if (this.isEmptyString(args[0])) {
          this.addWarning(line, column, 'Empty string id is suspicious', 'PSV6-POLYLINE-ID-STRING');
        } else {
          this.addInfo(line, column, 'Polyline deleted', 'PSV6-POLYLINE-DELETE-INFO');
        }
        break;
    }
    // Complexity hint for nested expressions in arguments
    if (args.some(a => this.isComplex(a))) {
      this.addWarning(line, column, 'Complex polyline expression', 'PSV6-POLYLINE-COMPLEXITY');
    }
  }

  private checkBestPractices() {
    const hasNew = this.calls.some(c => c.fn === 'new');
    const hasDelete = this.calls.some(c => c.fn === 'delete');
    if (hasNew && hasDelete) {
      this.addInfo(1, 1, 'Good polyline lifecycle management (create/delete)', 'PSV6-POLYLINE-BEST-PRACTICE');
    } else if (hasNew && !hasDelete) {
      this.addInfo(1, 1, 'Consider deleting polylines to free resources', 'PSV6-POLYLINE-MEMORY-SUGGESTION');
    }
  }

  private checkTooManyOperations() {
    const count = this.calls.length;
    if (count > 12) {
      this.addWarning(1, 1, 'Many polyline operations detected', 'PSV6-POLYLINE-PERF-MANY-CALLS');
    }
    const newCount = this.calls.filter(c => c.fn === 'new').length;
    if (newCount > 50) {
      this.addError(1, 1, 'Polyline object limit exceeded', 'PSV6-POLYLINE-LIMIT-EXCEEDED');
    }
  }

  // utils
  private extractBalanced(line: string, open: number): string | null {
    let depth = 0, inStr = false; let q = '';
    for (let i = open; i < line.length; i++) {
      const ch = line[i];
      if (!inStr && (ch === '"' || ch === '\'')) { inStr = true; q = ch; }
      else if (inStr && ch === q) { inStr = false; q = ''; }
      else if (!inStr) {
        if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth === 0) return line.substring(open + 1, i); }
      }
    }
    return null;
  }
  private splitArgs(s: string): string[] {
    if (!s.trim()) return [];
    const out: string[] = []; let cur = ''; let d = 0; let inStr = false; let q = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (!inStr && (ch === '"' || ch === '\'')) { inStr = true; q = ch; cur += ch; continue; }
      if (inStr) { cur += ch; if (ch === q) { inStr = false; q = ''; } continue; }
      if (ch === '(') { d++; cur += ch; continue; }
      if (ch === ')') { d--; cur += ch; continue; }
      if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  private num(s: string): number | null { const m = s.trim().match(/^[+\-]?\d+(\.\d+)?$/); return m ? parseFloat(m[0]) : null; }
  private isArrayArg(s: string): boolean {
    const t = s.trim();
    // Heuristics: accept identifiers (actual type may be provided by ArrayValidator later)
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) return true;
    return /\barray\./.test(t) || /^\[.*\]$/.test(t);
  }
  private isPointsArrayOfLines(s: string): { ok: boolean; message: string; code: string } {
    const t = s.trim();
    // Clearly OK cases
    if (/\barray\.new\s*<\s*line\s*>/i.test(t)) return { ok: true, message: '', code: '' };
    if (/\barray\.from\s*\(/.test(t) && /\bline\./.test(t)) return { ok: true, message: '', code: '' };
    if (/^\[.*\]$/.test(t) && /\bline\./.test(t)) return { ok: true, message: '', code: '' };
    // Unknown variable or expression — don't flag hard, but suggest
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) return { ok: true, message: '', code: '' };
    // Looks like an array, but not of line references
    if (/^\[.*\]$/.test(t) || /\barray\./.test(t)) {
      return { ok: false, message: 'points should be an array of line references', code: 'PSV6-POLYLINE-POINTS-CONTENT-TYPE' };
    }
    return { ok: true, message: '', code: '' };
  }
  private validateIdArg(s: string, line: number, column: number) {
    const t = s.trim();
    if (t === 'na') return;
    if (/^\s*polyline\.new\s*\(/.test(t)) return;
    // If simple identifier but not seen before, warn (soft check)
    const m = t.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
    if (m && !this.idVars.has(m[0])) {
      this.addWarning(line, column, 'Unknown polyline id reference', 'PSV6-POLYLINE-ID-UNKNOWN');
    }
  }
  private isColor(s: string): boolean { const t = s.trim(); return t.startsWith('color.') || t.startsWith('#') || t.startsWith('rgb'); }
  private isEmptyString(s: string): boolean { const t = s.trim(); return t === '""' || t === "''"; }
  private isComplex(s: string): boolean { const t = s.trim(); return /\bta\./.test(t) || /\(/.test(t) || /\+|\-|\*|\//.test(t); }

  private addError(line: number, column: number, message: string, code: string) {
    this.errors.push({ line, column, message, code, severity: 'error' });
  }
  private addWarning(line: number, column: number, message: string, code: string) {
    this.warnings.push({ line, column, message, code, severity: 'warning' });
  }
  private addInfo(line: number, column: number, message: string, code: string) {
    this.info.push({ line, column, message, code, severity: 'info' });
  }

  private getArgumentText(argument: ArgumentNode): string {
    const valueText = this.getExpressionText(argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
  }

  private getExpressionText(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'Identifier':
        return (expression as IdentifierNode).name;
      case 'CallExpression':
        return this.getNodeSource(expression);
      case 'MemberExpression': {
        const member = expression as MemberExpressionNode;
        if (member.computed) {
          return this.getNodeSource(member);
        }
        const objectText = this.getExpressionText(member.object);
        return `${objectText}.${member.property.name}`;
      }
      default:
        return this.getNodeSource(expression);
    }
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode | CallExpressionNode | MemberExpressionNode): string {
    const lines = this.context.lines ?? [];
    if (!node.loc) {
      return '';
    }
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
    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
