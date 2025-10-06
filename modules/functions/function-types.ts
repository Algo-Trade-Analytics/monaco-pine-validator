/**
 * Function Types Validator
 * 
 * Handles function type checking and validation:
 * - Function return type inference and validation
 * - Return type usage validation in expressions
 * - Inconsistent return type detection
 * - Function complexity analysis
 * - Type compatibility checking
 * 
 * Extracted from function-validator.ts to improve maintainability.
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../../core/types';
import { BUILTIN_FUNCTIONS_V6_RULES } from '../../core/constants';
import {
  type CallExpressionNode,
  type ExpressionNode,
  type FunctionDeclarationNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ProgramNode,
  type ReturnStatementNode,
} from '../../core/ast/nodes';
import { visit, type NodePath } from '../../core/ast/traversal';
import type { TypeMetadata } from '../../core/ast/types';
import { getSourceLine } from '../../core/ast/source-utils';

interface FunctionCall {
  name: string;
  arguments: string[];
  line: number;
  column: number;
  startIndex: number;
}

export class FunctionTypesValidator implements ValidationModule {
  name = 'FunctionTypesValidator';
  priority = 93; // High priority - runs after function declarations and built-in validation

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'FunctionDeclarationsValidator', 'FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.astContext = this.getAstContext(config);

    if (!this.astContext?.ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null,
      };
    }

    this.validateFunctionsAst(this.astContext.ast);

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

  /**
   * Get the return type of a function
   */
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
      'ta.pvi', 'ta.wad', 'ta.iii', 'ta.wvad'
    ];
    
    // Math functions
    if (funcName.startsWith('math.')) return 'float';
    
    // String functions
    if (funcName.startsWith('str.')) return 'string';
    
    // Color functions
    if (funcName.startsWith('color.')) return 'color';
    
    // Input functions
    if (funcName.startsWith('input.')) {
      const builtinRule = BUILTIN_FUNCTIONS_V6_RULES[funcName];
      if (builtinRule?.returnType) {
        return builtinRule.returnType;
      }
    }
    
    // Specific TA function return types
    if (taBooleanFunctions.includes(funcName)) return 'bool';
    if (taFloatFunctions.includes(funcName)) return 'series';
    
    // General TA functions (default to series)
    if (funcName.startsWith('ta.')) return 'series';
    
    // Array namespace
    if (funcName.startsWith('array.')) {
      const member = funcName.split('.')[1];
      if (member.startsWith('new')) return 'array';
      if (['copy','slice','concat','from','from_example','range','sort_indices'].includes(member)) return 'array';
      if (['size','indexof','lastindexof','binary_search','binary_search_leftmost','binary_search_rightmost'].includes(member)) return 'int';
      if (member === 'get') return 'unknown';
      if (['push','pop','set','clear','reverse','sort','remove','insert','unshift','shift','fill','standardize'].includes(member)) return 'void';
      if (['some','every'].includes(member)) return 'bool';
      if (['sum','avg','stdev','variance','median','mode','max','min','abs','covariance','percentile_linear_interpolation','percentile_nearest_rank','percentrank'].includes(member)) {
        return 'series';
      }
      if (['first','last'].includes(member)) return 'unknown';
      return 'array';
    }

    // Map namespace
    if (funcName.startsWith('map.')) {
      const member = funcName.split('.')[1];
      if (member === 'new') return 'map';
      if (member === 'size') return 'int';
      if (member === 'contains') return 'bool';
      if (member === 'keys' || member === 'values') return 'array';
      if (member === 'copy') return 'map';
      if (member === 'get') return 'unknown';
      if (['put','remove','clear','put_all'].includes(member)) return 'void';
      return 'map';
    }

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

  private validateFunctionsAst(program: ProgramNode): void {
    this.validateReturnTypesAst(program);
    this.validateFunctionMetricsAst(program);
  }

  private validateReturnTypesAst(program: ProgramNode): void {
    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          const fn = path.node as FunctionDeclarationNode;
          const name = fn.identifier?.name ?? 'anonymous function';
          const location = fn.identifier ?? fn;
          const returnTypes = this.collectReturnTypesAst(fn);

          if (returnTypes.length > 1) {
            this.addError(
              location.loc.start.line,
              location.loc.start.column,
              `Function '${name}' has inconsistent return types: ${returnTypes.join(', ')}`,
              'PSV6-FUNCTION-RETURN-TYPE',
            );
          }
        },
      },
    });
  }

  private validateFunctionMetricsAst(program: ProgramNode): void {
    visit(program, {
      FunctionDeclaration: {
        enter: (path) => {
          const fn = path.node as FunctionDeclarationNode;
          const name = fn.identifier?.name ?? 'anonymous function';
          const location = fn.identifier ?? fn;
          const complexity = this.calculateFunctionComplexityAst(fn);

          if (complexity > 10) {
            this.addWarning(
              location.loc.start.line,
              location.loc.start.column,
              `Function '${name}' has high complexity (${complexity}). Consider breaking it into smaller functions.`,
              'PSV6-FUNCTION-COMPLEXITY',
            );
          }

          const length = this.calculateFunctionLengthAst(fn);
          if (length > 50) {
            this.addWarning(
              location.loc.start.line,
              location.loc.start.column,
              `Function '${name}' is very long (${length} lines). Consider breaking it into smaller functions.`,
              'PSV6-FUNCTION-LENGTH',
            );
          }
        },
      },
    });
  }

  private collectReturnTypesAst(fn: FunctionDeclarationNode): string[] {
    if (!this.astContext) {
      return [];
    }

    const types = new Set<string>();

    visit(fn.body, {
      FunctionDeclaration: {
        enter: () => 'skip',
      },
      ReturnStatement: {
        enter: (returnPath: NodePath<ReturnStatementNode>) => {
          const argument = returnPath.node.argument as ExpressionNode | null;
          if (!argument) {
            types.add('void');
            return;
          }

          const inferred = this.inferReturnTypeAst(argument);
          if (inferred && inferred !== 'unknown') {
            types.add(inferred);
          }
        },
      },
    });

    return Array.from(types);
  }

  private inferReturnTypeAst(expression: ExpressionNode): string | null {
    if (!this.astContext) {
      return null;
    }

    const metadata = this.astContext.typeEnvironment.nodeTypes.get(expression) ?? null;
    const described = this.describeTypeMetadata(metadata);
    if (described && described !== 'unknown') {
      return described;
    }

    if (expression.kind === 'Identifier') {
      const identifier = expression as IdentifierNode;
      const identifierMetadata = this.astContext.typeEnvironment.identifiers.get(identifier.name) ?? null;
      const describedIdentifier = this.describeTypeMetadata(identifierMetadata);
      if (describedIdentifier && describedIdentifier !== 'unknown') {
        return describedIdentifier;
      }
      const typeInfo = this.context.typeMap.get(identifier.name);
      if (typeInfo) {
        return typeInfo.type;
      }
    }

    if (expression.kind === 'CallExpression') {
      const call = expression as CallExpressionNode;
      const calleeName = this.getExpressionQualifiedName(call.callee);
      if (calleeName) {
        const inferred = this.getFunctionReturnType(calleeName);
        if (inferred && inferred !== 'unknown') {
          return inferred;
        }
      }
    }

    return null;
  }

  private describeTypeMetadata(metadata: TypeMetadata | null): string | null {
    if (!metadata) {
      return null;
    }

    return metadata.kind;
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

  private calculateFunctionLengthAst(fn: FunctionDeclarationNode): number {
    if (fn.body.body.length === 0) {
      return 0;
    }

    const first = fn.body.body[0];
    const last = fn.body.body[fn.body.body.length - 1];
    return last.loc.end.line - first.loc.start.line + 1;
  }

  private getExpressionQualifiedName(expression: ExpressionNode | null): string | null {
    if (!expression) {
      return null;
    }
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

  /**
   * Validate return type usage in expressions
   */
  public validateReturnTypeUsage(funcName: string, call: FunctionCall): void {
    const returnType = this.getFunctionReturnType(funcName);
    
    // Get the line where this function call occurs
    const line = getSourceLine(this.context, call.line);
    if (!line) return;
    
    // Find the function call in the line
    const funcCallStart = line.indexOf(funcName, call.startIndex);
    if (funcCallStart === -1) return;
    
    // Find the end of the function call
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
    
    // Check the context around the function call
    const beforeCall = line.substring(0, funcCallStart).trim();
    const afterCall = line.substring(funcCallEnd).trim();
    
    // Check for arithmetic operations with boolean return types
    if (returnType === 'series' && this.isBooleanFunction(funcName)) {
      // Check if it's used in arithmetic operations
      if (this.isArithmeticContext(beforeCall, afterCall)) {
        this.addError(call.line, call.column, 
          `Boolean function '${funcName}' cannot be used in arithmetic operations`, 
          'PSV6-FUNCTION-RETURN-TYPE');
      }
    }
    
    // Check for string operations with non-string return types
    if (returnType !== 'string' && this.isStringContext(beforeCall, afterCall)) {
      this.addError(call.line, call.column, 
        `Function '${funcName}' returns ${returnType}, cannot be used in string operations`, 
        'PSV6-FUNCTION-RETURN-TYPE');
    }
  }

  /**
   * Check if a function returns boolean
   */
  private isBooleanFunction(funcName: string): boolean {
    const booleanFunctions = [
      'ta.crossover', 'ta.crossunder', 'ta.rising', 'ta.falling'
    ];
    return booleanFunctions.includes(funcName);
  }

  /**
   * Check if the context suggests arithmetic operations
   */
  private isArithmeticContext(before: string, after: string): boolean {
    const arithmeticOps = ['+', '-', '*', '/', '%', '^'];
    return arithmeticOps.some(op => before.endsWith(op) || after.startsWith(op));
  }

  /**
   * Check if the context suggests string operations
   */
  private isStringContext(before: string, after: string): boolean {
    const stringOps = ['+', 'str.'];
    return stringOps.some(op => before.endsWith(op) || after.startsWith(op));
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
