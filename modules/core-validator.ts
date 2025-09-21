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
} from '../core/types';
import {
  VERSION_RE, SCRIPT_START_RE, QUALIFIED_FN_RE, METHOD_DECL_RE,
  VAR_DECL_RE, SIMPLE_ASSIGN_RE, TUPLE_DECL_RE, TUPLE_REASSIGN_RE,
  KEYWORDS, NAMESPACES, PSEUDO_VARS, WILDCARD_IDENT, IDENT
} from '../core/constants';
import type {
  ArgumentNode,
  CallExpressionNode,
  ExpressionNode,
  IdentifierNode,
  IndexExpressionNode,
  MemberExpressionNode,
  ProgramNode,
  ScriptDeclarationNode,
  StringLiteralNode,
  NumberLiteralNode,
  UnaryExpressionNode,
  VersionDirectiveNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import type { TypeMetadata } from '../core/ast/types';

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
  private astStrategyUsageErrorLines = new Set<number>();
  private inLoop = false;
  private inFunction = false;
  private hasReturn = false;

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

  private scopeStack: ScopeInfo[] = [];
  private indentStack: number[] = [0];
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
    this.astContext = isAstValidationContext(context) && context.ast ? context : null;
    this.astVersionDirectiveLines.clear();
    this.astScriptDeclarationLines.clear();

    if (this.astContext?.ast) {
      this.processAstProgram(this.astContext.ast);
    }

    // Function declarations are now handled by FunctionDeclarationsValidator
    // Scan each line for core validation
    for (let i = 0; i < context.cleanLines.length; i++) {
      const line = context.cleanLines[i];
      const lineNum = i + 1;
      this.scanLine(line, lineNum);
    }

    // Post-validation checks
    this.performPostValidationChecks();

    // Return all errors found by this module
    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null
    };
  }

  private reset(): void {
    this.astContext = null;
    this.astVersionDirectiveLines.clear();
    this.astScriptDeclarationLines.clear();
    this.hasVersion = false;
    this.firstVersionLine = null;
    this.scriptType = null;
    this.scriptDeclParsed = false;
    this.hasStrategyCalls = false;
    this.hasPlotting = false;
    this.inLoop = false;
    this.inFunction = false;
    this.hasReturn = false;
    this.astProcessedStrategyUsage = false;
    this.astProcessedPlottingUsage = false;
    this.astProcessedLibraryRestrictions = false;
    this.astProcessedNegativeHistory = false;
    this.astStrategyUsageErrorLines.clear();
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
    this.indentStack = [0];
    this.paren = 0;
    this.bracket = 0;
    this.brace = 0;
  }

  private processAstProgram(program: ProgramNode): void {
    this.processVersionDirectives(program.directives);
    this.processScriptDeclarations(program.body);
    this.processAstScriptSemantics(program);
  }

  private processAstScriptSemantics(program: ProgramNode): void {
    this.astProcessedStrategyUsage = true;
    this.astProcessedPlottingUsage = true;
    this.astProcessedLibraryRestrictions = true;
    this.astProcessedNegativeHistory = true;

    visit(program, {
      CallExpression: {
        enter: ({ node }) => {
          this.processAstCallExpression(node);
        },
      },
      IndexExpression: {
        enter: ({ node }) => {
          this.processAstIndexExpression(node as IndexExpressionNode);
        },
      },
      MemberExpression: {
        enter: (path) => {
          this.processAstMemberExpression(path as NodePath<MemberExpressionNode>);
        },
      },
    });
  }

  private processAstCallExpression(call: CallExpressionNode): void {
    const calleePath = this.resolveCalleePath(call.callee);
    if (!calleePath || calleePath.length === 0) {
      return;
    }

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

  private processAstIndexExpression(indexExpression: IndexExpressionNode): void {
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

  private processAstMemberExpression(path: NodePath<MemberExpressionNode>): void {
    if (this.scriptType !== 'indicator') {
      return;
    }

    const parent = path.parent;
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

    if (line !== 1) {
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
  }

  private scanLine(line: string, lineNum: number): void {
    const t = line.trim();
    if (t === '') return;

    if (this.astVersionDirectiveLines.has(lineNum) || this.astScriptDeclarationLines.has(lineNum)) {
      return;
    }

    const strippedNoStrings = this.stripStringsAndLineComment(line);

    // Version directive
    if (VERSION_RE.test(line)) {
      this.handleVersionDirective(line, lineNum);
      return;
    }

    // Script declaration
    if (SCRIPT_START_RE.test(line)) {
      this.handleScriptDeclaration(line, lineNum);
      return;
    }

    // Script boundary validation
    this.validateScriptBoundaries(line, lineNum, strippedNoStrings);

    // Loop detection for performance analysis
    this.detectLoops(line, lineNum, strippedNoStrings);

    // Control flow analysis
    this.detectControlFlow(line, lineNum, strippedNoStrings);

    // Type declaration
    this.handleTypeDeclaration(line, lineNum, strippedNoStrings);

    // Indentation and scope
    this.handleIndentation(line, lineNum);

    // Bracket depths
    this.updateBracketDepths(strippedNoStrings, lineNum);

    // Tuple destructuring
    this.handleTupleDestructuring(line, lineNum, strippedNoStrings);

    // Function declarations
    this.handleFunctionDeclarations(line, lineNum);

    // Variable declarations and assignments
    this.handleVariableDeclarations(line, lineNum, strippedNoStrings);

    // Basic syntax checks
    this.checkBasicSyntax(line, lineNum, strippedNoStrings);

    // References and usage
    this.scanReferences(line, lineNum, strippedNoStrings);
  }

  private handleVersionDirective(line: string, lineNum: number): void {
    const m = line.match(VERSION_RE)!;
    const v = parseInt(m[1], 10);

    if (this.firstVersionLine === null) {
      if (this.config.targetVersion && v !== this.config.targetVersion) {
        const sev = v < this.config.targetVersion ? 'error' : 'warning';
        this.addBySeverity(sev, lineNum, 1,
          `Script declares //@version=${v} but targetVersion is ${this.config.targetVersion}.`,
          'PS001');
      }
      this.firstVersionLine = lineNum;
      this.hasVersion = true;
      this.context.hasVersion = true;
      this.context.firstVersionLine = lineNum;
      if (lineNum !== 1) {
        this.addWarning(lineNum, 1, 'Version directive should be on the first line.', 'PSW01');
      }
      if (v < 5) {
        this.addWarning(lineNum, 1, `Pine version ${v} is deprecated. Prefer v5 or v6.`, 'PSW02');
      }
    } else if (lineNum !== this.firstVersionLine) {
      this.addError(lineNum, 1, 'Multiple //@version directives. Only one allowed.', 'PS002');
    }
  }

  private handleScriptDeclaration(line: string, lineNum: number): void {
    if (this.scriptDeclParsed) {
      const currentMatch = line.match(SCRIPT_START_RE);
      if (currentMatch && currentMatch[1] !== this.scriptType) {
        this.addError(lineNum, 1, `Multiple script declarations not allowed (already '${this.scriptType}').`, 'PS004B');
      }
      return;
    }
    this.parseScriptDeclaration(lineNum);
  }

  private handleTypeDeclaration(line: string, lineNum: number, strippedNoStrings: string): void {
    const mType = /^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(strippedNoStrings);
    if (mType) {
      const name = mType[1];
      this.declared.set(name, lineNum);
      this.declIndent.set(name, this.indentStack[this.indentStack.length - 1]);
      this.parseTypeFields(name, lineNum);
    }
  }

  private handleTupleDestructuring(line: string, lineNum: number, strippedNoStrings: string): void {
    if (TUPLE_REASSIGN_RE.test(strippedNoStrings)) {
      this.addError(lineNum, 1, 'Tuple destructuring must use "=" (not ":=").', 'PST03');
    }
    
    const tupleMatch = line.match(TUPLE_DECL_RE);
    if (tupleMatch) {
      const content = tupleMatch[1];
      if (/^\s*,|,\s*,|,\s*$/.test(content)) {
        this.addWarning(lineNum, line.indexOf('[') + 1, 'Empty slot in destructuring tuple.', 'PST02');
      }
      const contentOffset = line.indexOf(content, line.indexOf('['));
      const names = content.split(',');
      for (const nameFragment of names) {
        const trimmedName = nameFragment.trim();
        if (!trimmedName || trimmedName === '_') continue;
        const col = contentOffset + nameFragment.indexOf(trimmedName) + 1;
        if (trimmedName.includes('.')) {
          this.addWarning(lineNum, col, 'Dotted names in tuple destructuring are unusual and may indicate an error.', 'PST01', 'Did you mean to destructure into plain identifiers (e.g., [a, b] = foo())?');
        } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedName)) {
          this.handleNewVar(trimmedName, lineNum, col);
        }
      }
    }
  }

  private handleFunctionDeclarations(line: string, lineNum: number): void {
    const funcMatch = line.match(QUALIFIED_FN_RE);
    const methMatch = line.match(METHOD_DECL_RE);
    
    if (funcMatch) {
      this.functionHeaderLine.set(funcMatch[1], lineNum);
    } else if (methMatch) {
      const name = methMatch[1];
      this.functionHeaderLine.set(name, lineNum);
      const namesOnly = methMatch[2].split(',').map(p => {
        const cleaned = p.trim().replace(/<[^>]*>/g, '');
        return cleaned.split(/\s+/).pop()!;
      }).filter(Boolean);
      const thisIdx = namesOnly.indexOf('this');
      if (thisIdx > 0) {
        this.addWarning(lineNum, 1, "In methods, 'this' should be the first parameter.", 'PSM01');
      }
    }
  }

  private handleVariableDeclarations(line: string, lineNum: number, strippedNoStrings: string): void {
    if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=>/.test(line)) {
      return;
    }
    // Check for invalid declarations
    if (/^\s*(?:var|varip)\s+const\b/.test(strippedNoStrings)) {
      this.addError(lineNum, 1, 'Invalid declaration: use either var/varip or const, not both.', 'PSD01');
    }
    
    // Only check for := in actual declarations (lines that start with var/varip/const or type annotations)
    if (/^\s*(?:(?:var|varip|const)\s+|(?:(?:int|float|bool|string|color|line|label|box|table|array|matrix|map)\s+))[A-Za-z_][A-Za-z0-9_]*\s*:=/.test(strippedNoStrings)) {
      this.addError(lineNum, 1, 'Use "=" (not ":=") in declarations.', 'PSD02');
    }

    // Variable declaration
    const decl = line.match(VAR_DECL_RE);
    if (decl) {
      const name = decl[1];
      this.handleNewVar(name, lineNum, line.indexOf(name) + 1);
      const rhs = line.slice(line.indexOf('=') + 1);
      const isConst = /^\s*const\b/.test(line);
      this.registerTypeHeuristic(name, rhs, lineNum, line.indexOf(name) + 1, isConst);
    } else {
      // Simple assignment
      if (SIMPLE_ASSIGN_RE.test(strippedNoStrings)
          && !/^\s*(if|for|while)\b/.test(strippedNoStrings)
          && this.findNamedArgsCached(line).size === 0) {
        const m = strippedNoStrings.match(SIMPLE_ASSIGN_RE)!;
        const varName = m[1];
        const col = line.indexOf(varName) + 1;

        if (this.declared.has(varName) && this.constNames.has(varName)) {
          this.addError(lineNum, col, `Cannot reassign const '${varName}' with '='.`, 'PS019');
          return;
        }

        if (!KEYWORDS.has(varName)) {
          this.handleNewVar(varName, lineNum, col);
          const rhs = line.slice(line.indexOf('=') + 1);
          this.registerTypeHeuristic(varName, rhs, lineNum, col, false);
        }
      }
      
      // Handle := assignments (reassignments)
      const reassignMatch = strippedNoStrings.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*/);
      if (reassignMatch && !/^\s*(if|for|while)\b/.test(strippedNoStrings)) {
        const varName = reassignMatch[1];
        const col = line.indexOf(varName) + 1;
        
        // Check if trying to reassign a const
        if (this.declared.has(varName) && this.constNames.has(varName)) {
          this.addError(lineNum, col, `Cannot reassign const '${varName}' with ':='.`, 'PS019');
          return;
        }
        
        // Check if this is a UDT field assignment (this.field := value)
        const udtFieldMatch = strippedNoStrings.match(/^\s*this\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*/);
        if (udtFieldMatch) {
          // This is a UDT field assignment - it's valid if we're inside a method
          // The UDTValidator will handle field validation separately
          return;
        }
        
        // Check if this is a method parameter (like 'this' or other parameters)
        if (this.isMethodParameter(varName, lineNum)) {
          // This is a method parameter - it's valid
          return;
        }
        
        // Check if variable is declared (for first assignment with :=)
        if (!this.declared.has(varName) && !KEYWORDS.has(varName)) {
          // Let the scope validator emit the primary PS016 for undeclared identifiers.
          return;
        }
      }
    }
  }

  private validateScriptBoundaries(line: string, lineNum: number, strippedNoStrings: string): void {
    // Check for strategy.* calls in indicators
    if (!this.astProcessedStrategyUsage && this.scriptType === 'indicator' && /strategy\./.test(strippedNoStrings)) {
      this.addError(lineNum, 1, "Calls to 'strategy.*' are not allowed in indicators.", 'PS020');
    }

    // Check for plotting and inputs in libraries
    if (!this.astProcessedLibraryRestrictions && this.scriptType === 'library') {
      if (/^\s*plot\s*\(/.test(strippedNoStrings)) {
        this.addError(lineNum, 1, "Plotting functions are not allowed in libraries.", 'PS021');
      }
      if (/input\s*\./.test(strippedNoStrings)) {
        this.addError(lineNum, 1, "Inputs aren't allowed in libraries.", 'PS026');
      }
    }

    // Check for missing strategy.* calls in strategies
    if (!this.astProcessedStrategyUsage && this.scriptType === 'strategy' && !this.hasStrategyCalls && /strategy\./.test(strippedNoStrings)) {
      this.hasStrategyCalls = true;
    }

    // Check for missing plotting in indicators
    if (!this.astProcessedPlottingUsage && this.scriptType === 'indicator' && !this.hasPlotting) {
      const plotsSeries = /^(?:\s*plot\s*\(|\s*plotshape\s*\(|\s*plotchar\s*\(|\s*plotarrow\s*\(|\s*plotbar\s*\(|\s*plotcandle\s*\(|\s*plotohlc\s*\()/;
      const draws = /\b(label\.new|line\.new|linefill\.new|polyline\.new|box\.new|table\.new|table\.cell|bgcolor\s*\(|fill\s*\()/;
      if (plotsSeries.test(strippedNoStrings) || draws.test(strippedNoStrings)) {
        this.hasPlotting = true;
      }
    }
  }

  private detectLoops(line: string, lineNum: number, strippedNoStrings: string): void {
    // Simple loop detection for performance analysis
    if (/^\s*for\s+/.test(strippedNoStrings)) {
      this.inLoop = true;
    } else if (/^\s*while\s+/.test(strippedNoStrings)) {
      this.inLoop = true;
    } else if (/^\s*if\s+/.test(strippedNoStrings) || /^\s*else\s*$/.test(strippedNoStrings)) {
      // Reset loop state when entering if/else blocks (simplified)
      this.inLoop = false;
    }
  }

  private detectControlFlow(line: string, lineNum: number, strippedNoStrings: string): void {
    // Simple control flow analysis for unreachable code detection
    if (this.config.enableControlFlowAnalysis) {
      // Detect function start
      if (/^\s*\w+\s*\([^)]*\)\s*=>/.test(strippedNoStrings)) {
        this.inFunction = true;
        this.hasReturn = false;
        return; // Don't check for unreachable code on the function declaration line
      }
      
      // Detect return statement
      if (this.inFunction && /^\s*return\s+/.test(strippedNoStrings)) {
        this.hasReturn = true;
        return; // Don't check for unreachable code on the return line itself
      }
      
      // Check for unreachable code after return
      if (this.inFunction && this.hasReturn && !/^\s*return\s+/.test(strippedNoStrings) && !/^\s*$/.test(strippedNoStrings)) {
        this.addWarning(lineNum, 1, `Unreachable code after return at line ${lineNum - 1}.`, 'PSC001');
      }
      
      // Reset function state when indentation decreases (function ends)
      const currentIndent = line.match(/^\s*/)?.[0].length || 0;
      if (this.inFunction && currentIndent === 0 && !/^\s*$/.test(strippedNoStrings)) {
        this.inFunction = false;
        this.hasReturn = false;
      }
    }
  }

  private checkBasicSyntax(line: string, lineNum: number, strippedNoStrings: string): void {
    // Check for invalid operators
    const invalidOps = ['===', '!==', '++', '--', '^', '~'];
    for (const op of invalidOps) {
      if (strippedNoStrings.includes(op)) {
        this.addWarning(lineNum, 1, `Operator '${op}' is not valid in Pine Script.`, 'PSO01');
      }
    }

    // Check for logical operators
    if (strippedNoStrings.includes('&&')) {
      this.addWarning(lineNum, 1, "Operator '&&' is not valid in Pine Script. Use 'and' instead.", 'PSO01');
    }
    if (strippedNoStrings.includes('||')) {
      this.addWarning(lineNum, 1, "Operator '||' is not valid in Pine Script. Use 'or' instead.", 'PSO01');
    }

    // Check for assignment in conditions
    if (/^\s*(if|while|for)\s*\([^)]*=\s*[^=]/.test(strippedNoStrings)) {
      this.addWarning(lineNum, 1, 'Assignment "=" inside condition; did you mean "=="?', 'PSO02');
    }

    // V6-specific: Check for numeric literals as conditions
    if (this.config.targetVersion >= 6) {
      const numericCondition = strippedNoStrings.match(/^\s*(if|while)\s+(\d+(?:\.\d+)?)\s*$/);
      if (numericCondition) {
        this.addError(lineNum, 1, 'Numeric literals are not implicitly converted to booleans in v6.', 'PSV6-001', 'Use a comparison like `if value > 0` or `if value != 0`.');
      }
    }

    // V6-specific: Check for numeric variables as conditions (simple pattern matching)
    if (this.config.targetVersion >= 6) {
      const variableCondition = strippedNoStrings.match(/^\s*(if|while)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
      if (variableCondition) {
        const varName = variableCondition[2];
        // Check if this variable was assigned a numeric value in the current scope
        if (this.isNumericVariable(varName)) {
          this.addError(lineNum, 1, 'Numeric variables are not implicitly converted to booleans in v6.', 'PSV6-001', 'Use a comparison like `if value > 0` or `if value != 0`.');
        }
      }
    }

    // V6-specific: Check for linewidth parameter with value < 1
    if (this.config.targetVersion >= 6) {
      const linewidthMatch = strippedNoStrings.match(/linewidth\s*=\s*0\b/);
      if (linewidthMatch) {
        this.addError(lineNum, 1, 'The value for \'linewidth\' must be >= 1, but it was 0.', 'PSV6-002');
      }
    }

    // Performance: Check for many history references on one line
    if (this.config.enablePerformanceAnalysis) {
      const histRefs = strippedNoStrings.match(/\[\s*\d+\s*\]/g);
      if (histRefs && histRefs.length > 5) {
        this.addWarning(lineNum, 1, 'Many history references on one line may impact performance.', 'PSP002');
      }
    }

    // Performance: Check for expensive operations in loops
    if (this.config.enablePerformanceAnalysis && this.inLoop) {
      const expensiveOps = ['request.security', 'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd'];
      for (const op of expensiveOps) {
        if (strippedNoStrings.includes(op)) {
          this.addWarning(lineNum, 1, 'Expensive operation inside loop may impact performance.', 'PSP001');
          break; // Only warn once per line
        }
      }
    }

    // Check for negative history references (but allow negative array indices in v6)
    if (!this.astProcessedNegativeHistory) {
      const negHist = strippedNoStrings.match(/\[\s*-\d+\s*\]/);
      if (negHist) {
        // In Pine Script v6, negative indices are allowed for arrays but not for history references
        if (this.config.targetVersion >= 6) {
          // Check if this is an array operation (array.get, array.set, etc.)
          const beforeBracket = strippedNoStrings.substring(0, negHist.index);
          const isArrayOperation = /array\.(get|set|slice|remove|insert|indexof|lastindexof)\s*\(\s*[^,)]+\s*,\s*$/.test(beforeBracket);

          if (!isArrayOperation) {
            // This is a history reference like close[-1], which is still invalid
            this.addError(lineNum, (negHist.index ?? 0) + 1, 'Invalid history reference: negative indexes are not allowed for series data.', 'PS024', 'Use positive indices like close[1] for historical data, or array.get(myArray, -1) for arrays.');
          }
          // If it's an array operation, allow it (ArrayValidator will handle bounds checking)
        } else {
          // Pre-v6: all negative indices are invalid
          this.addError(lineNum, (negHist.index ?? 0) + 1, 'Invalid history reference: negative indexes are not allowed.', 'PS024');
        }
      }
    }

    // Check for NA comparisons
    if (/(\bna\s*[!=]=)|([!=]=\s*na\b)/.test(strippedNoStrings)) {
      this.addWarning(lineNum, 1, "Direct comparison with 'na' is unreliable. Use na(x), e.g., na(myValue).", 'PS023', 'Replace `x == na` with `na(x)` and `x != na` with `not na(x)`.');
    }
  }

  private performPostValidationChecks(): void {
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
    if (this.brace !== 0) {
      this.addError(this.context.cleanLines.length, 1, 'Unmatched curly braces across script.', 'PS011');
    } else if (this.sawBrace) {
      this.addWarning(this.context.cleanLines.length, 1, 'Curly braces are not used for blocks in Pine Script.', 'PSB01');
    }
    
    if (this.paren !== 0) {
      this.addError(this.context.cleanLines.length, 1, 'Unmatched parentheses across script.', 'PS009');
    }
    if (this.bracket !== 0) {
      this.addError(this.context.cleanLines.length, 1, 'Unmatched square brackets across script.', 'PS010');
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
      if (!this.used.has(name) && !KEYWORDS.has(name) && !this.functionNames.has(name) && !functionParamSet.has(name)) {
        this.addWarning(line, 1, `Variable '${name}' is declared but never used.`, 'PSU01');
      }
    }
  }

  private isNumericVariable(varName: string): boolean {
    // Simple heuristic: check if the variable was assigned a numeric value
    // This is a basic implementation that looks for patterns like "x = 5" or "x = 5.0"
    if (!this.context?.cleanLines) return false;
    
    for (const line of this.context.cleanLines) {
      const stripped = this.stripStringsAndLineComment(line);
      const assignmentMatch = stripped.match(new RegExp(`^\\s*${varName}\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*$`));
      if (assignmentMatch) {
        return true;
      }
    }
    return false;
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

  private parseScriptDeclaration(startLine: number): void {
    let buf = '';
    let depth = 0;

    // iterate from the start line until we close the first (... )
    for (let i = startLine - 1; i < this.context.cleanLines.length; i++) {
      const raw = this.context.cleanLines[i];
      let inStr: '"' | "'" | null = null;
      let esc = false;
      buf += raw + '\n';

      for (let j = 0; j < raw.length; j++) {
        const ch = raw[j];
        if (!inStr && ch === '/' && (raw[j+1]||'') === '/') break;
        if (inStr) { if (esc) { esc = false; continue; } if (ch === '\\') { esc = true; continue; } if (ch === inStr) { inStr = null; continue; } continue; }
        if (ch === '"' || ch === "'") { inStr = ch as '"' | "'"; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }

      if (depth === 0) break;
    }
    
    if (depth !== 0) {
        this.addError(startLine, 1, 'Unclosed script declaration (missing ")").', 'PS004A');
        return;
    }

    const m = buf.match(/^\s*(indicator|strategy|library)\s*\(/);
    if (!m) {
      this.addError(startLine, 1, 'Malformed script declaration.', 'PS004');
      return;
    }
    this.scriptType = m[1] as any;
    this.scriptDeclParsed = true;
    this.context.scriptType = m[1] as any;

    const hasTitle = /\btitle\s*=/.test(buf) || /^\s*(indicator|strategy|library)\s*\(\s*["']/.test(buf);
    // Allow indicator() without title as it's valid in Pine Script
    const isIndicatorWithoutTitle = /^\s*indicator\s*\(\s*\)/.test(buf);
    if (!hasTitle && !isIndicatorWithoutTitle) {
      this.addError(startLine, 1, 'Script declaration should include a title (positional or title=).', 'PS005');
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

      const typeInfo: any = {
        type: normalizedType,
        isConst: false,
        isSeries: meta.isSeries ?? (normalizedType === 'series'),
        declaredAt: { line: lineNum, column: 1 },
        usages: [] as Array<{ line: number; column: number }>
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
        valueType = innerParts[innerParts.length - 1];
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

  private parseTypeFields(typeName: string, startLine: number): void {
    const fields = new Set<string>();
    const typeIndent = this.indentStack[this.indentStack.length - 1];
    
    // Look ahead for field declarations
    for (let i = startLine; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = line.length - line.trimStart().length;
      
      // Stop if we've unindented back to type level or beyond
      if (i > startLine && lineIndent <= typeIndent && line.trim() !== '') {
        break;
      }
      
      // Parse field declarations (simple type field pattern)
      const fieldMatch = line.match(/^\s+(float|int|bool|string|color)\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (fieldMatch) {
        const fieldName = fieldMatch[2];
        fields.add(fieldName);
        this.declared.set(fieldName, i + 1);
        this.declIndent.set(fieldName, lineIndent);
      }
    }
    
    this.typeFields.set(typeName, fields);
  }

  private handleIndentation(line: string, lineNum: number): void {
    const leading = line.match(/^\s*/)?.[0] ?? '';
    if (/\t/.test(leading)) this.sawTabIndent = true;
    if (/^(?: {1,})/.test(leading)) this.sawSpaceIndent = true;

    const indent = line.length - line.trimStart().length;
    const topIndent = this.indentStack[this.indentStack.length - 1];
    const prevLine = this.findPrevNonEmpty(lineNum - 1);
  
    if (indent > 0 && /\binput\.[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(this.stripStringsAndLineComment(line))) {
      this.addWarning(lineNum, 1, 'Inputs should be declared at top level (global scope).', 'PS027');
    }

    if (indent > topIndent) {
      this.indentStack.push(indent);
      
      const endsWithArrow = !!prevLine && /\)\s*=>\s*$/.test(prevLine.trim());
      
      if (prevLine && (QUALIFIED_FN_RE.test(prevLine) || METHOD_DECL_RE.test(prevLine))) {
        const m = prevLine.match(QUALIFIED_FN_RE) || prevLine.match(METHOD_DECL_RE)!;
        const name = m[1];
        const rawParams = (this.functionParams.get(name) || []);
        const params = rawParams.map(p => {
          const cleaned = p.trim().replace(/<[^>]*>/g, '');
          return cleaned.split(/\s+/).pop()!;
        }).filter(Boolean);
        
        this.scopeStack.push({ indent, params: new Set(params), fnName: name, variables: new Set() });
        if(!this.paramUsage.has(name)) this.paramUsage.set(name, new Set());
      } else if (endsWithArrow) {
        const MAX_HDR_LOOKBACK = 8;
        let fnName: string | null = null;
        for (let k = 1; k <= MAX_HDR_LOOKBACK && (lineNum - 1 - k) >= 0; k++) {
          const lno = lineNum - 1 - k;
          const L = (this.context.cleanLines[lno] || '').trim();
          if (/^(if|for|while|switch)\b/.test(L)) break;
          const mStart = L.match(new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(`)) || L.match(new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(`));
          if (mStart) { fnName = mStart[1]; break; }
          if (/\)\s*=>\s*$/.test(L)) break;
        }
        if (fnName && this.functionParams.has(fnName)) {
          const rawParams = (this.functionParams.get(fnName) || []);
          const params = rawParams.map(p => {
            const cleaned = p.trim().replace(/<[^>]*>/g, '');
            return cleaned.split(/\s+/).pop()!;
          }).filter(Boolean);
          this.scopeStack.push({ indent, params: new Set(params), fnName, variables: new Set() });
          if(!this.paramUsage.has(fnName)) this.paramUsage.set(fnName, new Set());
        }
      }
    } else if (indent < topIndent) {
      while (this.indentStack.length > 1 && indent < this.indentStack[this.indentStack.length - 1]) {
        this.indentStack.pop();
      }
      while (this.scopeStack.length > 1 && indent < this.scopeStack[this.scopeStack.length - 1].indent) {
        this.scopeStack.pop();
      }
      if (indent !== this.indentStack[this.indentStack.length - 1]) {
        this.addWarning(lineNum, 1, 'Indentation does not match previous block level.', 'PS018');
      }
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
    if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
      this.addError(line, col, `Identifier '${name}' conflicts with a Pine keyword/builtin.`, 'PS007');
      return;
    }

    const paramsHere = this.currentScope().params;
    if (paramsHere.has(name) && name !== 'this') {
        this.addWarning(line, col, `Identifier '${name}' shadows a function parameter.`, 'PSW05', 'Rename the local or the parameter to avoid confusion.');
    }

    const siteKey = `${line}:${name}`;
    if (this.declaredSites.has(siteKey)) return;
    this.declaredSites.add(siteKey);
    
    const currentIndent = this.indentStack[this.indentStack.length - 1];
    this.declared.set(name, line);
    this.declIndent.set(name, currentIndent);
    
    // Also update the shared context for other validators
    this.context.declaredVars.set(name, line);
  }

  private registerTypeHeuristic(name: string, rhs: string, line: number, col: number, isConst: boolean): void {
    if (isConst) this.constNames.add(name);
    const trimmedRhs = rhs.trim();
    const isSeries = /\[[^\]]+\]/.test(trimmedRhs) || /^(open|high|low|close|volume|time|bar_index|hl2|hlc3|ohlc4|hlcc4)\b/.test(trimmedRhs) || /\bta\./.test(trimmedRhs) || /request\.security/.test(trimmedRhs) || /request\.security_lower_tf/.test(trimmedRhs);
    let ty: 'int' | 'float' | 'bool' | 'string' | 'color' | 'series' | 'line' | 'label' | 'box' | 'table' | 'array' | 'matrix' | 'map' | 'udt' | 'unknown' = 'unknown';
    const s = rhs.trim();
    if (/^(true|false)\b/.test(s)) ty = 'bool';
    else if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/.test(s)) ty = 'string';
    else if (/^[+\-]?\d[\d_]*(?:\.\d[\d_]*)?(?:e[+\-]?\d+)?\b/i.test(s)) {
        ty = s.includes('.') || /e[+\-]/i.test(s) ? 'float' : 'int';
    }
    else if (/\bcolor\.(?:\w+)\b|\bcolor\.new\s*\(/.test(s)) ty = 'color';
    else if (/\b(line|label|box|table)\.new\s*\(/.test(s)) ty = s.match(/\b(line|label|box|table)\.new/)![1] as any;
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
      usages: []
    });
  }

  private scanReferences(line: string, lineNum: number, strippedNoStrings: string): void {
    // Simplified reference scanning - just mark variables as used
    const re = new RegExp(IDENT.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(strippedNoStrings))) {
      const tok = m[0];
      const col = (m.index ?? 0) + 1;
      
      if (WILDCARD_IDENT.has(tok)) { this.used.add(tok); continue; }
      if (KEYWORDS.has(tok) || PSEUDO_VARS.has(tok)) { this.used.add(tok); continue; }
      
      this.used.add(tok);
      if (this.declared.has(tok)) {
        const info = this.context.typeMap.get(tok);
        if (info) {
          info.usages.push({ line: lineNum, column: col });
        }
      }
    }
  }

  private findNamedArgsCached(line: string): Set<string> {
    const s = this.stripStringsAndLineComment(line);
    const out = new Set<string>();
    let depth = 0;
    let inFunctionCall = false;
    
    const isScriptDecl = /^\s*(indicator|strategy|library)\s*\(/.test(s);
    
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '(') {
          depth++;
          if (!isScriptDecl) inFunctionCall = true;
        }
        else if (ch === ')') {
          depth = Math.max(0, depth - 1);
          if (depth === 0) inFunctionCall = false;
        }
        else if (ch === '=' && depth > 0 && inFunctionCall) {
            const prev = s[i - 1] || '';
            const next = s[i + 1] || '';
            if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === ':' || next === '=') continue;
            const left = /[A-Za-z_][A-Za-z0-9_]*\s*$/.exec(s.slice(0, i));
            if (!left) continue;
            const name = left[0].trim();
            const before = s.slice(0, i - name.length).trimEnd();
            const sentinel = before.slice(-1);
            if (sentinel === '(' || sentinel === ',') out.add(name);
        }
    }
    return out;
  }

  private findPrevNonEmpty(lineNum: number): string | null {
    for (let i=lineNum-1;i>=0;i--) { 
      const t=this.context.cleanLines[i].trim(); 
      if (t!=='') return this.context.cleanLines[i]; 
    }
    return null;
  }

  private currentScope() {
      return this.scopeStack[this.scopeStack.length - 1];
  }

  private stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private isMethodParameter(varName: string, lineNum: number): boolean {
    // Check if we're inside a method definition by looking backwards for method declarations
    for (let i = lineNum - 1; i >= 0; i--) {
      const line = this.context.cleanLines[i];
      
      // Look for method declaration: method methodName(...) =>
      const methodMatch = line.match(/^\s*method\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/);
      if (methodMatch) {
        const params = methodMatch[2];
        
        // Check if the variable name is in the method parameters
        // Handle both typed (newX<float>) and untyped (newX) parameters
        const paramList = this.parseParameterList(params);
        for (const param of paramList) {
          const paramName = this.extractParameterName(param);
          if (paramName === varName) {
            return true;
          }
        }
        
        // Also check for 'this' parameter
        if (varName === 'this') {
          return true;
        }
      }
      
      // Stop if we hit a non-indented line (we've left the method scope)
      const currentIndent = this.getLineIndentation(line);
      const nextLineIndent = i < this.context.cleanLines.length - 1 ? 
        this.getLineIndentation(this.context.cleanLines[i + 1]) : 0;
      
      if (currentIndent === 0 && nextLineIndent > 0) {
        // We found a method declaration, but we're past its scope
        break;
      }
    }
    
    return false;
  }

  private parseParameterList(params: string): string[] {
    // Simple parameter parsing - split by comma but handle nested parentheses
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
    // Extract parameter name from typed parameter (e.g., "newX<float>" -> "newX")
    // or return the parameter as-is if untyped
    const match = param.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    return match ? match[1] : param.trim();
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }
}
