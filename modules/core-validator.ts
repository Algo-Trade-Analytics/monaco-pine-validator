/**
 * Core Validation Module
 * 
 * Extracts the essential validation logic from EnhancedPineScriptValidator
 * including script structure, variable declarations, function parsing, and basic syntax.
 */

import { BaseValidator } from '../core/base-validator';
import {
  AstValidationContext,
  ValidationModule,
  ValidationContext,
  ValidatorConfig,
  ValidationError,
  ValidationResult,
  ScopeInfo,
  TypeInfo,
} from '../core/types';
import {
  KEYWORDS, PSEUDO_VARS, WILDCARD_IDENT, IDENT
} from '../core/constants';

const ALLOWED_KEYWORD_IDENTIFIERS = new Set<string>();

const isReservedKeyword = (name: string): boolean =>
  KEYWORDS.has(name) && !ALLOWED_KEYWORD_IDENTIFIERS.has(name);

const isReservedPseudoVar = (name: string): boolean =>
  PSEUDO_VARS.has(name) && !ALLOWED_KEYWORD_IDENTIFIERS.has(name);

const isReservedIdentifier = (name: string): boolean =>
  isReservedKeyword(name) || isReservedPseudoVar(name);
import type {
  ArgumentNode,
  AssignmentStatementNode,
  BinaryExpressionNode,
  BlockStatementNode,
  CallExpressionNode,
  ConditionalExpressionNode,
  ExpressionNode,
  ForStatementNode,
  FunctionDeclarationNode,
  IdentifierNode,
  IfStatementNode,
  IndexExpressionNode,
  MemberExpressionNode,
  NumberLiteralNode,
  ParameterNode,
  ProgramNode,
  ScriptDeclarationNode,
  StatementNode,
  StringLiteralNode,
  TypeDeclarationNode,
  TypeReferenceNode,
  TupleExpressionNode,
  UnaryExpressionNode,
  VariableDeclarationNode,
  VersionDirectiveNode,
  WhileStatementNode,
  ReturnStatementNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import type { TypeMetadata } from '../core/ast/types';
import { getNodeSource, getSourceLine, getSourceLines } from '../core/ast/source-utils';

const PLOTTING_OR_DRAWING_CALLEES = new Set([
  'plot',
  'plotshape',
  'plotchar',
  'plotarrow',
  'plotbar',
  'plotcandle',
  'plotohlc',
  'label.new',
  'line.new',
  'linefill.new',
  'polyline.new',
  'box.new',
  'table.new',
  'table.cell',
  'bgcolor',
  'fill',
]);

const EXPENSIVE_LOOP_CALLEES = new Set([
  'request.security',
  'ta.sma',
  'ta.ema',
  'ta.rsi',
  'ta.macd',
]);

type AssignmentOperator = '=' | ':=' | '+=' | '-=' | '*=' | '/=' | '%=';

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}

export class CoreValidator implements ValidationModule {
  name = 'CoreValidator';
  priority = 100; // High priority - runs first

  // Error tracking
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];

  getDependencies(): string[] {
    return []; // Core validator has no dependencies
  }

  // Helper methods for error reporting
  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private addBySeverity(sev: 'error' | 'warning' | 'info', line: number, col: number, msg: string, code?: string, sugg?: string): void {
    if (sev === 'error') this.addError(line, col, msg, code, sugg);
    else if (sev === 'warning') this.addWarning(line, col, msg, code, sugg);
    else this.addInfo(line, col, msg, code, sugg);
  }

  private stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  }

  // Context and config
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  private hasVersion = false;
  private firstVersionLine: number | null = null;
  private scriptType: 'indicator' | 'strategy' | 'library' | null = null;
  private scriptDeclParsed = false;
  private hasStrategyCalls = false;
  private hasPlotting = false;
  private sawBrace = false;
  private sawTabIndent = false;
  private sawSpaceIndent = false;
  private astProcessedStrategyUsage = false;
  private astProcessedPlottingUsage = false;
  private astProcessedLibraryRestrictions = false;
  private astProcessedNegativeHistory = false;
  private astProcessedNumericConditions = false;
  private astProcessedLinewidthZero = false;
  private astProcessedNaComparisons = false;
  private astNaComparisonWarningLines = new Set<number>();
  private astProcessedControlFlow = false;
  private astProcessedInvalidOperators = false;
  private astProcessedFunctionDeclarations = false;
  private astProcessedAssignmentInConditions = false;
  private astProcessedExpensiveOperations = false;
  private astProcessedVariableStatements = false;
  private astProcessedIdentifierUsage = false;
  private astProcessedInputPlacement = false;
  private astProcessedHistoryReferenceDensity = false;
  private astProcessedTypeDeclarations = false;
  private astProcessedTupleDestructuring = false;
  private astStrategyUsageErrorLines = new Set<number>();

  private declared = new Map<string, number>();
  private declIndent = new Map<string, number>();
  private declaredSites = new Set<string>();
  private constNames = new Set<string>();
  private functionNames = new Set<string>();
  private methodNames = new Set<string>();
  private functionParams = new Map<string, string[]>();
  private functionHeaderLine = new Map<string, number>();
  private used = new Set<string>();
  private paramUsage = new Map<string, Set<string>>();
  private typeFields = new Map<string, Set<string>>();
  private astFunctionStack: Array<{ name: string | null; params: Set<string> }> = [];
  private astHistoryReferenceCounts = new Map<number, number>();
  private astHistoryReferenceWarnedLines = new Set<number>();
  private astReassignmentErrorSites = new Set<string>();
  private astCompoundAssignmentErrorSites = new Set<string>();
  private astThisAssignmentLines = new Set<string>();
  private astTypeFieldLines = new Set<number>();

  private scopeStack: ScopeInfo[] = [];
  private paren = 0;
  private bracket = 0;
  private brace = 0;
  private astContext: AstValidationContext | null = null;
  private astVersionDirectiveLines = new Set<number>();
  private astScriptDeclarationLines = new Set<number>();

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    if (config.ast?.mode === 'disabled') {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.astContext = this.getAstContext(config);

    const ast = this.astContext?.ast ?? null;
    if (!ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.processAstProgram(ast);
    this.analyzeSourceStructureForAst();
    this.performPostValidationChecks();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
  }

  private reset(): void {
    // Clear error/warning/info arrays
    this.errors = [];
    this.warnings = [];
    this.info = [];
    
    this.astContext = null;
    this.astVersionDirectiveLines.clear();
    this.astScriptDeclarationLines.clear();
    this.hasVersion = false;
    this.firstVersionLine = null;
    this.scriptType = null;
    this.scriptDeclParsed = false;
    this.hasStrategyCalls = false;
    this.hasPlotting = false;
    this.astProcessedStrategyUsage = false;
    this.astProcessedPlottingUsage = false;
    this.astProcessedLibraryRestrictions = false;
    this.astProcessedNegativeHistory = false;
    this.astProcessedNumericConditions = false;
    this.astProcessedLinewidthZero = false;
    this.astProcessedNaComparisons = false;
    this.astNaComparisonWarningLines.clear();
    this.astProcessedControlFlow = false;
    this.astProcessedInvalidOperators = false;
    this.astProcessedFunctionDeclarations = false;
    this.astProcessedAssignmentInConditions = false;
    this.astProcessedExpensiveOperations = false;
    this.astProcessedVariableStatements = false;
    this.astProcessedIdentifierUsage = false;
    this.astProcessedInputPlacement = false;
    this.astProcessedHistoryReferenceDensity = false;
    this.astProcessedTypeDeclarations = false;
    this.astProcessedTupleDestructuring = false;
    this.astStrategyUsageErrorLines.clear();
    this.astHistoryReferenceCounts.clear();
    this.astHistoryReferenceWarnedLines.clear();
    this.astReassignmentErrorSites.clear();
    this.astCompoundAssignmentErrorSites.clear();
    this.astThisAssignmentLines.clear();
    this.sawBrace = false;
    this.sawTabIndent = false;
    this.sawSpaceIndent = false;
    this.declared.clear();
    this.declIndent.clear();
    this.declaredSites.clear();
    this.constNames.clear();
    this.functionNames.clear();
    this.methodNames.clear();
    this.functionParams.clear();
    this.functionHeaderLine.clear();
    this.used.clear();
    this.paramUsage.clear();
    this.typeFields.clear();
    this.scopeStack = [{ indent: -1, params: new Set(), fnName: null, variables: new Set() }];
    this.paren = 0;
    this.bracket = 0;
    this.brace = 0;
    this.astFunctionStack = [];
    this.astTypeFieldLines.clear();
  }

  private processAstProgram(program: ProgramNode): void {
    this.processVersionDirectives(program.directives);
    this.processScriptDeclarations(program.body);
    this.processAstScriptSemantics(program);
  }

  private analyzeSourceStructureForAst(): void {
    const lines = getSourceLines(this.context);
    if (lines.length === 0) {
      return;
    }

    const indentLevels: number[] = [0];

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? '';
      const lineNumber = index + 1;
      const leading = line.match(/^\s*/)?.[0] ?? '';

      if (!this.sawTabIndent && /\t/.test(leading)) {
        this.sawTabIndent = true;
      }

      if (!this.sawSpaceIndent && / /.test(leading)) {
        this.sawSpaceIndent = true;
      }

      const withoutStrings = this.stripStringsAndLineComment(line);
      this.updateBracketDepths(withoutStrings, lineNumber);

      if (process.env.DEBUG_PS016 === '1' && line.includes('this')) {
        console.log('[PS016 debug] raw line', { line: lineNumber, content: line });
        console.log('[PS016 debug] stripped line', { content: withoutStrings });
      }

      const thisAssignmentMatch = withoutStrings.match(/\bthis\.(?<field>[A-Za-z_]\w*)\s*=(?!=)/);
      if (thisAssignmentMatch) {
        const field = thisAssignmentMatch.groups?.field ?? '?';
        const key = `${lineNumber}:${field}`;
        if (!this.astThisAssignmentLines.has(key)) {
          this.astThisAssignmentLines.add(key);
          const column = (thisAssignmentMatch.index ?? 0) + 1;
          if (process.env.DEBUG_PS016 === '1') {
            console.log('[PS016 debug] textual detection', { line: lineNumber, field });
          }
          this.addError(
            lineNumber,
            column,
            `Use ':=' to assign to 'this.${field}'. '=' is reserved for the first assignment.`,
            'PS016',
          );
        }
      }

      const indent = leading.length;
      const trimmed = line.trim();

      if (trimmed.length === 0) {
        continue;
      }

      const currentTop = indentLevels[indentLevels.length - 1];
      if (indent > currentTop) {
        indentLevels.push(indent);
        continue;
      }

      if (indent < currentTop) {
        while (indentLevels.length > 1 && indent < indentLevels[indentLevels.length - 1]) {
          indentLevels.pop();
        }

        if (indent !== indentLevels[indentLevels.length - 1]) {
          this.addWarning(lineNumber, 1, 'Indentation does not match previous block level.', 'PS018');
        }
      }
    }
  }

  private processAstScriptSemantics(program: ProgramNode): void {
    this.astProcessedStrategyUsage = true;
    this.astProcessedPlottingUsage = true;
    this.astProcessedLibraryRestrictions = true;
    this.astProcessedNegativeHistory = true;
    this.astProcessedNumericConditions = true;
    this.astProcessedLinewidthZero = true;
    this.astProcessedNaComparisons = true;
    this.astProcessedInvalidOperators = true;
    this.astProcessedAssignmentInConditions = true;
    this.astProcessedExpensiveOperations = true;
    this.astProcessedVariableStatements = true;
    this.astProcessedIdentifierUsage = true;
    this.astProcessedInputPlacement = true;
    this.astProcessedHistoryReferenceDensity = true;
    this.astProcessedTypeDeclarations = true;
    this.astProcessedTupleDestructuring = true;

    let loopDepth = 0;

    visit(program, {
      VariableDeclaration: {
        enter: (path) => {
          this.processAstVariableDeclaration(path as NodePath<VariableDeclarationNode>);
        },
      },
      AssignmentStatement: {
        enter: (path) => {
          this.processAstAssignmentStatement(path.node as AssignmentStatementNode);
        },
      },
      ReturnStatement: {
        enter: (path) => {
          const node = path.node as ReturnStatementNode;
          const argument = node.argument;
          if (process.env.DEBUG_PS016 === '1') {
            console.log('[PS016 debug] visiting return statement');
          }
          if (!argument) {
            return;
          }

          if (process.env.DEBUG_PS016 === '1') {
            if (argument.kind === 'BinaryExpression') {
              const binary = argument as BinaryExpressionNode;
              console.log('[PS016 debug] return binary', {
                operator: binary.operator,
                leftKind: binary.left.kind,
              });
            } else {
              console.log('[PS016 debug] return argument kind', argument.kind);
            }
          }

          if (argument.kind !== 'BinaryExpression') {
            return;
          }

          const binary = argument as BinaryExpressionNode;
          if (!this.isAssignmentOperator(binary.operator)) {
            return;
          }

          const left = binary.left;
          const line = binary.loc.start.line;
          const column = left.loc.start.column;
          this.processAstAssignment(left, binary.operator, binary.right, line, column, null);
        },
      },
      CallExpression: {
        enter: (path) => {
          const node = path.node as CallExpressionNode;
          this.processAstCallExpression(node);
          if (loopDepth > 0) {
            this.processAstLoopPerformanceCall(node);
          }
          this.processAstInputPlacement(path as NodePath<CallExpressionNode>);
        },
      },
      IndexExpression: {
        enter: (path) => {
          this.processAstIndexExpression(path.node as IndexExpressionNode);
        },
      },
      MemberExpression: {
        enter: (path) => {
          this.processAstMemberExpression(path as NodePath<MemberExpressionNode>);
        },
      },
      IfStatement: {
        enter: (path) => {
          const test = (path.node as IfStatementNode).test;
          this.processAstConditionalTest(test);
          this.processAstAssignmentInConditionalTest(test);
        },
      },
      WhileStatement: {
        enter: (path) => {
          loopDepth++;
          const test = (path.node as WhileStatementNode).test;
          this.processAstConditionalTest(test);
          this.processAstAssignmentInConditionalTest(test);
        },
        exit: () => {
          loopDepth = Math.max(0, loopDepth - 1);
        },
      },
      ForStatement: {
        enter: (path) => {
          loopDepth++;
          const forStatement = path.node as ForStatementNode;
          const test = forStatement.test;
          if (test) {
            this.processAstConditionalTest(test);
            this.processAstAssignmentInConditionalTest(test);
          }
        },
        exit: () => {
          loopDepth = Math.max(0, loopDepth - 1);
        },
      },
      SwitchStatement: {
        enter: () => {},
      },
      SwitchCase: {
        enter: () => {
          this.pushAstScope(new Set(), this.currentAstFunctionName());
        },
        exit: () => {
          this.popScope();
        },
      },
      ConditionalExpression: {
        enter: (path) => {
          this.processAstConditionalTest((path.node as ConditionalExpressionNode).test);
        },
      },
      BinaryExpression: {
        enter: (path) => {
          this.processAstBinaryExpression(path as NodePath<BinaryExpressionNode>);
        },
      },
      UnaryExpression: {
        enter: (path) => {
          this.processAstUnaryExpression(path.node as UnaryExpressionNode);
        },
      },
      FunctionDeclaration: {
        enter: (path) => {
          const fn = path.node as FunctionDeclarationNode;
          const paramNames = new Set(fn.params.map((param) => param.identifier.name));
          this.astFunctionStack.push({ name: fn.identifier?.name ?? null, params: paramNames });
          this.pushAstScope(paramNames, fn.identifier?.name ?? null);
          this.processAstFunctionDeclaration(fn);
          this.processAstFunctionControlFlow(fn);
        },
        exit: () => {
          this.popScope();
          this.astFunctionStack.pop();
        },
      },
      BlockStatement: {
        enter: (path) => {
          const parent = path.parent?.node;
          if (parent && parent.kind === 'FunctionDeclaration') {
            return;
          }
          this.pushAstScope(new Set(), this.currentAstFunctionName());
        },
        exit: (path) => {
          const parent = path.parent?.node;
          if (parent && parent.kind === 'FunctionDeclaration') {
            return;
          }
          this.popScope();
        },
      },
      TypeDeclaration: {
        enter: (path) => {
          this.processAstTypeDeclaration(path.node as TypeDeclarationNode);
        },
      },
      Identifier: {
        enter: (path) => {
          this.processAstIdentifier(path as NodePath<IdentifierNode>);
        },
      },
    });
  }

  private processAstVariableDeclaration(path: NodePath<VariableDeclarationNode>): void {
    if (this.isInsideTypeDeclaration(path)) {
      return;
    }

    const declaration = path.node;
    const line = declaration.loc.start.line;
    const declarationKind = declaration.declarationKind;
    const typeName = this.getTypeReferenceName(declaration.typeAnnotation);
    const loweredType = typeName ? typeName.toLowerCase() : null;

    if (
      loweredType &&
      ((declarationKind === 'var' || declarationKind === 'varip') && loweredType === 'const')
    ) {
      this.addError(line, declaration.loc.start.column, 'Invalid declaration: use either var/varip or const, not both.', 'PSD01');
    }

    if (
      loweredType &&
      declarationKind === 'const' &&
      (loweredType === 'var' || loweredType === 'varip')
    ) {
      this.addError(line, declaration.loc.start.column, 'Invalid declaration: use either var/varip or const, not both.', 'PSD01');
    }

    const identifier = declaration.identifier;
    const name = identifier.name;
    const identifierColumn = identifier.loc.start.column;
    this.handleNewVar(name, line, identifierColumn);
    const initializer = declaration.initializer;
    const initializerOperator = declaration.initializerOperator;

    if (initializer && initializerOperator === ':=') {
      this.addError(line, declaration.loc.start.column, 'Use "=" (not ":=") in declarations.', 'PSD02');
    }

    const isConst = declaration.declarationKind === 'const';
    this.registerTypeHeuristic(name, initializer ?? null, line, identifierColumn, isConst);
  }

  private isInsideTypeDeclaration(path: NodePath): boolean {
    let current: NodePath | null = path.parent;
    while (current) {
      if (current.node.kind === 'TypeDeclaration') {
        return true;
      }
      if (current.node.kind === 'Program') {
        return false;
      }
      current = current.parent;
    }
    return false;
  }

  private processAstAssignmentStatement(statement: AssignmentStatementNode): void {
    const line = statement.loc.start.line;
    const left = statement.left;
    const operator = (statement.operator as AssignmentOperator) ?? '=';
    const rhsExpression = statement.right;
    const column = left.loc.start.column;

    this.processAstAssignment(left, operator, rhsExpression, line, column, statement);
  }

  private processAstTupleDestructuring(
    statement: AssignmentStatementNode,
    tuple: TupleExpressionNode,
    operator: AssignmentOperator,
  ): void {
    const tupleLine = statement.loc.start.line;
    const tupleColumn = tuple.loc.start.column;

    if (operator !== '=') {
      this.addError(
        tupleLine,
        tupleColumn,
        `Tuple destructuring must use "=" (not '${operator}').`,
        'PST03',
      );
    }

    let hasEmptySlot = false;

    tuple.elements.forEach((element) => {
      if (this.isEmptyTupleElement(element)) {
        hasEmptySlot = true;
        return;
      }

      if (element && element.kind === 'Identifier') {
        const identifier = element as IdentifierNode;
        if (identifier.name === '_') {
          return;
        }
        this.handleNewVar(identifier.name, identifier.loc.start.line, identifier.loc.start.column);
        return;
      }

      if (element && element.kind === 'MemberExpression') {
        const member = element as MemberExpressionNode;
        this.addWarning(
          member.loc.start.line,
          member.loc.start.column,
          'Dotted names in tuple destructuring are unusual and may indicate an error.',
          'PST01',
          'Did you mean to destructure into plain identifiers (e.g., [a, b] = foo())?',
        );
        return;
      }
    });

    if (hasEmptySlot) {
      this.addWarning(tupleLine, tupleColumn, 'Empty slot in destructuring tuple.', 'PST02');
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

  private processAstCallExpression(call: CallExpressionNode): void {
    const calleePath = this.resolveCalleePath(call.callee);
    if (!calleePath || calleePath.length === 0) {
      return;
    }

    // Note: Parameter names in function calls (e.g., box.new(bgcolor=color.red))
    // are just labels for arguments and should NOT be checked for keyword conflicts.
    // Many valid parameter names (bgcolor, color, series, etc.) are also function
    // names or built-ins, but that doesn't prevent their use as parameter names.

    const root = calleePath[0];
    const fullName = calleePath.join('.');

    if (root === 'strategy') {
      if (this.scriptType === 'indicator') {
        this.addStrategyNamespaceError(call.loc.start.line, call.loc.start.column);
      }

      if (this.scriptType === 'strategy') {
        this.hasStrategyCalls = true;
      }
    }

    if (this.scriptType === 'indicator' && PLOTTING_OR_DRAWING_CALLEES.has(fullName)) {
      this.hasPlotting = true;
    }

    if (this.scriptType === 'library') {
      if (PLOTTING_OR_DRAWING_CALLEES.has(fullName)) {
        this.addError(
          call.loc.start.line,
          call.loc.start.column,
          "Plotting functions are not allowed in libraries.",
          'PS021',
        );
      }

      if (root === 'input') {
        this.addError(
          call.loc.start.line,
          call.loc.start.column,
          "Inputs aren't allowed in libraries.",
          'PS026',
        );
      }
    }

    const targetVersion = this.config.targetVersion ?? 6;
    if (targetVersion >= 6) {
      for (const argument of call.args) {
        if (!argument.name || argument.name.name !== 'linewidth') {
          continue;
        }

        const numericValue = this.extractNumericLiteral(argument.value);
        if (numericValue === null || numericValue !== 0) {
          continue;
        }

        const { line, column } = argument.value.loc.start;
        this.addError(
          line,
          column,
          "The value for 'linewidth' must be >= 1, but it was 0.",
          'PSV6-002',
        );
      }
    }

    for (const argument of call.args) {
      if (!argument.name) {
        continue;
      }

      const argName = argument.name.name;
      const valueLoc = argument.value.loc;
      const isMultiLineValue = valueLoc && valueLoc.end.line > valueLoc.start.line;

      if (isMultiLineValue && isReservedKeyword(argName)) {
        const { line, column } = argument.name.loc.start;
        this.addError(line, column, `Identifier '${argName}' conflicts with a Pine keyword/builtin.`, 'PS007');
      }
    }
  }

  private processAstTypeDeclaration(type: TypeDeclarationNode): void {
    const name = type.identifier.name;
    const typeLine = type.loc.start.line;
    const typeIndent = Math.max(0, type.loc.start.column - 1);

    this.declared.set(name, typeLine);
    this.declIndent.set(name, typeIndent);
    this.context.declaredVars.set(name, typeLine);

    const fields = new Set<string>();
    for (const field of type.fields) {
      const fieldName = field.identifier.name;
      fields.add(fieldName);
      const fieldLine = field.loc.start.line;
      const fieldIndent = Math.max(0, field.loc.start.column - 1);
      this.declared.set(fieldName, fieldLine);
      this.declIndent.set(fieldName, fieldIndent);
      this.astTypeFieldLines.add(fieldLine);
    }

    this.typeFields.set(name, fields);
  }

  private resolveCalleePath(expression: ExpressionNode): string[] | null {
    if (expression.kind === 'Identifier') {
      return [(expression as IdentifierNode).name];
    }

    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      const objectPath = this.resolveCalleePath(member.object);
      if (!objectPath) {
        return null;
      }
      return [...objectPath, member.property.name];
    }

    return null;
  }

  private processAstInputPlacement(path: NodePath<CallExpressionNode>): void {
    const calleePath = this.resolveCalleePath(path.node.callee);
    if (!calleePath || calleePath.length === 0 || calleePath[0] !== 'input') {
      return;
    }

    if (this.isAstTopLevel(path)) {
      return;
    }

    const { line, column } = path.node.loc.start;
    this.addWarning(line, column, 'Inputs should be declared at top level (global scope).', 'PS027');
  }

  private isAstTopLevel(path: NodePath): boolean {
    let current: NodePath | null = path.parent;
    while (current) {
      const { node } = current;
      switch (node.kind) {
        case 'Program':
          return true;
        case 'FunctionDeclaration':
        case 'IfStatement':
        case 'WhileStatement':
        case 'ForStatement':
        case 'SwitchStatement':
          return false;
        case 'BlockStatement':
          if (current.parent && current.parent.node.kind !== 'Program') {
            return false;
          }
          break;
        default:
          break;
      }
      current = current.parent;
    }
    return true;
  }

  private processAstIdentifier(path: NodePath<IdentifierNode>): void {
    if (this.isAstIdentifierDeclaration(path)) {
      return;
    }

    const name = path.node.name;
    if (WILDCARD_IDENT.has(name)) {
      this.used.add(name);
      return;
    }

    if (isReservedIdentifier(name)) {
      this.used.add(name);
      return;
    }

    this.used.add(name);

    const info = this.context.typeMap.get(name);
    if (info) {
      info.usages.push({ line: path.node.loc.start.line, column: path.node.loc.start.column });
    }

    this.recordAstParameterUsage(name);
  }

  private isAstIdentifierDeclaration(path: NodePath<IdentifierNode>): boolean {
    const parent = path.parent;
    if (!parent) {
      return false;
    }

    const { node } = parent;
    const key = path.key;

    if (node.kind === 'VariableDeclaration' && key === 'identifier') {
      return true;
    }

    if (node.kind === 'FunctionDeclaration' && key === 'identifier') {
      return true;
    }

    if (node.kind === 'Parameter' && key === 'identifier') {
      return true;
    }

    if (node.kind === 'ScriptDeclaration' && key === 'identifier') {
      return true;
    }

    if (node.kind === 'Argument' && key === 'name') {
      return true;
    }

    if (node.kind === 'TypeReference' && key === 'name') {
      return true;
    }

    if (node.kind === 'MemberExpression' && key === 'property') {
      const member = node as MemberExpressionNode;
      return !member.computed;
    }

    return false;
  }

  private recordAstParameterUsage(name: string): void {
    for (let index = this.astFunctionStack.length - 1; index >= 0; index--) {
      const fn = this.astFunctionStack[index];
      if (!fn.name) {
        continue;
      }
      if (!fn.params.has(name)) {
        continue;
      }
      if (!this.paramUsage.has(fn.name)) {
        this.paramUsage.set(fn.name, new Set());
      }
      this.paramUsage.get(fn.name)!.add(name);
      break;
    }
  }

  private isAstFunctionParameter(name: string): boolean {
    for (let index = this.astFunctionStack.length - 1; index >= 0; index--) {
      const fn = this.astFunctionStack[index];
      if (fn.params.has(name)) {
        return true;
      }
    }
    return false;
  }

  private processAstIndexExpression(indexExpression: IndexExpressionNode): void {
    this.recordAstHistoryReference(indexExpression);

    const indexValue = this.extractNumericLiteral(indexExpression.index);
    if (indexValue === null || indexValue >= 0) {
      return;
    }

    const location = indexExpression.index.loc.start;
    const targetVersion = this.config.targetVersion ?? 6;

    if (targetVersion < 6) {
      this.addError(
        location.line,
        location.column,
        'Invalid history reference: negative indexes are not allowed.',
        'PS024',
      );
      return;
    }

    const metadata = this.resolveExpressionType(indexExpression.object);
    const isSeries = !metadata || metadata.kind === 'series';

    if (!isSeries) {
      return;
    }

    this.addError(
      location.line,
      location.column,
      'Invalid history reference: negative indexes are not allowed for series data.',
      'PS024',
      'Use positive indices like close[1] for historical data, or array.get(myArray, -1) for arrays.',
    );
  }

  private recordAstHistoryReference(indexExpression: IndexExpressionNode): void {
    if (!this.config.enablePerformanceAnalysis) {
      return;
    }

    if (indexExpression.index.kind !== 'NumberLiteral') {
      return;
    }

    const line = indexExpression.loc.start.line;
    if (this.astHistoryReferenceWarnedLines.has(line)) {
      return;
    }

    const nextCount = (this.astHistoryReferenceCounts.get(line) ?? 0) + 1;
    this.astHistoryReferenceCounts.set(line, nextCount);

    if (nextCount <= 5) {
      return;
    }

    this.astHistoryReferenceWarnedLines.add(line);
    this.addWarning(
      line,
      1,
      'Many history references on one line may impact performance.',
      'PSP002',
    );
  }

  private processAstMemberExpression(path: NodePath<MemberExpressionNode>): void {
    const parent = path.parent;
    if (parent?.node.kind === 'BinaryExpression' && parent.key === 'left') {
      const binary = parent.node as BinaryExpressionNode;
      if (this.isThisMemberExpression(path.node) && binary.operator === '=') {
        this.addError(
          path.node.loc.start.line,
          path.node.loc.start.column,
          `Use ':=' to assign to 'this.${path.node.property.kind === 'Identifier' ? path.node.property.name : '?'}'. '=' is reserved for the first assignment.`,
          'PS016',
        );
        return;
      }
    }

    if (this.scriptType !== 'indicator') {
      return;
    }

    if (parent?.node.kind === 'CallExpression' && parent.key === 'callee') {
      return;
    }

    const memberPath = this.resolveCalleePath(path.node);
    if (!memberPath || memberPath.length === 0 || memberPath[0] !== 'strategy') {
      return;
    }

    const { line, column } = path.node.loc.start;
    this.addStrategyNamespaceError(line, column);
  }

  private processAstConditionalTest(test: ExpressionNode): void {
    const targetVersion = this.config.targetVersion ?? 6;
    if (targetVersion < 6) {
      return;
    }

    const literalValue = this.extractNumericLiteral(test);
    if (literalValue !== null) {
      const { line, column } = test.loc.start;
      this.addError(
        line,
        column,
        'Numeric literals are not implicitly converted to booleans in v6.',
        'PSV6-001',
        'Use a comparison like `if value > 0` or `if value != 0`.',
      );
      return;
    }

    if (test.kind !== 'Identifier') {
      return;
    }

    const metadata = this.resolveExpressionType(test);
    if (!metadata) {
      return;
    }

    if (metadata.kind === 'bool') {
      return;
    }

    if (metadata.kind === 'float' || metadata.kind === 'int' || metadata.kind === 'series') {
      const { line, column } = test.loc.start;
      this.addError(
        line,
        column,
        'Numeric variables are not implicitly converted to booleans in v6.',
        'PSV6-001',
        'Use a comparison like `if value > 0` or `if value != 0`.',
      );
    }
  }

  private processAstBinaryExpression(path: NodePath<BinaryExpressionNode>): void {
    const expression = path.node;

    if (this.isAssignmentOperator(expression.operator)) {
      const parent = path.parent?.node ?? null;
          if (!parent || parent.kind !== 'AssignmentStatement') {
        if (process.env.DEBUG_PS016 === '1') {
          console.log('[PS016 debug] binary expression visited');
        }
        if (process.env.DEBUG_PS016 === '1') {
          console.log('[PS016 debug] assignment binary', {
            operator: expression.operator,
            parentKind: parent?.kind ?? 'none',
            leftKind: expression.left.kind,
          });
        }
        const left = expression.left;
        const line = expression.loc.start.line;
        const column = left.loc.start.column;
        this.processAstAssignment(left, expression.operator, expression.right, line, column, null);
      }
    }

    const invalidOperatorMessage = this.getAstInvalidBinaryOperatorMessage(expression.operator);
    if (invalidOperatorMessage) {
      const { line, column } = expression.loc.start;
      this.addWarning(line, column, invalidOperatorMessage, 'PSO01');
    }

    if (expression.operator !== '==' && expression.operator !== '!=') {
      return;
    }

    // Check if either side is na (either as Identifier or NullLiteral)
    const leftIsNa = this.isIdentifierNamed(expression.left, 'na') || expression.left.kind === 'NullLiteral';
    const rightIsNa = this.isIdentifierNamed(expression.right, 'na') || expression.right.kind === 'NullLiteral';
    
    if (!leftIsNa && !rightIsNa) {
      return;
    }

    const { line, column } = expression.loc.start;
    this.astNaComparisonWarningLines.add(line);
    this.addWarning(
      line,
      column,
      "Direct comparison with 'na' is unreliable. Use na(x), e.g., na(myValue).",
      'PS023',
      'Replace `x == na` with `na(x)` and `x != na` with `not na(x)`.',
    );
  }

  private processAstUnaryExpression(expression: UnaryExpressionNode): void {
    const invalidOperatorMessage = this.getAstInvalidUnaryOperatorMessage(expression.operator);
    if (!invalidOperatorMessage) {
      return;
    }

    const { line, column } = expression.loc.start;
    this.addWarning(line, column, invalidOperatorMessage, 'PSO01');
  }

  private processAstAssignmentInConditionalTest(test: ExpressionNode): void {
    const location = this.findAssignmentInExpression(test);
    if (!location) {
      return;
    }

    this.addWarning(
      location.line,
      location.column,
      'Assignment "=" inside condition; did you mean "=="?',
      'PSO02',
    );
  }

  private findAssignmentInExpression(expression: ExpressionNode): { line: number; column: number } | null {
    let assignmentLocation: { line: number; column: number } | null = null;

    visit(expression, {
      BinaryExpression: {
        enter: ({ node }) => {
          if (assignmentLocation) {
            return false;
          }

          const binary = node as BinaryExpressionNode;
          if (binary.operator === '=') {
            assignmentLocation = { ...binary.loc.start };
            return false;
          }

          return undefined;
        },
      },
    });

    return assignmentLocation;
  }

  private isAssignmentOperator(operator: string): operator is AssignmentOperator {
    return (
      operator === '=' ||
      operator === ':=' ||
      operator === '+=' ||
      operator === '-=' ||
      operator === '*=' ||
      operator === '/=' ||
      operator === '%='
    );
  }

  private processAstAssignment(
    left: ExpressionNode,
    operator: AssignmentOperator,
    rhsExpression: ExpressionNode | null,
    line: number,
    column: number,
    statement: AssignmentStatementNode | null,
  ): void {
    if (process.env.DEBUG_PS016 === '1') {
      console.log('[PS016 debug] processAstAssignment', {
        leftKind: left.kind,
        operator,
        line,
        column,
      });
    }

    if (left.kind === 'TupleExpression' && statement) {
      this.processAstTupleDestructuring(statement, left as TupleExpressionNode, operator);
      return;
    }

    if (left.kind === 'MemberExpression') {
      const member = left as MemberExpressionNode;
      if (process.env.DEBUG_PS016 === '1') {
        const objectKind = member.object.kind;
        const objectName = objectKind === 'Identifier' ? (member.object as IdentifierNode).name : 'n/a';
        const propertyName = member.property.kind === 'Identifier' ? (member.property as IdentifierNode).name : 'n/a';
        console.log('[PS016 debug] member expression', {
          objectKind,
          objectName,
          propertyKind: member.property.kind,
          propertyName,
          operator,
        });
      }
      if (this.isThisMemberExpression(member) && operator === '=') {
        this.addError(
          line,
          member.loc.start.column,
          `Use ':=' to assign to 'this.${member.property.kind === 'Identifier' ? member.property.name : '?'}'. '=' is reserved for the first assignment.`,
          'PS016',
        );
      }
      return;
    }

    if (left.kind !== 'Identifier') {
      return;
    }

    const identifier = left as IdentifierNode;
    const name = identifier.name;
    const isParameter = this.isAstFunctionParameter(name);

    if (this.constNames.has(name)) {
      this.addError(line, column, `Cannot reassign const '${name}' with '${operator}'.`, 'PS019');
      return;
    }

    if (isReservedKeyword(name)) {
      return;
    }

    if (operator === ':=') {
      if (!this.declared.has(name) && !isParameter) {
        const siteKey = `${line}:${name}`;
        if (!this.astReassignmentErrorSites.has(siteKey)) {
          this.astReassignmentErrorSites.add(siteKey);
          this.addError(
            line,
            column,
            `Variable '${name}' not declared before ':='. Use '=' on first assignment.`,
            'PS016',
          );
        }
        return;
      }
      return;
    }

    if (operator !== '=') {
      if (!this.declared.has(name) && !isParameter) {
        const siteKey = `${line}:${name}`;
        if (!this.astCompoundAssignmentErrorSites.has(siteKey)) {
          this.astCompoundAssignmentErrorSites.add(siteKey);
          this.addError(
            line,
            column,
            `Variable '${name}' not declared before '${operator}'. Use '=' for first assignment or declare it.`,
            'PS017',
          );
        }
      }
      return;
    }

    if (!this.declared.has(name)) {
      this.handleNewVar(name, line, column);
    }

    if (rhsExpression) {
      this.registerTypeHeuristic(name, rhsExpression, line, column, false);
    }
  }

  private processAstLoopPerformanceCall(call: CallExpressionNode): void {
    if (!this.config.enablePerformanceAnalysis) {
      return;
    }

    const calleePath = this.resolveCalleePath(call.callee);
    if (!calleePath || calleePath.length === 0) {
      return;
    }

    const fullName = calleePath.join('.');
    if (!EXPENSIVE_LOOP_CALLEES.has(fullName)) {
      return;
    }

    const { line, column } = call.loc.start;
    this.addWarning(line, column, 'Expensive operation inside loop may impact performance.', 'PSP001');
  }

  private processAstFunctionDeclaration(fn: FunctionDeclarationNode): void {
    if (!fn.identifier) {
      return;
    }

    this.astProcessedFunctionDeclarations = true;

    const name = fn.identifier.name;
    const params = fn.params.map((param) => this.formatAstParameter(param));
    const headerLine = fn.loc.start.line;

    this.functionNames.add(name);
    this.functionParams.set(name, params);
    this.functionHeaderLine.set(name, headerLine);
    this.context.functionParams.set(name, params);
    this.paramUsage.set(name, new Set());

    const methodIndex = fn.params.findIndex((param) => param.identifier.name === 'this');
    const isMethod = methodIndex !== -1;
    if (isMethod) {
      this.methodNames.add(name);
      this.context.methodNames?.add(name);
      if (methodIndex > 0) {
        const location = fn.params[methodIndex]!.identifier.loc.start;
        this.addWarning(location.line, location.column, "In methods, 'this' should be the first parameter.", 'PSM01');
      }
    }

    this.registerParameterTypes(name, params, headerLine);
    this.checkAstDuplicateParameters(fn, name, isMethod);
  }

  private getAstInvalidBinaryOperatorMessage(operator: string): string | null {
    switch (operator) {
      case '&&':
        return "Operator '&&' is not valid in Pine Script. Use 'and' instead.";
      case '||':
        return "Operator '||' is not valid in Pine Script. Use 'or' instead.";
      case '===':
        return "Operator '===' is not valid in Pine Script.";
      case '!==':
        return "Operator '!==' is not valid in Pine Script.";
      case '|':
        return "Operator '|' is not valid in Pine Script.";
      case '&':
        return "Operator '&' is not valid in Pine Script.";
      case '^':
        return "Operator '^' is not valid in Pine Script.";
      default:
        return null;
    }
  }

  private getAstInvalidUnaryOperatorMessage(operator: string): string | null {
    switch (operator) {
      case '++':
        return "Operator '++' is not valid in Pine Script.";
      case '--':
        return "Operator '--' is not valid in Pine Script.";
      case '~':
        return "Operator '~' is not valid in Pine Script.";
      case '!':
        return "Operator '!' is not valid in Pine Script. Use 'not' instead.";
      default:
        return null;
    }
  }

  private formatAstParameter(param: ParameterNode): string {
    const typePart = param.typeAnnotation ? this.stringifyAstTypeReference(param.typeAnnotation) : null;
    const identifier = param.identifier.name;
    if (typePart) {
      return `${typePart} ${identifier}`;
    }
    return identifier;
  }

  private stringifyAstTypeReference(type: TypeReferenceNode): string {
    const base = type.name.name;
    if (!type.generics.length) {
      return base;
    }

    const generics = type.generics.map((generic) => this.stringifyAstTypeReference(generic));
    return `${base}<${generics.join(', ')}>`;
  }

  private checkAstDuplicateParameters(
    fn: FunctionDeclarationNode,
    name: string,
    isMethod: boolean,
  ): void {
    const seen = new Set<string>();

    for (const param of fn.params) {
      const paramName = param.identifier.name;
      if (seen.has(paramName)) {
        const { line, column } = param.identifier.loc.start;
        const message = isMethod && paramName === 'this'
          ? `Duplicate 'this' parameter in method '${name}'.`
          : `Duplicate parameter '${paramName}' in function '${name}'.`;
        this.addError(line, column, message, 'PSDUP01');
        continue;
      }

      seen.add(paramName);
    }
  }

  private processAstFunctionControlFlow(fn: FunctionDeclarationNode): void {
    if (!this.config.enableControlFlowAnalysis) {
      return;
    }

    this.astProcessedControlFlow = true;
    this.processAstStatementSequence(fn.body.body);
  }

  private processAstStatementSequence(statements: StatementNode[]): number | null {
    let returnLine: number | null = null;

    for (const statement of statements) {
      if (returnLine !== null) {
        this.reportAstUnreachableStatement(statement, returnLine);
        continue;
      }

      const nestedReturn = this.processAstStatementControlFlow(statement);
      if (nestedReturn !== null) {
        returnLine = nestedReturn;
      }
    }

    return returnLine;
  }

  private processAstStatementControlFlow(statement: StatementNode): number | null {
    switch (statement.kind) {
      case 'ReturnStatement':
        return statement.loc.start.line;
      case 'BlockStatement':
        return this.processAstStatementSequence((statement as BlockStatementNode).body);
      case 'IfStatement': {
        const consequentStatements = this.unwrapAstStatement(statement.consequent);
        const consequentReturn = this.processAstStatementSequence(consequentStatements);
        if (consequentReturn !== null) {
          if (statement.alternate) {
            this.reportAstUnreachableStatement(statement.alternate, consequentReturn);
          }
          return consequentReturn;
        }

        if (statement.alternate) {
          const alternateStatements = this.unwrapAstStatement(statement.alternate);
          const alternateReturn = this.processAstStatementSequence(alternateStatements);
          if (alternateReturn !== null) {
            return alternateReturn;
          }
        }

        return null;
      }
      case 'WhileStatement':
        return this.processAstStatementSequence(statement.body.body);
      case 'ForStatement':
        return this.processAstStatementSequence(statement.body.body);
      case 'SwitchStatement': {
        let returnLine: number | null = null;
        for (const caseNode of statement.cases) {
          if (returnLine !== null) {
            this.reportAstUnreachableStatements(caseNode.consequent, returnLine);
            continue;
          }

          const caseReturn = this.processAstStatementSequence(caseNode.consequent);
          if (caseReturn !== null) {
            returnLine = caseReturn;
          }
        }
        return returnLine;
      }
      case 'FunctionDeclaration':
        return this.processAstStatementSequence(statement.body.body);
      default:
        return null;
    }
  }

  private unwrapAstStatement(statement: StatementNode): StatementNode[] {
    if (statement.kind === 'BlockStatement') {
      return (statement as BlockStatementNode).body;
    }
    return [statement];
  }

  private reportAstUnreachableStatements(statements: StatementNode[], returnLine: number): void {
    for (const statement of statements) {
      this.reportAstUnreachableStatement(statement, returnLine);
    }
  }

  private reportAstUnreachableStatement(statement: StatementNode, returnLine: number): void {
    if (statement.kind === 'BlockStatement') {
      this.reportAstUnreachableStatements((statement as BlockStatementNode).body, returnLine);
      return;
    }

    if (statement.kind === 'ReturnStatement') {
      return;
    }

    const { line, column } = statement.loc.start;
    this.addWarning(
      line,
      column,
      `Unreachable code after return at line ${returnLine}.`,
      'PSC001',
    );

    switch (statement.kind) {
      case 'IfStatement':
        this.reportAstUnreachableStatement(statement.consequent, returnLine);
        if (statement.alternate) {
          this.reportAstUnreachableStatement(statement.alternate, returnLine);
        }
        break;
      case 'WhileStatement':
      case 'ForStatement':
        this.reportAstUnreachableStatement(statement.body, returnLine);
        break;
      case 'SwitchStatement':
        for (const caseNode of statement.cases) {
          this.reportAstUnreachableStatements(caseNode.consequent, returnLine);
        }
        break;
      case 'FunctionDeclaration':
        this.reportAstUnreachableStatements(statement.body.body, returnLine);
        break;
      default:
        break;
    }
  }

  private isIdentifierNamed(expression: ExpressionNode, name: string): boolean {
    return expression.kind === 'Identifier' && (expression as IdentifierNode).name === name;
  }

  private addStrategyNamespaceError(line: number, column: number): void {
    if (this.astStrategyUsageErrorLines.has(line)) {
      return;
    }

    this.astStrategyUsageErrorLines.add(line);
    this.addError(
      line,
      column,
      "Calls to 'strategy.*' are not allowed in indicators.",
      'PS020',
    );
  }

  private extractNumericLiteral(expression: ExpressionNode): number | null {
    if (expression.kind === 'NumberLiteral') {
      return (expression as NumberLiteralNode).value;
    }
    if (expression.kind === 'UnaryExpression') {
      const unary = expression as UnaryExpressionNode;
      const argumentValue = this.extractNumericLiteral(unary.argument);
      if (argumentValue === null) {
        return null;
      }
      if (unary.operator === '-') {
        return -argumentValue;
      }
      if (unary.operator === '+') {
        return argumentValue;
      }
    }
    return null;
  }

  private resolveExpressionType(expression: ExpressionNode): TypeMetadata | null {
    if (!this.astContext) {
      return null;
    }

    const { typeEnvironment } = this.astContext;
    const direct = typeEnvironment.nodeTypes.get(expression);
    if (direct) {
      return direct;
    }

    if (expression.kind === 'Identifier') {
      const identifier = expression as IdentifierNode;
      return typeEnvironment.identifiers.get(identifier.name) ?? null;
    }

    return null;
  }

  private processVersionDirectives(directives: ProgramNode['directives']): void {
    const versionDirectives = directives.filter(
      (directive): directive is VersionDirectiveNode => directive.kind === 'VersionDirective',
    );

    if (versionDirectives.length === 0) {
      return;
    }

    for (const directive of versionDirectives) {
      this.astVersionDirectiveLines.add(directive.loc.start.line);
    }

    const [primary, ...duplicates] = versionDirectives;
    const line = primary.loc.start.line;
    const column = primary.loc.start.column;

    this.hasVersion = true;
    this.context.hasVersion = true;
    this.firstVersionLine = line;
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

    // Only warn if version directive is after the script declaration
    // License comments and other metadata are allowed before version directive
    // The version directive should be just above the coding block (indicator/strategy/library)
    // Check if there's a script declaration after the version directive
    const hasScriptDeclaration = this.context.lines.some((lineContent, index) => 
      index >= line - 1 && (
        lineContent.includes('indicator(') || 
        lineContent.includes('strategy(') || 
        lineContent.includes('library(')
      )
    );
    
    if (!hasScriptDeclaration) {
      this.addWarning(line, column, 'Version directive should be just above the coding block.', 'PSW01');
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

  private processScriptDeclarations(body: ProgramNode['body']): void {
    const scriptDeclarations = body.filter(
      (node): node is ScriptDeclarationNode => node.kind === 'ScriptDeclaration',
    );

    if (scriptDeclarations.length === 0) {
      return;
    }

    const [primary, ...duplicates] = scriptDeclarations;

    this.astScriptDeclarationLines.add(primary.loc.start.line);
    this.scriptType = primary.scriptType;
    this.context.scriptType = primary.scriptType;
    this.scriptDeclParsed = true;

    const hasTitle = this.scriptDeclarationHasTitle(primary);
    const isIndicatorWithoutTitle = primary.scriptType === 'indicator' && primary.arguments.length === 0;

    if (!hasTitle && !isIndicatorWithoutTitle) {
      this.addError(
        primary.loc.start.line,
        primary.loc.start.column,
        'Script declaration should include a title (positional or title=).',
        'PS005',
      );
    }

    for (const duplicate of duplicates) {
      this.astScriptDeclarationLines.add(duplicate.loc.start.line);
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

  private scriptDeclarationHasTitle(script: ScriptDeclarationNode): boolean {
    return script.arguments.some((argument, index) => {
      if (argument.name && argument.name.name === 'title') {
        return true;
      }
      if (!argument.name && index === 0 && this.isStringLiteral(argument.value)) {
        return true;
      }
      return false;
    });
  }

  private isStringLiteral(expression: ExpressionNode): expression is StringLiteralNode {
    return expression.kind === 'StringLiteral';
  }  private performPostValidationChecks(): void {
    // Check for missing version
    if (!this.hasVersion) {
      this.addError(1, 1, 'Missing version directive. Add //@version=6 at the top.', 'PS012');
    }

    // Check for missing script declaration
    if (!this.scriptType) {
      const line = this.hasVersion ? 2 : 1;
      this.addError(line, 1, 'Missing script declaration. Add indicator(), strategy(), or library().', 'PS013');
    }

    // Check for missing strategy.* calls in strategies
    if (this.scriptType === 'strategy' && !this.hasStrategyCalls) {
      this.addWarning(1, 1, 'Strategy script has no strategy.* calls. Consider adding strategy.entry() or strategy.exit().', 'PS015');
    }

    // Check for missing plotting in indicators
    if (this.scriptType === 'indicator' && !this.hasPlotting) {
      this.addWarning(1, 1, 'Indicator script has no plotting functions. Consider adding plot() or plotshape().', 'PS014');
    }

    // Check for mixed indentation
    if (this.sawTabIndent && this.sawSpaceIndent) {
      this.addWarning(1, 1, 'Mixed tabs and spaces for indentation detected.', 'PSI02');
    }

    // Check for unmatched brackets
    const totalLines = Math.max(1, getSourceLines(this.context).length);
    if (this.brace !== 0) {
      this.addError(totalLines, 1, 'Unmatched curly braces across script.', 'PS011');
    } else if (this.sawBrace) {
      this.addWarning(totalLines, 1, 'Curly braces are not used for blocks in Pine Script.', 'PSB01');
    }

    if (this.paren !== 0) {
      this.addError(totalLines, 1, 'Unmatched parentheses across script.', 'PS009');
    }
    if (this.bracket !== 0) {
      this.addError(totalLines, 1, 'Unmatched square brackets across script.', 'PS010');
    }

    // Check for unused variables
    this.checkUnusedVariables();
    this.checkUnusedParameters();
  }

  private checkUnusedVariables(): void {
    const IGNORE_UNUSED = new Set(['_']);
    const functionParamSet = new Set([...this.functionParams.values()].flat().map(p => p.trim().split(/\s+/).pop()!));
    
    for (const [name, line] of this.declared.entries()) {
      if (IGNORE_UNUSED.has(name)) continue;
      if (!this.used.has(name) && !isReservedKeyword(name) && !this.functionNames.has(name) && !functionParamSet.has(name)) {
        this.addWarning(line, 1, `Variable '${name}' is declared but never used.`, 'PSU01');
      }
    }
  }

  private checkUnusedParameters(): void {
    for (const [fn, params] of this.functionParams.entries()) {
      if (/^(indicator|strategy|library)$/.test(fn)) continue;
      
      const headerLine = this.functionHeaderLine.get(fn) ?? 1;
      const usedInFn = this.paramUsage.get(fn) ?? new Set<string>();
      
      const cleanedParams = params.map(s => {
        const cleaned = s.trim().replace(/<[^>]*>/g, '');
        return cleaned.split(/\s+/).pop()!;
      }).filter(Boolean);
      
      for (const p of cleanedParams) {
        if (p === '_' || (this.methodNames.has(fn) && p === 'this')) continue;
        // Skip PSU-PARAM warnings for dotted function names (known limitation)
        if (fn.includes('.')) continue;
        if (!usedInFn.has(p)) {
          this.addWarning(headerLine, 1, `Parameter '${p}' in '${fn}' is never used.`, 'PSU-PARAM');
        }
      }
    }
  }

  // Helper methods extracted from EnhancedPineScriptValidator
  private collectFunctions(lines: string[]): void {
    const START_QUAL = new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(`);
    const START_METH = new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(`);
    let buf = '';
    let startIdx = -1;
    let name: string | null = null;
    let linesSeen = 0;
    const MAX_HDR_LINES = 12;
  
    const reset = () => { buf = ''; startIdx = -1; name = null; linesSeen = 0; };
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (startIdx < 0) {
        const m = line.match(START_QUAL) || line.match(START_METH);
        if (m) {
          const before = line.slice(0, m.index ?? 0);
          const dotted = before.endsWith('.') || /\.\s*$/.test(before);
          const candidate = m[1];
          
          // Skip script declarations (indicator/strategy/library)
          if (/^(indicator|strategy|library)$/.test(candidate)) {
            continue;
          }
          
          if (!dotted && !/=\s*[^=]/.test(line.substring(0, line.indexOf('(')))) {
            startIdx = i;
            name = candidate;
            buf = line + '\n';
            linesSeen = 1;
            
            // Check if this line also contains => (single-line method)
            if (/=>/.test(line)) {
              // Process immediately
              const m =
                buf.match(new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm')) ||
                buf.match(new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm'));
              if (m) {
                  const full = m[1];
                  const isMethod = buf.trim().startsWith('method');
                  if(isMethod) this.methodNames.add(full);
                  const params = m[2].split(',').map(s=>s.trim()).filter(Boolean);
                  this.functionNames.add(full);
                  this.functionParams.set(full, params);
                  this.functionHeaderLine.set(full, startIdx + 1);
                  
                  // Don't add user-defined functions to context.functionNames (only built-in functions)
                  // this.context.functionNames.add(full);
                  this.context.functionParams.set(full, params);
                  this.registerParameterTypes(full, params, startIdx + 1);

                  // Parse parameter names, handling type annotations like "this<Point>"
                  const namesOnly = params.map(p => {
                    const cleaned = p.trim().replace(/<[^>]*>/g, '');
                    return cleaned.split(/\s+/).pop()!;
                  }).filter(Boolean);
                  const seen = new Set<string>();
                  namesOnly.forEach((p) => {
                    if (seen.has(p)) {
                      const msg = (isMethod && p === 'this')
                        ? `Duplicate 'this' parameter in method '${full}'.`
                        : `Duplicate parameter '${p}' in function '${full}'.`;
                      this.addError(startIdx + 1, 1, msg, 'PSDUP01');
                    }
                    seen.add(p);
                  });
              }
              reset();
            }
          }
        }
        continue;
      }
  
      // collecting
      if (line.trim() === '') {
        buf += line + '\n';
        continue; // Allow blank lines without penalty
      }
      if (/^(if|for|while|switch|export\s+\S+\s+as\s+\S+)\b/.test(line.trim())) { reset(); continue; }
      buf += line + '\n';
      linesSeen++;
  
      // Header ended without => (very likely a call or something else)
      if (/\)\s*$/.test(line) && !/=>/.test(buf)) { reset(); continue; }
  
      if (/=>/.test(line)) {
        const m =
          buf.match(new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm')) ||
          buf.match(new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm'));
        if (m) {
            const full = m[1];
            const isMethod = buf.trim().startsWith('method');
            if(isMethod) this.methodNames.add(full);
            const params = m[2].split(',').map(s=>s.trim()).filter(Boolean);
            this.functionNames.add(full);
            this.functionParams.set(full, params);
            this.functionHeaderLine.set(full, startIdx + 1);
            
            // Don't add user-defined functions to context.functionNames (only built-in functions)
            // this.context.functionNames.add(full);
            this.context.functionParams.set(full, params);
            this.registerParameterTypes(full, params, startIdx + 1);

            // Parse parameter names, handling type annotations like "this<Point>"
            const namesOnly = params.map(p => {
              const cleaned = p.trim().replace(/<[^>]*>/g, '');
              return cleaned.split(/\s+/).pop()!;
            }).filter(Boolean);
            const seen = new Set<string>();
            namesOnly.forEach((p) => {
              if (seen.has(p)) {
                const msg = (isMethod && p === 'this')
                  ? `Duplicate 'this' parameter in method '${full}'.`
                  : `Duplicate parameter '${p}' in function '${full}'.`;
                this.addError(startIdx + 1, 1, msg, 'PSDUP01');
              }
              seen.add(p);
            });
        }
        reset();
        continue;
      }
  
      if (linesSeen >= MAX_HDR_LINES) reset(); // safety bail
    }
  }

  private registerParameterTypes(funcName: string, params: string[], lineNum: number): void {
    for (const rawParam of params) {
      const meta = this.extractParameterMeta(rawParam);
      if (!meta || !meta.name || meta.name === 'this') continue;

      const normalizedType = this.normalizeTypeName(meta.type);
      const existing = this.context.typeMap.get(meta.name);
      if (existing && existing.type !== 'unknown') {
        continue;
      }

      const typeInfo: TypeInfo = {
        type: normalizedType,
        isConst: false,
        isSeries: meta.isSeries ?? (normalizedType === 'series'),
        declaredAt: { line: lineNum, column: 1 },
        usages: []
      };

      if (meta.elementType) {
        const normalizedElement = this.normalizeTypeName(meta.elementType);
        if (normalizedElement !== 'unknown') {
          typeInfo.elementType = normalizedElement;
        }
      }

      if (meta.valueType) {
        const normalizedValue = this.normalizeTypeName(meta.valueType);
        if (normalizedValue !== 'unknown') {
          typeInfo.valueType = normalizedValue;
        }
      }

      this.context.typeMap.set(meta.name, typeInfo);
    }
  }

  private extractParameterMeta(param: string): { name: string; type: string | null; elementType?: string; valueType?: string; isSeries?: boolean } | null {
    const trimmed = param.trim();
    if (!trimmed) return null;

    const beforeDefault = trimmed.split('=')[0]?.trim() ?? '';
    if (!beforeDefault) return null;
    if (/^this\b/.test(beforeDefault)) return null;

    const normalized = beforeDefault
      .replace(/<\s*/g, '<')
      .replace(/\s*>/g, '>')
      .replace(/,\s*/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    const paramPattern = /^(?:var|varip|const)?\s*(?:(series|simple|input)\s+)?([A-Za-z_][A-Za-z0-9_]*(?:<[^>]+>)?)\s+([A-Za-z_][A-Za-z0-9_]*)$/;
    const match = normalized.match(paramPattern);

    if (!match) {
      const parts = normalized.split(/\s+/);
      const name = parts[parts.length - 1];
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        return null;
      }
      return { name, type: null };
    }

    const qualifier = match[1];
    let typeToken = match[2];
    const name = match[3];

    let elementType: string | undefined;
    let valueType: string | undefined;
    let baseType: string | null = typeToken;
    let isSeries = qualifier === 'series';

    if (typeToken.startsWith('array<')) {
      const inner = typeToken.slice(typeToken.indexOf('<') + 1, typeToken.lastIndexOf('>'));
      const innerParts = inner.split(',').map(p => p.trim()).filter(Boolean);
      baseType = 'array';
      elementType = innerParts[innerParts.length - 1] ?? 'unknown';
    } else if (typeToken.startsWith('map<')) {
      const inner = typeToken.slice(typeToken.indexOf('<') + 1, typeToken.lastIndexOf('>'));
      const innerParts = inner.split(',').map(p => p.trim()).filter(Boolean);
      baseType = 'map';
      if (innerParts.length) {
        const trimmed = innerParts[innerParts.length - 1];
        valueType = trimmed;
      }
    } else if (/^series\b/i.test(typeToken)) {
      baseType = 'series';
      isSeries = true;
    }

    if (isSeries && baseType && baseType !== 'series') {
      elementType = baseType;
      baseType = 'series';
    }

    return { name, type: baseType, elementType, valueType, isSeries };
  }

  private normalizeTypeName(type: string | null | undefined): 'int' | 'float' | 'bool' | 'string' | 'color' | 'series' | 'line' | 'label' | 'box' | 'table' | 'array' | 'matrix' | 'map' | 'unknown' {
    if (!type) return 'unknown';
    const lower = type.toLowerCase();
    switch (lower) {
      case 'int':
      case 'integer':
        return 'int';
      case 'float':
      case 'double':
        return 'float';
      case 'bool':
      case 'boolean':
        return 'bool';
      case 'string':
        return 'string';
      case 'color':
        return 'color';
      case 'series':
        return 'series';
      case 'line':
        return 'line';
      case 'label':
        return 'label';
      case 'box':
        return 'box';
      case 'table':
        return 'table';
      case 'array':
        return 'array';
      case 'matrix':
        return 'matrix';
      case 'map':
        return 'map';
      default:
        return 'unknown';
    }
  }

  private updateBracketDepths(noStrings: string, lineNum: number): void {
    for (let i = 0; i < noStrings.length; i++) {
        const ch = noStrings[i];
        const col = i + 1;
        
        if (ch === '{') { this.sawBrace = true; this.brace++; }
        else if (ch === '}') { this.sawBrace = true; this.brace--; if (this.brace < 0) { this.addError(lineNum, col, "Unexpected '}'.", 'PS008'); this.brace = 0; break; } }
        else if (ch === '(') this.paren++;
        else if (ch === ')') { this.paren--; if (this.paren < 0) { this.addError(lineNum, col, 'Unexpected \')\'.', 'PS008'); this.paren = 0; break; } }
        else if (ch === '[') this.bracket++;
        else if (ch === ']') { this.bracket--; if (this.bracket < 0) { this.addError(lineNum, col, 'Unexpected \']\'.', 'PS008'); this.bracket = 0; break; } }
      }
  }

  private handleNewVar(name: string, line: number, col: number): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      this.addError(line, col, `Invalid identifier '${name}'.`, 'PS006');
      return;
    }
    if (!this.astTypeFieldLines.has(line)) {
      if (isReservedKeyword(name)) {
        this.addError(line, col, `Identifier '${name}' conflicts with a Pine keyword/builtin.`, 'PS007');
        return;
      }

      if (isReservedPseudoVar(name)) {
        this.addWarning(line, col, `Identifier '${name}' shadows a built-in variable.`, 'PS007');
        return;
      }
    }

    const lexicalScope = this.currentScope();
    const activeAstScope = this.astFunctionStack.length
      ? this.astFunctionStack[this.astFunctionStack.length - 1]!
      : null;
    const paramsHere = activeAstScope?.params ?? lexicalScope.params;

    if (paramsHere.has(name) && name !== 'this') {
      this.addWarning(
        line,
        col,
        `Identifier '${name}' shadows a function parameter.`,
        'PSW05',
        'Rename the local or the parameter to avoid confusion.',
      );
    }

    const isShadowingParameter = paramsHere.has(name) && name !== 'this';
    const alreadyInScope = lexicalScope.variables.has(name);
    if (alreadyInScope) {
      this.addWarning(
        line,
        col,
        `Identifier '${name}' already declared in this block; use ':=' to reassign.`,
        'PSW03',
      );
    } else if (!isShadowingParameter) {
      for (let i = this.scopeStack.length - 2; i >= 0; i--) {
        if (this.scopeStack[i].variables.has(name)) {
          this.addWarning(
            line,
            col,
            `Identifier '${name}' shadows an outer declaration.`,
            'PSW04',
          );
          break;
        }
      }
    }

    const siteKey = `${line}:${name}`;
    if (this.declaredSites.has(siteKey)) {
      return;
    }

    this.declaredSites.add(siteKey);
    lexicalScope.variables.add(name);

    const sourceLine = getSourceLine(this.context, line);
    const currentIndent = this.getLineIndentation(sourceLine);
    this.declared.set(name, line);
    this.declIndent.set(name, currentIndent);

    // Also update the shared context for other validators
    this.context.declaredVars.set(name, line);
  }

  private registerTypeHeuristic(
    name: string,
    rhsExpression: ExpressionNode | null,
    line: number,
    col: number,
    isConst: boolean,
  ): void {
    if (isConst) this.constNames.add(name);
    const rhs = rhsExpression ? this.getExpressionSource(rhsExpression) : '';
    const trimmedRhs = rhs.trim();
    const isSeries =
      /\[[^\]]+\]/.test(trimmedRhs) ||
      /^(open|high|low|close|volume|time|bar_index|hl2|hlc3|ohlc4|hlcc4)\b/.test(trimmedRhs) ||
      /\bta\./.test(trimmedRhs) ||
      /request\.security/.test(trimmedRhs) ||
      /request\.security_lower_tf/.test(trimmedRhs);
    let ty: 'int' | 'float' | 'bool' | 'string' | 'color' | 'series' | 'line' | 'label' | 'box' | 'table' | 'array' | 'matrix' | 'map' | 'udt' | 'unknown' = 'unknown';
    const s = trimmedRhs;
    if (/^(true|false)\b/.test(s)) ty = 'bool';
    else if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/.test(s)) ty = 'string';
    else if (/^[+\-]?\d[\d_]*(?:\.\d[\d_]*)?(?:e[+\-]?\d+)?\b/i.test(s)) {
        ty = s.includes('.') || /e[+\-]/i.test(s) ? 'float' : 'int';
    }
    else if (/^color\.(?:\w+)\b/.test(s) || /^color\.new\s*\(/.test(s)) ty = 'color';
    else if (/\b(line|label|box|table)\.new\s*\(/.test(s)) {
      const match = s.match(/\b(line|label|box|table)\.new/);
      if (match) {
        ty = match[1] as 'line' | 'label' | 'box' | 'table';
      }
    }
    else if (/\barray\./.test(s)) ty = 'array';
    else if (/\bmatrix\./.test(s)) ty = 'matrix';
    else if (/\bmap\./.test(s)) ty = 'map';
    else if (/\b[A-Z][A-Za-z0-9_]*\.new\s*\(/.test(s)) {
      // Extract the UDT type name
      const udtMatch = s.match(/\b([A-Z][A-Za-z0-9_]*)\.new\s*\(/);
      if (udtMatch) {
        const udtTypeName = udtMatch[1];
        // Check if this UDT type exists in the context
        const udtTypeInfo = this.context.typeMap.get(udtTypeName);
        if (udtTypeInfo?.type === 'udt') {
          ty = 'udt';
        } else {
          ty = 'unknown'; // UDT type not found
        }
      }
    }
    // Handle method calls (e.g., p1.distance(p2))
    else if (/\b[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(s)) {
      const methodMatch = s.match(/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (methodMatch) {
        const objectName = methodMatch[1];
        const methodName = methodMatch[2];
        // Check if the object is a UDT
        const objectType = this.context.typeMap.get(objectName);
        if (objectType?.type === 'udt') {
          // For UDT method calls, assume they return float (most common case)
          ty = 'float';
        } else {
          ty = 'unknown';
        }
      }
    }
    // Handle namespace member access (e.g., timeframe.period, ta.sma)
    else if (/\b[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
      const namespaceMatch = s.match(/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/);
      if (namespaceMatch) {
        const [, namespace, member] = namespaceMatch;
        // Handle specific namespace members
        if (namespace === 'timeframe' && member === 'period') {
          ty = 'string'; // timeframe.period returns a string
        } else if (namespace === 'ta') {
          ty = 'series'; // Most ta functions return series
        } else if (namespace === 'math') {
          ty = 'float'; // Most math functions return float
        } else if (namespace === 'str') {
          ty = 'string'; // String functions return string
        } else if (namespace === 'color') {
          ty = 'color'; // Color functions return color
        } else {
          ty = 'unknown';
        }
      }
    }
    // Handle switch statements (e.g., switch var => "value")
    else if (/\bswitch\s+/.test(s)) {
      // For switch statements, try to infer the return type from the cases
      // Look for string literals in the switch cases
      if (s.includes('"')) {
        ty = 'string'; // Switch returns string if it has string literals
      } else if (/\b\d+\b/.test(s)) {
        ty = 'int'; // Switch returns int if it has numeric literals
      } else {
        ty = 'unknown'; // Can't determine switch return type
      }
    }
    // Handle function calls (e.g., ta.sma(close, 20), math.max(a, b))
    else if (/\b[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(s)) {
      const funcMatch = s.match(/\b([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        // Check if it's a built-in function
        if (this.context.functionNames && this.context.functionNames.has(funcName)) {
          // Infer return type based on function namespace
          if (funcName.startsWith('ta.')) {
            ty = 'series'; // Most TA functions return series
          } else if (funcName.startsWith('math.')) {
            ty = 'float'; // Most math functions return float
          } else if (funcName.startsWith('str.')) {
            // Special handling for specific string functions
            if (funcName === 'str.tonumber') {
              ty = 'float'; // str.tonumber returns float
            } else {
              ty = 'string'; // Other string functions return string
            }
          } else if (funcName.startsWith('color.')) {
            ty = 'color'; // Color functions return color
          } else {
            ty = 'unknown';
          }
        } else {
          ty = 'unknown';
        }
      }
    }
    // Handle user-defined function calls (e.g., myFunction(close))
    else if (/\b[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(s)) {
      // Check if it's not a built-in function
      const funcMatch = s.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const isUserDefined = this.functionNames.has(funcName);
        
        // If it's a user-defined function, assume it returns series (most common case)
        if (isUserDefined) {
          ty = 'series'; // User-defined functions typically return series
        }
      }
    }
    else if (isSeries) ty = 'series'; // Use the isSeries detection
    
    // Store type info in context for other modules to use
    this.context.typeMap.set(name, {
      type: ty,
      isConst,
      isSeries,
      declaredAt: { line, column: col },
      usages: [],
    });
  }

  private isThisMemberExpression(expression: MemberExpressionNode): boolean {
    if (expression.object.kind !== 'Identifier') {
      return false;
    }
    if (expression.computed) {
      return false;
    }
    const identifier = expression.object as IdentifierNode;
    return identifier.name === 'this';
  }

  private currentScope(): ScopeInfo {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  private pushAstScope(params: Set<string>, fnName: string | null): void {
    this.scopeStack.push({ indent: 0, params, fnName, variables: new Set() });
  }

  private popScope(): void {
    if (this.scopeStack.length > 1) {
      this.scopeStack.pop();
    }
  }

  private currentAstFunctionName(): string | null {
    const top = this.astFunctionStack[this.astFunctionStack.length - 1];
    return top?.name ?? null;
  }

  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private getTypeReferenceName(type: TypeReferenceNode | null): string | null {
    if (!type) {
      return null;
    }
    return type.name?.name ?? null;
  }

  private getExpressionSource(node: ExpressionNode | null): string {
    if (!node) {
      return '';
    }
    return getNodeSource(this.context, node);
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }

    return isAstValidationContext(this.context) && this.context.ast ? this.context : null;
  }
}
