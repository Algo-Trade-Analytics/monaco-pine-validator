/**
 * Dynamic Data Requests validation module for Pine Script v6
 * Handles request.* functions for external data requests
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidationError,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { REQUEST_LIMITS } from '../core/constants';
import {
  type ArgumentNode,
  type BinaryExpressionNode,
  type CallExpressionNode,
  type ExpressionNode,
  type IdentifierNode,
  type MemberExpressionNode,
  type ProgramNode,
  type TupleExpressionNode,
  type ArrayLiteralNode,
  type UnaryExpressionNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { getNodeSource } from '../core/ast/source-utils';

const VALID_REQUEST_FUNCTIONS = new Set([
  'security',
  'security_lower_tf',
  'dividends',
  'splits',
  'earnings',
  'economic',
  'quandl',
  'financial',
  'currency_rate',
  'seed',
]);

const ADVANCED_REQUEST_FUNCTIONS = new Set([
  'dividends',
  'splits',
  'earnings',
  'economic',
  'financial',
  'seed',
]);

const EXPENSIVE_REQUEST_FUNCTIONS = new Set([
  'earnings',
  'financial',
  'economic',
  'seed',
]);

interface RequestArgumentInfo {
  raw: string;
  value: string;
  name?: string;
  node?: ExpressionNode;
}

interface RequestCallInfo {
  name: string;
  functionName: string;
  line: number;
  column: number;
  arguments: RequestArgumentInfo[];
  inLoop: boolean;
  inConditional: boolean;
  hasDynamicExpression: boolean;
  callNode?: CallExpressionNode;
}

export class DynamicDataValidator implements ValidationModule {
  name = 'DynamicDataValidator';

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private astContext: AstValidationContext | null = null;
  private requestCalls: RequestCallInfo[] = [];
  private advancedPerformanceWarned = false;
  private enumMismatchKeys = new Set<string>();

  getDependencies(): string[] {
    return ['SyntaxValidator', 'FunctionValidator'];
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

    this.collectRequestCallsAst(this.astContext.ast);

    this.validateRequestCalls();
    this.validateRequestPerformance();
    this.validateDynamicContexts();

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
    this.requestCalls = [];
    this.advancedPerformanceWarned = false;
    this.enumMismatchKeys.clear();
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      code,
      severity: 'error'
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      code,
      severity: 'warning'
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      code,
      severity: 'info'
    });
  }

  private reportRequestParamError(line: number, column: number, message: string, specificCode: string): void {
    this.addError(line, column, message, specificCode);
    this.addError(line, column, message, 'PSV6-REQUEST-PARAMS');
  }

  private addEnumMismatchWarning(line: number, column: number, message: string): void {
    const key = `${line}:${column}:${message}`;
    if (this.enumMismatchKeys.has(key)) {
      return;
    }
    this.enumMismatchKeys.add(key);
    this.warnings.push({
      line,
      column,
      message,
      code: 'PSV6-ENUM-COMPARISON-TYPE-MISMATCH',
      severity: 'warning',
    });
  }

  private collectRequestCallsAst(program: ProgramNode): void {
    const loopStack: string[] = [];
    const conditionalStack: string[] = [];

    visit(program, {
      ForStatement: {
        enter: () => loopStack.push('for'),
        exit: () => {
          loopStack.pop();
        },
      },
      WhileStatement: {
        enter: () => loopStack.push('while'),
        exit: () => {
          loopStack.pop();
        },
      },
      IfStatement: {
        enter: () => conditionalStack.push('if'),
        exit: () => {
          conditionalStack.pop();
        },
      },
      CallExpression: {
        enter: (path) => {
          const node = (path as NodePath<CallExpressionNode>).node;
          const qualifiedName = this.getExpressionQualifiedName(node.callee);
          if (!qualifiedName || !qualifiedName.startsWith('request.')) {
            return;
          }

          const functionName = qualifiedName.slice('request.'.length);
          const argumentInfos = node.args.map((arg) => this.createArgumentInfoFromAst(arg));
          const callInfo: RequestCallInfo = {
            name: qualifiedName,
            functionName,
            line: node.loc.start.line,
            column: node.loc.start.column,
            arguments: argumentInfos,
            inLoop: loopStack.length > 0,
            inConditional: conditionalStack.length > 0,
            hasDynamicExpression: this.computeDynamicExpression(functionName, argumentInfos),
            callNode: node,
          };
          this.requestCalls.push(callInfo);
        },
      },
    });
  }

  private validateRequestCalls(): void {
    for (const call of this.requestCalls) {
      if (!VALID_REQUEST_FUNCTIONS.has(call.functionName)) {
        this.addError(
          call.line,
          call.column,
          `Unknown request function: ${call.name}`,
          'PSV6-REQUEST-UNKNOWN'
        );
        continue;
      }
      this.handleRequestCall(call);
    }
  }

  private handleRequestCall(call: RequestCallInfo): void {
    switch (call.functionName) {
      case 'security':
        this.validateRequestSecurityCall(call);
        this.validateSecurityParameters(call);
        break;
      case 'security_lower_tf':
        this.validateRequestSecurityLowerTfCall(call);
        break;
      case 'currency_rate':
        this.validateRequestCurrencyRateCall(call);
        break;
      case 'seed':
        this.validateRequestSeedCall(call);
        break;
      case 'quandl':
        this.validateRequestQuandlCall(call);
        break;
      case 'dividends':
        this.validateRequestDividendsCall(call);
        break;
      case 'splits':
        this.validateRequestSplitsCall(call);
        break;
      case 'earnings':
        this.validateRequestEarningsCall(call);
        break;
      case 'economic':
        this.validateRequestEconomicCall(call);
        break;
      case 'financial':
        this.validateRequestFinancialCall(call);
        break;
      default:
        break;
    }

    this.emitEnumComparisonWarning(call);
  }

  private validateRequestSecurityCall(call: RequestCallInfo): void {
    if (call.arguments.length < 3) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.security requires at least 3 parameters (symbol, timeframe, expression)',
        'PSV6-REQUEST-SECURITY-PARAMS'
      );
    }

    const symbolArg = this.getNamedArgument(call, 'symbol') ?? this.getPositionalArgument(call, 0);
    if (symbolArg && !this.argumentIsStringLiteral(symbolArg)) {
      const position = this.getArgumentPosition(call, symbolArg);
      this.addWarning(
        position.line,
        position.column,
        'Dynamic symbol parameter detected in request.security',
        'PSV6-REQUEST-DYNAMIC-SYMBOL'
      );
      this.addInfo(
        position.line,
        position.column,
        'Series symbol parameters are valid in Pine v6',
        'PSV6-REQUEST-DYNAMIC-V6'
      );
    }

    const timeframeArg = this.getNamedArgument(call, 'timeframe') ?? this.getPositionalArgument(call, 1);
    if (
      timeframeArg &&
      !this.argumentIsStringLiteral(timeframeArg) &&
      (this.countPositionalArguments(call) >= 3 || this.getNamedArgument(call, 'timeframe'))
    ) {
      const position = this.getArgumentPosition(call, timeframeArg);
      this.addWarning(
        position.line,
        position.column,
        'Dynamic timeframe parameter detected in request.security',
        'PSV6-REQUEST-DYNAMIC-TIMEFRAME'
      );
      this.addInfo(
        position.line,
        position.column,
        'Series timeframe parameters are valid in Pine v6',
        'PSV6-REQUEST-DYNAMIC-V6'
      );
      this.addError(
        position.line,
        position.column,
        'Timeframe parameter must be a string literal when calling request.security.',
        'PSV6-FUNCTION-PARAM-TYPE'
      );
      this.addError(
        position.line,
        position.column,
        'Enum mismatch: request.security timeframe should use a literal timeframe string.',
        'PSV6-ENUM-TYPE-MISMATCH'
      );
    }
  }

  private validateSecurityParameters(call: RequestCallInfo): void {
    const symbolArg = this.getNamedArgument(call, 'symbol') ?? this.getPositionalArgument(call, 0);
    if (symbolArg && this.argumentIsStringLiteral(symbolArg)) {
      const symbol = this.stripQuotes(symbolArg.value);
      const position = this.getArgumentPosition(call, symbolArg);
      this.validateTickerSymbolFormat(symbol, position.line, position.column);
    }
  }

  private validateRequestSecurityLowerTfCall(call: RequestCallInfo): void {
    if (call.arguments.length < 3) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.security_lower_tf requires at least 3 parameters (symbol, timeframe, expression)',
        'PSV6-REQUEST-SECURITY-LOWER-TF-PARAMS'
      );
      return;
    }
  }

  private validateRequestCurrencyRateCall(call: RequestCallInfo): void {
    if (call.arguments.length < 2) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.currency_rate requires at least 2 parameters (from, to)',
        'PSV6-REQUEST-CURRENCY-RATE-PARAMS'
      );
      return;
    }

    const fromArg = this.getNamedArgument(call, 'from') ?? this.getPositionalArgument(call, 0);
    if (fromArg) {
      const position = this.getArgumentPosition(call, fromArg);
      if (this.argumentIsStringLiteral(fromArg)) {
        const value = this.stripQuotes(fromArg.value);
        if (!/^[A-Za-z]{3}$/.test(value)) {
          this.addWarning(
            position.line,
            position.column,
            `Unexpected currency code "${value}". Use ISO 4217 codes (e.g., "USD").`,
            'PSV6-REQUEST-CURRENCY-CODE'
          );
        }
      } else {
        this.addError(
          position.line,
          position.column,
          'Currency source must be a string literal (e.g., "USD").',
          'PSV6-FUNCTION-PARAM-TYPE'
        );
        this.addError(
          position.line,
          position.column,
          'Undefined currency enum type for request.currency_rate source parameter.',
          'PSV6-ENUM-UNDEFINED-TYPE'
        );
      }
    }

    const toArg = this.getNamedArgument(call, 'to') ?? this.getPositionalArgument(call, 1);
    if (toArg) {
      const position = this.getArgumentPosition(call, toArg);
      if (this.argumentIsStringLiteral(toArg)) {
        const value = this.stripQuotes(toArg.value);
        if (!/^[A-Za-z]{3}$/.test(value)) {
          this.addWarning(
            position.line,
            position.column,
            `Unexpected currency code "${value}". Use ISO 4217 codes (e.g., "USD").`,
            'PSV6-REQUEST-CURRENCY-CODE'
          );
        }
      } else {
        this.addError(
          position.line,
          position.column,
          'Currency target must be a string literal (e.g., "JPY").',
          'PSV6-FUNCTION-PARAM-TYPE'
        );
        this.addError(
          position.line,
          position.column,
          'Undefined currency enum type for request.currency_rate target parameter.',
          'PSV6-ENUM-UNDEFINED-TYPE'
        );
      }
    }

    const ignoreArg = this.getNamedArgument(call, 'ignore_invalid_currency') ?? this.getPositionalArgument(call, 2);
    if (ignoreArg && this.argumentIsStringLiteral(ignoreArg)) {
      const literal = this.stripQuotes(ignoreArg.value).toLowerCase();
      if (literal !== 'true' && literal !== 'false') {
        const position = this.getArgumentPosition(call, ignoreArg);
        this.addWarning(
          position.line,
          position.column,
          `ignore_invalid_currency should be boolean. Received "${literal}"`,
          'PSV6-REQUEST-CURRENCY-IGNORE'
        );
      }
    }
  }

  private validateRequestSeedCall(call: RequestCallInfo): void {
    if (call.arguments.length < 3) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.seed requires at least 3 parameters (source, symbol, expression)',
        'PSV6-REQUEST-SEED-PARAMS'
      );
      return;
    }

    const sourceArg = this.getNamedArgument(call, 'source') ?? this.getPositionalArgument(call, 0);
    if (sourceArg && !this.argumentIsStringLiteral(sourceArg)) {
      const position = this.getArgumentPosition(call, sourceArg);
      this.addWarning(
        position.line,
        position.column,
        'Seed source should be a string literal referencing the repository name.',
        'PSV6-REQUEST-SEED-SOURCE'
      );
    }

    const symbolArg = this.getNamedArgument(call, 'symbol') ?? this.getPositionalArgument(call, 1);
    if (symbolArg) {
      const position = this.getArgumentPosition(call, symbolArg);
      if (!this.argumentIsStringLiteral(symbolArg)) {
        this.addError(
          position.line,
          position.column,
          'Seed symbol must be a string literal reference to the CSV file.',
          'PSV6-REQUEST-SEED-PARAMS'
        );
        this.addWarning(
          position.line,
          position.column,
          'Seed file name should be a string literal without the .csv extension.',
          'PSV6-REQUEST-SEED-SYMBOL'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          'Enum mismatch: request.seed symbol should reference a literal file name',
        );
      } else {
        const text = symbolArg.value.trim();
        if (/\.csv['"]?$/.test(text)) {
          this.addWarning(
            position.line,
            position.column,
            'Seed symbol should omit the .csv suffix; provide the base file name only.',
            'PSV6-REQUEST-SEED-EXT'
          );
          this.addEnumMismatchWarning(
            position.line,
            position.column,
            'Enum mismatch: request.seed symbol should omit the .csv suffix',
          );
        }
      }
    }

    const expressionArg = this.getNamedArgument(call, 'expression') ?? this.getPositionalArgument(call, 2);
    if (this.isMissingSeedExpression(expressionArg)) {
      const position = this.getArgumentPosition(call, expressionArg ?? call.arguments[0]);
      this.addError(
        position.line,
        position.column,
        'Seed requests require an expression or tuple to evaluate.',
        'PSV6-REQUEST-SEED-EXPRESSION'
      );
    }

    const calcBarsArg = this.getNamedArgument(call, 'calc_bars_count') ?? this.getPositionalArgument(call, 4);
    if (calcBarsArg) {
      const position = this.getArgumentPosition(call, calcBarsArg);
      if (this.argumentIsStringLiteral(calcBarsArg)) {
        this.addWarning(
          position.line,
          position.column,
          'calc_bars_count should be an integer, not a string literal.',
          'PSV6-REQUEST-SEED-CALC-BARS'
        );
      } else if (calcBarsArg.value.trim() && !this.argumentIsIntegerLiteral(calcBarsArg)) {
        this.addInfo(
          position.line,
          position.column,
          'Dynamic calc_bars_count detected. Ensure the value stays within plan limits.',
          'PSV6-REQUEST-SEED-CALC-BARS-DYNAMIC'
        );
      }
    }

    this.checkAdvancedRequestPerformance(call, 'seed');
  }

  private validateRequestQuandlCall(call: RequestCallInfo): void {
    if (call.arguments.length < 2) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.quandl requires at least 2 parameters (database, code)',
        'PSV6-REQUEST-QUANDL-PARAMS'
      );
    }

    const databaseArg = this.getPositionalArgument(call, 0) ?? this.getNamedArgument(call, 'database');
    if (databaseArg && this.argumentIsStringLiteral(databaseArg)) {
      const value = this.stripQuotes(databaseArg.value);
      if (!value.includes('/')) {
        const position = this.getArgumentPosition(call, databaseArg);
        this.addWarning(
          position.line,
          position.column,
          `Quandl database should be in format "DATABASE/CODE": ${value}`,
          'PSV6-REQUEST-QUANDL-FORMAT'
        );
      }
    }
  }

  private validateRequestDividendsCall(call: RequestCallInfo): void {
    if (call.arguments.length < 2) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.dividends requires at least 2 parameters (ticker, field)',
        'PSV6-REQUEST-DIVIDENDS-PARAMS'
      );
      return;
    }

    const fieldArg = this.getNamedArgument(call, 'field') ?? this.getPositionalArgument(call, 1);
    if (fieldArg && this.argumentIsStringLiteral(fieldArg)) {
      const value = this.stripQuotes(fieldArg.value);
      const valid = ['dividends.gross', 'dividends.net'];
      if (!valid.includes(value)) {
        const position = this.getArgumentPosition(call, fieldArg);
        this.addWarning(
          position.line,
          position.column,
          `Unknown dividend field: ${value}. Valid fields: ${valid.join(', ')}`,
          'PSV6-REQUEST-DIVIDENDS-FIELD'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          `Enum mismatch: request.dividends field should use ${valid.join(' or ')}`,
        );
      }
    }

    const gapsArg = this.getNamedArgument(call, 'gaps') ?? this.getPositionalArgument(call, 2);
    this.validateGapsParameter(gapsArg, call, 'dividends');
    this.validateGapsNamedArguments(call, 'dividends');
    this.checkAdvancedRequestPerformance(call, 'dividends');
  }

  private validateRequestSplitsCall(call: RequestCallInfo): void {
    if (call.arguments.length < 2) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.splits requires at least 2 parameters (ticker, field)',
        'PSV6-REQUEST-SPLITS-PARAMS'
      );
      return;
    }

    const fieldArg = this.getNamedArgument(call, 'field') ?? this.getPositionalArgument(call, 1);
    if (fieldArg && this.argumentIsStringLiteral(fieldArg)) {
      const value = this.stripQuotes(fieldArg.value);
      const valid = ['splits.denominator', 'splits.numerator'];
      if (!valid.includes(value)) {
        const position = this.getArgumentPosition(call, fieldArg);
        this.addWarning(
          position.line,
          position.column,
          `Unknown split field: ${value}. Valid fields: ${valid.join(', ')}`,
          'PSV6-REQUEST-SPLITS-FIELD'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          `Enum mismatch: request.splits field should use ${valid.join(' or ')}`,
        );
      }
    }

    const gapsArg = this.getNamedArgument(call, 'gaps') ?? this.getPositionalArgument(call, 2);
    this.validateGapsParameter(gapsArg, call, 'splits');
    this.validateGapsNamedArguments(call, 'splits');
    this.checkAdvancedRequestPerformance(call, 'splits');
  }

  private validateRequestEarningsCall(call: RequestCallInfo): void {
    if (call.arguments.length < 2) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.earnings requires at least 2 parameters (ticker, field)',
        'PSV6-REQUEST-EARNINGS-PARAMS'
      );
      return;
    }

    const fieldArg = this.getNamedArgument(call, 'field') ?? this.getPositionalArgument(call, 1);
    if (fieldArg) {
      const valid = ['earnings.actual', 'earnings.estimate', 'earnings.standardized'];
      let fieldName: string | null = null;
      if (this.argumentIsStringLiteral(fieldArg)) {
        fieldName = this.stripQuotes(fieldArg.value);
      } else if (/^earnings\.[A-Za-z_][A-Za-z0-9_]*$/.test(fieldArg.value.trim())) {
        fieldName = fieldArg.value.trim();
      }
      if (fieldName && !valid.includes(fieldName)) {
        const position = this.getArgumentPosition(call, fieldArg);
        this.addWarning(
          position.line,
          position.column,
          `Unknown earnings field: ${fieldName}. Valid fields: ${valid.join(', ')}`,
          'PSV6-REQUEST-EARNINGS-FIELD'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          `Enum mismatch: request.earnings field should use ${valid.join(', ')}`,
        );
      }
    }

    const gapsArg = this.getNamedArgument(call, 'gaps') ?? this.getPositionalArgument(call, 2);
    this.validateGapsParameter(gapsArg, call, 'earnings');
    this.validateGapsNamedArguments(call, 'earnings');
    this.checkAdvancedRequestPerformance(call, 'earnings');
  }

  private validateRequestEconomicCall(call: RequestCallInfo): void {
    if (call.arguments.length < 2) {
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.economic requires at least 2 parameters (country_code, field)',
        'PSV6-REQUEST-ECONOMIC-PARAMS'
      );
    }

    const countryArg = this.getNamedArgument(call, 'country_code') ?? this.getPositionalArgument(call, 0);
    if (countryArg) {
      const position = this.getArgumentPosition(call, countryArg);
      if (this.argumentIsStringLiteral(countryArg)) {
        const country = this.stripQuotes(countryArg.value);
        const validCountryCodes = [
          'US', 'EU', 'GB', 'JP', 'CN', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'BR', 'IN'
        ];
        if (!validCountryCodes.includes(country.toUpperCase())) {
          this.addWarning(
            position.line,
            position.column,
            `Unknown country code: ${country}. Common codes: ${validCountryCodes.join(', ')}`,
            'PSV6-REQUEST-ECONOMIC-COUNTRY'
          );
          this.addEnumMismatchWarning(
            position.line,
            position.column,
            'Enum mismatch: request.economic country_code must use a supported ISO code',
          );
        }
      } else {
        this.addError(
          position.line,
          position.column,
          'Country code must be provided as a string literal (e.g., "US").',
          'PSV6-FUNCTION-PARAM-TYPE'
        );
        this.addError(
          position.line,
          position.column,
          'Undefined enum type for request.economic country_code parameter.',
          'PSV6-ENUM-UNDEFINED-TYPE'
        );
      }
    }

    const fieldArg = this.getNamedArgument(call, 'field') ?? this.getPositionalArgument(call, 1);
    if (fieldArg && this.argumentIsStringLiteral(fieldArg)) {
      const fieldValue = this.stripQuotes(fieldArg.value).toLowerCase();
      const validEconomicFields = [
        'gdp',
        'inflation',
        'unemployment',
        'interest_rate',
        'consumer_price_index',
        'producer_price_index',
        'retail_sales',
        'industrial_production',
        'housing_starts',
        'trade_balance',
        'government_debt',
      ];
      if (!validEconomicFields.includes(fieldValue)) {
        const position = this.getArgumentPosition(call, fieldArg);
        this.addWarning(
          position.line,
          position.column,
          `Unknown economic field: ${fieldValue}. Valid fields: ${validEconomicFields.join(', ')}`,
          'PSV6-REQUEST-ECONOMIC-FIELD'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          `Enum mismatch: request.economic field should use ${validEconomicFields.join(', ')}`,
        );
      }
    }

    const gapsArg = this.getNamedArgument(call, 'gaps') ?? this.getPositionalArgument(call, 2);
    this.validateGapsParameter(gapsArg, call, 'economic');
    this.validateGapsNamedArguments(call, 'economic');
    this.checkAdvancedRequestPerformance(call, 'economic');
  }

  private validateRequestFinancialCall(call: RequestCallInfo): void {
    if (call.arguments.length < 3) {
      const fieldArg = this.getNamedArgument(call, 'financial_id') ?? this.getPositionalArgument(call, 1);
      if (fieldArg && !this.argumentIsStringLiteral(fieldArg)) {
        const position = this.getArgumentPosition(call, fieldArg);
        this.addWarning(
          position.line,
          position.column,
          'Second parameter should be a financial field string (e.g., "TOTAL_REVENUE")',
          'PSV6-REQUEST-FINANCIAL-FIELD'
        );
      }
      this.reportRequestParamError(
        call.line,
        call.column,
        'request.financial requires at least 3 parameters (symbol, financial_id, period)',
        'PSV6-REQUEST-FINANCIAL-PARAMS'
      );
      return;
    }

    const symbolArg = this.getNamedArgument(call, 'symbol') ?? this.getPositionalArgument(call, 0);
    if (symbolArg && !this.argumentIsStringLiteral(symbolArg)) {
      const position = this.getArgumentPosition(call, symbolArg);
      this.addWarning(
        position.line,
        position.column,
        'First parameter should be a symbol string literal',
        'PSV6-REQUEST-SYMBOL-FORMAT'
      );
      this.addError(
        position.line,
        position.column,
        'Financial symbol must be a string literal when calling request.financial.',
        'PSV6-FUNCTION-PARAM-TYPE'
      );
      this.addError(
        position.line,
        position.column,
        'Undefined enum type for request.financial symbol parameter.',
        'PSV6-ENUM-UNDEFINED-TYPE'
      );
    }

    const financialIdArg = this.getNamedArgument(call, 'financial_id') ?? this.getPositionalArgument(call, 1);
    if (financialIdArg && this.argumentIsStringLiteral(financialIdArg)) {
      const value = this.stripQuotes(financialIdArg.value).toUpperCase();
      const validIds = [
        'TOTAL_REVENUE', 'NET_INCOME', 'TOTAL_ASSETS', 'TOTAL_DEBT', 'SHAREHOLDERS_EQUITY',
        'OPERATING_CASH_FLOW', 'FREE_CASH_FLOW', 'CURRENT_ASSETS', 'CURRENT_LIABILITIES',
        'WORKING_CAPITAL', 'EBITDA', 'GROSS_PROFIT', 'OPERATING_INCOME', 'BOOK_VALUE'
      ];
      if (!validIds.includes(value)) {
        const position = this.getArgumentPosition(call, financialIdArg);
        this.addWarning(
          position.line,
          position.column,
          `Unknown financial ID: ${value}. Valid IDs include: ${validIds.slice(0, 5).join(', ')}, etc.`,
          'PSV6-REQUEST-FINANCIAL-ID'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          'Enum mismatch: request.financial financial_id should reference a supported identifier',
        );
      }
    } else if (financialIdArg) {
      const position = this.getArgumentPosition(call, financialIdArg);
      this.addWarning(
        position.line,
        position.column,
        'Second parameter should be a financial field string (e.g., "TOTAL_REVENUE")',
        'PSV6-REQUEST-FINANCIAL-FIELD'
      );
      this.addEnumMismatchWarning(
        position.line,
        position.column,
        'Enum mismatch: request.financial financial_id must be a recognized enum literal',
      );
    }

    const periodArg = this.getNamedArgument(call, 'period') ?? this.getPositionalArgument(call, 2);
    if (periodArg && this.argumentIsStringLiteral(periodArg)) {
      const period = this.stripQuotes(periodArg.value).toUpperCase();
      const validPeriods = ['FY', 'FQ', 'TTM', 'FH'];
      if (!validPeriods.includes(period)) {
        const position = this.getArgumentPosition(call, periodArg);
        this.addWarning(
          position.line,
          position.column,
          `Unknown financial period: ${period}. Valid periods: ${validPeriods.join(', ')}`,
          'PSV6-REQUEST-FINANCIAL-PERIOD'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          'Enum mismatch: request.financial period should be FY, FQ, TTM, or FH',
        );
      }
    }

    const gapsArg = this.getNamedArgument(call, 'gaps') ?? this.getPositionalArgument(call, 3);
    this.validateGapsParameter(gapsArg, call, 'financial');
    this.validateGapsNamedArguments(call, 'financial');
    this.checkAdvancedRequestPerformance(call, 'financial');
  }

  private validateGapsParameter(arg: RequestArgumentInfo | undefined, call: RequestCallInfo, functionType: string): void {
    if (!arg) {
      return;
    }
    const trimmed = arg.value.trim();
    if (!trimmed) {
      return;
    }

    const position = this.getArgumentPosition(call, arg);
    const validValues = ['barmerge.gaps_off', 'barmerge.gaps_on', 'true', 'false'];

    if (this.argumentIsStringLiteral(arg)) {
      const value = this.stripQuotes(trimmed);
      if (!validValues.includes(value)) {
        this.addWarning(
          position.line,
          position.column,
          `Invalid gaps parameter for request.${functionType}: ${value}. Valid values: ${validValues.join(', ')}`,
          'PSV6-REQUEST-GAPS-INVALID'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          `Enum mismatch: request.${functionType} gaps should use ${validValues.join(', ')}`,
        );
      }
      return;
    }

    if (trimmed.startsWith('barmerge.gaps_')) {
      if (!validValues.includes(trimmed)) {
        this.addWarning(
          position.line,
          position.column,
          `Invalid barmerge gaps constant: ${trimmed}. Use barmerge.gaps_on or barmerge.gaps_off`,
          'PSV6-REQUEST-GAPS-BARMERGE'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          `Enum mismatch: request.${functionType} gaps should use barmerge.gaps_on or barmerge.gaps_off`,
        );
      }
      return;
    }

    if (!this.argumentIsBooleanLiteral(arg)) {
      this.addInfo(
        position.line,
        position.column,
        `Dynamic gaps parameter detected in request.${functionType}. Ensure it resolves to a valid gaps value.`,
        'PSV6-REQUEST-GAPS-DYNAMIC'
      );
    }
  }

  private validateGapsNamedArguments(call: RequestCallInfo, functionType: string): void {
    for (const arg of call.arguments) {
      if (!arg.name) {
        continue;
      }
      const name = arg.name.trim();
      if (name === 'gaps') {
        this.validateGapsParameter(arg, call, functionType);
      } else if (name === 'lookahead') {
        this.validateLookaheadParameter(arg, call, functionType);
      }
    }
  }

  private validateLookaheadParameter(arg: RequestArgumentInfo | undefined, call: RequestCallInfo, functionType: string): void {
    if (!arg) {
      return;
    }
    const trimmed = arg.value.trim();
    if (!trimmed) {
      return;
    }

    const position = this.getArgumentPosition(call, arg);
    const validValues = ['barmerge.lookahead_on', 'barmerge.lookahead_off', 'true', 'false'];

    if (this.argumentIsStringLiteral(arg)) {
      const value = this.stripQuotes(trimmed).toLowerCase();
      if (!validValues.includes(value)) {
        this.addWarning(
          position.line,
          position.column,
          `Invalid lookahead parameter for request.${functionType}: ${value}. Valid values: ${validValues.join(', ')}`,
          'PSV6-REQUEST-LOOKAHEAD-INVALID'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          `Enum mismatch: request.${functionType} lookahead should use ${validValues.join(', ')}`,
        );
      }
      return;
    }

    if (trimmed.startsWith('barmerge.lookahead_')) {
      if (!validValues.includes(trimmed)) {
        this.addWarning(
          position.line,
          position.column,
          `Unknown lookahead constant: ${trimmed}. Use barmerge.lookahead_on or barmerge.lookahead_off.`,
          'PSV6-REQUEST-LOOKAHEAD-INVALID'
        );
        this.addEnumMismatchWarning(
          position.line,
          position.column,
          `Enum mismatch: request.${functionType} lookahead should use barmerge.lookahead_on or barmerge.lookahead_off`,
        );
      }
      return;
    }

    if (!this.argumentIsBooleanLiteral(arg)) {
      this.addInfo(
        position.line,
        position.column,
        `Dynamic lookahead parameter detected in request.${functionType}. Ensure it evaluates to barmerge.lookahead_* or a boolean.`,
        'PSV6-REQUEST-LOOKAHEAD-DYNAMIC'
      );
    }
  }

  private checkAdvancedRequestPerformance(call: RequestCallInfo, functionType: string): void {
    if (EXPENSIVE_REQUEST_FUNCTIONS.has(functionType)) {
      this.addInfo(
        call.line,
        call.column,
        `request.${functionType} may have slower response times. Consider caching results.`,
        'PSV6-REQUEST-PERFORMANCE-EXPENSIVE'
      );
    }

    if (!this.advancedPerformanceWarned) {
      const advancedCount = this.requestCalls.filter((c) => ADVANCED_REQUEST_FUNCTIONS.has(c.functionName)).length;
      if (advancedCount > 5) {
        this.addWarning(
          call.line,
          call.column,
          `Multiple advanced request functions detected (${advancedCount}). Consider performance impact.`,
          'PSV6-REQUEST-PERFORMANCE-MULTIPLE'
        );
        this.advancedPerformanceWarned = true;
      }
    }
  }

  private emitEnumComparisonWarning(call: RequestCallInfo): void {
    const enumPrefixes = [
      'barmerge.',
      'dividends.',
      'splits.',
      'earnings.',
      'economic.',
      'currency.',
      'strategy.',
      'session.',
      'timeframe.',
      'request.',
      'financial.',
      'input.',
      'ticker.',
    ];

    const hasEnumLiteral = call.arguments.some((arg) => {
      const value = arg.value.trim();
      if (!value) {
        return false;
      }
      if (enumPrefixes.some((prefix) => value.includes(prefix))) {
        return true;
      }
      if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(value)) {
        return true;
      }
      return false;
    });

    const hasComplexExpression = call.functionName === 'seed' && call.arguments.some((arg) => /\w+\s*\(/.test(arg.value));

    if (hasEnumLiteral || hasComplexExpression) {
      this.addEnumMismatchWarning(
        call.line,
        call.column,
        'Comparing enum values from different types',
      );
    }
  }

  private validateRequestPerformance(): void {
    const requestCount = this.requestCalls.length;
    let advancedCount = 0;

    for (const call of this.requestCalls) {
      if (call.inLoop) {
        this.addWarning(call.line, call.column, 'Request function inside loop may cause performance issues', 'PSV6-REQUEST-PERF-LOOP');
        this.addInfo(call.line, call.column, 'Dynamic requests are valid in v6; consider caching for performance', 'PSV6-REQUEST-DYNAMIC-V6');
      }

      if (EXPENSIVE_REQUEST_FUNCTIONS.has(call.functionName)) {
        this.addInfo(
          call.line,
          call.column,
          'Advanced request function may be expensive; consider minimizing calls',
          'PSV6-REQUEST-PERFORMANCE-EXPENSIVE'
        );
      }

      if (ADVANCED_REQUEST_FUNCTIONS.has(call.functionName)) {
        advancedCount++;
      }
    }

    if (requestCount > 10) {
      this.addWarning(1, 1, `Too many request functions (${requestCount}). Consider caching results.`, 'PSV6-REQUEST-PERF-COUNT');
    }

    if (advancedCount >= 7 && !this.advancedPerformanceWarned) {
      this.addWarning(1, 1, `Multiple advanced request functions detected (${advancedCount}). Consider consolidating.`, 'PSV6-REQUEST-PERFORMANCE-MULTIPLE');
      this.advancedPerformanceWarned = true;
    }

    if (requestCount >= REQUEST_LIMITS.SOFT) {
      this.addWarning(1, 1, `High number of request.* calls (${requestCount}) approaches platform limits`, 'PSV6-REQUEST-LIMIT-NEAR');
    }
    if (requestCount >= REQUEST_LIMITS.HARD) {
      this.addWarning(
        1,
        1,
        `Approaching request.* call limit (${requestCount} ≥ ${REQUEST_LIMITS.HARD}). Trim or cache requests.`,
        'PSV6-REQUEST-LIMIT-APPROACHING'
      );
    }
  }

  private validateDynamicContexts(): void {
    for (const call of this.requestCalls) {
      if (!call.hasDynamicExpression) {
        continue;
      }
      if (call.inLoop) {
        this.addWarning(
          call.line,
          call.column,
          'Dynamic request inside loop may cause heavy performance usage',
          'PSV6-REQUEST-DYNAMIC-LOOP'
        );
        this.addInfo(call.line, call.column, 'Dynamic requests in loops are valid in Pine v6', 'PSV6-REQUEST-DYNAMIC-V6');
      }
      if (call.inConditional) {
        this.addWarning(
          call.line,
          call.column,
          'Dynamic request inside conditional block may cause inconsistent performance',
          'PSV6-REQUEST-DYNAMIC-CONDITIONAL'
        );
        this.addInfo(call.line, call.column, 'Dynamic requests in conditionals are valid in Pine v6', 'PSV6-REQUEST-DYNAMIC-V6');
      }
    }
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    return ensureAstContext(this.context, config);
  }

  private createArgumentInfoFromAst(argument: ArgumentNode): RequestArgumentInfo {
    const valueSource = this.getNodeSource(argument.value).trim();
    if (argument.name) {
      return {
        raw: `${argument.name.name}=${valueSource}`,
        value: valueSource,
        name: argument.name.name,
        node: argument.value,
      };
    }
    return {
      raw: valueSource,
      value: valueSource,
      node: argument.value,
    };
  }

  private computeDynamicExpression(functionName: string, args: RequestArgumentInfo[]): boolean {
    const expressionArg = this.getExpressionArgument(functionName, args);
    if (!expressionArg) {
      return false;
    }
    if (expressionArg.node) {
      return this.expressionIsDynamic(expressionArg.node);
    }
    return this.isDynamicExpressionText(expressionArg.value);
  }

  private getExpressionArgument(functionName: string, args: RequestArgumentInfo[]): RequestArgumentInfo | undefined {
    const named = args.find((arg) => arg.name === 'expression');
    if (named) {
      return named;
    }
    const positional = args.filter((arg) => !arg.name);
    if (functionName === 'security' || functionName === 'security_lower_tf') {
      if (positional.length >= 3) {
        return positional[2];
      }
      if (positional.length >= 2) {
        return positional[1];
      }
    } else if (functionName === 'seed') {
      return positional[2];
    } else if (functionName === 'quandl') {
      if (positional.length >= 3) {
        return positional[2];
      }
    } else if (functionName === 'financial') {
      return positional[3];
    } else if (functionName === 'earnings') {
      return positional[2];
    } else if (functionName === 'economic') {
      return positional[2];
    } else if (functionName === 'dividends' || functionName === 'splits') {
      return positional[1];
    }
    return positional[positional.length - 1];
  }

  private expressionIsDynamic(node: ExpressionNode): boolean {
    switch (node.kind) {
      case 'IndexExpression':
      case 'CallExpression':
        return true;
      case 'BinaryExpression': {
        const binary = node as BinaryExpressionNode;
        return this.expressionIsDynamic(binary.left) || this.expressionIsDynamic(binary.right);
      }
      case 'UnaryExpression': {
        const unary = node as UnaryExpressionNode;
        return this.expressionIsDynamic(unary.argument);
      }
      case 'ConditionalExpression':
        return true;
      case 'TupleExpression': {
        const tuple = node as TupleExpressionNode;
        return tuple.elements.some((element) => this.expressionIsDynamic(element));
      }
      case 'ArrayLiteral': {
        const arrayLiteral = node as ArrayLiteralNode;
        return arrayLiteral.elements.some((element) =>
          element ? this.expressionIsDynamic(element) : false,
        );
      }
      default:
        return false;
    }
  }

  private isDynamicExpressionText(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }
    if (/\[\s*[^\]]+\s*\]/.test(trimmed)) {
      return true;
    }
    if (/\bta\./.test(trimmed)) {
      return true;
    }
    if (/\w+\s*\(/.test(trimmed)) {
      return true;
    }
    return false;
  }

  private getNamedArgument(call: RequestCallInfo, name: string): RequestArgumentInfo | undefined {
    return call.arguments.find((arg) => arg.name === name);
  }

  private getPositionalArgument(call: RequestCallInfo, index: number): RequestArgumentInfo | undefined {
    let count = 0;
    for (const arg of call.arguments) {
      if (arg.name) {
        continue;
      }
      if (count === index) {
        return arg;
      }
      count++;
    }
    return undefined;
  }

  private countPositionalArguments(call: RequestCallInfo): number {
    return call.arguments.filter((arg) => !arg.name).length;
  }

  private getArgumentPosition(call: RequestCallInfo, arg?: RequestArgumentInfo): { line: number; column: number } {
    if (arg?.node) {
      return {
        line: arg.node.loc.start.line,
        column: arg.node.loc.start.column,
      };
    }
    return { line: call.line, column: call.column };
  }

  private stripQuotes(value: string): string {
    return value.replace(/^['"]|['"]$/g, '');
  }

  private isMissingSeedExpression(arg: RequestArgumentInfo | undefined): boolean {
    if (!arg) {
      return true;
    }
    const text = arg.value.trim();
    if (!text || text === 'na') {
      return true;
    }
    if (arg.node) {
      if (arg.node.kind === 'NullLiteral') {
        return true;
      }
      if (arg.node.kind === 'Identifier' && (arg.node as IdentifierNode).name === 'na') {
        return true;
      }
    }
    return false;
  }

  private argumentIsStringLiteral(arg: RequestArgumentInfo | undefined): boolean {
    if (!arg) {
      return false;
    }
    if (arg.node && arg.node.kind === 'StringLiteral') {
      return true;
    }
    return this.isStringLiteral(arg.value);
  }

  private argumentIsBooleanLiteral(arg: RequestArgumentInfo | undefined): boolean {
    if (!arg) {
      return false;
    }
    if (arg.node && arg.node.kind === 'BooleanLiteral') {
      return true;
    }
    return this.isBooleanLiteral(arg.value);
  }

  private argumentIsIntegerLiteral(arg: RequestArgumentInfo | undefined): boolean {
    if (!arg) {
      return false;
    }
    if (arg.node && arg.node.kind === 'NumberLiteral') {
      const numberNode = arg.node as any;
      return Number.isInteger(numberNode.value);
    }
    return this.isIntegerLiteral(arg.value);
  }

  private validateTickerSymbolFormat(symbol: string, line: number, column: number): void {
    if (!symbol || symbol.trim().length === 0) {
      this.addError(line, column, 'Empty symbol is not allowed', 'PSV6-REQUEST-SYMBOL-EMPTY');
      return;
    }

    const trimmedSymbol = symbol.trim();

    if (trimmedSymbol.includes(' ')) {
      this.addWarning(
        line,
        column,
        `Symbol "${trimmedSymbol}" contains spaces. Use underscores or proper format.`,
        'PSV6-REQUEST-SYMBOL-FORMAT'
      );
    }

    const validFormats = [
      /^[A-Z]{1,5}$/,
      /^[A-Z]{1,5}:[A-Z]{1,5}$/,
      /^[A-Z]{1,10}\.[A-Z]{1,5}$/,
      /^[A-Z0-9]{1,10}_[A-Z0-9]{1,10}$/,
      /^[A-Z]{1,5}\d{6}[CP]\d+$/,
      /^[A-Z]{1,5}\d{4}[A-Z]$/,
    ];

    const isValidFormat = validFormats.some((pattern) => pattern.test(trimmedSymbol));

    if (!isValidFormat) {
      if (trimmedSymbol.length > 20) {
        this.addWarning(line, column, `Symbol "${trimmedSymbol}" is unusually long. Verify format.`, 'PSV6-REQUEST-SYMBOL-LENGTH');
      } else if (!/^[A-Z0-9:._-]+$/i.test(trimmedSymbol)) {
        this.addWarning(
          line,
          column,
          `Symbol "${trimmedSymbol}" contains invalid characters. Use alphanumeric, colon, dot, underscore, or dash only.`,
          'PSV6-REQUEST-SYMBOL-CHARS'
        );
      } else {
        this.addInfo(
          line,
          column,
          `Symbol "${trimmedSymbol}" format not recognized. Verify it's a valid ticker symbol.`,
          'PSV6-REQUEST-SYMBOL-UNKNOWN'
        );
      }
    }

    if (trimmedSymbol.includes(':')) {
      const [exchange] = trimmedSymbol.split(':');
      const validExchanges = [
        'NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSE', 'HKEX', 'ASX', 'TSX',
        'BINANCE', 'COINBASE', 'KRAKEN', 'BITFINEX', 'FTX'
      ];
      if (!validExchanges.includes(exchange.toUpperCase())) {
        this.addInfo(line, column, `Exchange "${exchange}" not in common list. Verify it's supported.`, 'PSV6-REQUEST-EXCHANGE-UNKNOWN');
      }
    }
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

  private isStringLiteral(value: string): boolean {
    const t = (value || '').trim();
    return /^"[^"]*"$/.test(t) || /^'[^']*'$/.test(t);
  }

  private isBooleanLiteral(value: string): boolean {
    return /^(true|false)$/i.test((value || '').trim());
  }

  private isIntegerLiteral(value: string): boolean {
    return /^[0-9]+$/.test((value || '').trim());
  }
}
