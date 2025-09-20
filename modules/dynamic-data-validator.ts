/**
 * Dynamic Data Requests validation module for Pine Script v6
 * Handles request.* functions for external data requests
 */

import { ValidationModule, ValidationContext, ValidationError, ValidationResult, ValidatorConfig } from '../core/types';
import { REQUEST_LIMITS } from '../core/constants';

export class DynamicDataValidator implements ValidationModule {
  name = 'DynamicDataValidator';
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  getDependencies(): string[] {
    return ['SyntaxValidator', 'FunctionValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.validateRequestFunctions();
    this.validateRequestSecurity();
    this.validateRequestCurrencyRate();
    this.validateRequestSeed();
    this.validateRequestQuandl();
    this.validateAdvancedRequestFunctions();
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

  private validateRequestFunctions(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check for request.* function calls
      const requestMatch = line.match(/request\.(\w+)\s*\(/);
      if (requestMatch) {
        const functionName = requestMatch[1];
        this.validateRequestFunction(line, lineNum, functionName);
      }
    }
  }

  private validateRequestFunction(line: string, lineNum: number, functionName: string): void {
    const validRequestFunctions = [
      'security', 'security_lower_tf', 'dividends', 'splits', 'earnings',
      'economic', 'quandl', 'financial', 'currency_rate', 'seed'
    ];

    if (!validRequestFunctions.includes(functionName)) {
      this.addError(lineNum, 1, `Unknown request function: request.${functionName}`, 'PSV6-REQUEST-UNKNOWN');
      return;
    }

    // Validate specific request functions
    switch (functionName) {
      case 'security':
        this.validateRequestSecurityCall(line, lineNum);
        break;
      case 'security_lower_tf':
        this.validateRequestSecurityLowerTfCall(line, lineNum);
        break;
      case 'dividends':
        this.validateRequestDividendsCall(line, lineNum);
        break;
      case 'splits':
        this.validateRequestSplitsCall(line, lineNum);
        break;
      case 'earnings':
        this.validateRequestEarningsCall(line, lineNum);
        break;
      case 'economic':
        this.validateRequestEconomicCall(line, lineNum);
        break;
      case 'quandl':
        this.validateRequestQuandlCall(line, lineNum);
        break;
      case 'financial':
        this.validateRequestFinancialCall(line, lineNum);
        break;
      case 'currency_rate':
        this.validateRequestCurrencyRateCall(line, lineNum);
        break;
      case 'seed':
        this.validateRequestSeedCall(line, lineNum);
        break;
    }
  }

  private validateRequestSecurity(): void {
    // Additional security-specific validation
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      const securityMatch = line.match(/request\.security\s*\(/);
      if (securityMatch) {
        this.validateSecurityParameters(line, lineNum);
      }
    }
  }

  private validateRequestCurrencyRate(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      if (/request\.currency_rate\s*\(/.test(line)) {
        this.validateRequestCurrencyRateCall(line, lineNum);
      }
    }
  }

  private validateRequestSeed(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      if (/request\.seed\s*\(/.test(line)) {
        this.validateRequestSeedCall(line, lineNum);
      }
    }
  }

  private validateRequestQuandl(): void {
    // Additional Quandl-specific validation
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      const quandlMatch = line.match(/request\.quandl\s*\(/);
      if (quandlMatch) {
        this.validateQuandlParameters(line, lineNum);
      }
    }
  }

  private validateAdvancedRequestFunctions(): void {
    // Additional validation for advanced request functions
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Validate dividends function calls
      const dividendsMatch = line.match(/request\.dividends\s*\(/);
      if (dividendsMatch) {
        this.validateAdvancedRequestParameters(line, lineNum, 'dividends');
      }

      // Validate splits function calls
      const splitsMatch = line.match(/request\.splits\s*\(/);
      if (splitsMatch) {
        this.validateAdvancedRequestParameters(line, lineNum, 'splits');
      }

      // Validate earnings function calls
      const earningsMatch = line.match(/request\.earnings\s*\(/);
      if (earningsMatch) {
        this.validateAdvancedRequestParameters(line, lineNum, 'earnings');
      }

      // Validate economic function calls
      const economicMatch = line.match(/request\.economic\s*\(/);
      if (economicMatch) {
        this.validateAdvancedRequestParameters(line, lineNum, 'economic');
      }

      // Validate financial function calls
      const financialMatch = line.match(/request\.financial\s*\(/);
      if (financialMatch) {
        this.validateAdvancedRequestParameters(line, lineNum, 'financial');
      }
    }
  }

  private validateAdvancedRequestParameters(line: string, lineNum: number, functionType: string): void {
    // Common parameter validation for advanced request functions
    const symbolMatch = line.match(new RegExp(`request\\.${functionType}\\s*\\(\\s*["']([^"']+)["']`));
    if (symbolMatch) {
      const symbol = symbolMatch[1];
      this.validateTickerSymbolFormat(symbol, lineNum);
    }

    // Check for performance implications
    this.checkAdvancedRequestPerformance(line, lineNum, functionType);
  }

  private checkAdvancedRequestPerformance(line: string, lineNum: number, functionType: string): void {
    // Performance checks specific to advanced request functions
    const expensiveFunctions = ['earnings', 'financial', 'economic', 'seed'];
    
    if (expensiveFunctions.includes(functionType)) {
      this.addInfo(lineNum, 1, 
        `request.${functionType} may have slower response times. Consider caching results.`, 
        'PSV6-REQUEST-PERFORMANCE-EXPENSIVE');
    }

    // Check for multiple advanced requests in the same script
    const advancedRequestCount = this.countAdvancedRequests();
    if (advancedRequestCount > 5) {
      this.addWarning(lineNum, 1, 
        `Multiple advanced request functions detected (${advancedRequestCount}). Consider performance impact.`, 
        'PSV6-REQUEST-PERFORMANCE-MULTIPLE');
    }
  }

  private countAdvancedRequests(): number {
    let count = 0;
    const advancedRequestPattern = /request\.(dividends|splits|earnings|economic|financial|seed)\s*\(/g;
    
    for (const line of this.context.cleanLines) {
      const matches = line.match(advancedRequestPattern);
      if (matches) {
        count += matches.length;
      }
    }
    
    return count;
  }

  private validateRequestPerformance(): void {
    // Check for performance issues with request functions
    let requestCount = 0;
    let inLoop = false;

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;

      // Check if we're in a loop
      if (line.match(/^\s*(for|while)\s+/)) {
        inLoop = true;
      } else if (line.match(/^\s*(end|})\s*$/)) {
        inLoop = false;
      }

      // Count request functions
      const requestMatch = line.match(/request\.(\w+)\s*\(/);
      if (requestMatch) {
        requestCount++;
        const kind = requestMatch[1];
        
        if (inLoop) {
          this.addWarning(lineNum, 1, 
            'Request function inside loop may cause performance issues', 
            'PSV6-REQUEST-PERF-LOOP');
          // Also acknowledge as valid v6 dynamic feature
          this.addInfo(lineNum, 1, 'Dynamic requests are valid in v6; consider caching for performance', 'PSV6-REQUEST-DYNAMIC-V6');
        }

        // Expensive request types informational note
        if (['earnings','financial','economic'].includes(kind)) {
          this.addInfo(lineNum, 1, 'Advanced request function may be expensive; consider minimizing calls', 'PSV6-REQUEST-PERFORMANCE-EXPENSIVE');
        }
      }
    }

    // Warn if too many request functions
    if (requestCount > 10) {
      this.addWarning(1, 1, 
        `Too many request functions (${requestCount}). Consider caching results.`, 
        'PSV6-REQUEST-PERF-COUNT');
    }

    // Warn if many advanced request functions are used
    const advancedCount = this.context.cleanLines.reduce((acc, l) => acc + ((l.match(/request\.(dividends|splits|earnings|economic|financial)\s*\(/g) || []).length), 0);
    if (advancedCount >= 7) {
      this.addWarning(1, 1, `Multiple advanced request functions detected (${advancedCount}). Consider consolidating.`, 'PSV6-REQUEST-PERFORMANCE-MULTIPLE');
    }

    // Heuristic script-level limits
    if (requestCount >= REQUEST_LIMITS.SOFT) {
      this.addWarning(1, 1, `High number of request.* calls (${requestCount}) approaches platform limits`, 'PSV6-REQUEST-LIMIT-NEAR');
    }
    if (requestCount >= REQUEST_LIMITS.HARD) {
      this.addWarning(1, 1, `Approaching request.* call limit (${requestCount} ≥ ${REQUEST_LIMITS.HARD}). Trim or cache requests.`, 'PSV6-REQUEST-LIMIT-APPROACHING');
    }
  }

  private validateRequestSecurityCall(line: string, lineNum: number): void {
    // Basic parameter validation for request.security
    const paramMatch = line.match(/request\.security\s*\(\s*([^)]*)\s*\)/);
    if (paramMatch) {
      const params = paramMatch[1];
      const paramList = this.parseParameterList(params);
      
      if (paramList.length < 2) {
        this.addError(lineNum, 1, 
          'request.security requires at least 2 parameters (symbol, expression)', 
          'PSV6-REQUEST-SECURITY-PARAMS');
      }

      // Dynamic symbol/timeframe detection (v6 allows series strings)
      const symbolArg = paramList[0]?.trim();
      const timeframeCandidate = paramList[1]?.trim();
      const expressionArg = paramList.length >= 3 ? paramList[2].trim() : paramList[1]?.trim();

      if (symbolArg && !this.isStringLiteral(symbolArg)) {
        this.addWarning(lineNum, 1, 'Dynamic symbol parameter detected in request.security', 'PSV6-REQUEST-DYNAMIC-SYMBOL');
        this.addInfo(lineNum, 1, 'Series symbol parameters are valid in Pine v6', 'PSV6-REQUEST-DYNAMIC-V6');
      }
      // When three params provided, second is timeframe; warn if dynamic (not string literal)
      if (paramList.length >= 3 && timeframeCandidate && !this.isStringLiteral(timeframeCandidate)) {
        this.addWarning(lineNum, 1, 'Dynamic timeframe parameter detected in request.security', 'PSV6-REQUEST-DYNAMIC-TIMEFRAME');
        this.addInfo(lineNum, 1, 'Series timeframe parameters are valid in Pine v6', 'PSV6-REQUEST-DYNAMIC-V6');
      }
      // If expression uses dynamic indexing, we consider it dynamic context (handled in validateDynamicContexts too)
    }
  }

  private validateRequestSecurityLowerTfCall(line: string, lineNum: number): void {
    // Basic parameter validation for request.security_lower_tf
    const paramMatch = line.match(/request\.security_lower_tf\s*\(\s*([^)]*)\s*\)/);
    if (paramMatch) {
      const params = paramMatch[1];
      const paramList = this.parseParameterList(params);
      
      if (paramList.length < 3) {
        this.addError(lineNum, 1, 
          'request.security_lower_tf requires at least 3 parameters (symbol, timeframe, expression)', 
          'PSV6-REQUEST-SECURITY-LOWER-TF-PARAMS');
      }
    }
  }

  private validateRequestCurrencyRateCall(line: string, lineNum: number): void {
    const paramMatch = line.match(/request\.currency_rate\s*\(\s*([^)]*)\s*\)/);
    if (!paramMatch) return;
    const params = paramMatch[1];
    const paramList = this.parseParameterList(params);

    if (paramList.length < 2) {
      this.addError(lineNum, 1,
        'request.currency_rate requires at least 2 parameters (from, to)',
        'PSV6-REQUEST-CURRENCY-RATE-PARAMS');
      return;
    }

    const fromArg = paramList[0]?.trim();
    const toArg = paramList[1]?.trim();

    if (this.isStringLiteral(fromArg || '')) {
      const currency = (fromArg as string).replace(/['"]/g, '');
      if (!/^[A-Za-z]{3}$/.test(currency)) {
        this.addWarning(lineNum, 1,
          `Unexpected currency code "${currency}". Use ISO 4217 codes (e.g., "USD").`,
          'PSV6-REQUEST-CURRENCY-CODE');
      }
    }

    if (this.isStringLiteral(toArg || '')) {
      const currency = (toArg as string).replace(/['"]/g, '');
      if (!/^[A-Za-z]{3}$/.test(currency)) {
        this.addWarning(lineNum, 1,
          `Unexpected currency code "${currency}". Use ISO 4217 codes (e.g., "USD").`,
          'PSV6-REQUEST-CURRENCY-CODE');
      }
    }

    if (paramList.length >= 3) {
      const ignoreParam = (paramList[2] || '').trim();
      if (ignoreParam && this.isStringLiteral(ignoreParam)) {
        const literal = ignoreParam.replace(/['"]/g, '').toLowerCase();
        if (literal !== 'true' && literal !== 'false') {
          this.addWarning(lineNum, 1,
            `ignore_invalid_currency should be boolean. Received "${literal}"`,
            'PSV6-REQUEST-CURRENCY-IGNORE');
        }
      }
    }
  }

  private validateRequestSeedCall(line: string, lineNum: number): void {
    const paramMatch = line.match(/request\.seed\s*\(\s*([^)]*)\s*\)/);
    if (!paramMatch) return;
    const params = paramMatch[1];
    const paramList = this.parseParameterList(params);

    if (paramList.length < 3) {
      this.addError(lineNum, 1,
        'request.seed requires at least 3 parameters (source, symbol, expression)',
        'PSV6-REQUEST-SEED-PARAMS');
      return;
    }

    const sourceArg = paramList[0]?.trim() ?? '';
    const symbolArg = paramList[1]?.trim() ?? '';
    const expressionArg = paramList[2]?.trim() ?? '';

    if (!this.isStringLiteral(sourceArg)) {
      this.addWarning(lineNum, 1,
        'Seed source should be a string literal referencing the repository name.',
        'PSV6-REQUEST-SEED-SOURCE');
    }

    if (!this.isStringLiteral(symbolArg)) {
      this.addWarning(lineNum, 1,
        'Seed file name should be a string literal without the .csv extension.',
        'PSV6-REQUEST-SEED-SYMBOL');
    } else if (/\.csv['"]?$/.test(symbolArg)) {
      this.addWarning(lineNum, 1,
        'Seed symbol should omit the .csv suffix; provide the base file name only.',
        'PSV6-REQUEST-SEED-EXT');
    }

    if (!expressionArg || expressionArg === 'na') {
      this.addError(lineNum, 1,
        'Seed requests require an expression or tuple to evaluate.',
        'PSV6-REQUEST-SEED-EXPRESSION');
    }

    if (paramList.length >= 5) {
      const calcBars = (paramList[4] || '').trim();
      if (this.isStringLiteral(calcBars)) {
        this.addWarning(lineNum, 1,
          'calc_bars_count should be an integer, not a string literal.',
          'PSV6-REQUEST-SEED-CALC-BARS');
      } else if (calcBars && !this.isIntegerLiteral(calcBars)) {
        this.addInfo(lineNum, 1,
          'Dynamic calc_bars_count detected. Ensure the value stays within plan limits.',
          'PSV6-REQUEST-SEED-CALC-BARS-DYNAMIC');
      }
    }
  }

  private validateRequestQuandlCall(line: string, lineNum: number): void {
    // Basic parameter validation for request.quandl
    const paramMatch = line.match(/request\.quandl\s*\(\s*([^)]*)\s*\)/);
    if (paramMatch) {
      const params = paramMatch[1];
      const paramList = this.parseParameterList(params);
      
      if (paramList.length < 2) {
        this.addError(lineNum, 1, 
          'request.quandl requires at least 2 parameters (database, code)', 
          'PSV6-REQUEST-QUANDL-PARAMS');
      }
    }
  }

  // (earlier simplified request.* validators removed; advanced variants follow below)

  private validateRequestDividendsCall(line: string, lineNum: number): void {
    const m = line.match(/request\.dividends\s*\(\s*([^)]*)\s*\)/);
    if (!m) return;
    const parts = this.parseParameterList(m[1]);
    if (parts.length < 2) {
      this.addError(lineNum, 1, 'request.dividends requires at least 2 parameters (ticker, field)', 'PSV6-REQUEST-DIVIDENDS-PARAMS');
      return;
    }
    const field = parts[1]?.trim();
    if (field && this.isStringLiteral(field)) {
      const value = field.replace(/['"]/g, '');
      const valid = ['dividends.gross','dividends.net'];
      if (!valid.includes(value)) {
        this.addWarning(lineNum, 1, `Unknown dividend field: ${value}. Valid fields: ${valid.join(', ')}`, 'PSV6-REQUEST-DIVIDENDS-FIELD');
      }
    }
    if (parts.length >= 3) this.validateGapsParameter(parts[2], lineNum, 'dividends');
    this.validateGapsNamedParam(parts, lineNum, 'dividends');
  }

  private validateRequestSplitsCall(line: string, lineNum: number): void {
    const m = line.match(/request\.splits\s*\(\s*([^)]*)\s*\)/);
    if (!m) return;
    const parts = this.parseParameterList(m[1]);
    if (parts.length < 2) {
      this.addError(lineNum, 1, 'request.splits requires at least 2 parameters (ticker, field)', 'PSV6-REQUEST-SPLITS-PARAMS');
      return;
    }
    const field = parts[1]?.trim();
    if (field && this.isStringLiteral(field)) {
      const value = field.replace(/['"]/g, '');
      const valid = ['splits.denominator','splits.numerator'];
      if (!valid.includes(value)) {
        this.addWarning(lineNum, 1, `Unknown split field: ${value}. Valid fields: ${valid.join(', ')}`, 'PSV6-REQUEST-SPLITS-FIELD');
      }
    }
    if (parts.length >= 3) this.validateGapsParameter(parts[2], lineNum, 'splits');
    this.validateGapsNamedParam(parts, lineNum, 'splits');
  }

  private validateRequestEarningsCall(line: string, lineNum: number): void {
    const m = line.match(/request\.earnings\s*\(\s*([^)]*)\s*\)/);
    if (!m) return;
    const parts = this.parseParameterList(m[1]);
    if (parts.length < 2) {
      this.addError(lineNum, 1, 'request.earnings requires at least 2 parameters (ticker, field)', 'PSV6-REQUEST-EARNINGS-PARAMS');
      return;
    }
    const field = parts[1]?.trim();
    if (field) {
      const valid = ['earnings.actual', 'earnings.estimate', 'earnings.standardized'];
      let fieldName: string | null = null;

      if (this.isStringLiteral(field)) {
        fieldName = field.replace(/['"]/g, '');
      } else {
        const identMatch = field.match(/^(earnings\.[A-Za-z_][A-Za-z0-9_]*)$/);
        if (identMatch) {
          fieldName = identMatch[1];
        }
      }

      if (fieldName && !valid.includes(fieldName)) {
        this.addWarning(
          lineNum,
          1,
          `Unknown earnings field: ${fieldName}. Valid fields: ${valid.join(', ')}`,
          'PSV6-REQUEST-EARNINGS-FIELD'
        );
      }
    }
    if (parts.length >= 3) this.validateGapsParameter(parts[2], lineNum, 'earnings');
    this.validateGapsNamedParam(parts, lineNum, 'earnings');
  }

  private validateRequestEconomicCall(line: string, lineNum: number): void {
    const paramMatch = line.match(/request\.economic\s*\(\s*([^)]*)\s*\)/);
    if (paramMatch) {
      const params = paramMatch[1];
      const paramList = this.parseParameterList(params);
      
      if (paramList.length < 2) {
        this.addError(lineNum, 1, 
          'request.economic requires at least 2 parameters (country_code, field)', 
          'PSV6-REQUEST-ECONOMIC-PARAMS');
        return;
      }

      // Validate country code parameter
      const countryParam = paramList[0]?.trim();
      if (countryParam && this.isStringLiteral(countryParam)) {
        const countryCode = countryParam.replace(/['"]/g, '');
        const validCountryCodes = [
          'US', 'EU', 'GB', 'JP', 'CN', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'BR', 'IN'
        ];
        
        if (!validCountryCodes.includes(countryCode.toUpperCase())) {
          this.addWarning(lineNum, 1, 
            `Unknown country code: ${countryCode}. Common codes: ${validCountryCodes.join(', ')}`, 
            'PSV6-REQUEST-ECONOMIC-COUNTRY');
        }
      }

      // Validate field parameter
      const fieldParam = paramList[1]?.trim();
      if (fieldParam) {
        const validEconomicFields = [
          'gdp', 'inflation', 'unemployment', 'interest_rate', 'consumer_price_index',
          'producer_price_index', 'retail_sales', 'industrial_production',
          'housing_starts', 'trade_balance', 'government_debt'
        ];
        
        if (this.isStringLiteral(fieldParam)) {
          const fieldValue = fieldParam.replace(/['"]/g, '').toLowerCase();
          if (!validEconomicFields.includes(fieldValue)) {
            this.addWarning(lineNum, 1, 
              `Unknown economic field: ${fieldValue}. Valid fields: ${validEconomicFields.join(', ')}`, 
              'PSV6-REQUEST-ECONOMIC-FIELD');
          }
        }
      }

      // Validate gaps parameter if present
      if (paramList.length >= 3) {
        this.validateGapsParameter(paramList[2], lineNum, 'economic');
      }
    }
  }

  private validateRequestFinancialCall(line: string, lineNum: number): void {
    const m = line.match(/request\.financial\s*\(\s*([^)]*)\s*\)/);
    if (!m) return;
    const parts = this.parseParameterList(m[1]);
    if (parts.length < 3) {
      if (parts.length >= 2 && !this.isStringLiteral((parts[1] || '').trim())) {
        this.addWarning(lineNum, 1, 'Second parameter should be a financial field string (e.g., "TOTAL_REVENUE")', 'PSV6-REQUEST-FINANCIAL-FIELD');
      }
      this.addError(lineNum, 1, 'request.financial requires at least 3 parameters (symbol, financial_id, period)', 'PSV6-REQUEST-FINANCIAL-PARAMS');
      return;
    }
    if (!this.isStringLiteral(parts[0])) {
      this.addWarning(lineNum, 1, 'First parameter should be a symbol string literal', 'PSV6-REQUEST-SYMBOL-FORMAT');
    }
    const financialIdParam = parts[1]?.trim();
    if (!this.isStringLiteral(financialIdParam || '')) {
      this.addWarning(lineNum, 1, 'Second parameter should be a financial field string (e.g., "TOTAL_REVENUE")', 'PSV6-REQUEST-FINANCIAL-FIELD');
    } else {
      const id = (financialIdParam as string).replace(/['"]/g, '').toUpperCase();
      const validIds = ['TOTAL_REVENUE','NET_INCOME','TOTAL_ASSETS','TOTAL_DEBT','SHAREHOLDERS_EQUITY','OPERATING_CASH_FLOW','FREE_CASH_FLOW','CURRENT_ASSETS','CURRENT_LIABILITIES','WORKING_CAPITAL','EBITDA','GROSS_PROFIT','OPERATING_INCOME','BOOK_VALUE'];
      if (!validIds.includes(id)) {
        this.addWarning(lineNum, 1, `Unknown financial ID: ${id}. Valid IDs include: ${validIds.slice(0,5).join(', ')}, etc.`, 'PSV6-REQUEST-FINANCIAL-ID');
      }
    }
    const periodParam = parts[2]?.trim();
    if (this.isStringLiteral(periodParam || '')) {
      const p = (periodParam as string).replace(/['"]/g, '').toUpperCase();
      const validPeriods = ['FY','FQ','TTM','FH'];
      if (!validPeriods.includes(p)) {
        this.addWarning(lineNum, 1, `Unknown financial period: ${p}. Valid periods: ${validPeriods.join(', ')}`, 'PSV6-REQUEST-FINANCIAL-PERIOD');
      }
    }
    if (parts.length >= 4) this.validateGapsParameter(parts[3], lineNum, 'financial');
  }

  private validateGapsNamedParam(parts: string[], lineNum: number, functionType: string): void {
    for (const p of parts) {
      const [lhs, rhs] = p.split('=');
      if (!rhs) continue;
      const key = lhs.trim();
      const value = rhs.trim();

      if (key === 'gaps') {
        this.validateGapsParameter(value, lineNum, functionType);
      } else if (key === 'lookahead') {
        this.validateLookaheadParameter(value, lineNum, functionType);
      }
    }
  }

  private validateGapsParameter(gapsParam: string, lineNum: number, functionType: string): void {
    // Validate gaps parameter (common to many request functions)
    const trimmed = gapsParam?.trim();
    if (!trimmed) return;

    // Check for valid gaps values
    const validGapsValues = ['barmerge.gaps_off', 'barmerge.gaps_on', 'true', 'false'];
    
    if (this.isStringLiteral(trimmed)) {
      // String literal gaps parameter
      const gapsValue = trimmed.replace(/['"]/g, '');
      if (!validGapsValues.includes(gapsValue)) {
        this.addWarning(lineNum, 1, 
          `Invalid gaps parameter for request.${functionType}: ${gapsValue}. Valid values: ${validGapsValues.join(', ')}`, 
          'PSV6-REQUEST-GAPS-INVALID');
      }
    } else if (this.isBooleanLiteral(trimmed)) {
      // Boolean gaps parameter (valid)
      return;
    } else if (trimmed.startsWith('barmerge.gaps_')) {
      // barmerge constant (valid)
      if (!validGapsValues.includes(trimmed)) {
        this.addWarning(lineNum, 1, 
          `Invalid barmerge gaps constant: ${trimmed}. Use barmerge.gaps_on or barmerge.gaps_off`, 
          'PSV6-REQUEST-GAPS-BARMERGE');
      }
    } else {
      // Dynamic gaps parameter
      this.addInfo(lineNum, 1, 
        `Dynamic gaps parameter detected in request.${functionType}. Ensure it resolves to a valid gaps value.`, 
        'PSV6-REQUEST-GAPS-DYNAMIC');
    }
  }

  private validateLookaheadParameter(param: string, lineNum: number, functionType: string): void {
    const trimmed = param?.trim();
    if (!trimmed) return;

    const validLookaheadValues = ['barmerge.lookahead_on', 'barmerge.lookahead_off', 'true', 'false'];

    if (this.isStringLiteral(trimmed)) {
      const value = trimmed.replace(/['"]/g, '').toLowerCase();
      if (!validLookaheadValues.includes(value)) {
        this.addWarning(lineNum, 1,
          `Invalid lookahead parameter for request.${functionType}: ${value}. Valid values: ${validLookaheadValues.join(', ')}`,
          'PSV6-REQUEST-LOOKAHEAD-INVALID');
      }
    } else if (trimmed.startsWith('barmerge.lookahead_')) {
      if (!validLookaheadValues.includes(trimmed)) {
        this.addWarning(lineNum, 1,
          `Unknown lookahead constant: ${trimmed}. Use barmerge.lookahead_on or barmerge.lookahead_off.`,
          'PSV6-REQUEST-LOOKAHEAD-INVALID');
      }
    } else if (!this.isBooleanLiteral(trimmed)) {
      this.addInfo(lineNum, 1,
        `Dynamic lookahead parameter detected in request.${functionType}. Ensure it evaluates to barmerge.lookahead_* or a boolean.`,
        'PSV6-REQUEST-LOOKAHEAD-DYNAMIC');
    }
  }

  private validateSecurityParameters(line: string, lineNum: number): void {
    // Additional security parameter validation
    const symbolMatch = line.match(/request\.security\s*\(\s*["']([^"']*)["']/);
    if (symbolMatch) {
      const symbol = symbolMatch[1];
      this.validateTickerSymbolFormat(symbol, lineNum);
    }
  }

  private validateTickerSymbolFormat(symbol: string, lineNum: number): void {
    // Comprehensive ticker/symbol format validation
    if (!symbol || symbol.trim().length === 0) {
      this.addError(lineNum, 1, 'Empty symbol is not allowed', 'PSV6-REQUEST-SYMBOL-EMPTY');
      return;
    }

    const trimmedSymbol = symbol.trim();

    // Check for spaces in symbol
    if (trimmedSymbol.includes(' ')) {
      this.addWarning(lineNum, 1, 
        `Symbol "${trimmedSymbol}" contains spaces. Use underscores or proper format.`, 
        'PSV6-REQUEST-SYMBOL-FORMAT');
    }

    // Check for valid symbol formats
    const validFormats = [
      /^[A-Z]{1,5}$/,                           // Simple ticker (AAPL, MSFT)
      /^[A-Z]{1,5}:[A-Z]{1,5}$/,                // Exchange:Symbol (NASDAQ:AAPL)
      /^[A-Z]{1,10}\.[A-Z]{1,5}$/,              // Exchange.Symbol (BINANCE.BTCUSDT)
      /^[A-Z0-9]{1,10}_[A-Z0-9]{1,10}$/,        // Crypto pairs (BTC_USD)
      /^[A-Z]{1,5}\d{6}[CP]\d+$/,               // Options format (AAPL230120C150)
      /^[A-Z]{1,5}\d{4}[A-Z]$/,                 // Futures format (ESH4)
    ];

    const isValidFormat = validFormats.some(pattern => pattern.test(trimmedSymbol));
    
    if (!isValidFormat) {
      // Check for common issues
      if (trimmedSymbol.length > 20) {
        this.addWarning(lineNum, 1, 
          `Symbol "${trimmedSymbol}" is unusually long. Verify format.`, 
          'PSV6-REQUEST-SYMBOL-LENGTH');
      } else if (!/^[A-Z0-9:._-]+$/i.test(trimmedSymbol)) {
        this.addWarning(lineNum, 1, 
          `Symbol "${trimmedSymbol}" contains invalid characters. Use alphanumeric, colon, dot, underscore, or dash only.`, 
          'PSV6-REQUEST-SYMBOL-CHARS');
      } else {
        this.addInfo(lineNum, 1, 
          `Symbol "${trimmedSymbol}" format not recognized. Verify it's a valid ticker symbol.`, 
          'PSV6-REQUEST-SYMBOL-UNKNOWN');
      }
    }

    // Check for exchange prefixes
    if (trimmedSymbol.includes(':')) {
      const [exchange, ticker] = trimmedSymbol.split(':');
      const validExchanges = [
        'NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSE', 'HKEX', 'ASX', 'TSX',
        'BINANCE', 'COINBASE', 'KRAKEN', 'BITFINEX', 'FTX'
      ];
      
      if (!validExchanges.includes(exchange.toUpperCase())) {
        this.addInfo(lineNum, 1, 
          `Exchange "${exchange}" not in common list. Verify it's supported.`, 
          'PSV6-REQUEST-EXCHANGE-UNKNOWN');
      }
    }
  }

  private validateQuandlParameters(line: string, lineNum: number): void {
    // Additional Quandl parameter validation
    const databaseMatch = line.match(/request\.quandl\s*\(\s*["']([^"']+)["']/);
    if (databaseMatch) {
      const database = databaseMatch[1];
      
      // Check for common Quandl database formats
      if (!database.includes('/')) {
        this.addWarning(lineNum, 1, 
          `Quandl database should be in format "DATABASE/CODE": ${database}`, 
          'PSV6-REQUEST-QUANDL-FORMAT');
      }
    }
  }

  private parseParameterList(params: string): string[] {
    // Simple parameter parsing - split by comma but respect quotes
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < params.length; i++) {
      const char = params[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (!inQuotes && char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }
    
    return result;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Dynamic context detection (loops, conditionals) for request.* calls
  // ────────────────────────────────────────────────────────────────────────────
  private validateDynamicContexts(): void {
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const line = this.context.cleanLines[i];
      const lineNum = i + 1;
      const start = /request\.(\w+)\s*\(/.exec(line);
      if (!start) continue;
      const openIdx = start.index + start[0].length - 1;
      const argsStr = this.extractBalancedArgs(line, openIdx) ?? '';
      const args = this.parseParameterList(argsStr);
      const isDynamicExpr = this.isDynamicExpressionArg(args);
      const inLoop = this.isInLoop(i);
      const inConditional = this.isInConditional(i);

      if (isDynamicExpr && inLoop) {
        this.addWarning(lineNum, 1, 'Dynamic request inside loop may cause heavy performance usage', 'PSV6-REQUEST-DYNAMIC-LOOP');
        this.addInfo(lineNum, 1, 'Dynamic requests in loops are valid in Pine v6', 'PSV6-REQUEST-DYNAMIC-V6');
      }
      if (isDynamicExpr && inConditional) {
        this.addWarning(lineNum, 1, 'Dynamic request inside conditional block may cause inconsistent performance', 'PSV6-REQUEST-DYNAMIC-CONDITIONAL');
        this.addInfo(lineNum, 1, 'Dynamic requests in conditionals are valid in Pine v6', 'PSV6-REQUEST-DYNAMIC-V6');
      }
    }
  }

  private extractBalancedArgs(line: string, openParenIndex: number): string | null {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    for (let i = openParenIndex; i < line.length; i++) {
      const ch = line[i];
      if (!inString && (ch === '"' || ch === "'")) {
        inString = true; stringChar = ch;
      } else if (inString && ch === stringChar) {
        inString = false; stringChar = '';
      } else if (!inString) {
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) {
            return line.substring(openParenIndex + 1, i);
          }
        }
      }
    }
    return null;
  }

  private isDynamicExpressionArg(args: string[]): boolean {
    if (args.length === 0) return false;
    const expr = (args.length >= 3 ? args[2] : args[1]) || '';
    const s = (expr || '').trim();
    // Heuristics: indexing, ta.* calls, arithmetic, function calls denote dynamic evaluation
    if (/\[\s*[^\]]+\s*\]/.test(s)) return true; // e.g., close[i]
    if (/\bta\./.test(s)) return true;
    if (/\w+\s*\(/.test(s)) return true; // any function call
    return false;
  }

  private isInLoop(lineIndex: number): boolean {
    // Look back a few lines for a for/while with greater indentation
    for (let i = lineIndex - 1; i >= 0 && i >= lineIndex - 6; i--) {
      const ln = this.context.cleanLines[i] || '';
      if (/^\s*(for|while)\b/.test(ln)) return true;
    }
    return false;
  }

  private isInConditional(lineIndex: number): boolean {
    for (let i = lineIndex - 1; i >= 0 && i >= lineIndex - 6; i--) {
      const ln = this.context.cleanLines[i] || '';
      if (/^\s*if\b/.test(ln)) return true;
    }
    return false;
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
