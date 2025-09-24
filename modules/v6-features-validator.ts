/**
 * Pine Script v6 features validator
 *
 * Historically this module offered lightweight heuristics for the new
 * language features introduced in Pine Script v6 by scanning raw source
 * lines.  Most responsibilities have since migrated to dedicated
 * validators that operate on the shared AST and semantic context.  The
 * remaining logic focuses on compatibility guidance that is still unique
 * to this module while keeping the legacy scanner available as a fallback
 * when AST analysis is not available.
 */

import {
  type ValidationModule,
  type ValidationContext,
  type ValidationResult,
  type ValidatorConfig,
  type AstValidationContext,
} from '../core/types';
import {
  type ProgramNode,
  type SwitchStatementNode,
  type SwitchCaseNode,
  type ExpressionNode,
  type VariableDeclarationNode,
  type TypeDeclarationNode,
  type EnumDeclarationNode,
  type CallExpressionNode,
  type ArgumentNode,
  type MemberExpressionNode,
  type IdentifierNode,
  type IndexExpressionNode,
} from '../core/ast/nodes';
import { visit } from '../core/ast/traversal';
import { KEYWORDS, NAMESPACES } from '../core/constants';
import type { TypeEnvironment, TypeMetadata } from '../core/ast/types';

interface DiagnosticEntry {
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly code: string;
}

function isAstContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}

const TEXT_FORMAT_FUNCTIONS = new Set(['format_bold', 'format_italic', 'format_color', 'format_size']);
const REQUEST_INFO_FUNCTIONS = new Set(['dividends', 'earnings', 'splits']);

export class V6FeaturesValidator implements ValidationModule {
  name = 'V6FeaturesValidator';

  private errors: DiagnosticEntry[] = [];
  private warnings: DiagnosticEntry[] = [];
  private info: DiagnosticEntry[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private astTypeEnvironment: TypeEnvironment | null = null;

  getDependencies(): string[] {
    return ['SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    if (config.targetVersion !== 6) {
      return this.buildResult();
    }

    if (isAstContext(context) && context.ast) {
      this.astContext = context;
      this.astTypeEnvironment = context.typeEnvironment;
      this.validateWithAst(context.ast);
    } else {
      this.validateLegacy();
    }

    return this.buildResult();
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.astContext = null;
    this.astTypeEnvironment = null;
  }

  private buildResult(): ValidationResult {
    const toValidationError = (entry: DiagnosticEntry, severity: 'error' | 'warning' | 'info') => ({
      ...entry,
      severity,
    });

    return {
      isValid: this.errors.length === 0,
      errors: this.errors.map((entry) => toValidationError(entry, 'error')),
      warnings: this.warnings.map((entry) => toValidationError(entry, 'warning')),
      info: this.info.map((entry) => toValidationError(entry, 'info')),
      typeMap: this.context.typeMap,
      scriptType: this.context.scriptType,
    };
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

  private validateWithAst(program: ProgramNode | null): void {
    if (!program) {
      this.validateLegacy();
      return;
    }

    visit(program, {
      SwitchStatement: {
        enter: (path) => this.processSwitchStatement(path.node as SwitchStatementNode),
      },
      VariableDeclaration: {
        enter: (path) => this.processVariableDeclaration(path.node as VariableDeclarationNode),
      },
      TypeDeclaration: {
        enter: (path) => this.processTypeDeclaration(path.node as TypeDeclarationNode),
      },
      EnumDeclaration: {
        enter: (path) => this.processEnumDeclaration(path.node as EnumDeclarationNode),
      },
      CallExpression: {
        enter: (path) => this.processCallExpression(path.node as CallExpressionNode),
      },
      IndexExpression: {
        enter: (path) => this.processIndexExpression(path.node as IndexExpressionNode),
      },
    });
  }

  private processSwitchStatement(node: SwitchStatementNode): void {
    const { line, column } = node.loc.start;
    const switchType = this.getExpressionType(node.discriminant);

    if (node.cases.length === 0) {
      this.addWarning(line, column, 'Switch statement requires at least one case clause.', 'PSV6-SWITCH-NO-CASES');
    }

    let defaultEncountered = false;
    for (const switchCase of node.cases) {
      const { line: caseLine, column: caseColumn } = switchCase.loc.start;

      if (switchCase.test === null) {
        if (!switchCase.consequent.length) {
          this.addError(caseLine, caseColumn, 'Default clause requires a result expression.', 'PSV6-SWITCH-DEFAULT-RESULT');
        }

        if (defaultEncountered) {
          this.addError(caseLine, caseColumn, 'Switch statement can only have one default clause.', 'PSV6-SWITCH-MULTIPLE-DEFAULT');
        }

        defaultEncountered = true;
        continue;
      }

      if (!switchCase.consequent.length) {
        this.addError(caseLine, caseColumn, 'Case clause requires a result expression.', 'PSV6-SWITCH-CASE-RESULT');
      }

      const caseType = this.getExpressionType(switchCase.test);
      if (switchType && caseType && switchType !== caseType) {
        this.addWarning(
          caseLine,
          caseColumn,
          `Case value type '${caseType}' may not be compatible with switch expression type '${switchType}'.`,
          'PSV6-SWITCH-TYPE-MISMATCH',
        );
      }
    }

    if (!defaultEncountered) {
      this.addInfo(line, column, 'Consider adding a default clause to handle unexpected values.', 'PSV6-SWITCH-NO-DEFAULT');
    }
  }

  private processVariableDeclaration(node: VariableDeclarationNode): void {
    if (node.declarationKind === 'varip' && this.context.scriptType === 'library') {
      const { line, column } = node.identifier.loc.start;
      this.addError(line, column, 'varip variables are not allowed in libraries.', 'PSV6-VARIP-LIBRARY');
    }
  }

  private processTypeDeclaration(node: TypeDeclarationNode): void {
    const typeName = node.identifier.name;
    if (KEYWORDS.has(typeName) || NAMESPACES.has(typeName)) {
      const { line, column } = node.identifier.loc.start;
      this.addError(line, column, `Type name '${typeName}' conflicts with a built-in keyword or type.`, 'PSV6-UDT-CONFLICT');
    }
  }

  private processEnumDeclaration(node: EnumDeclarationNode): void {
    const enumName = node.identifier.name;
    if (KEYWORDS.has(enumName) || NAMESPACES.has(enumName)) {
      const { line, column } = node.identifier.loc.start;
      this.addError(line, column, `Enum name '${enumName}' conflicts with a built-in keyword or type.`, 'PSV6-ENUM-CONFLICT');
    }
  }

  private processCallExpression(node: CallExpressionNode): void {
    const path = this.getMemberPath(node.callee);
    if (!path || path.length === 0) {
      return;
    }

    const namespace = path[0];
    const member = path[1] ?? null;
    const { line, column } = node.loc.start;

    if (namespace === 'request' && member === 'security') {
      if (this.hasDynamicSeriesArgument(node.args)) {
        this.addInfo(
          line,
          column,
          'Dynamic data requests with series string arguments are supported in v6.',
          'PSV6-DYNAMIC-REQUEST',
        );
      }
    } else if (namespace === 'request' && member && REQUEST_INFO_FUNCTIONS.has(member)) {
      this.addInfo(line, column, `request.${member} is available in Pine Script v6.`, 'PSV6-REQUEST-FUNCTION');
    }

    if (namespace === 'text' && member && TEXT_FORMAT_FUNCTIONS.has(member)) {
      const functionName = `text.${member}`;
      this.addInfo(line, column, `${functionName} is available in Pine Script v6 for text formatting.`, 'PSV6-TEXT-FORMAT');

      if ((member === 'format_bold' || member === 'format_italic') && !this.firstArgumentIsString(node.args)) {
        this.addWarning(line, column, `${functionName} requires a string argument.`, 'PSV6-TEXT-FORMAT-STRING');
      }

      if (member === 'format_color' && !this.hasColorArgument(node.args)) {
        this.addWarning(line, column, `${functionName} requires a color argument.`, 'PSV6-TEXT-FORMAT-COLOR');
      }
    }
  }

  private processIndexExpression(node: IndexExpressionNode): void {
    if (node.index.kind === 'NumberLiteral' && node.index.value === 0) {
      const { line, column } = node.index.loc.start;
      this.addInfo(
        line,
        column,
        'History reference [0] is equivalent to the current value.',
        'PSV6-HISTORY-ZERO',
      );
    }
  }

  private hasDynamicSeriesArgument(args: ArgumentNode[]): boolean {
    return args.some((arg) => {
      const path = this.getMemberPath(arg.value);
      if (!path || path.length < 2) {
        return false;
      }

      return (
        (path[0] === 'timeframe' && path[1] === 'period') ||
        (path[0] === 'syminfo' && path[1] === 'tickerid')
      );
    });
  }

  private firstArgumentIsString(args: ArgumentNode[]): boolean {
    if (args.length === 0) {
      return false;
    }

    return this.isStringExpression(args[0].value);
  }

  private hasColorArgument(args: ArgumentNode[]): boolean {
    if (args.length < 2) {
      return false;
    }

    return this.isColorExpression(args[1].value);
  }

  private getMemberPath(expression: ExpressionNode): string[] | null {
    if (expression.kind === 'Identifier') {
      return [(expression as IdentifierNode).name];
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }

      const objectPath = this.getMemberPath(member.object);
      if (!objectPath) {
        return null;
      }

      return [...objectPath, member.property.name];
    }

    return null;
  }

  private isStringExpression(expression: ExpressionNode): boolean {
    const type = this.getExpressionType(expression);
    if (type === 'string') {
      return true;
    }

    return expression.kind === 'StringLiteral';
  }

  private isColorExpression(expression: ExpressionNode): boolean {
    const type = this.getExpressionType(expression);
    if (type === 'color') {
      return true;
    }

    if (expression.kind === 'MemberExpression') {
      const path = this.getMemberPath(expression);
      return !!path && path[0] === 'color';
    }

    if (expression.kind === 'CallExpression') {
      const path = this.getMemberPath((expression as CallExpressionNode).callee);
      return !!path && path[0] === 'color';
    }

    return false;
  }

  private getExpressionType(expression: ExpressionNode): string | null {
    if (this.astTypeEnvironment) {
      const metadata = this.astTypeEnvironment.nodeTypes.get(expression);
      const described = this.describeTypeMetadata(metadata);
      if (described && described !== 'unknown') {
        return described;
      }

      if (expression.kind === 'Identifier') {
        const identifier = expression as IdentifierNode;
        const identifierMetadata = this.astTypeEnvironment.identifiers.get(identifier.name);
        const identifierType = this.describeTypeMetadata(identifierMetadata);
        if (identifierType && identifierType !== 'unknown') {
          return identifierType;
        }
      }
    }

    return this.inferLiteralType(expression);
  }

  private describeTypeMetadata(metadata: TypeMetadata | null | undefined): string | null {
    return metadata ? metadata.kind : null;
  }

  private inferLiteralType(expression: ExpressionNode): string | null {
    switch (expression.kind) {
      case 'NumberLiteral':
        return Number.isInteger((expression as any).value) ? 'int' : 'float';
      case 'BooleanLiteral':
        return 'bool';
      case 'StringLiteral':
        return 'string';
      default:
        return null;
    }
  }

  // Legacy fallback implementation -------------------------------------------------------------

  private validateLegacy(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      const noStrings = this.stripStringsAndLineComment(line);

      this.validateSwitchStatementLegacy(line, lineNum);
      this.validateVaripDeclarationLegacy(line, lineNum);
      this.validateUDTDeclarationLegacy(line, lineNum);
      this.validateDynamicRequestsLegacy(line, lineNum, noStrings);
      this.validateTextFormattingLegacy(line, lineNum, noStrings);
      this.validateEnumDeclarationLegacy(line, lineNum);
      this.validateWhileLoopLegacy(line, lineNum);
      this.validateHistoryReferencingLegacy(noStrings, lineNum);
    }
  }

  private validateSwitchStatementLegacy(line: string, lineNum: number): void {
    const switchMatch = line.match(/^\s*switch\s+(.+)$/);
    if (switchMatch) {
      const expression = switchMatch[1].trim();

      if (!expression) {
        this.addError(lineNum, 1, 'Switch statement requires an expression.', 'PSV6-SWITCH-EXPR');
        return;
      }

      this.validateSwitchCasesLegacy(lineNum, expression);
    }
  }

  private validateSwitchCasesLegacy(switchLine: number, switchExpression: string): void {
    let foundDefault = false;
    let caseCount = 0;
    const switchIndent = this.getLineIndentation(this.context.cleanLines[switchLine - 1]);

    for (let i = switchLine; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);

      if (i > switchLine && lineIndent <= switchIndent && line.trim() !== '') {
        break;
      }

      if (line.trim() === '') {
        continue;
      }

      const caseMatch = line.match(/^\s*([^=]+)\s*=>\s*(.+)$/);
      if (caseMatch) {
        caseCount++;
        const caseValue = caseMatch[1].trim();
        const caseResult = caseMatch[2].trim();

        this.validateCaseTypeCompatibilityLegacy(caseValue, switchExpression, i + 1);

        if (!caseResult) {
          this.addError(i + 1, 1, 'Case clause requires a result expression.', 'PSV6-SWITCH-CASE-RESULT');
        }
        continue;
      }

      const defaultMatch = line.match(/^\s*=>\s*(.+)$/);
      if (defaultMatch) {
        if (foundDefault) {
          this.addError(i + 1, 1, 'Switch statement can only have one default clause.', 'PSV6-SWITCH-MULTIPLE-DEFAULT');
        }
        foundDefault = true;
        const defaultResult = defaultMatch[1].trim();

        if (!defaultResult) {
          this.addError(i + 1, 1, 'Default clause requires a result expression.', 'PSV6-SWITCH-DEFAULT-RESULT');
        }
        continue;
      }

      if (line.trim() !== '') {
        this.addError(i + 1, 1, 'Invalid syntax in switch statement. Expected case or default clause.', 'PSV6-SWITCH-INVALID-SYNTAX');
      }
    }

    if (caseCount === 0) {
      this.addWarning(switchLine, 1, 'Switch statement requires at least one case clause.', 'PSV6-SWITCH-NO-CASES');
    }

    if (!foundDefault) {
      this.addInfo(switchLine, 1, 'Consider adding a default clause to handle unexpected values.', 'PSV6-SWITCH-NO-DEFAULT');
    }
  }

  private validateCaseTypeCompatibilityLegacy(caseValue: string, switchExpression: string, lineNum: number): void {
    const caseType = this.inferTypeLegacy(caseValue);
    const switchType = this.inferTypeLegacy(switchExpression);

    if (caseType !== switchType && caseType !== 'unknown' && switchType !== 'unknown') {
      this.addWarning(lineNum, 1, `Case value type '${caseType}' may not be compatible with switch expression type '${switchType}'.`, 'PSV6-SWITCH-TYPE-MISMATCH');
    }
  }

  private validateVaripDeclarationLegacy(line: string, lineNum: number): void {
    const varipMatch = line.match(/^\s*varip\s+(.+)$/);
    if (varipMatch) {
      const declaration = varipMatch[1].trim();

      if (!declaration.includes('=')) {
        this.addError(lineNum, 1, 'varip declaration requires an initial value assignment.', 'PSV6-VARIP-NO-INIT');
        return;
      }

      if (this.context.scriptType === 'library') {
        this.addError(lineNum, 1, 'varip variables are not allowed in libraries.', 'PSV6-VARIP-LIBRARY');
      }

      this.addInfo(lineNum, 1, 'varip variables maintain state within bars and may impact performance.', 'PSV6-VARIP-PERFORMANCE');

      this.validateVaripUsagePatternsLegacy(lineNum);
    }
  }

  private validateVaripUsagePatternsLegacy(varipLine: number): void {
    const varipIndent = this.getLineIndentation(this.context.cleanLines[varipLine - 1]);

    for (let i = varipLine; i < Math.min(varipLine + 10, this.context.cleanLines.length); i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);

      if (lineIndent <= varipIndent && line.trim() !== '') {
        break;
      }

      if (line.includes('barstate.isconfirmed')) {
        this.addInfo(
          i + 1,
          1,
          'Consider using barstate.isconfirmed to reset varip variables on confirmed bars.',
          'PSV6-VARIP-CONFIRMED',
        );
        break;
      }
    }
  }

  private validateUDTDeclarationLegacy(line: string, lineNum: number): void {
    const udtMatch = line.match(/^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (udtMatch) {
      const typeName = udtMatch[1];

      if (KEYWORDS.has(typeName) || NAMESPACES.has(typeName)) {
        this.addError(lineNum, line.indexOf(typeName) + 1, `Type name '${typeName}' conflicts with a built-in keyword or type.`, 'PSV6-UDT-CONFLICT');
      }

      this.validateUDTFieldsLegacy(lineNum, typeName);
    }
  }

  private validateUDTFieldsLegacy(udtLine: number, typeName: string): void {
    const udtIndent = this.getLineIndentation(this.context.cleanLines[udtLine - 1]);
    const fields: string[] = [];

    for (let i = udtLine; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);

      if (i > udtLine && lineIndent <= udtIndent && line.trim() !== '') {
        break;
      }

      const fieldMatch = line.match(/^\s+(int|float|bool|string|color)\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (fieldMatch) {
        const fieldType = fieldMatch[1];
        const fieldName = fieldMatch[2];

        if (fields.includes(fieldName)) {
          this.addError(i + 1, line.indexOf(fieldName) + 1, `Duplicate field name '${fieldName}' in type '${typeName}'.`, 'PSV6-UDT-DUPLICATE-FIELD');
        } else {
          fields.push(fieldName);
        }

        if (!['int', 'float', 'bool', 'string', 'color'].includes(fieldType)) {
          this.addError(i + 1, line.indexOf(fieldType) + 1, `Invalid field type '${fieldType}' in UDT. Only basic types are allowed.`, 'PSV6-UDT-INVALID-TYPE');
        }
      }
    }

    if (fields.length === 0) {
      this.addWarning(udtLine, 1, `Type '${typeName}' should have at least one field.`, 'PSV6-UDT-NO-FIELDS');
    }
  }

  private validateDynamicRequestsLegacy(line: string, lineNum: number, noStrings: string): void {
    const requestMatch = noStrings.match(/request\.security\s*\(([^)]+)\)/);
    if (requestMatch) {
      const args = requestMatch[1];

      if (args.includes('timeframe.period') || args.includes('syminfo.tickerid')) {
        this.addInfo(lineNum, 1, 'Dynamic data requests with series string arguments are supported in v6.', 'PSV6-DYNAMIC-REQUEST');
      }

      this.validateRequestParametersLegacy(args, lineNum);
    }

    for (const func of REQUEST_INFO_FUNCTIONS) {
      if (noStrings.includes(`request.${func}`)) {
        this.addInfo(lineNum, 1, `request.${func} is available in Pine Script v6.`, 'PSV6-REQUEST-FUNCTION');
      }
    }
  }

  private validateRequestParametersLegacy(args: string, lineNum: number): void {
    const params = args.split(',').map((p) => p.trim());

    if (params.length < 3) {
      this.addError(lineNum, 1, 'request.security requires at least 3 parameters: symbol, timeframe, expression.', 'PSV6-REQUEST-PARAMS');
    }
  }

  private validateTextFormattingLegacy(line: string, lineNum: number, noStrings: string): void {
    for (const func of TEXT_FORMAT_FUNCTIONS) {
      if (noStrings.includes(`text.${func}`)) {
        const functionName = `text.${func}`;
        this.addInfo(lineNum, 1, `${functionName} is available in Pine Script v6 for text formatting.`, 'PSV6-TEXT-FORMAT');

        if ((func === 'format_bold' || func === 'format_italic') && !line.includes('"') && !line.includes("'")) {
          this.addWarning(lineNum, 1, `${functionName} requires a string argument.`, 'PSV6-TEXT-FORMAT-STRING');
        }

        if (func === 'format_color' && !line.includes('color.')) {
          this.addWarning(lineNum, 1, `${functionName} requires a color argument.`, 'PSV6-TEXT-FORMAT-COLOR');
        }
      }
    }
  }

  private validateEnumDeclarationLegacy(line: string, lineNum: number): void {
    const enumMatch = line.match(/^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (enumMatch) {
      const enumName = enumMatch[1];

      if (KEYWORDS.has(enumName) || NAMESPACES.has(enumName)) {
        this.addError(lineNum, line.indexOf(enumName) + 1, `Enum name '${enumName}' conflicts with a built-in keyword or type.`, 'PSV6-ENUM-CONFLICT');
      }

      this.validateEnumValuesLegacy(lineNum, enumName);
    }
  }

  private validateEnumValuesLegacy(enumLine: number, enumName: string): void {
    const enumIndent = this.getLineIndentation(this.context.cleanLines[enumLine - 1]);
    const values: string[] = [];

    for (let i = enumLine; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);

      if (i > enumLine && lineIndent <= enumIndent && line.trim() !== '') {
        break;
      }

      const valueMatch = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (valueMatch) {
        const value = valueMatch[1];

        if (values.includes(value)) {
          this.addError(i + 1, line.indexOf(value) + 1, `Duplicate enum value '${value}' in enum '${enumName}'.`, 'PSV6-ENUM-DUPLICATE-VALUE');
        } else {
          values.push(value);
        }
      }
    }

    if (values.length === 0) {
      this.addWarning(enumLine, 1, `Enum '${enumName}' should have at least one value.`, 'PSV6-ENUM-NO-VALUES');
    }
  }

  private validateWhileLoopLegacy(line: string, lineNum: number): void {
    const whileMatch = line.match(/^\s*while\s+(.+)$/);
    if (whileMatch) {
      const condition = whileMatch[1].trim();

      if (!condition) {
        this.addError(lineNum, 1, 'While loop requires a condition.', 'PSV6-WHILE-CONDITION');
        return;
      }

      const conditionType = this.inferTypeLegacy(condition);
      if (conditionType !== 'bool' && conditionType !== 'unknown') {
        this.addWarning(lineNum, 1, 'While loop condition should be boolean.', 'PSV6-WHILE-BOOL-CONDITION');
      }

      this.validateWhileLoopSafetyLegacy(lineNum, condition);
    }
  }

  private validateWhileLoopSafetyLegacy(whileLine: number, _condition: string): void {
    const whileIndent = this.getLineIndentation(this.context.cleanLines[whileLine - 1]);
    let foundModification = false;

    for (let i = whileLine; i < Math.min(whileLine + 20, this.context.cleanLines.length); i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);

      if (lineIndent <= whileIndent && line.trim() !== '') {
        break;
      }

      if (line.includes(':=') || line.includes('+=') || line.includes('-=')) {
        foundModification = true;
        break;
      }
    }

    if (!foundModification) {
      this.addWarning(whileLine, 1, 'While loop may be infinite if loop variable is not modified.', 'PSV6-WHILE-INFINITE');
    }
  }

  private validateHistoryReferencingLegacy(noStrings: string, lineNum: number): void {
    const historyRefs = noStrings.match(/\[(\d+)\]/g);
    if (!historyRefs) {
      return;
    }

    for (const ref of historyRefs) {
      const index = parseInt(ref.slice(1, -1), 10);

      if (index > 100) {
        this.addWarning(lineNum, this.context.cleanLines[lineNum - 1].indexOf(ref) + 1, `Large history reference [${index}] may impact performance.`, 'PSV6-HISTORY-LARGE');
      }

      if (index === 0) {
        this.addInfo(lineNum, this.context.cleanLines[lineNum - 1].indexOf(ref) + 1, 'History reference [0] is equivalent to the current value.', 'PSV6-HISTORY-ZERO');
      }
    }
  }

  private inferTypeLegacy(expression: string): string {
    const trimmed = expression.trim();

    if (/^(true|false)\b/.test(trimmed)) {
      return 'bool';
    }
    if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/.test(trimmed)) {
      return 'string';
    }
    if (/^[+\-]?\d[\d_]*(?:\.\d[\d_]*)?(?:e[+\-]?\d+)?\b/i.test(trimmed)) {
      return trimmed.includes('.') || /e[+\-]/i.test(trimmed) ? 'float' : 'int';
    }
    if (/\bcolor\.(?:\w+)\b|\bcolor\.new\s*\(/.test(trimmed)) {
      return 'color';
    }

    return 'unknown';
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (match) => ' '.repeat(match.length));
  }
}
