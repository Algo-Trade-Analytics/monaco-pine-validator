import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../core/types';
import {
  type ArgumentNode,
  type BinaryExpressionNode,
  type CallExpressionNode,
  type ExpressionNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ParameterNode,
  type ProgramNode,
  type TypeReferenceNode,
  type UnaryExpressionNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import { BUILTIN_FUNCTIONS_V6_RULES, KEYWORDS, NAMESPACES, NS_MEMBERS } from '../core/constants';

interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType: string;
  line: number;
  column: number;
  isMethod: boolean;
  implicitOffset: number;
  requiredParams: number;
  totalParams: number;
  rawParams: string[];
  node?: FunctionDeclarationNode;
  identifier?: IdentifierNode | null;
}

interface FunctionSignatureMeta {
  rawParams: string[];
  requiredParams: number;
  totalParams: number;
  implicitOffset: number;
  line: number;
  isMethod: boolean;
}

interface FunctionCall {
  name: string;
  arguments: string[];
  line: number;
  column: number;
  startIndex: number;
  astNode?: CallExpressionNode;
  astPath?: NodePath<CallExpressionNode>;
}

export class FunctionValidator implements ValidationModule {
  name = 'FunctionValidator';
  priority = 85; // High priority - functions are core to Pine Script

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  // Function tracking (extracted from EnhancedPineScriptValidator)
  private functionNames = new Set<string>();
  private methodNames = new Set<string>();
  private functionParams = new Map<string, FunctionSignatureMeta[]>();
  private functionHeaderLine = new Map<string, number>();
  private paramUsage = new Map<string, Set<string>>();
  private userFunctions: Map<string, FunctionInfo[]> = new Map();
  private functionCalls: FunctionCall[] = [];
  private readonly allowedInstanceMethods = new Set([
    'push','pop','get','set','size','clear','reverse','sort','sort_indices','copy','slice','concat','fill','from','from_example',
    'indexof','lastindexof','includes','binary_search','binary_search_leftmost','binary_search_rightmost','range','remove','insert',
    'unshift','shift','first','last','max','min','median','mode','abs','sum','avg','stdev','variance','standardize','covariance',
    'percentile_linear_interpolation','percentile_nearest_rank','percentrank','some','every','delete'
  ]);

  private isDebugEnabled(): boolean {
    const env = (globalThis as any)?.process?.env;
    return !!env && env.DEBUG_FUNC === '1';
  }

  getDependencies(): string[] {
    return ['SyntaxValidator']; // Depends on basic syntax validation
  }

  private extractParamName(param: string): string {
    const withoutDefault = param.split('=')[0]?.trim() ?? '';
    const cleaned = withoutDefault.replace(/<[^>]*>/g, '').trim();
    if (!cleaned) return '';
    const tokens = cleaned.split(/\s+/);
    return tokens[tokens.length - 1] ?? '';
  }

  private computeRequiredParams(params: string[]): number {
    return params.reduce((count, param) => {
      return count + (param.includes('=') ? 0 : 1);
    }, 0);
  }

  private createFunctionInfo(
    name: string,
    params: string[],
    line: number,
    column: number,
    isMethod: boolean,
    options: { node?: FunctionDeclarationNode; identifier?: IdentifierNode | null } = {},
  ): FunctionInfo {
    const parameterNames = params.map(p => this.extractParamName(p)).filter(Boolean);
    const totalParams = params.length;
    const requiredParams = this.computeRequiredParams(params);
    const implicitOffset = isMethod ? 1 : 0;

    const info: FunctionInfo = {
      name,
      parameters: parameterNames,
      returnType: 'unknown',
      line,
      column,
      isMethod,
      implicitOffset,
      requiredParams,
      totalParams,
      rawParams: params,
      node: options.node,
      identifier: options.identifier,
    };
    return info;
  }

  private createSignatureMeta(params: string[], isMethod: boolean, line: number): FunctionSignatureMeta {
    return {
      rawParams: params,
      requiredParams: this.computeRequiredParams(params),
      totalParams: params.length,
      implicitOffset: isMethod ? 1 : 0,
      line,
      isMethod
    };
  }

  private signatureHasExplicitTypes(params: string[]): boolean {
    return params.every((param, index) => {
      const trimmed = param.split('=')[0]?.trim() ?? '';
      if (!trimmed) return false;
      if (index === 0 && /^this\b/.test(trimmed)) return true;
      const tokens = trimmed.replace(/<[^>]*>/g, '').trim().split(/\s+/);
      return tokens.length >= 2;
    });
  }

  private registerFunctionSignature(
    name: string,
    params: string[],
    lineNum: number,
    isMethod: boolean,
    checkDuplicateParams = true
  ): void {
    this.functionNames.add(name);
    const signature = this.createSignatureMeta(params, isMethod, lineNum);
    this.addFunctionSignature(name, signature);

    const funcInfo = this.createFunctionInfo(name, params, lineNum, 1, isMethod);
    this.addUserFunction(name, funcInfo);

    if (!checkDuplicateParams) {
      return;
    }

    const seen = new Set<string>();
    funcInfo.parameters.forEach((paramName, idx) => {
      if (!paramName) return;
      if (funcInfo.isMethod && idx === 0 && paramName === 'this') {
        if (seen.has(paramName)) {
          this.addError(lineNum, 1, `Duplicate 'this' parameter in method '${name}'.`, 'PSDUP01');
        }
        seen.add(paramName);
        return;
      }
      if (seen.has(paramName)) {
        this.addError(lineNum, 1, `Duplicate parameter '${paramName}' in function '${name}'.`, 'PSDUP01');
      }
      seen.add(paramName);
    });
  }

  private addFunctionSignature(name: string, signature: FunctionSignatureMeta): void {
    if (!this.functionParams.has(name)) {
      this.functionParams.set(name, []);
    }
    this.functionParams.get(name)!.push(signature);
    if (!this.functionHeaderLine.has(name)) {
      this.functionHeaderLine.set(name, signature.line);
    }
  }

  private addUserFunction(name: string, info: FunctionInfo): void {
    if (!this.userFunctions.has(name)) {
      this.userFunctions.set(name, []);
    }
    this.userFunctions.get(name)!.push(info);
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.astContext = this.getAstContext(config);
    const program = this.astContext?.ast;

    if (!program) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    // Extract comprehensive function validation logic from EnhancedPineScriptValidator
    // NOTE: FunctionDeclarationsValidator also collects functions, but this module needs its own
    // collection for complete validation. Future optimization: coordinate with FunctionDeclarationsValidator
    this.collectFunctionsFromAst(program);

    if (this.isDebugEnabled()) {
      console.log('[FunctionValidator] collected names', Array.from(this.functionNames));
      console.log('[FunctionValidator] collected params map', Array.from(this.functionParams.entries()));
      console.log('[FunctionValidator] userFunctions', Array.from(this.userFunctions.keys()));
    }

    // Update the shared context with function information early so downstream checks see method definitions
    if (this.context.functionNames) {
      for (const funcName of this.functionNames) {
        this.context.functionNames.add(funcName);
      }
    }

    this.validateFunctionCalls();
    this.validateUserFunctions();
    this.checkUnusedParameters();
    this.validateDuplicateFunctions();
    this.validateInconsistentReturnTypes();
    this.validatePerformanceIssues();
    this.validateFunctionComplexity();

    // Update the shared context with function information
    // Function metadata already shared before validation

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
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.functionNames.clear();
    this.methodNames.clear();
    this.functionParams.clear();
    this.functionHeaderLine.clear();
    this.paramUsage.clear();
    this.userFunctions.clear();
    this.functionCalls = [];
    this.astContext = null;
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private collectFunctionsFromAst(program: ProgramNode): void {
    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          this.processAstFunctionDeclaration(path.node as FunctionDeclarationNode);
        },
      },
    });
  }

  private processAstFunctionDeclaration(fn: FunctionDeclarationNode): void {
    if (!fn.identifier) {
      return;
    }

    const fullName = fn.identifier.name;
    const params = fn.params.map((param) => this.formatAstParameter(param));
    const paramNames = fn.params.map((param) => param.identifier.name).filter(Boolean);
    const line = fn.loc?.start.line ?? 1;
    const column = fn.loc?.start.column ?? 1;
    const hasThisParam = fn.params.length > 0 && fn.params[0].identifier.name === 'this';
    const isMethodCandidate = fullName.includes('.');
    const isMethod = isMethodCandidate && hasThisParam;
    const storeName = isMethod ? fullName.split('.').pop() ?? fullName : fullName;

    if (isMethod) {
      this.methodNames.add(storeName);
      this.context.methodNames?.add(storeName);
    }

    this.storeAstFunctionSignature(storeName, params, line, column, isMethod, paramNames, {
      checkDuplicates: true,
      node: fn,
      identifier: fn.identifier,
    });

    if (isMethod && fullName !== storeName) {
      this.storeAstFunctionSignature(fullName, params, line, column, isMethod, paramNames, { checkDuplicates: false });
    }
  }

  private storeAstFunctionSignature(
    name: string,
    params: string[],
    line: number,
    column: number,
    isMethod: boolean,
    paramNames: string[],
    options: { checkDuplicates?: boolean; node?: FunctionDeclarationNode; identifier?: IdentifierNode | null } = {},
  ): void {
    this.functionNames.add(name);
    const signature = this.createSignatureMeta(params, isMethod, line);
    this.addFunctionSignature(name, signature);

    if (!this.functionHeaderLine.has(name)) {
      this.functionHeaderLine.set(name, line);
    }

    if (!this.context.functionParams.has(name)) {
      this.context.functionParams.set(name, params);
    }

    const info = this.createFunctionInfo(name, params, line, column, isMethod, {
      node: options.node,
      identifier: options.identifier,
    });
    this.addUserFunction(name, info);

    if (options.checkDuplicates === false) {
      return;
    }

    const seen = new Set<string>();
    for (const [index, paramName] of paramNames.entries()) {
      if (!paramName) {
        continue;
      }
      if (seen.has(paramName)) {
        const message = paramName === 'this' && isMethod
          ? `Duplicate 'this' parameter in method '${name}'.`
          : `Duplicate parameter '${paramName}' in function '${name}'.`;
        this.addError(line, column, message, 'PSDUP01');
      }
      seen.add(paramName);
    }
  }

  private formatAstParameter(param: ParameterNode): string {
    const typeAnnotation = param.typeAnnotation ? `${this.stringifyAstTypeReference(param.typeAnnotation)} ` : '';
    const name = param.identifier.name;
    const defaultValue = param.defaultValue ? ' = <default>' : '';
    return `${typeAnnotation}${name}${defaultValue}`.trim();
  }

  private stringifyAstTypeReference(type: TypeReferenceNode): string {
    const base = type.name.name;
    if (!type.generics.length) {
      return base;
    }
    const generics = type.generics.map((generic) => this.stringifyAstTypeReference(generic));
    return `${base}<${generics.join(', ')}>`;
  }

  /**
   * Validate function calls (extracted from UltimateValidator.validateFunctionCalls)
   */
  private validateFunctionCalls(): void {
    if (this.astContext?.ast) {
      this.collectFunctionCallsFromAst(this.astContext.ast);
    }

    // Validate all collected function calls
    for (const call of this.functionCalls) {
      this.validateSingleFunctionCall(call);
    }
  }

  private collectFunctionCallsFromAst(program: ProgramNode): void {
    visit(program, {
      CallExpression: {
        enter: (path) => {
          const node = path.node as CallExpressionNode;
          const qualifiedName = this.getExpressionQualifiedName(node.callee);
          if (!qualifiedName || /^(indicator|strategy|library)$/.test(qualifiedName)) {
            return;
          }

          const line = node.loc?.start.line ?? 1;
          const column = node.loc?.start.column ?? 1;
          const args = node.args.map((argument) => this.argumentToString(argument));
          const startIndex = Math.max(0, column - 1);

          this.functionCalls.push({
            name: qualifiedName,
            arguments: args,
            line,
            column,
            startIndex,
            astNode: node,
            astPath: path as NodePath<CallExpressionNode>,
          });
        },
      },
    });
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

  private argumentToString(argument: ArgumentNode): string {
    const valueText = this.getNodeSource(argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode | CallExpressionNode): string {
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

  private isArgumentCountCompatible(requiredParams: number, totalParams: number, implicitOffset: number, provided: number): boolean {
    const min = Math.max(0, requiredParams - implicitOffset);
    const max = Math.max(0, totalParams - implicitOffset);
    return provided >= min && provided <= max;
  }

  private findMatchingSignatureMeta(signatures: FunctionSignatureMeta[], provided: number): FunctionSignatureMeta | null {
    for (const signature of signatures) {
      if (this.isArgumentCountCompatible(signature.requiredParams, signature.totalParams, signature.implicitOffset, provided)) {
        return signature;
      }
    }
    return null;
  }

  private findMatchingFunctionInfo(overloads: FunctionInfo[], provided: number): FunctionInfo | null {
    for (const info of overloads) {
      if (this.isArgumentCountCompatible(info.requiredParams, info.totalParams, info.implicitOffset, provided)) {
        return info;
      }
    }
    return null;
  }

  private validateSingleFunctionCall(call: FunctionCall): void {
    // Delegate namespaced built-ins to specialized modules to avoid double-validation
    if (call.name.includes('.')) {
      const parts = call.name.split('.');
      const namespace = parts[0];
      const funcName = parts[parts.length - 1];

      // Handle chained object method calls like this.start.move()
      const declaredVars = this.context.declaredVars ?? new Map<string, number>();
      const baseLooksLikeVariable = namespace === 'this' || declaredVars.has(namespace);

      if (!NAMESPACES.has(namespace) || baseLooksLikeVariable) {
        if (!(parts.length === 2 && funcName === 'new' && this.isUDTConstructor(namespace))) {
          this.validateObjectMethodCall(parts, call);
          return;
        }
      }

      const delegatedNamespaces = new Set(['ta','math','str','input','line','label','box','table','map','strategy','array','matrix','polyline']);
      // In library scripts, restrict certain namespaces explicitly to match TDD expectations
      if (this.context.scriptType === 'library') {
        if (namespace === 'strategy') {
          this.addError(
            call.line,
            call.column,
            `Unknown function in library context: ${call.name}`,
            'PSV6-FUNCTION-UNKNOWN'
          );
          return;
        }
        if (namespace === 'input') {
          this.addError(
            call.line,
            call.column,
            `Function '${call.name}' is not allowed in libraries`,
            'PSV6-FUNCTION-NAMESPACE'
          );
          return;
        }
      }
      if (delegatedNamespaces.has(namespace)) {
        // If function is in the wrong namespace, surface a namespace error
        const members: any = (NS_MEMBERS as any)[namespace];
        if (!members || (members instanceof Set && !members.has(funcName))) {
          const fullQualified = call.name;
          if (parts.length > 2 && BUILTIN_FUNCTIONS_V6_RULES[fullQualified]) {
            this.validateReturnTypeUsage(fullQualified, call);
            return;
          }
          const correct = this.findCorrectNamespace(funcName);
          if (correct) {
            this.addError(call.line, call.column,
              `Function '${funcName}' should be in '${correct}' namespace, not '${namespace}'`,
              'PSV6-FUNCTION-NAMESPACE');
            return;
          }
        }
        // For delegated namespaces (except strategy), still run return-type usage checks (e.g., bool in arithmetic)
        if (namespace !== 'strategy') {
          this.validateReturnTypeUsage(call.name, call);
        }
        // Let specialized modules handle namespaced calls (str, ta, math, input, line, label, box, table, map, strategy)
        return;
      }
      // Otherwise, validate as built-in
      this.validateBuiltInFunctionCall(call);
      return;
    }
    // Non-namespaced function
    this.validateUserFunctionCall(call);
  }

  private validateObjectMethodCall(parts: string[], originalCall: FunctionCall): void {
    const qualifiedName = parts.join('.');
    if (this.userFunctions.has(qualifiedName) || this.functionParams.has(qualifiedName)) {
      const qualifiedCall: FunctionCall = {
        name: qualifiedName,
        arguments: originalCall.arguments,
        line: originalCall.line,
        column: originalCall.column,
        startIndex: originalCall.startIndex
      };
      this.validateUserFunctionCall(qualifiedCall);
      return;
    }

    const methodName = parts[parts.length - 1];
    if (this.allowedInstanceMethods.has(methodName)) {
      return;
    }
    const methodCall: FunctionCall = {
      name: methodName,
      arguments: originalCall.arguments,
      line: originalCall.line,
      column: originalCall.column,
      startIndex: originalCall.startIndex
    };

    this.validateUserFunctionCall(methodCall);
  }

  private validateBuiltInFunctionCall(call: FunctionCall): void {
    // Handle script declarations (indicator, strategy, library)
    if (['indicator', 'strategy', 'library'].includes(call.name)) {
      // These are script declarations, not function calls - skip validation
      return;
    }

    let rules: any;
    let fullName: string;

    // Check if it's a namespaced function
    if (call.name.includes('.')) {
      const parts = call.name.split('.');
      const namespace = parts[0];
      const funcName = parts[parts.length - 1];
      
      // Check if namespace is valid
      if (!NAMESPACES.has(namespace)) {
        // Check if it's a UDT constructor (e.g., Point.new, PriceBar.new)
        if (funcName === 'new' && this.isUDTConstructor(namespace)) {
          // This is a UDT constructor call, which is valid
          return;
        }
        
        // Check if it's a UDT method call (e.g., p1.distance, p2.move)
        const varTypeInfo = this.context.typeMap.get(namespace);
        if (varTypeInfo?.type === 'udt') {
          // This is a UDT method call, which is valid
          return;
        }
        
        // Check if this variable is assigned a UDT constructor in the code
        if (this.isVariableAssignedUDTConstructor(namespace)) {
          // This is likely a UDT method call, which is valid
          return;
        }
        
        // Check if it's a UDT constructor (e.g., Point.new)
        if (this.isUDTConstructor(namespace)) {
          // This is a UDT constructor, which is valid
          return;
        }
        
        this.addError(call.line, call.column, `Invalid namespace: ${namespace}`, 'PSV6-FUNCTION-NAMESPACE');
        return;
      }

      // Get function rules
      fullName = call.name;
      rules = BUILTIN_FUNCTIONS_V6_RULES[fullName] ?? BUILTIN_FUNCTIONS_V6_RULES[`${namespace}.${funcName}`];
      
      // Check if it's a known built-in function (even if not in rules)
      if (!rules && !this.context.functionNames.has(fullName)) {
        // Check if the function exists in a different namespace
        const correctNamespace = this.findCorrectNamespace(funcName);
        if (correctNamespace) {
          this.addError(call.line, call.column, 
            `Function '${funcName}' should be in '${correctNamespace}' namespace, not '${namespace}'`, 
            'PSV6-FUNCTION-NAMESPACE');
        } else {
          this.addError(call.line, call.column, `Unknown function: ${call.name}`, 'PSV6-FUNCTION-UNKNOWN');
        }
        return;
      }
    } else {
      // Handle non-namespaced functions (like plot, hline, etc.)
      fullName = call.name;
      rules = BUILTIN_FUNCTIONS_V6_RULES[call.name];
      
      // Check if it's a known built-in function (even if not in rules)
      if (!rules && !this.context.functionNames.has(call.name)) {
        // Allow pseudo-constructor style initializers like: var polyline_id = polyline(na)
        if (call.name === 'polyline' && call.arguments.length === 1) {
          return;
        }
        this.addError(call.line, call.column, `Unknown function: ${call.name}`, 'PSV6-FUNCTION-UNKNOWN');
        return;
      }
    }

    // Validate deprecated parameters (extracted from UltimateValidator)
    if (rules && rules.deprecatedParams) {
      const argsString = call.arguments.join(',');
      for (const param of rules.deprecatedParams) {
        if (new RegExp(`\\b${param}\\s*=`).test(argsString)) {
          this.addError(call.line, call.column,
            `Parameter '${param}' was removed in Pine v6. ${rules.v6Changes || ''}`,
            'PSV6-DEP-PARAM'
          );
        }
      }
    }

    // Validate parameter count and types
    this.validateFunctionParameters(fullName, rules || {}, call);
    
    // Validate return type usage in expressions
    this.validateReturnTypeUsage(fullName, call);
  }

  private validateFunctionParameters(funcName: string, rules: any, call: FunctionCall): void {
    if (!rules.parameters) return;

    const requiredParams = rules.parameters.filter((p: any) => p.required !== false).length;
    if (call.arguments.length < requiredParams) {
      this.addError(call.line, call.column, 
        `Function ${funcName} expects at least ${requiredParams} parameters, got ${call.arguments.length}`, 
        'PSV6-FUNCTION-PARAM-COUNT');
    }
    
    if (call.arguments.length > rules.parameters.length) {
      this.addError(call.line, call.column, 
        `Function ${funcName} expects at most ${rules.parameters.length} parameters, got ${call.arguments.length}`, 
        'PSV6-FUNCTION-PARAM-COUNT');
    }

    // Validate parameter types and qualifiers (extracted from UltimateValidator)
    for (let i = 0; i < rules.parameters.length && i < call.arguments.length; i++) {
      const param = rules.parameters[i];
      const arg = call.arguments[i];
      
      // Check if this is a named parameter
      if (arg.includes('=')) {
        const [paramName, paramValue] = arg.split('=');
        if (paramName.trim() !== param.name) {
          // This is not the parameter we're looking for, skip validation
          continue;
        }
        const argValue = paramValue.trim();
        
        // Skip validation if parameter is not required and not provided
        if (param.required === false && !argValue) {
          continue;
        }
        
        this.validateParameterType(funcName, param, argValue, call.line, call.column);
      } else {
        // Positional parameter
        const argValue = arg.trim();
        
        // Skip validation if parameter is not required and not provided
        if (param.required === false && !argValue) {
          continue;
        }
        
        this.validateParameterType(funcName, param, argValue, call.line, call.column);
      }
    }
  }

  private validateParameterType(funcName: string, param: any, argValue: string, line: number, column: number): void {
    const trimmedArg = argValue.trim();

    if (param.type === 'chart.point' && trimmedArg === 'na') {
      return;
    }

    // Validate parameter type
    if (param.type && !this.isValidParameterType(argValue, param.type)) {
      this.addError(line, column, 
        `Parameter '${param.name}' of '${funcName}' should be ${param.type}, got ${this.inferArgumentType(argValue)}`, 
        'PSV6-FUNCTION-PARAM-TYPE');
    }

    // Validate qualifier: if 'simple' required but argument appears to be 'series', flag mismatch
    if (param.qualifier === 'simple') {
      const inferred = this.inferArgumentType(argValue);
      if (inferred === 'series') {
        this.addError(line, column,
          `Parameter '${param.name}' of '${funcName}' requires simple type, got series`,
          'PSV6-FUNCTION-PARAM-TYPE');
      }
    }

    // Validate parameter constraints
    if (param.min !== undefined || param.max !== undefined) {
      const numValue = this.extractNumericValue(argValue);
      if (numValue !== null) {
        if (param.min !== undefined && numValue < param.min) {
          this.addError(line, column, `The value for '${param.name}' must be >= ${param.min}, but it was ${numValue}.`, 'PSV6-002');
        }
        if (param.max !== undefined && numValue > param.max) {
          this.addError(line, column, `The value for '${param.name}' must be <= ${param.max}, but it was ${numValue}.`, 'PSV6-PARAM-MAX');
        }
      }
    }
  }

  private validateUserFunctionCall(call: FunctionCall): void {
    const overloads = this.userFunctions.get(call.name);

    if (!overloads || overloads.length === 0) {
      const fallbackSignatures = this.functionParams.get(call.name);
      const isMethod = this.methodNames.has(call.name);

      if (this.isDebugEnabled()) {
        console.log('[FunctionValidator] fallback lookup', call.name, 'signatures', fallbackSignatures, 'method?', isMethod);
      }

      if (fallbackSignatures && fallbackSignatures.length > 0) {
        const providedParams = call.arguments.length;
        const match = this.findMatchingSignatureMeta(fallbackSignatures, providedParams);

        if (!match) {
          const first = fallbackSignatures[0];
          const min = Math.max(0, first.requiredParams - first.implicitOffset);
          const max = Math.max(0, first.totalParams - first.implicitOffset);
          this.addError(call.line, call.column,
            `Function ${call.name} expects between ${min} and ${max} parameters, got ${providedParams}`,
            'PSV6-FUNCTION-CALL-PARAM-COUNT');
        }
        return;
      }

      if (this.functionNames.has(call.name) || this.isInlineFunctionDeclaration(call.name)) {
        // Function was collected but lacks metadata (e.g., func declarations without detailed parsing)
        return;
      }

      // Check if it's a built-in function without namespace
      const directRules = BUILTIN_FUNCTIONS_V6_RULES[call.name];
      if (directRules) {
        // It's a standalone built-in function (like plot, int, float, etc.)
        this.validateBuiltInFunctionCall(call);
        return;
      }

      const builtInRules = Object.keys(BUILTIN_FUNCTIONS_V6_RULES).find(key => key.endsWith(`.${call.name}`));
      if (builtInRules) {
        this.addError(call.line, call.column,
          `Function ${call.name} requires namespace (e.g., ${builtInRules})`,
          'PSV6-FUNCTION-NAMESPACE');
      } else if (this.context.functionNames && this.context.functionNames.has(call.name)) {
        // Known standalone built-in (e.g., alertcondition) without explicit rules — accept
        return;
      } else {
        // Allow pseudo-constructor style initializers
        if (call.name === 'polyline' && call.arguments.length === 1) {
          return;
        }
        this.addError(call.line, call.column, `Unknown function: ${call.name}`, 'PSV6-FUNCTION-UNKNOWN');
      }
      return;
    }

    const providedParams = call.arguments.length;
    const match = this.findMatchingFunctionInfo(overloads, providedParams);

    if (!match) {
      const signature = overloads[0];
      const min = Math.max(0, signature.requiredParams - signature.implicitOffset);
      const max = Math.max(0, signature.totalParams - signature.implicitOffset);
      this.addError(call.line, call.column, 
        `Function ${call.name} expects between ${min} and ${max} parameters, got ${providedParams}`, 
        'PSV6-FUNCTION-CALL-PARAM-COUNT');
      return;
    }

    // Track parameter usage
    const usageKey = match.name;
    if (!this.paramUsage.has(usageKey)) {
      this.paramUsage.set(usageKey, new Set());
    }

    const max = Math.max(0, match.totalParams - match.implicitOffset);
    const usable = Math.min(max, providedParams);
    for (let i = 0; i < usable; i++) {
      const paramName = match.parameters[i + match.implicitOffset];
      if (!paramName) continue;
      this.paramUsage.get(usageKey)!.add(paramName);
    }
  }

  private validateUserFunctions(): void {
    // Validate function complexity and style
    for (const [, overloads] of this.userFunctions.entries()) {
      for (const func of overloads) {
        // Function complexity is now validated in the main validateFunctionComplexity() method
        this.validateFunctionStyle(func);
      }
    }
  }

  private validateFunctionComplexity(): void {
    if (!this.astContext?.ast) {
      return;
    }

    this.validateFunctionComplexityAst();
  }

  private validateFunctionComplexityAst(): void {
    const visited = new Set<FunctionDeclarationNode>();

    for (const overloads of this.userFunctions.values()) {
      for (const func of overloads) {
        if (!func.node || visited.has(func.node)) {
          continue;
        }

        visited.add(func.node);
        const complexity = this.calculateFunctionComplexityAst(func.node);
        if (complexity <= 10) {
          continue;
        }

        const location = func.identifier ?? func.node.identifier ?? func.node;
        this.addWarning(
          location.loc.start.line,
          location.loc.start.column,
          `Function '${func.name}' has high complexity (${complexity}). Consider breaking it into smaller functions`,
          'PSV6-FUNCTION-STYLE-COMPLEXITY',
        );
      }
    }
  }

  private calculateFunctionComplexityAst(fn: FunctionDeclarationNode): number {
    let complexity = 1;

    visit(fn.body, {
      FunctionDeclaration: {
        enter: () => 'skip',
      },
      IfStatement: {
        enter: (path) => {
          complexity += 1;
          if (path.node.alternate) {
            complexity += 1;
          }
        },
      },
      ForStatement: {
        enter: () => {
          complexity += 1;
        },
      },
      WhileStatement: {
        enter: () => {
          complexity += 1;
        },
      },
      SwitchStatement: {
        enter: () => {
          complexity += 1;
        },
      },
      ConditionalExpression: {
        enter: () => {
          complexity += 1;
        },
      },
      BinaryExpression: {
        enter: (binaryPath) => {
          const operator = binaryPath.node.operator;
          if (operator === 'and' || operator === 'or') {
            complexity += 1;
          }
        },
      },
    });

    return complexity;
  }

  private validateFunctionStyle(func: FunctionInfo): void {
    if (func.isMethod) {
      return; // Skip stylistic checks for methods to avoid noisy warnings
    }

    if (func.name.includes('.')) {
      return; // Skip style checks for namespaced functions (e.g., UDT static methods)
    }

    // Check function naming conventions
    if (func.name.length < 3 || !func.name.match(/^[a-z]/)) {
      this.addWarning(func.line, func.column, 
        `Function name '${func.name}' should follow camelCase convention and be descriptive`, 
        'PSV6-FUNCTION-STYLE-NAMING');
    }

    // Check for function documentation
    if (!this.hasFunctionDocumentation(func.line)) {
      this.addWarning(func.line, func.column, 
        `Function '${func.name}' should have documentation comment above it`, 
        'PSV6-FUNCTION-STYLE-DOCS');
    }
  }

  private isInlineFunctionDeclaration(name: string): boolean {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${escaped}\\s*\\([^)]*\\)\\s*=>`);
    return this.context.cleanLines.some(line => pattern.test(line));
  }

  private hasFunctionDocumentation(lineNum: number): boolean {
    // Check if there's a comment above the function
    if (lineNum > 1) {
      const prevLine = this.context.cleanLines[lineNum - 2];
      return prevLine.trim().startsWith('//');
    }
    return false;
  }

  private checkUnusedParameters(): void {
    // Check for unused parameters (extracted from EnhancedPineScriptValidator)
    for (const [fn, overloads] of this.userFunctions.entries()) {
      if (/^(indicator|strategy|library)$/.test(fn)) continue;
      const usedInFn = this.paramUsage.get(fn) ?? new Set<string>();

      for (const func of overloads) {
        const line = func.line ?? (this.functionHeaderLine.get(fn) ?? 1);
        func.parameters.forEach((p, idx) => {
          if (!p || p === '_' || (func.isMethod && idx === 0)) return;
          if (fn.includes('.')) return; // Skip dotted names to avoid noise
          if (!usedInFn.has(p)) {
            this.addWarning(line, func.column, `Parameter '${p}' in '${fn}' is never used.`, 'PSU-PARAM');
          }
        });
      }
    }
  }

  // Helper methods
  private isValidParameterType(arg: string, expectedType: string): boolean {
    const actualType = this.inferArgumentType(arg);
    // Direct type match
    if (expectedType === actualType) return true;
    
    // Basic type checking with more flexible rules
    // Tolerate unknowns for object-like or collection types to avoid false negatives before type inference
    if ((expectedType === 'array' || expectedType === 'polyline') && actualType === 'unknown') return true;
    // Treat 'na' as compatible with numeric/series parameters
    if (actualType === 'na' && (expectedType === 'float' || expectedType === 'int' || expectedType === 'series' || expectedType === 'any')) return true;
    if (expectedType === 'series' && (actualType === 'series' || actualType === 'float' || actualType === 'int' || actualType === 'literal')) return true;
    if (expectedType === 'series' && actualType === 'unknown') {
      const identifierMatch = arg.trim().match(/^[A-Za-z_][A-Za-z0-9_]*$/);
      if (identifierMatch) {
        const id = identifierMatch[0];
        if (this.context.declaredVars.has(id) || this.context.typeMap.has(id)) {
          return true;
        }
      } else {
        return true;
      }
    }
    if (expectedType === 'int' && (actualType === 'int' || actualType === 'float')) return true;
    if (expectedType === 'float' && (actualType === 'float' || actualType === 'int')) return true;
    if (expectedType === 'string' && (actualType === 'string' || actualType === 'series')) return true;
    if (expectedType === 'bool' && actualType === 'bool') return true;
    if (expectedType === 'color' && actualType === 'color') return true;
    if (expectedType === 'array' && actualType === 'array') return true;
    if (expectedType === 'matrix' && actualType === 'matrix') return true;
    if (expectedType === 'map' && actualType === 'map') return true;
    
    // Accept specialized drawing/object ids (e.g., line, label, box, table, polyline)
    const objectTypes = new Set(['line','label','box','table','polyline','linefill']);
    if (objectTypes.has(expectedType) && objectTypes.has(actualType)) return true;
    
    // Accept common enum-like dotted constants for int parameters (e.g., line.style_solid, label.style_label_up, size.normal, location.top)
    if (expectedType === 'int') {
      const trimmed = arg.trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
        const ns = trimmed.split('.')[0];
        const enumLikeNamespaces = new Set(['line', 'label', 'size', 'location', 'shape', 'table', 'text', 'display']);
        if (enumLikeNamespaces.has(ns)) return true;
      }
    }

    // Allow 'series' to be passed where 'float' is expected (common in Pine Script)
    if (expectedType === 'float' && actualType === 'series') return true;
    
    // Allow 'any' type to accept any argument
    if (expectedType === 'any') return true;

    return false;
  }

  private inferArgumentType(arg: string): string {
    const trimmed = arg.trim();
    
    // String literal
    if (trimmed.match(/^"[^"]*"$/) || trimmed.match(/^'[^']*'$/)) {
      return 'string';
    }
    
    // Numeric literal (including negative numbers and scientific notation)
    if (trimmed.match(/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/)) {
      return trimmed.includes('.') || /[eE]/.test(trimmed) ? 'float' : 'int';
    }
    
    // Boolean literal
    if (trimmed === 'true' || trimmed === 'false') {
      return 'bool';
    }
    
    // Color literal
    if (trimmed.match(/^color\./)) {
      return 'color';
    }
    
    // Check for built-in variables (series)
    if (['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'].includes(trimmed)) {
      return 'series';
    }
    
    // Check for type names (for array.new, matrix.new, etc.)
    if (['int', 'float', 'bool', 'string', 'color', 'line', 'label', 'box', 'table', 'array', 'matrix', 'map'].includes(trimmed)) {
      return 'string'; // Type names are treated as strings in function parameters
    }
    
    // Check for function calls (e.g., ta.sma(close, 20))
    if (trimmed.includes('(') && trimmed.includes(')')) {
      const funcMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*\.?[A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        return this.getFunctionReturnType(funcName);
      }
    }
    
    // Check for field access (e.g., bar.close)
    if (trimmed.includes('.') && !trimmed.includes('(')) {
      const parts = trimmed.split('.');
      if (parts.length === 2) {
        const [variableName, fieldName] = parts;
        const fieldKey = `${variableName}.${fieldName}`;
        
        // Check if the field type is in the type map (set by UDTValidator)
        const fieldTypeInfo = this.context.typeMap.get(fieldKey);
        if (fieldTypeInfo && fieldTypeInfo.type !== 'unknown') {
          return fieldTypeInfo.type;
        }
      }
    }
    
    // Check for namespace access (e.g., ta.sma, color.blue)
    if (trimmed.includes('.')) {
      const parts = trimmed.split('.');
      if (parts.length === 2) {
        const [namespace, member] = parts;
        // For now, assume namespace members return appropriate types
        if (namespace === 'ta') return 'series'; // Most ta functions return series
        if (namespace === 'math') return 'float'; // Most math functions return float
        if (namespace === 'str') return 'string'; // Most str functions return string
        if (namespace === 'color') return 'color'; // Color namespace returns color
        if (namespace === 'input') return 'input'; // Input namespace returns input
        if (namespace === 'array') return 'array';
        if (namespace === 'map') return 'map';
        if (namespace === 'alert') return 'string'; // Alert frequency/constants behave like strings
        if (namespace === 'session') return 'string';
        if (namespace === 'timezone') return 'string';
        if (namespace === 'timeframe') return 'string';
        return 'unknown';
      }
    }
    
    // Check if it's a variable reference
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      // Look up in context type map first (this is the most reliable source)
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo && typeInfo.type !== 'unknown') {
        return typeInfo.type;
      }
      
      // Check if this variable is assigned a function call
      const functionType = this.isVariableAssignedFunction(trimmed);
      if (functionType) {
        return functionType;
      }
      
      // Check for common built-in variables that might not be in type map
      if (['open', 'high', 'low', 'close', 'volume', 'time', 'bar_index', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'].includes(trimmed)) {
        return 'series';
      }
      
    // Check for common built-in constants
    if (['true', 'false', 'na'].includes(trimmed)) {
      return trimmed === 'na' ? 'unknown' : 'bool';
    }
    
    // Check for color constants
    if (trimmed.startsWith('color.')) {
      return 'color';
    }
    
    // Check for shape constants
    if (trimmed.startsWith('shape.')) {
      return 'int';
    }
    
        // Check for location constants
        if (trimmed.startsWith('location.')) {
          return 'int';
        }
        
        // Check for syminfo properties
        if (trimmed.startsWith('syminfo.')) {
          if (trimmed === 'syminfo.minmove' || trimmed === 'syminfo.pointvalue') {
            return 'float';
          }
          return 'string';
        }
    
    // Check if it's a built-in constant in usedVars
    if (this.context.usedVars && this.context.usedVars.has(trimmed)) {
      // Determine type based on the constant name
      if (trimmed.startsWith('color.')) {
        return 'color';
      } else if (trimmed.startsWith('shape.') || trimmed.startsWith('location.')) {
        return 'int';
      }
    }
      
      // Check for common built-in functions that return series
      if (['plot', 'plotshape', 'plotchar', 'plotcandle', 'plotbar', 'bgcolor', 'hline', 'fill', 'barcolor'].includes(trimmed)) {
        return 'series';
      }
    }

    // Default to unknown
    return 'unknown';
  }

  private extractNumericValue(arg: string): number | null {
    const match = arg.match(/^[+\-]?\d+(\.\d+)?$/);
    return match ? parseFloat(match[0]) : null;
  }

  private validateReturnTypeUsage(funcName: string, call: FunctionCall): void {
    const returnType = this.getFunctionReturnType(funcName);

    if (call.astPath && this.astContext?.ast) {
      const handled = this.validateReturnTypeUsageAst(funcName, call, returnType);
      if (handled) {
        return;
      }
    }

    this.validateReturnTypeUsageLegacy(funcName, call, returnType);
  }

  private validateReturnTypeUsageAst(funcName: string, call: FunctionCall, returnType: string): boolean {
    const path = call.astPath;
    if (!path) {
      return false;
    }

    const location = call.astNode?.loc?.start ?? { line: call.line, column: call.column };
    const parent = path.parent;
    if (!parent) {
      return false;
    }

    if (parent.node.kind === 'BinaryExpression') {
      const binary = parent.node as BinaryExpressionNode;
      const otherOperand = path.key === 'left' ? binary.right : path.key === 'right' ? binary.left : null;
      if (!otherOperand) {
        return false;
      }
      const operator = binary.operator;

      if ((returnType === 'bool' || this.isBooleanFunction(funcName)) && this.isArithmeticOperator(operator, otherOperand)) {
        this.addError(
          location.line,
          location.column,
          `Boolean function '${funcName}' cannot be used in arithmetic operations`,
          'PSV6-FUNCTION-RETURN-TYPE',
        );
        return true;
      }

      if (
        returnType !== 'string'
        && operator === '+'
        && this.isStringExpression(otherOperand)
      ) {
        this.addError(
          location.line,
          location.column,
          `Function '${funcName}' returns ${returnType}, cannot be used in string operations`,
          'PSV6-FUNCTION-RETURN-TYPE',
        );
        return true;
      }

      return false;
    }

    if (
      parent.node.kind === 'UnaryExpression'
      && (returnType === 'bool' || this.isBooleanFunction(funcName))
    ) {
      const unary = parent.node as UnaryExpressionNode;
      if (unary.operator === '+' || unary.operator === '-') {
        this.addError(
          location.line,
          location.column,
          `Boolean function '${funcName}' cannot be used in arithmetic operations`,
          'PSV6-FUNCTION-RETURN-TYPE',
        );
        return true;
      }
    }

    return false;
  }

  private validateReturnTypeUsageLegacy(funcName: string, call: FunctionCall, returnType: string): void {
    const line = this.context.lines[call.line - 1];
    if (!line) return;

    const funcCallStart = line.indexOf(funcName, call.startIndex);
    if (funcCallStart === -1) return;

    let funcCallEnd = funcCallStart + funcName.length;
    let parenCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = funcCallStart; i < line.length; i++) {
      const char = line[i];
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
      } else if (!inString && char === '(') {
        parenCount++;
      } else if (!inString && char === ')') {
        parenCount--;
        if (parenCount === 0) {
          funcCallEnd = i + 1;
          break;
        }
      }
    }

    const beforeCall = line.substring(0, funcCallStart).trim();
    const afterCall = line.substring(funcCallEnd).trim();

    if ((returnType === 'bool') || this.isBooleanFunction(funcName)) {
      if (this.isArithmeticContext(beforeCall, afterCall)) {
        this.addError(call.line, call.column,
          `Boolean function '${funcName}' cannot be used in arithmetic operations`,
          'PSV6-FUNCTION-RETURN-TYPE');
      }
    }

    if (returnType !== 'string' && this.isStringContext(beforeCall, afterCall)) {
      this.addError(call.line, call.column,
        `Function '${funcName}' returns ${returnType}, cannot be used in string operations`,
        'PSV6-FUNCTION-RETURN-TYPE');
    }

    this.checkVariableAssignmentUsage(funcName, returnType, call, line, funcCallStart, funcCallEnd);
  }

  private checkVariableAssignmentUsage(funcName: string, returnType: string, call: FunctionCall, line: string, funcCallStart: number, funcCallEnd: number): void {
    // Check if this is a variable assignment
    const assignmentMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!assignmentMatch) return;
    
    const varName = assignmentMatch[1];
    const expression = assignmentMatch[2];
    
    // Check if the function call is the ONLY thing in the expression (direct assignment)
    const trimmedExpression = expression.trim();
    if (!trimmedExpression.includes(funcName)) return;
    
    // Only check for boolean functions being used incorrectly
    if (!(returnType === 'bool' || this.isBooleanFunction(funcName))) return;
    
    // Check if this variable is used incorrectly in subsequent lines
    for (let i = call.line; i < this.context.lines.length; i++) {
      const currentLine = this.context.lines[i];
      if (!currentLine.includes(varName)) continue;
      
      // Check if the variable is used in arithmetic operations
      if (this.isVariableUsedInArithmetic(currentLine, varName)) {
        this.addError(i + 1, 1, 
          `Variable '${varName}' contains boolean result from '${funcName}' and cannot be used in arithmetic operations`, 
          'PSV6-FUNCTION-RETURN-TYPE');
      }
    }
  }

  private isArithmeticOperator(operator: string, otherOperand: ExpressionNode): boolean {
    const arithmeticOperators = new Set(['+', '-', '*', '/', '%', '^']);
    if (!arithmeticOperators.has(operator)) {
      return false;
    }

    if (operator === '+' && this.isStringExpression(otherOperand)) {
      return false;
    }

    return true;
  }

  private isStringExpression(expression: ExpressionNode): boolean {
    if (expression.kind === 'StringLiteral') {
      return true;
    }

    const typeKind = this.getExpressionTypeKind(expression);
    return typeKind === 'string';
  }

  private getExpressionTypeKind(expression: ExpressionNode): string | null {
    if (!this.astContext) {
      return null;
    }

    const { typeEnvironment } = this.astContext;
    const direct = typeEnvironment.nodeTypes.get(expression);
    if (direct) {
      return direct.kind;
    }

    if (expression.kind === 'Identifier') {
      const identifier = expression as IdentifierNode;
      const fromIdentifiers = typeEnvironment.identifiers.get(identifier.name);
      return fromIdentifiers?.kind ?? null;
    }

    return null;
  }

  private isVariableUsedInArithmetic(line: string, varName: string): boolean {
    // Check if the variable is used with arithmetic operators
    const arithmeticOps = ['+', '-', '*', '/', '%', '^'];
    
    for (const op of arithmeticOps) {
      // Check for patterns like: varName + something, something + varName, varName - something, etc.
      const patterns = [
        new RegExp(`\\b${varName}\\s*\\${op}`),
        new RegExp(`\\${op}\\s*\\b${varName}\\b`)
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private isBooleanFunction(funcName: string): boolean {
    const booleanFunctions = [
      'ta.crossover', 'ta.crossunder', 'ta.rising', 'ta.falling'
    ];
    return booleanFunctions.includes(funcName);
  }

  private isArithmeticContext(before: string, after: string): boolean {
    // Remove comments from the strings
    const beforeClean = before.replace(/\/\/.*$/, '').trim();
    const afterClean = after.replace(/\/\/.*$/, '').trim();
    
    // Check for arithmetic operators around the function call
    const arithmeticOps = ['+', '-', '*', '/', '%', '^'];
    
    // Check if there's an arithmetic operator before or after
    for (const op of arithmeticOps) {
      if (beforeClean.endsWith(op) || afterClean.startsWith(op)) {
        return true;
      }
    }
    
    // Check for compound assignment operators
    const compoundOps = ['+=', '-=', '*=', '/=', '%='];
    for (const op of compoundOps) {
      if (beforeClean.endsWith(op) || afterClean.startsWith(op)) {
        return true;
      }
    }
    
    return false;
  }

  private isStringContext(before: string, after: string): boolean {
    // Check for string operations - be more specific to avoid false positives
    const stringOps = ['str.', 'tostring'];
    
    for (const op of stringOps) {
      if (before.endsWith(op) || after.startsWith(op)) {
        return true;
      }
    }
    
    // Only flag + as string context if it's clearly a string concatenation
    // (e.g., if immediate neighbor is a string literal or str.*)
    if (before.trimEnd().endsWith('+')) {
      const afterTrim = after.trimStart();
      if (afterTrim.startsWith('"') || afterTrim.startsWith("'")) return true;
      if (/^str\./.test(afterTrim)) return true;
    }
    if (after.trimStart().startsWith('+')) {
      const beforeTrim = before.trimEnd();
      // get the last token before +
      const lastChar = beforeTrim.slice(-1);
      if (lastChar === '"' || lastChar === "'") return true;
      if (/str\.[A-Za-z_]/.test(beforeTrim.slice(-15))) return true;
    }
    
    return false;
  }

  private validateDuplicateFunctions(): void {
    for (const [funcName, signatures] of this.functionParams.entries()) {
      if (signatures.length <= 1) continue;

      const seen = new Map<string, number>();
      let hasExactDuplicate = false;
      for (const signature of signatures) {
        const signatureKey = signature.rawParams.join('|');
        if (seen.has(signatureKey)) {
          const firstLine = seen.get(signatureKey)!;
          this.addError(signature.line, 1,
            `Duplicate function signature '${funcName}' (first declared at line ${firstLine})`,
            'PSV6-FUNCTION-DUPLICATE');
          hasExactDuplicate = true;
        } else {
          seen.set(signatureKey, signature.line);
        }
      }

      if (hasExactDuplicate) {
        continue;
      }

      const typedOverloads = signatures.every(sig => this.signatureHasExplicitTypes(sig.rawParams));
      if (!typedOverloads) {
        const firstLine = signatures[0].line;
        for (let i = 1; i < signatures.length; i++) {
          this.addError(signatures[i].line, 1,
            `Duplicate function name '${funcName}' (first declared at line ${firstLine})`,
            'PSV6-FUNCTION-DUPLICATE');
        }
      }
    }
  }

  private validateInconsistentReturnTypes(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const funcMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*=>/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const lineNum = i + 1;
        
        // Find the function body and analyze return types
        const returnTypes = this.analyzeFunctionReturnTypes(funcName, i);
        if (returnTypes.length > 1) {
          this.addError(lineNum, 1, 
            `Function '${funcName}' has inconsistent return types: ${returnTypes.join(', ')}`, 
            'PSV6-FUNCTION-RETURN-TYPE');
        }
      }
    }
  }

  private analyzeFunctionReturnTypes(funcName: string, startLine: number): string[] {
    const returnTypes = new Set<string>();
    const baseIndent = this.getLineIndentation(this.context.cleanLines[startLine]);
    
    // Look for return statements in the function body
    for (let i = startLine + 1; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineIndent = this.getLineIndentation(line);
      
      // Stop if we've unindented back to the function level or beyond
      if (lineIndent <= baseIndent && line.trim() !== '') {
        break;
      }
      
      // Look for return values (expressions that are not assignments or control structures)
      if (lineIndent > baseIndent) {
        const trimmed = line.trim();
        
        // Skip control structures
        if (/^(if|for|while|switch)\b/.test(trimmed)) {
          continue;
        }
        
        // Skip assignments
        if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(trimmed)) {
          continue;
        }
        
        // This looks like a return value - analyze its type
        const returnType = this.inferReturnValueType(trimmed);
        if (returnType !== 'unknown' && returnType !== 'void') {
          returnTypes.add(returnType);
        }
      }
    }
    
    return Array.from(returnTypes);
  }

  private getLineIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  private inferReturnValueType(expression: string): string {
    const trimmed = expression.trim();
    
    // String literals
    if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'$/.test(trimmed)) {
      return 'string';
    }
    
    // Numeric literals
    if (/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$/.test(trimmed)) {
      return trimmed.includes('.') || /[eE]/.test(trimmed) ? 'float' : 'int';
    }
    
    // Boolean literals
    if (trimmed === 'true' || trimmed === 'false') {
      return 'bool';
    }
    
    // Function calls
    if (trimmed.includes('(') && trimmed.includes(')')) {
      const funcMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*\.?[A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (funcMatch) {
        return this.getFunctionReturnType(funcMatch[1]);
      }
    }
    
    // Variable references
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      const typeInfo = this.context.typeMap.get(trimmed);
      if (typeInfo) {
        return typeInfo.type;
      }
    }
    
    return 'unknown';
  }

  private findCorrectNamespace(funcName: string): string | null {
    // Check if the function exists in any namespace
    for (const [namespace, members] of Object.entries(NS_MEMBERS)) {
      if (members.has(funcName)) {
        return namespace;
      }
    }
    
    // Check if it's a standalone built-in function
    if (BUILTIN_FUNCTIONS_V6_RULES[funcName]) {
      return null; // It's a standalone function, no namespace needed
    }
    
    return null;
  }

  private isUDTConstructor(namespace: string): boolean {
    // Check if the namespace is a UDT type by looking in the context
    const typeInfo = this.context.typeMap.get(namespace);
    return typeInfo?.type === 'udt';
  }

  private isVariableAssignedUDTConstructor(varName: string): boolean {
    // Look through the code to see if this variable is assigned a UDT constructor
    for (const line of this.context.cleanLines) {
      // Check for assignment pattern: varName = UDTType.new(...)
      const assignmentMatch = line.match(new RegExp(`^\\s*${varName}\\s*=\\s*([A-Z][A-Za-z0-9_]*)\.new\\s*\\(`));
      if (assignmentMatch) {
        const udtTypeName = assignmentMatch[1];
        // Check if this UDT type exists in the context
        const udtTypeInfo = this.context.typeMap.get(udtTypeName);
        if (udtTypeInfo?.type === 'udt') {
          return true;
        }
      }
    }
    return false;
  }

  private isVariableAssignedFunction(varName: string): string | null {
    // Look through the code to see if this variable is assigned a function call
    for (const line of this.context.cleanLines) {
      // Check for assignment pattern: varName = functionCall(...)
      const assignmentMatch = line.match(new RegExp(`^\\s*${varName}\\s*=\\s*([A-Za-z_][A-Za-z0-9_]*\\.[A-Za-z_][A-Za-z0-9_]*)\\s*\\(`));
      if (assignmentMatch) {
        const funcName = assignmentMatch[1];
        // Check if it's a built-in function
        if (BUILTIN_FUNCTIONS_V6_RULES[funcName] || (this.context.functionNames && this.context.functionNames.has(funcName)) || funcName.startsWith('strategy.')) {
          // Infer return type based on function namespace
          if (funcName.startsWith('ta.')) {
            return 'series'; // Most TA functions return series
          } else if (funcName.startsWith('math.')) {
            return 'float'; // Most math functions return float
          } else if (funcName.startsWith('str.')) {
            // Special handling for specific string functions
            if (funcName === 'str.tonumber') {
              return 'float'; // str.tonumber returns float
            } else {
              return 'string'; // Other string functions return string
            }
          } else if (funcName.startsWith('color.')) {
            return 'color'; // Color functions return color
          } else if (funcName.startsWith('array.')) {
            // Array functions return various types
            if (funcName === 'array.new') {
              return 'array';
            } else {
              // Let TypeInferenceValidator handle array.get and other array functions
              return null;
            }
          } else if (funcName.startsWith('matrix.')) {
            // Matrix functions return various types
            if (funcName === 'matrix.new') {
              return 'matrix';
            } else {
              // Let TypeInferenceValidator handle matrix.get and other matrix functions
              return null;
            }
          } else if (funcName === 'strategy.percent_of_equity') {
            return 'float';
          } else if (funcName.startsWith('strategy.risk.')) {
            return 'void';
          }
        }
      }
    }
    return null;
  }

  private validatePerformanceIssues(): void {
    this.validateExpensiveFunctionsInLoops();
    this.validateNestedExpensiveFunctionCalls();
    this.validateDuplicateFunctionCalls();
  }

  private validateExpensiveFunctionsInLoops(): void {
    const expensiveFunctions = new Set([
      'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.stoch', 'ta.atr', 'ta.bb',
      'ta.highest', 'ta.lowest', 'ta.sar', 'ta.roc', 'ta.mom', 'ta.change',
      'ta.correlation', 'ta.dev', 'ta.linreg', 'ta.percentile_linear_interpolation',
      'ta.percentile_nearest_rank', 'ta.percentrank', 'ta.pivothigh', 'ta.pivotlow',
      'ta.range', 'ta.stdev', 'ta.variance', 'ta.wma', 'ta.alma', 'ta.vwma', 'ta.swma',
      'ta.rma', 'ta.hma', 'ta.tsi', 'ta.cci', 'ta.cmo', 'ta.mfi', 'ta.obv', 'ta.pvt',
      'ta.nvi', 'ta.pvi', 'ta.wad', 'request.security', 'request.security_lower_tf'
    ]);

    let inLoop = false;
    let loopIndent = 0;

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      const indent = this.getLineIndentation(line);
      const trimmed = line.trim();

      // Check for loop start
      if (/^\s*for\s+\w+\s*=\s*\d+\s+to\s+\d+/.test(line) || /^\s*while\s+/.test(line)) {
        inLoop = true;
        loopIndent = indent;
        continue;
      }

      // Check for loop end (unindent)
      if (inLoop && indent <= loopIndent && trimmed !== '') {
        inLoop = false;
        loopIndent = 0;
      }

      // Check for expensive functions in loops
      if (inLoop) {
        for (const funcName of expensiveFunctions) {
          if (line.includes(funcName)) {
            this.addWarning(lineNum, 1, 
              `Expensive function '${funcName}' called inside loop may impact performance`, 
              'PSV6-FUNCTION-PERF-LOOP');
          }
        }
      }
    }
  }

  private validateNestedExpensiveFunctionCalls(): void {
    const expensiveFunctions = new Set([
      'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.stoch', 'ta.atr', 'ta.bb',
      'ta.highest', 'ta.lowest', 'ta.sar', 'ta.roc', 'ta.mom', 'ta.change',
      'ta.correlation', 'ta.dev', 'ta.linreg', 'ta.percentile_linear_interpolation',
      'ta.percentile_nearest_rank', 'ta.percentrank', 'ta.pivothigh', 'ta.pivotlow',
      'ta.range', 'ta.stdev', 'ta.variance', 'ta.wma', 'ta.alma', 'ta.vwma', 'ta.swma',
      'ta.rma', 'ta.hma', 'ta.tsi', 'ta.cci', 'ta.cmo', 'ta.mfi', 'ta.obv', 'ta.pvt',
      'ta.nvi', 'ta.pvi', 'ta.wad', 'request.security', 'request.security_lower_tf'
    ]);

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Count expensive function calls in this line
      let expensiveCallCount = 0;
      for (const funcName of expensiveFunctions) {
        const regex = new RegExp(`\\b${funcName.replace('.', '\\.')}\\s*\\(`, 'g');
        const matches = line.match(regex);
        if (matches) {
          expensiveCallCount += matches.length;
        }
      }

      // Warn if more than 2 expensive function calls in one line
      if (expensiveCallCount > 2) {
        this.addWarning(lineNum, 1, 
          `Multiple expensive function calls (${expensiveCallCount}) on one line may impact performance`, 
          'PSV6-FUNCTION-PERF-NESTED');
      }
    }
  }

  private validateDuplicateFunctionCalls(): void {
    const functionCallSignatures = new Map<string, number>();
    const functionCallLines = new Map<string, number[]>();

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Find function calls with their full signatures (including parameters)
      const functionCallRegex = /\b([A-Za-z_][A-Za-z0-9_]*\.?[A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
      let match;
      while ((match = functionCallRegex.exec(line)) !== null) {
        const funcName = match[1];
        const params = match[2].trim();
        const signature = `${funcName}(${params})`;
        
        if (!functionCallSignatures.has(signature)) {
          functionCallSignatures.set(signature, 0);
          functionCallLines.set(signature, []);
        }
        
        functionCallSignatures.set(signature, functionCallSignatures.get(signature)! + 1);
        functionCallLines.get(signature)!.push(lineNum);
      }
    }

    // Check for function calls with identical signatures called more than 2 times
    for (const [signature, count] of functionCallSignatures.entries()) {
      if (count > 2) {
        const lines = functionCallLines.get(signature)!;
        this.addWarning(lines[0], 1, 
          `Function call '${signature}' is repeated ${count} times. Consider caching the result to improve performance`, 
          'PSV6-FUNCTION-PERF-DUPLICATE');
      }
    }
  }


  private getFunctionReturnType(funcName: string): string {
    // TA functions that return boolean
    const taBooleanFunctions = [
      'ta.crossover', 'ta.crossunder', 'ta.rising', 'ta.falling'
    ];
    
    // TA functions that return float
    const taFloatFunctions = [
      'ta.sma', 'ta.ema', 'ta.rsi', 'ta.macd', 'ta.stoch', 'ta.atr', 'ta.bb', 'ta.highest', 'ta.lowest',
      'ta.sar', 'ta.roc', 'ta.mom', 'ta.change', 'ta.correlation', 'ta.dev', 'ta.linreg',
      'ta.percentile_linear_interpolation', 'ta.percentile_nearest_rank', 'ta.percentrank', 'ta.pivothigh',
      'ta.pivotlow', 'ta.range', 'ta.stdev', 'ta.variance', 'ta.wma', 'ta.alma', 'ta.vwma', 'ta.swma',
      'ta.rma', 'ta.hma', 'ta.tsi', 'ta.cci', 'ta.cmo', 'ta.mfi', 'ta.obv', 'ta.pvt', 'ta.nvi',
      'ta.pvi', 'ta.wad'
    ];
    
    // Math functions
    if (funcName.startsWith('math.')) return 'float';
    
    // String functions
    if (funcName.startsWith('str.')) return 'string';
    
    // Strategy sizing helpers
    if (funcName === 'strategy.percent_of_equity') return 'float';
    // Strategy risk management functions
    if (funcName.startsWith('strategy.risk.')) return 'void';
    // Core strategy order functions
    if (funcName === 'strategy.entry' || funcName === 'strategy.order' || funcName === 'strategy.close' || funcName === 'strategy.close_all' || funcName === 'strategy.cancel' || funcName === 'strategy.cancel_all') return 'void';

    // Color functions
    if (funcName.startsWith('color.')) return 'color';
    
    // Input functions
    if (funcName.startsWith('input.')) return 'input';

    // Array namespace
    if (funcName.startsWith('array.')) {
      const member = funcName.split('.')[1];
      if (['new', 'copy', 'slice', 'from'].includes(member)) return 'array';
      if (['size', 'indexof', 'lastindexof', 'includes'].includes(member)) return 'int';
      if (member === 'get') return 'unknown';
      if (['push', 'pop', 'set', 'clear', 'reverse', 'sort', 'remove', 'insert', 'unshift', 'shift', 'fill'].includes(member)) return 'void';
      return 'array';
    }

    // Map functions
    if (funcName.startsWith('map.')) {
      const member = funcName.split('.')[1];
      if (member === 'new' || member === 'copy') return 'map';
      if (member === 'size') return 'int';
      if (member === 'contains') return 'bool';
      if (member === 'get') return 'unknown'; // element type resolved by TypeInference module
      if (member === 'keys' || member === 'values') return 'array';
      if (['put', 'remove', 'clear', 'put_all'].includes(member)) return 'void';
      return 'map';
    }

    // Matrix namespace
    if (funcName.startsWith('matrix.')) {
      const member = funcName.split('.')[1];
      if (member === 'new' || member === 'copy' || member === 'transpose') return 'matrix';
      if (['rows', 'columns', 'elements_count'].includes(member)) return 'int';
      if (member === 'get') return 'unknown';
      if (['set', 'clear', 'fill', 'reverse', 'sort', 'remove_row', 'remove_col', 'swap_rows', 'swap_columns'].includes(member)) return 'void';
      return 'matrix';
    }

    // Specific TA function return types
    if (taBooleanFunctions.includes(funcName)) return 'bool';
    if (taFloatFunctions.includes(funcName)) return 'series';
    
    // General TA functions (default to series)
    if (funcName.startsWith('ta.')) return 'series';
    
    // Plotting functions
    if (['plot', 'plotshape', 'plotchar', 'plotcandle', 'plotbar', 'bgcolor', 'hline', 'fill', 'barcolor'].includes(funcName)) {
      return 'series';
    }
    
    // Check if it's a user-defined function
    if (this.context.functionNames && this.context.functionNames.has(funcName)) {
      // For now, assume user functions return series
      return 'series';
    }

    // Default for most functions
    return 'series';
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
