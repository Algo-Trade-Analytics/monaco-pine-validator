/**
 * Input Functions Validator
 * 
 * Validates Pine Script v6 Input functions and operations:
 * - Input function parameter validation
 * - Input type validation (int, float, bool, string, color, source, timeframe, session, symbol, resolution)
 * - Input parameter validation (minval, maxval, step, options, group, tooltip, inline, confirm)
 * - Input performance analysis
 * - Input best practices suggestions
 * 
 * Priority 1.3: CRITICAL GAPS - Input Functions (0% Coverage)
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
  type TypeInfo,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
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
import { findAncestor, visit, type NodePath } from '../core/ast/traversal';
import { getNodeSource } from '../core/ast/source-utils';

interface InputFunctionCall {
  name: string;
  line: number;
  column: number;
  arguments: string[];
  parameters: Map<string, string>;
  assignedName?: string | null;
}

const INPUT_RETURN_TYPES: Record<string, { type: TypeInfo['type']; isSeries?: boolean }> = {
  int: { type: 'int' },
  float: { type: 'float' },
  bool: { type: 'bool' },
  string: { type: 'string' },
  color: { type: 'color' },
  source: { type: 'series', isSeries: true },
  timeframe: { type: 'string' },
  session: { type: 'string' },
  symbol: { type: 'string' },
  resolution: { type: 'string' },
  time: { type: 'int' },
  text_area: { type: 'string' },
  price: { type: 'float' },
  enum: { type: 'enum' },
};

export class InputFunctionsValidator implements ValidationModule {
  name = 'InputFunctionsValidator';
  priority = 87; // High priority - input functions are essential for Pine Script

  private helper = new ValidationHelper();
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  // Input function tracking
  private inputFunctionCalls: InputFunctionCall[] = [];
  private inputCount = 0;

  getDependencies(): string[] {
    return ['TypeValidator', 'FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.context = context;
    this.config = config;
    this.reset();

    this.astContext = this.getAstContext(config);

    if (!this.astContext?.ast) {
      return this.helper.buildResult(context);
    }

    this.collectInputFunctionDataAst(this.astContext.ast);

    // Post-process validations
    this.validateInputPerformance();
    this.validateInputBestPractices();
    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.astContext = null;
    this.inputFunctionCalls = [];
    this.inputCount = 0;
  }



  private collectInputFunctionDataAst(program: ProgramNode): void {
    visit(program, {
      CallExpression: {
        enter: (path) => {
          this.processAstInputCall(path as NodePath<CallExpressionNode>);
        },
      },
    });
  }

  private processAstInputCall(path: NodePath<CallExpressionNode>): void {
    const node = path.node;
    const qualifiedName = this.getExpressionQualifiedName(node.callee);
    if (!qualifiedName || !qualifiedName.startsWith('input.')) {
      return;
    }

    const functionName = qualifiedName.slice('input.'.length);
    const args: string[] = [];
    const parameters = new Map<string, string>();

    for (const argument of node.args) {
      const valueText = this.getNodeSource(argument.value).trim();
      if (argument.name) {
        parameters.set(argument.name.name, valueText);
      } else {
        args.push(valueText);
      }
    }

    const callInfo: InputFunctionCall = {
      name: functionName,
      line: node.loc.start.line,
      column: node.loc.start.column,
      arguments: args,
      parameters,
      assignedName: this.getAssignedIdentifier(path),
    };

    const hasRequiredParameters = this.ensureRequiredParameters(functionName, args, parameters, callInfo.line, callInfo.column);

    this.recordInputFunctionCall(callInfo);
    this.validateInputFunction(functionName, args, parameters, callInfo.line, callInfo.column, hasRequiredParameters);
  }

  private ensureRequiredParameters(
    functionName: string,
    args: string[],
    parameters: Map<string, string>,
    lineNum: number,
    column: number,
  ): boolean {
    let isValid = true;

    const hasNamedDefval = parameters.has('defval');
    const hasPositionalDefval = args.length > 0;
    if (!hasNamedDefval && !hasPositionalDefval) {
      this.helper.addError(
        lineNum,
        column,
        `input.${functionName}() requires a default value (defval)`,
        'PSV6-FUNCTION-PARAM-COUNT',
      );
      isValid = false;
    }

    // In Pine Script v6, the title parameter is optional for input functions
    // const positionalIndexForTitle = hasNamedDefval ? 0 : 1;
    // const hasNamedTitle = parameters.has('title');
    // const hasPositionalTitle = args.length > positionalIndexForTitle;
    // if (!hasNamedTitle && !hasPositionalTitle) {
    //   this.helper.addError(
    //     lineNum,
    //     column,
    //     `input.${functionName}() requires a title parameter`,
    //     'PSV6-FUNCTION-PARAM-COUNT',
    //   );
    //   isValid = false;
    // }

    return isValid;
  }

  private validateInputFunction(
    functionName: string,
    args: string[],
    parameters: Map<string, string>,
    lineNum: number,
    column: number,
    hasRequiredParameters: boolean,
  ): void {
    switch (functionName) {
      case 'int':
        this.validateInputInt(args, parameters, lineNum, column);
        break;
      case 'float':
        this.validateInputFloat(args, parameters, lineNum, column);
        break;
      case 'bool':
        this.validateInputBool(args, parameters, lineNum, column);
        break;
      case 'string':
        this.validateInputString(args, parameters, lineNum, column);
        break;
      case 'color':
        this.validateInputColor(args, parameters, lineNum, column);
        break;
      case 'source':
        this.validateInputSource(args, parameters, lineNum, column);
        break;
      case 'timeframe':
        this.validateInputTimeframe(args, parameters, lineNum, column);
        break;
      case 'session':
        this.validateInputSession(args, parameters, lineNum, column);
        break;
      case 'symbol':
        this.validateInputSymbol(args, parameters, lineNum, column);
        break;
      case 'resolution':
        this.validateInputResolution(args, parameters, lineNum, column);
        break;
      case 'time':
        this.validateInputTime(args, parameters, lineNum, column);
        break;
      case 'text_area':
        this.validateInputTextArea(args, parameters, lineNum, column);
        break;
      case 'price':
        this.validateInputPrice(args, parameters, lineNum, column);
        break;
      case 'enum':
        this.validateInputEnum(args, parameters, lineNum, column);
        break;
      default:
        this.helper.addError(lineNum, column, `Unknown input function: input.${functionName}`, 'PSV6-INPUT-UNKNOWN-FUNCTION');
    }

    if (!hasRequiredParameters) {
      // Skip best-practice suggestions that rely on the missing parameters
      return;
    }
  }

  private recordInputFunctionCall(call: InputFunctionCall): void {
    this.inputFunctionCalls.push({
      ...call,
      arguments: [...call.arguments],
      parameters: new Map(call.parameters),
    });
    this.registerInputVariableType(call.assignedName, call.name, call.line, call.column);
    this.inputCount++;
  }

  private registerInputVariableType(name: string | null | undefined, functionName: string, line: number, column: number): void {
    if (!name) {
      return;
    }

    const returnSpec = INPUT_RETURN_TYPES[functionName];
    if (!returnSpec) {
      return;
    }

    if (!this.context.typeMap) {
      this.context.typeMap = new Map();
    }

    const existing = this.context.typeMap.get(name);
    const typeInfo: TypeInfo = existing ?? {
      type: returnSpec.type,
      isConst: false,
      isSeries: Boolean(returnSpec.isSeries),
      declaredAt: { line, column },
      usages: [],
    };

    if (existing) {
      typeInfo.type = returnSpec.type;
      typeInfo.isSeries = Boolean(returnSpec.isSeries);
      typeInfo.declaredAt = typeInfo.declaredAt ?? { line, column };
    }

    this.context.typeMap.set(name, typeInfo);
    this.context.declaredVars?.set?.(name, line);
  }

  private validateInputInt(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value
    const hasNamedDef = parameters.has('defval');
    const defArgInt = parameters.get('defval') ?? args[0];
    const rawDefault = (defArgInt ?? '').trim();
    const defaultValue = this.extractNumericValue(defArgInt ?? '');
    if (!hasNamedDef && defaultValue === null && rawDefault !== 'na') {
      this.helper.addWarning(lineNum, column, 'Default value should be an integer or na', Codes.INPUT_DEFVAL_TYPE);
      const normalized = this.stripQuotes(rawDefault).toLowerCase();
      if (this.isQuotedLiteral(rawDefault) || normalized === 'true' || normalized === 'false') {
        this.helper.addError(lineNum, column, 'defval must be an integer for input.int', Codes.INPUT_DEFVAL_TYPE);
        this.helper.addError(lineNum, column, 'defval must be an integer for input.int', 'PSV6-FUNCTION-PARAM-TYPE');
      }
    }
    const inferredType = this.inferArgumentType(defArgInt ?? '');
    if (inferredType && this.isClearlyNonNumericType(inferredType)) {
      this.helper.addError(lineNum, column, 'defval must be an integer for input.int', 'PSV6-INPUT-DEFVAL-TYPE');
      this.helper.addError(lineNum, column, 'defval must be an integer for input.int', 'PSV6-FUNCTION-PARAM-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'int', defArgInt);
  }

  private validateInputFloat(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value
    const hasNamedDefF = parameters.has('defval');
    const defArgFloat = parameters.get('defval') ?? args[0];
    const rawDefault = (defArgFloat ?? '').trim();
    const defaultValue = this.extractNumericValue(defArgFloat ?? '');
    if (!hasNamedDefF && defaultValue === null && rawDefault !== 'na') {
      this.helper.addWarning(lineNum, column, 'Default value should be a float or na', Codes.INPUT_DEFVAL_TYPE);
      const normalized = this.stripQuotes(rawDefault).toLowerCase();
      if (this.isQuotedLiteral(rawDefault) || normalized === 'true' || normalized === 'false') {
        this.helper.addError(lineNum, column, 'defval must be a number for input.float', Codes.INPUT_DEFVAL_TYPE);
        this.helper.addError(lineNum, column, 'defval must be a number for input.float', 'PSV6-FUNCTION-PARAM-TYPE');
      }
    }
    const inferredType = this.inferArgumentType(defArgFloat ?? '');
    if (inferredType && this.isClearlyNonNumericType(inferredType)) {
      this.helper.addError(lineNum, column, 'defval must be a number for input.float', 'PSV6-INPUT-DEFVAL-TYPE');
      this.helper.addError(lineNum, column, 'defval must be a number for input.float', 'PSV6-FUNCTION-PARAM-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'float', defArgFloat);
  }

  private validateInputBool(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value
    const hasNamedDefB = parameters.has('defval');
    const defArgBool = (parameters.get('defval') ?? args[0] ?? '').trim().toLowerCase();
    const defaultValue = defArgBool;
    if (!hasNamedDefB && !['true', 'false', 'na'].includes(defaultValue)) {
      this.helper.addWarning(lineNum, column, 'Default value should be true, false, or na', 'PSV6-INPUT-DEFAULT-TYPE');
      // Clearly invalid default type for bool
      if (this.isQuotedLiteral(defaultValue) || /^[+\-]?\d+(?:\.\d+)?$/.test(defaultValue)) {
        this.helper.addError(lineNum, column, 'Invalid parameter type for input.bool default', Codes.INPUT_DEFVAL_TYPE);
      }
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'bool', defArgBool);
  }

  private validateInputString(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be string literal or constant)
    const hasNamedDefS = parameters.has('defval');
    const defArgStr = parameters.get('defval') ?? args[0];
    if (!hasNamedDefS && !this.isStringLike(defArgStr ?? '')) {
      this.helper.addWarning(lineNum, column, 'Default value should be a string literal', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'string', defArgStr);
    
    // Special validation for string inputs
    this.validateStringInputParameters(parameters, lineNum, column);
  }

  private validateInputColor(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be color expression)
    const hasNamedDefC = parameters.has('defval');
    const defArgColor = (parameters.get('defval') ?? args[0] ?? '').trim();
    if (!hasNamedDefC && !this.isColorExpression(defArgColor)) {
      this.helper.addWarning(lineNum, column, 'Default value should be a color expression', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'color', defArgColor);
  }

  private validateInputSource(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be series)
    const hasNamedDefSrc = parameters.has('defval');
    const defArgSource = (parameters.get('defval') ?? args[0] ?? '').trim();
    if (!hasNamedDefSrc && !this.isSeriesExpression(defArgSource)) {
      this.helper.addWarning(lineNum, column, 'Default value should be a series expression', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'source', defArgSource);
  }

  private validateInputTimeframe(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be timeframe string)
    const defaultValue = args[0];
    if (this.isStringLiteral(defaultValue) && !this.isValidTimeframe(defaultValue)) {
      this.helper.addWarning(lineNum, column, 'Default value should be a valid timeframe string', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'timeframe', args[0]);
  }

  private validateInputSession(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be session string)
    const defaultValue = args[0];
    if (this.isStringLiteral(defaultValue) && !this.isValidSession(defaultValue)) {
      this.helper.addWarning(lineNum, column, 'Default value should be a valid session string', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'session', args[0]);
  }

  private validateInputSymbol(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be string literal)
    if (!this.isStringLiteral(args[0])) {
      this.helper.addWarning(lineNum, column, 'Default value should be a string literal', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'symbol', args[0]);
  }

  private validateInputResolution(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be string literal)
    if (!this.isStringLiteral(args[0])) {
      this.helper.addWarning(lineNum, column, 'Default value should be a string literal', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'resolution', args[0]);
  }

  private validateInputTime(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Default value should be an int (timestamp) or timestamp() call
    const defaultValue = parameters.get('defval') ?? args[0];
    if (defaultValue && !this.isNumericOrTimestamp(defaultValue)) {
      this.helper.addWarning(lineNum, column, 'Default value should be a timestamp or timestamp() call', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'time', defaultValue);
  }

  private validateInputTextArea(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be string literal)
    const defaultValue = parameters.get('defval') ?? args[0];
    if (defaultValue && !this.isStringLiteral(defaultValue)) {
      this.helper.addWarning(lineNum, column, 'Default value should be a string literal', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'text_area', defaultValue);
  }

  private validateInputPrice(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate default value (should be numeric)
    const defaultValue = parameters.get('defval') ?? args[0];
    if (defaultValue && !this.isNumericLike(defaultValue)) {
      this.helper.addWarning(lineNum, column, 'Default value should be a numeric expression', 'PSV6-INPUT-DEFAULT-TYPE');
    }

    // Validate parameters
    this.validateInputParameters(parameters, lineNum, column, 'price', defaultValue);
  }

  private isNumericOrTimestamp(value: string): boolean {
    return this.isNumericLike(value) || value.trim().startsWith('timestamp(');
  }

  private isNumericLike(value: string): boolean {
    const trimmed = value.trim();
    // Check if it's a number literal, variable, or numeric function call
    return /^-?\d+(\.\d+)?$/.test(trimmed) || // number literal
           /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed) || // variable
           /^[a-zA-Z_][a-zA-Z0-9_]*\(/.test(trimmed); // function call
  }

  private validateInputParameters(parameters: Map<string, string>, lineNum: number, column: number, inputType: string, defaultArg?: string): void {
    // Resolve defval override for downstream comparisons
    const resolvedDefaultArg = parameters.has('defval') ? parameters.get('defval')! : (defaultArg ?? '');

    for (const [paramName, paramValue] of parameters) {
      switch (paramName) {
        case 'defval':
          this.validateDefvalParameter(paramValue, inputType, lineNum, column);
          break;
        case 'title':
          this.validateTitleParameter(paramValue, lineNum, column);
          break;
        case 'minval':
          this.validateMinvalParameter(paramValue, inputType, lineNum, column, resolvedDefaultArg);
          break;
        case 'maxval':
          this.validateMaxvalParameter(paramValue, inputType, lineNum, column, resolvedDefaultArg);
          break;
        case 'step':
          this.validateStepParameter(paramValue, inputType, lineNum, column);
          break;
        case 'options':
          this.validateOptionsParameter(paramValue, lineNum, column);
          break;
        case 'group':
          this.validateGroupParameter(paramValue, lineNum, column);
          break;
        case 'tooltip':
          this.validateTooltipParameter(paramValue, lineNum, column);
          break;
        case 'inline':
          this.validateInlineParameter(paramValue, lineNum, column);
          break;
        case 'confirm':
          this.validateConfirmParameter(paramValue, lineNum, column);
          break;
        case 'multiline':
          this.validateMultilineParameter(paramValue, lineNum, column);
          break;
        default:
          this.helper.addWarning(lineNum, column, `Unknown input parameter: ${paramName}`, 'PSV6-INPUT-UNKNOWN-PARAMETER');
      }
    }
  }

  private validateDefvalParameter(value: string, inputType: string, lineNum: number, column: number): void {
    const v = value?.trim() ?? '';
    switch (inputType) {
      case 'int': {
        const n = this.extractNumericValue(v);
        if (n === null || !/^[-+]?\d+$/.test(v.replace(/^['"]|['"]$/g, ''))) {
          this.helper.addError(lineNum, column, 'defval must be an integer for input.int', 'PSV6-INPUT-DEFVAL-TYPE');
          this.helper.addError(lineNum, column, 'defval must be an integer for input.int', 'PSV6-FUNCTION-PARAM-TYPE');
        }
        break;
      }
      case 'float': {
        const n = this.extractNumericValue(v);
        if (n === null) {
          this.helper.addError(lineNum, column, 'defval must be a number for input.float', 'PSV6-INPUT-DEFVAL-TYPE');
          this.helper.addError(lineNum, column, 'defval must be a number for input.float', 'PSV6-FUNCTION-PARAM-TYPE');
        }
        break;
      }
      case 'bool': {
        const b = v.toLowerCase();
        if (!(b === 'true' || b === 'false')) {
          this.helper.addError(lineNum, column, 'defval must be true/false for input.bool', 'PSV6-INPUT-DEFVAL-TYPE');
        }
        break;
      }
      case 'string': {
        if (!this.isStringLike(v)) {
          this.helper.addError(lineNum, column, 'defval must be a string literal for input.string', 'PSV6-INPUT-DEFVAL-TYPE');
        }
        break;
      }
      case 'color': {
        if (!this.isColorExpression(v)) {
          this.helper.addError(lineNum, column, 'defval must be a color expression for input.color', 'PSV6-INPUT-DEFVAL-TYPE');
        }
        break;
      }
      case 'source': {
        if (!this.isSeriesExpression(v)) {
          this.helper.addError(lineNum, column, 'defval must be a series (e.g., close) for input.source', 'PSV6-INPUT-DEFVAL-TYPE');
        }
        break;
      }
      case 'timeframe':
      case 'session':
      case 'symbol':
      case 'resolution': {
        if (!this.isStringLike(v)) {
          this.helper.addError(lineNum, column, `defval must be a string literal for input.${inputType}`, 'PSV6-INPUT-DEFVAL-TYPE');
        }
        break;
      }
    }
  }

  private validateTitleParameter(value: string, lineNum: number, column: number): void {
    if (!this.isStringLike(value)) {
      this.helper.addWarning(lineNum, column, 'title parameter should be a string literal', 'PSV6-INPUT-TITLE-WARNING');
      return;
    }
    const clean = this.extractStringLiteralValue(value);
    if (clean && clean.length > 80) {
      this.helper.addInfo(lineNum, column, 'Input title is long; consider shortening', 'PSV6-INPUT-TITLE-LENGTH');
    }
  }

  private validateMinvalParameter(value: string, inputType: string, lineNum: number, column: number, defaultArg?: string): void {
    const numValue = this.extractNumericValue(value);
    if (numValue === null) {
      this.helper.addError(lineNum, column, 'minval parameter should be a numeric value', 'PSV6-INPUT-PARAM-TYPE');
      return;
    }

    // Check for reasonable minval values
    if (numValue < -1000000 || numValue > 1000000) {
      this.helper.addWarning(lineNum, column, 'minval parameter has an extreme value', 'PSV6-INPUT-MINVAL-WARNING');
    }

    // Suggest when minval > default value
    if (defaultArg) {
      const def = this.extractNumericValue(defaultArg);
      if (def !== null && numValue > def) {
        this.helper.addWarning(lineNum, column, 'minval is greater than the default value', 'PSV6-INPUT-MINVAL-WARNING');
      }
    }
  }

  private validateMaxvalParameter(value: string, inputType: string, lineNum: number, column: number, defaultArg?: string): void {
    const numValue = this.extractNumericValue(value);
    if (numValue === null) {
      this.helper.addError(lineNum, column, 'maxval parameter should be a numeric value', 'PSV6-INPUT-PARAM-TYPE');
      return;
    }

    // Check for reasonable maxval values
    if (numValue < -1000000 || numValue > 1000000) {
      this.helper.addWarning(lineNum, column, 'maxval parameter has an extreme value', 'PSV6-INPUT-MAXVAL-WARNING');
    }

    // Suggest when maxval < default value
    if (defaultArg) {
      const def = this.extractNumericValue(defaultArg);
      if (def !== null && numValue < def) {
        this.helper.addWarning(lineNum, column, 'maxval is less than the default value', 'PSV6-INPUT-MAXVAL-WARNING');
      }
    }
  }

  private validateStepParameter(value: string, inputType: string, lineNum: number, column: number): void {
    const numValue = this.extractNumericValue(value);
    if (numValue === null) {
      this.helper.addError(lineNum, column, 'step parameter should be a numeric value', 'PSV6-INPUT-PARAM-TYPE');
      return;
    }

    if (numValue <= 0) {
      this.helper.addWarning(lineNum, column, 'step parameter should be positive', 'PSV6-INPUT-STEP-WARNING');
    }

    if (numValue < 0.0001) {
      this.helper.addWarning(lineNum, column, 'step parameter is very small', 'PSV6-INPUT-STEP-WARNING');
    }
  }

  private validateOptionsParameter(value: string, lineNum: number, column: number): void {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.substring(1, trimmed.length - 1);
      const elements = this.splitTopLevelList(inner);
      const invalid = elements.filter(element => element && !this.isStringLike(element));
      if (invalid.length > 0) {
        this.helper.addWarning(lineNum, column, 'options array should contain string literals or string constants', 'PSV6-INPUT-OPTIONS-WARNING');
      }
      return;
    }

    if (this.isStringLike(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo?.type === 'array') {
        return;
      }
    }

    this.helper.addWarning(lineNum, column, 'options parameter should be an array', 'PSV6-INPUT-OPTIONS-WARNING');
  }

  private validateGroupParameter(value: string, lineNum: number, column: number): void {
    // Group parameter should be a string literal
    if (!this.isStringLike(value)) {
      this.helper.addWarning(lineNum, column, 'group parameter should be a string literal', 'PSV6-INPUT-GROUP-WARNING');
    }
  }

  private validateTooltipParameter(value: string, lineNum: number, column: number): void {
    // Tooltip parameter should be a string literal
    if (!this.isStringLike(value)) {
      this.helper.addWarning(lineNum, column, 'tooltip parameter should be a string literal', 'PSV6-INPUT-TOOLTIP-WARNING');
      return;
    }
    const clean = this.extractStringLiteralValue(value);
    if (clean) {
      if (clean.length > 120) {
        this.helper.addInfo(lineNum, column, 'Tooltip seems long; keep it concise for IDE UI', 'PSV6-INPUT-TOOLTIP-LENGTH');
      }
      if (/\n{2,}/.test(clean)) {
        this.helper.addWarning(lineNum, column, 'Tooltip contains multiple newlines; simplify formatting', 'PSV6-INPUT-TOOLTIP-FORMAT');
      }
    }
  }

  private validateInlineParameter(value: string, lineNum: number, column: number): void {
    // Inline parameter should be a string literal
    if (!this.isStringLike(value)) {
      this.helper.addWarning(lineNum, column, 'inline parameter should be a string literal', 'PSV6-INPUT-INLINE-WARNING');
    }
  }

  private validateConfirmParameter(value: string, lineNum: number, column: number): void {
    const boolValue = value.trim().toLowerCase();
    if (!['true', 'false'].includes(boolValue)) {
      this.helper.addWarning(lineNum, column, 'confirm parameter should be true or false', 'PSV6-INPUT-CONFIRM-WARNING');
    }
  }

  private validateMultilineParameter(value: string, lineNum: number, column: number): void {
    const boolValue = value.trim().toLowerCase();
    if (!['true', 'false'].includes(boolValue)) {
      this.helper.addWarning(lineNum, column, 'multiline parameter should be true or false', 'PSV6-INPUT-MULTILINE-WARNING');
    }
  }

  private validateStringInputParameters(parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate options parameter for string inputs
    if (parameters.has('options')) {
      const optionsValue = parameters.get('options')!;
      // This is a basic check - in a real implementation, you'd parse the array
      if (optionsValue.includes('[]') || optionsValue === '[]') {
        this.helper.addWarning(lineNum, column, 'Empty options array for string input', 'PSV6-INPUT-OPTIONS-WARNING');
      }
    }
  }

  private validateInputPerformance(): void {
    // Check for too many input functions
    if (this.inputCount > 25) {
      this.helper.addWarning(1, 1,
        `Too many input functions detected (${this.inputCount}). Consider grouping related inputs.`,
        'PSV6-INPUT-TOO-MANY');
    }

    // Check for complex input expressions
    for (const call of this.inputFunctionCalls) {
      const defaultArg = call.parameters.get('defval') ?? call.arguments[0];
      if (this.hasComplexExpression(defaultArg ?? '')) {
        this.helper.addWarning(call.line, call.column,
          'Complex expression used as input default value. Consider using simpler expressions.',
          'PSV6-INPUT-COMPLEX-EXPRESSION');
      }
    }
  }

  private validateInputBestPractices(): void {
    // Check for poor variable naming
    const poorNames = new Set(['a', 'b', 'c', 'x', 'y', 'z', 'temp', 'flag', 'val', 'value']);

    for (const call of this.inputFunctionCalls) {
      const variableName = call.assignedName;
      if (variableName && poorNames.has(variableName)) {
        this.helper.addInfo(call.line, call.column,
          `Consider using a more descriptive name instead of '${variableName}'`,
          'PSV6-INPUT-NAMING-SUGGESTION');
      }
    }

    // Check for missing tooltips
    let inputsWithoutTooltips = 0;
    for (const call of this.inputFunctionCalls) {
      if (!call.parameters.has('tooltip')) {
        inputsWithoutTooltips++;
      }
    }

    if (inputsWithoutTooltips > this.inputCount * 0.5) {
      this.helper.addInfo(1, 1,
        'Consider adding tooltips to input functions to improve user experience',
        'PSV6-INPUT-TOOLTIP-SUGGESTION');
    }

    // Check for input grouping
    const groups = new Set<string>();
    for (const call of this.inputFunctionCalls) {
      if (call.parameters.has('group')) {
        groups.add(call.parameters.get('group')!);
      }
    }

    if (this.inputCount >= 4 && groups.size === 0) {
      this.helper.addInfo(1, 1,
        'Consider grouping related input functions using the group parameter',
        'PSV6-INPUT-GROUP-SUGGESTION');
    }

    // Check for reasonable default values
    for (const call of this.inputFunctionCalls) {
      const defaultValue = call.parameters.get('defval') ?? call.arguments[0];
      if (this.isUnreasonableDefault(defaultValue)) {
        this.helper.addInfo(call.line, call.column,
          'Consider using a more reasonable default value',
          'PSV6-INPUT-DEFAULT-SUGGESTION');
      }
    }
  }

  private getAssignedIdentifier(path: NodePath<CallExpressionNode>): string | null {
    const assignment = findAncestor(path, (ancestor): ancestor is NodePath<AssignmentStatementNode> => {
      return ancestor.node.kind === 'AssignmentStatement';
    });
    if (assignment && (assignment.node as AssignmentStatementNode).right === path.node) {
      const left = (assignment.node as AssignmentStatementNode).left;
      if (left.kind === 'Identifier') {
        return (left as IdentifierNode).name;
      }
    }

    const declaration = findAncestor(path, (ancestor): ancestor is NodePath<VariableDeclarationNode> => {
      return ancestor.node.kind === 'VariableDeclaration';
    });
    if (declaration && (declaration.node as VariableDeclarationNode).initializer === path.node) {
      return (declaration.node as VariableDeclarationNode).identifier.name;
    }

    return null;
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return (expression as IdentifierNode).name;
    }
    if (expression.kind === 'MemberExpression') {
      const member = expression as MemberExpressionNode;
      if (member.computed) {
        return null;
      }
      const objectName = this.getExpressionQualifiedName(member.object);
      if (!objectName) {
        return null;
      }
      return `${objectName}.${member.property.name}`;
    }
    return null;
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode | CallExpressionNode): string {
    return getNodeSource(this.context, node);
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
  }

  // Helper methods
  private extractNumericValue(arg: string): number | null {
    if (!arg) return null;
    const trimmed = arg.trim();
    // Support both .05 and 0.05 formats (Pine Script accepts both)
    const match = trimmed.match(/^[+\-]?(?:\d+\.\d*|\.\d+|\d+)$/);
    return match ? parseFloat(trimmed) : null;
  }

  private stripQuotes(value: string): string {
    const trimmed = value.trim();
    const match = trimmed.match(/^(["'])(.*)\1$/);
    return match ? match[2] : trimmed;
  }

  private isQuotedLiteral(value: string): boolean {
    const trimmed = value.trim();
    return /^(["']).*\1$/.test(trimmed);
  }

  private splitTopLevelList(value: string): string[] {
    const elements: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (!inString && (ch === '"' || ch === '\'')) {
        inString = true;
        stringChar = ch;
        current += ch;
        continue;
      }
      if (inString) {
        current += ch;
        if (ch === stringChar) {
          inString = false;
          stringChar = '';
        }
        continue;
      }
      if (ch === '[' || ch === '(' || ch === '{' || ch === '<') {
        depth++;
        current += ch;
        continue;
      }
      if (ch === ']' || ch === ')' || ch === '}' || ch === '>') {
        depth = Math.max(0, depth - 1);
        current += ch;
        continue;
      }
      if (ch === ',' && depth === 0) {
        elements.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }

    if (current.trim()) {
      elements.push(current.trim());
    }

    return elements;
  }

  private extractStringLiteralValue(value: string): string | null {
    if (!this.isStringLiteral(value)) {
      return null;
    }
    return value.replace(/^"|"$|^'|'$/g, '');
  }

  private isStringLike(arg: string | undefined | null): boolean {
    if (!arg) return false;
    const trimmed = arg.trim();
    if (!trimmed) return false;
    if (this.isStringLiteral(trimmed)) {
      return true;
    }

    const identifierMatch = trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
    if (identifierMatch) {
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo && (typeInfo.type === 'string' || typeInfo.enumType === 'string')) {
        return true;
      }
      if (/^[A-Z0-9_]+$/.test(trimmed)) {
        return true;
      }
    }

    return false;
  }

  private isStringLiteral(arg: string): boolean {
    const trimmed = arg.trim();
    return (trimmed.startsWith('"') && trimmed.endsWith('"')) || 
           (trimmed.startsWith("'") && trimmed.endsWith("'"));
  }

  private isColorExpression(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.includes('color.') || 
           trimmed.startsWith('#') || 
           trimmed.startsWith('rgb') ||
           trimmed === 'na';
  }

  private isSeriesExpression(value: string): boolean {
    const trimmed = value.trim();
    const seriesKeywords = ['close', 'open', 'high', 'low', 'volume', 'hl2', 'hlc3', 'ohlc4'];
    return seriesKeywords.some(keyword => trimmed.includes(keyword));
  }

  private isValidTimeframe(value: string): boolean {
    const cleanValue = value.replace(/^"|"$|^'|'$/g, '');
    const timeframePattern = /^\d+[DWMYH]?$/;
    return timeframePattern.test(cleanValue);
  }

  private isValidSession(value: string): boolean {
    const cleanValue = value.replace(/^"|"$|^'|'$/g, '');
    const sessionPattern = /^\d{4}-\d{4}$/;
    return sessionPattern.test(cleanValue);
  }

  private hasComplexExpression(expression: string): boolean {
    // Remove string literals to avoid false positives from parentheses in strings
    const withoutStrings = expression.replace(/"[^"]*"|'[^']*'/g, '');
    
    const complexPatterns = [
      /ta\./,
      /math\./,
      /str\./,
      /\(/,  // Function calls (after removing string literals)
      /\+|\-|\*|\//
    ];
    return complexPatterns.some(pattern => pattern.test(withoutStrings));
  }

  private isUnreasonableDefault(value: string): boolean {
    if (!value) return false;
    const numValue = this.extractNumericValue(value);
    if (numValue !== null) {
      return Math.abs(numValue) > 100000 || (numValue !== 0 && Math.abs(numValue) < 0.000001);
    }
    
    const cleanValue = value.replace(/^"|"$|^'|'$/g, '');
    return cleanValue.length > 100;
  }

  private validateInputEnum(args: string[], parameters: Map<string, string>, lineNum: number, column: number): void {
    // Validate required parameters for input.enum()
    // input.enum() requires at least the default value (positional or named)
    const hasDefaultValue = args.length > 0 || parameters.has('defval');
    const hasTitle = args.length > 1 || parameters.has('title');
    
    if (!hasDefaultValue) {
      this.helper.addError(lineNum, column, 'input.enum() requires a default value (e.g., MyEnum.VALUE)', 'PSV6-INPUT-ENUM-ARGS');
      return;
    }

    // Validate default value is an enum member reference
    const defaultValue = args.length > 0 ? args[0] : parameters.get('defval') || '';
    if (defaultValue && !defaultValue.includes('.')) {
      this.helper.addError(lineNum, column, 'input.enum() default value must be an enum member (e.g., MyEnum.VALUE)', 'PSV6-INPUT-ENUM-DEFAULT');
    }

    // Validate optional parameters
    this.validateInputParameters(parameters, lineNum, column, 'enum');
  }

  private inferArgumentType(value: string): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    if (/^[+-]?\d+$/.test(trimmed)) {
      return 'int';
    }
    if (/^[+-]?(?:\d*\.\d+|\d+\.\d*)$/.test(trimmed)) {
      return 'float';
    }

    const lower = trimmed.toLowerCase();
    if (lower === 'na') {
      return 'na';
    }
    if (lower === 'true' || lower === 'false') {
      return 'bool';
    }

    if (this.isQuotedLiteral(trimmed)) {
      return 'string';
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap?.get(trimmed);
      if (typeInfo) {
        const baseType = (typeInfo.type ?? 'unknown').toLowerCase();
        if (typeInfo.isSeries || baseType.startsWith('series')) {
          return 'series';
        }
        return baseType;
      }
    }

    return null;
  }

  private isClearlyNonNumericType(type: string): boolean {
    const normalized = type.toLowerCase();
    if (normalized === 'na') {
      return false;
    }
    if (normalized === 'series') {
      return false;
    }
    return ['string', 'bool', 'color', 'enum', 'udt', 'array', 'map'].some((disallowed) =>
      normalized.startsWith(disallowed),
    );
  }

  // Getter methods for other modules
  getInputFunctionCalls(): InputFunctionCall[] {
    return [...this.inputFunctionCalls];
  }

  getInputCount(): number {
    return this.inputCount;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
