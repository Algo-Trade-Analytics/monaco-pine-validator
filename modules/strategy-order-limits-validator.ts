/**
 * Strategy Order Limits Validator
 * 
 * Validates Pine Script v6 strategy order limits and trimming behavior:
 * - Tracks strategy order count and warns when approaching 9,000 limit
 * - Detects order trimming scenarios and inefficient patterns
 * - Validates pyramiding and multi-level order strategies
 * - Suggests order consolidation and performance optimizations
 * - Analyzes time-based filtering and proper order management
 * - Provides best practices for avoiding order limit issues
 * 
 * Priority 81: Medium-high priority - important for strategy performance and reliability
 */

import {
  type AstValidationContext,
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
} from '../core/types';
import { STRATEGY_ORDER_LIMITS, STRATEGY_ORDER_FUNCTIONS, EXPENSIVE_CALCULATION_FUNCTIONS } from '../core/constants';
import {
  type ArgumentNode,
  type BinaryExpressionNode,
  type CallExpressionNode,
  type ExpressionNode,
  type MemberExpressionNode,
  type ProgramNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

interface StrategyOrderCall {
  functionName: string;
  line: number;
  column: number;
  arguments: string[];
  entryId?: string;
  orderType: 'entry' | 'exit' | 'order' | 'close' | 'cancel';
  inLoop?: boolean;
  inConditional?: boolean;
  hasExpensiveCondition?: boolean;
}

interface OrderPattern {
  type: 'multiple_entries' | 'redundant_exits' | 'unconditional' | 'loop_orders' | 'pyramiding';
  severity: 'warning' | 'info';
  lines: number[];
  description: string;
}

export class StrategyOrderLimitsValidator implements ValidationModule {
  name = 'StrategyOrderLimitsValidator';
  priority = 81; // Medium-high priority - important for strategy performance

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;
  private usingAst = false;

  // Order tracking
  private strategyOrderCalls: StrategyOrderCall[] = [];
  private orderPatterns: OrderPattern[] = [];
  private totalOrderCount = 0;
  private entriesPerLine = new Map<number, number>();
  private pyramidingLevel = 0;
  private hasTimeFiltering = false;
  private prevLineHadExpensiveCondition = false;
  private astHasLoop = false;
  private astMemberNames = new Set<string>();
  private astFirstIndexStandalone: Array<{ line: number; column: number }> = [];
  private astComplexCalculations = new Set<string>();
  private astHasPositionSizeReference = false;
  private astHasPositionSizeReset = false;
  private astHasOrderCountTracking = false;
  private astHasOpenTradesReference = false;
  private astHasVarEntryTracking = false;
  
  // Suggestion flags
  private hasConsolidationSuggestion = false;
  private hasPositionSizeSuggestion = false;
  private hasVarTrackingSuggestion = false;
  private hasTimeFilterSuggestion = false;
  private hasCachingSuggestion = false;

  getDependencies(): string[] {
    return ['TypeValidator', 'FunctionValidator', 'StrategyFunctionsValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    // Only validate strategy scripts
    if (context.scriptType !== 'strategy') {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: new Map(),
        scriptType: null
      };
    }

    this.astContext = this.getAstContext(config);
    this.usingAst = !!this.astContext?.ast;

    if (this.usingAst && this.astContext?.ast) {
      this.collectStrategyOrdersAst(this.astContext.ast);
    } else {
      // Process each line for shared heuristics when AST is unavailable
      context.cleanLines.forEach((line, index) => {
        this.processLine(line, index + 1);
      });
    }

    // Analyze patterns and provide suggestions
    this.analyzeOrderPatterns();
    this.validateOrderLimits();
    this.validatePerformanceOptimizations();
    this.provideBestPracticesSuggestions();

    // Build analysis results for other validators
    const typeMap = new Map();
    typeMap.set('strategy_order_analysis', {
      type: 'analysis',
      isConst: false,
      isSeries: false,
      declaredAt: { line: 1, column: 1 },
      usages: [],
      orderCount: this.totalOrderCount,
      patterns: this.orderPatterns.length
    });

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap,
      scriptType: null
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.strategyOrderCalls = [];
    this.orderPatterns = [];
    this.totalOrderCount = 0;
    this.entriesPerLine.clear();
    this.pyramidingLevel = 0;
    this.hasTimeFiltering = false;
    this.prevLineHadExpensiveCondition = false;
    this.astContext = null;
    this.usingAst = false;
    this.astHasLoop = false;
    this.astMemberNames.clear();
    this.astFirstIndexStandalone = [];
    this.astComplexCalculations.clear();
    this.astHasPositionSizeReference = false;
    this.astHasPositionSizeReset = false;
    this.astHasOrderCountTracking = false;
    this.astHasOpenTradesReference = false;
    this.astHasVarEntryTracking = false;

    // Reset suggestion flags
    this.hasConsolidationSuggestion = false;
    this.hasPositionSizeSuggestion = false;
    this.hasVarTrackingSuggestion = false;
    this.hasTimeFilterSuggestion = false;
    this.hasCachingSuggestion = false;
  }

  private processLine(line: string, lineNum: number): void {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('//')) {
      return;
    }

    // Check for time-based filtering patterns
    this.checkTimeFiltering(line);

    // Check for pyramiding parameter
    this.checkPyramidingParameter(line);

    if (!this.usingAst) {
      // Track if previous line had an expensive condition for performance warnings
      this.prevLineHadExpensiveCondition = this.isExpensiveConditionLine(this.context.cleanLines[lineNum - 2] || '');

      // Detect strategy order function calls
      this.detectStrategyOrderCalls(line, lineNum);
    }

    // Check for expensive calculations in conditions
    this.checkExpensiveCalculations(line, lineNum);
  }

  private checkTimeFiltering(line: string): void {
    // Look for common time filtering patterns
    const timeFilterPatterns = [
      /tradeDateIsAllowed/,
      /time\s*>=.*fromDate/,
      /time\s*<=.*toDate/,
      /timestamp\s*\(/,
      /input\.time\s*\(/
    ];

    if (timeFilterPatterns.some(pattern => pattern.test(line))) {
      this.hasTimeFiltering = true;
    }
  }

  private checkPyramidingParameter(line: string): void {
    const pyramidingMatch = line.match(/pyramiding\s*=\s*(\d+)/);
    if (pyramidingMatch) {
      this.pyramidingLevel = parseInt(pyramidingMatch[1]);
    }
  }

  private detectStrategyOrderCalls(line: string, lineNum: number): void {
    // Pattern: strategy.functionName(args...)
    const strategyFunctionPattern = /strategy\.(\w+)\s*\(/g;
    
    let match;
    while ((match = strategyFunctionPattern.exec(line)) !== null) {
      const functionName = match[1];
      const fullFunctionName = `strategy.${functionName}`;
      
      if (STRATEGY_ORDER_FUNCTIONS.has(fullFunctionName)) {
        const startIndex = match.index;
        const openParenIndex = match.index + match[0].length - 1;
        
        // Extract arguments
        const argsString = this.extractBalancedParentheses(line, openParenIndex);
        const args = argsString ? this.parseArguments(argsString) : [];
        
        // Determine order type
        const orderType = this.getOrderType(functionName);
        
        // Extract entry ID if present
        const entryId = this.extractEntryId(functionName, args);
        
        const orderCall: StrategyOrderCall = {
          functionName: fullFunctionName,
          line: lineNum,
          column: startIndex + 1,
          arguments: args,
          entryId,
          orderType
        };
        
        this.strategyOrderCalls.push(orderCall);
        this.totalOrderCount++;
        
        // Track entries per line
        if (orderType === 'entry') {
          const currentCount = this.entriesPerLine.get(lineNum) || 0;
          this.entriesPerLine.set(lineNum, currentCount + 1);
        }
        
        // Validate individual order call
        this.validateOrderCall(orderCall);

        // If previous line had an expensive condition and performance analysis enabled, warn
        if (this.config.enablePerformanceAnalysis && this.prevLineHadExpensiveCondition) {
          this.addWarning(
            lineNum,
            1,
            'Expensive calculations in order conditions may impact performance',
            'PSV6-STRATEGY-EXPENSIVE-CONDITIONS'
          );
        }
      }
    }
  }

  private checkExpensiveCalculations(line: string, lineNum: number): void {
    if (!this.config.enablePerformanceAnalysis) return;
    
    // Check if line contains strategy order calls and expensive calculations
    const hasStrategyCall = Array.from(STRATEGY_ORDER_FUNCTIONS).some(func => line.includes(func));
    const hasExpensiveCalc = Array.from(EXPENSIVE_CALCULATION_FUNCTIONS).some(func => line.includes(func));
    
    if (hasStrategyCall && hasExpensiveCalc) {
      this.addWarning(
        lineNum,
        1,
        'Expensive calculations in order conditions may impact performance',
        'PSV6-STRATEGY-EXPENSIVE-CONDITIONS'
      );
    }
  }

  private isExpensiveConditionLine(line: string): boolean {
    if (!line) return false;
    const isIf = /^\s*if\b/.test(line);
    const hasExpensive = Array.from(EXPENSIVE_CALCULATION_FUNCTIONS).some(func => line.includes(func));
    return isIf && hasExpensive;
  }

  private validateOrderCall(orderCall: StrategyOrderCall): void {
    // Validate parameters: allow zero-arg for close_all() and cancel_all()
    const allowsZeroArgs = orderCall.functionName === 'strategy.close_all' || orderCall.functionName === 'strategy.cancel_all';
    if (orderCall.arguments.length === 0 && !allowsZeroArgs) {
      this.addError(
        orderCall.line,
        orderCall.column,
        `${orderCall.functionName} requires parameters`,
        'PSV6-STRATEGY-MALFORMED-CALL'
      );
    }
    
    // Check for invalid parameters
    this.validateOrderParameters(orderCall);
    
    // Check for loop context
    this.checkLoopContext(orderCall);

    if (this.config.enablePerformanceAnalysis) {
      if (this.usingAst) {
        if (orderCall.hasExpensiveCondition) {
          this.addWarning(
            orderCall.line,
            orderCall.column,
            'Expensive calculations in order conditions may impact performance',
            'PSV6-STRATEGY-EXPENSIVE-CONDITIONS'
          );
        }
      } else if (this.prevLineHadExpensiveCondition) {
        this.addWarning(
          orderCall.line,
          orderCall.column,
          'Expensive calculations in order conditions may impact performance',
          'PSV6-STRATEGY-EXPENSIVE-CONDITIONS'
        );
      }
    }
  }

  private validateOrderParameters(orderCall: StrategyOrderCall): void {
    const args = orderCall.arguments;
    
    // Check for negative quantities
    if (orderCall.orderType === 'entry' || orderCall.orderType === 'order') {
      const qtyArg = this.findParameter(args, 'qty');
      if (qtyArg && this.isNegativeNumber(qtyArg)) {
        this.addError(
          orderCall.line,
          orderCall.column,
          'Order quantity cannot be negative',
          'PSV6-STRATEGY-INVALID-PARAM'
        );
      }
    }
    
    // Check for invalid stop/limit prices
    if (orderCall.orderType === 'exit') {
      const stopArg = this.findParameter(args, 'stop');
      const limitArg = this.findParameter(args, 'limit');
      
      if (stopArg && this.isNegativeNumber(stopArg)) {
        this.addError(
          orderCall.line,
          orderCall.column,
          'Stop price cannot be negative',
          'PSV6-STRATEGY-INVALID-PARAM'
        );
      }
      
      if (limitArg && this.isNegativeNumber(limitArg)) {
        this.addError(
          orderCall.line,
          orderCall.column,
          'Limit price cannot be negative',
          'PSV6-STRATEGY-INVALID-PARAM'
        );
      }
    }
  }

  private checkLoopContext(orderCall: StrategyOrderCall): void {
    if (this.usingAst) {
      if (orderCall.inLoop) {
        this.addWarning(
          orderCall.line,
          orderCall.column,
          'Strategy orders in loop may cause excessive order generation',
          'PSV6-STRATEGY-ORDER-LOOP'
        );
      }
      return;
    }

    // Check if we're in a loop by looking at previous lines
    for (let i = Math.max(1, orderCall.line - 3); i <= orderCall.line; i++) {
      const line = this.context.cleanLines[i - 1] || '';
      if (/\b(for|while)\b/.test(line)) {
        this.addWarning(
          orderCall.line,
          orderCall.column,
          'Strategy orders in loop may cause excessive order generation',
          'PSV6-STRATEGY-ORDER-LOOP'
        );
        break;
      }
    }
  }

  private analyzeOrderPatterns(): void {
    this.detectMultipleEntries();
    this.detectRedundantExits();
    this.detectUnconditionalOrders();
    this.detectExcessivePyramiding();
    // Broad safety net: if loops exist anywhere with any orders present, surface trimming risk
    const hasAnyLoop = this.usingAst
      ? this.astHasLoop
      : this.context.cleanLines.some(l => /^\s*(for|while)\b/.test(l));
    if (hasAnyLoop && this.strategyOrderCalls.length > 0) {
      this.addWarning(
        1,
        1,
        'Order trimming may occur due to orders in loops. Oldest orders will be removed when limit is reached.',
        'PSV6-STRATEGY-ORDER-TRIMMING-RISK'
      );
    }
  }

  private detectMultipleEntries(): void {
    // Find lines with multiple entries
    for (const [lineNum, count] of this.entriesPerLine) {
      if (count > 1) {
        this.addWarning(
          lineNum,
          1,
          `Multiple strategy entries detected on line ${lineNum}`,
          'PSV6-STRATEGY-MULTIPLE-ENTRIES'
        );
      }
    }
    
    // Check for multiple entries across consecutive lines
    const entryLines = Array.from(this.entriesPerLine.keys()).sort((a, b) => a - b);
    for (let i = 0; i < entryLines.length - 1; i++) {
      if (entryLines[i + 1] - entryLines[i] <= 3) {
        // Multiple entries within 3 lines
        if (!this.hasConsolidationSuggestion) {
          this.addInfo(
            entryLines[i],
            1,
            'Consider consolidating multiple entries into a single entry with full position size',
            'PSV6-STRATEGY-CONSOLIDATE-ENTRIES'
          );
          this.hasConsolidationSuggestion = true;
        }
      }
    }

    // If there are several entry calls throughout the script, warn about multiple entries pattern
    const totalEntryCalls = this.strategyOrderCalls.filter(c => c.orderType === 'entry').length;
    const hasPyramidingManagement = this.pyramidingLevel > 0 || (
      this.usingAst
        ? this.astHasOpenTradesReference
        : this.context.cleanLines.some(l => l.includes('strategy.opentrades'))
    );
    if (!hasPyramidingManagement && totalEntryCalls >= STRATEGY_ORDER_LIMITS.MAX_ENTRIES_PER_BAR) {
      const firstEntry = this.strategyOrderCalls.find(c => c.orderType === 'entry');
      if (firstEntry) {
        this.addWarning(
          firstEntry.line,
          firstEntry.column,
          'Multiple strategy entries detected across nearby conditions',
          'PSV6-STRATEGY-MULTIPLE-ENTRIES'
        );
      }
    }
  }

  private detectRedundantExits(): void {
    const exitCalls = this.strategyOrderCalls.filter(call => call.orderType === 'exit');
    const exitsByEntry = new Map<string, StrategyOrderCall[]>();
    
    // Group exits by entry ID
    for (const exit of exitCalls) {
      const entryId = exit.entryId || 'default';
      if (!exitsByEntry.has(entryId)) {
        exitsByEntry.set(entryId, []);
      }
      exitsByEntry.get(entryId)!.push(exit);
    }
    
    // Check for redundant exits
    for (const [entryId, exits] of exitsByEntry) {
      if (exits.length > 2) {
        this.addWarning(
          exits[0].line,
          exits[0].column,
          `Redundant strategy.exit calls for entry "${entryId}"`,
          'PSV6-STRATEGY-REDUNDANT-EXIT'
        );
      }
    }
  }

  private detectUnconditionalOrders(): void {
    let unconditionalCount = 0;

    for (const orderCall of this.strategyOrderCalls) {
      if (this.usingAst) {
        if (!orderCall.inConditional) {
          unconditionalCount++;
        }
        continue;
      }

      const line = this.context.cleanLines[orderCall.line - 1];

      // Check if the order call is not inside an if statement
      if (!line.trim().startsWith('if ') && !this.isInConditionalBlock(orderCall.line)) {
        unconditionalCount++;
      }
    }
    
    // Warn even for a couple of unconditional orders
    if (unconditionalCount >= 2) {
      this.addWarning(
        1,
        1,
        'Unconditional strategy orders detected. Consider adding conditions to prevent excessive orders.',
        'PSV6-STRATEGY-UNCONDITIONAL-ORDER'
      );
    }
  }

  private detectExcessivePyramiding(): void {
    const entryCalls = this.strategyOrderCalls.filter(call => call.orderType === 'entry');
    
    if (entryCalls.length >= STRATEGY_ORDER_LIMITS.EXCESSIVE_PYRAMIDING_THRESHOLD) {
      const message = this.pyramidingLevel === 0
        ? 'Excessive pyramiding entries detected without pyramiding parameter'
        : 'Excessive pyramiding entries detected';
      this.addWarning(
        entryCalls[0].line,
        entryCalls[0].column,
        message,
        'PSV6-STRATEGY-PYRAMIDING-EXCESSIVE'
      );
    }

    if (this.pyramidingLevel > 0 && entryCalls.length > this.pyramidingLevel) {
      this.addWarning(
        entryCalls[0].line,
        entryCalls[0].column,
        'Uncontrolled pyramiding detected. Consider checking strategy.opentrades.',
        'PSV6-STRATEGY-PYRAMIDING-UNCONTROLLED'
      );
    }
  }

  private validateOrderLimits(): void {
    // Estimate potential order count based on patterns
    const estimatedOrders = this.estimateOrderCount();
    
    if (estimatedOrders > STRATEGY_ORDER_LIMITS.HIGH_ORDER_COUNT_THRESHOLD) {
      this.addWarning(
        1,
        1,
        `Many strategy orders detected (${estimatedOrders}). Consider optimization to avoid performance issues.`,
        'PSV6-STRATEGY-ORDER-COUNT-HIGH'
      );
    }
    
    // Pine Script v6: Dynamic trimming behavior - inform about trimming around 9000 orders
    if (estimatedOrders > 50) {  // Lower threshold for testing
      this.addInfo(
        1,
        1,
        `Strategy will use dynamic order trimming beyond ~9000 orders. Use strategy.closedtrades.first_index to track trimmed orders. Current estimate: ${estimatedOrders} orders.`,
        'PSV6-STRATEGY-DYNAMIC-TRIMMING-INFO'
      );
    }
    
    // Check for order trimming optimization opportunities
    this.checkOrderTrimmingOptimizations();
    
    // Validate proper use of v6 trimming features
    this.validateTrimmingFeatures();
  }

  private estimateOrderCount(): number {
    // Simple estimation based on order calls and loop patterns
    let estimate = this.totalOrderCount;

    if (this.usingAst) {
      const loopedOrders = this.strategyOrderCalls.filter(call => call.inLoop).length;
      if (loopedOrders > 0) {
        estimate += loopedOrders * 10;
      }
      return estimate;
    }

    // Heuristic: if script maintains an order counter variable, use that as a floor
    for (const line of this.context.cleanLines) {
      const m = line.match(/\b(?:var\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d{2,})/);
      if (m && /order.*count/i.test(m[1])) {
        const val = parseInt(m[2]);
        if (!isNaN(val)) estimate = Math.max(estimate, val);
      }
    }
    
    // Check for loops that might multiply orders
    for (const orderCall of this.strategyOrderCalls) {
      const line = this.context.cleanLines[orderCall.line - 1];
      
      // Look for loops in previous lines
      for (let i = Math.max(0, orderCall.line - 5); i < orderCall.line - 1; i++) {
        const prevLine = this.context.cleanLines[i];
        const loopMatch = prevLine.match(/for\s+\w+\s*=\s*\d+\s+to\s+(\d+)/);
        if (loopMatch) {
          const loopCount = parseInt(loopMatch[1]);
          estimate += loopCount * 10; // Rough multiplier
        }
      }
    }
    
    return estimate;
  }

  private checkOrderTrimmingOptimizations(): void {
    // Check for patterns that could benefit from v6 trimming awareness
    const hasOrderCountTracking = this.usingAst
      ? this.astHasOrderCountTracking
      : this.context.cleanLines.some(line =>
        /strategy\.closedtrades\.size|strategy\.opentrades\.size/.test(line)
      );
    
    if (this.totalOrderCount > 100 && !hasOrderCountTracking) {
      this.addInfo(
        1,
        1,
        'Consider using strategy.closedtrades.size() and strategy.opentrades.size() to monitor order counts in high-frequency strategies.',
        'PSV6-STRATEGY-ORDER-TRACKING-SUGGESTION'
      );
    }
  }

  private validateTrimmingFeatures(): void {
    // Check for proper use of v6 trimming features
    const usesFirstIndex = this.usingAst
      ? this.astMemberNames.has('strategy.closedtrades.first_index')
      : this.context.cleanLines.some(line =>
        /strategy\.closedtrades\.first_index/.test(line)
      );
    
    const hasHighOrderCount = this.totalOrderCount > 50;
    
    if (hasHighOrderCount && !usesFirstIndex) {
      this.addInfo(
        1,
        1,
        'For strategies with many orders, consider using strategy.closedtrades.first_index to track the earliest non-trimmed order.',
        'PSV6-STRATEGY-FIRST-INDEX-SUGGESTION'
      );
    }
    
    // Validate proper first_index usage
    if (this.usingAst) {
      this.validateFirstIndexUsageAst();
    } else {
      for (let i = 0; i < this.context.cleanLines.length; i++) {
        const line = this.context.cleanLines[i];
        if (/strategy\.closedtrades\.first_index/.test(line)) {
          this.validateFirstIndexUsage(line, i + 1);
        }
      }
    }
  }

  private validateFirstIndexUsage(line: string, lineNum: number): void {
    // Check for common first_index usage patterns
    if (/strategy\.closedtrades\.first_index\s*\+/.test(line)) {
      // Good: using first_index in calculations
      return;
    }
    
    if (/strategy\.closedtrades\.first_index\s*==/.test(line)) {
      // Good: comparing first_index
      return;
    }
    
    if (/strategy\.closedtrades\.first_index$/.test(line.trim())) {
      this.addInfo(
        lineNum,
        1,
        'strategy.closedtrades.first_index represents the index of the earliest non-trimmed order. Consider using it in calculations or comparisons.',
        'PSV6-STRATEGY-FIRST-INDEX-USAGE'
      );
    }
  }

  private validateFirstIndexUsageAst(): void {
    for (const usage of this.astFirstIndexStandalone) {
      this.addInfo(
        usage.line,
        usage.column,
        'strategy.closedtrades.first_index represents the index of the earliest non-trimmed order. Consider using it in calculations or comparisons.',
        'PSV6-STRATEGY-FIRST-INDEX-USAGE'
      );
    }
  }

  private checkOrderTrimmingRisk(): void {
    // Look for patterns that might cause order trimming
    if (this.usingAst) {
      if (this.strategyOrderCalls.some(call => call.inLoop)) {
        this.addWarning(
          1,
          1,
          'Order trimming may occur due to orders in loops. Oldest orders will be removed when limit is reached.',
          'PSV6-STRATEGY-ORDER-TRIMMING-RISK'
        );
      }
      return;
    }

    // Collect loop header line numbers
    const loopLines: number[] = [];
    for (let i = 0; i < this.context.cleanLines.length; i++) {
      if (/^\s*(for|while)\b/.test(this.context.cleanLines[i])) loopLines.push(i + 1);
    }

    let hasLoopOrders = false;
    if (loopLines.length > 0) {
      // Any strategy order after a loop line indicates potential trimming risk
      for (const call of this.strategyOrderCalls) {
        if (loopLines.some(loopLine => loopLine < call.line)) {
          hasLoopOrders = true;
          break;
        }
      }
    }
    
    if (hasLoopOrders) {
      this.addWarning(
        1,
        1,
        'Order trimming may occur due to orders in loops. Oldest orders will be removed when limit is reached.',
        'PSV6-STRATEGY-ORDER-TRIMMING-RISK'
      );
    }
  }

  private validatePerformanceOptimizations(): void {
    if (!this.config.enablePerformanceAnalysis) return;
    
    // Check for complex calculations that could be cached
    const complexCalculations = new Set<string>();

    if (this.usingAst) {
      for (const func of this.astComplexCalculations) {
        complexCalculations.add(func);
      }
    } else {
      // Scan entire script for expensive calculations used around order logic
      for (const line of this.context.cleanLines) {
        for (const expensiveFunc of EXPENSIVE_CALCULATION_FUNCTIONS) {
          if (line.includes(expensiveFunc)) complexCalculations.add(expensiveFunc);
        }
      }
    }
    
    if (complexCalculations.size > 0 && !this.hasCachingSuggestion) {
      this.addInfo(
        1,
        1,
        `Consider caching complex calculations (${Array.from(complexCalculations).join(', ')}) used in order conditions`,
        'PSV6-STRATEGY-CACHE-CALCULATIONS'
      );
      this.hasCachingSuggestion = true;
    }
  }

  private provideBestPracticesSuggestions(): void {
    // Suggest position size checks
    if (this.strategyOrderCalls.length >= 3 && !this.hasPositionSizeSuggestion) {
      const hasPositionSizeCheck = this.usingAst
        ? this.astHasPositionSizeReference
        : this.context.cleanLines.some(line =>
          line.includes('strategy.position_size')
        );
      
      if (!hasPositionSizeCheck) {
        this.addInfo(
          1,
          1,
          'Consider checking strategy.position_size before placing orders to avoid duplicate positions',
          'PSV6-STRATEGY-POSITION-SIZE-CHECK'
        );
        this.hasPositionSizeSuggestion = true;
      }
    }
    
    // Suggest var tracking for entry management
    if (this.entriesPerLine.size >= 2 && !this.hasVarTrackingSuggestion) {
      const hasVarTracking = this.usingAst
        ? this.astHasVarEntryTracking
        : this.context.cleanLines.some(line =>
          line.includes('var bool') && line.includes('entered')
        );
      
      if (!hasVarTracking) {
        this.addInfo(
          1,
          1,
          'Consider using var for entry tracking to prevent multiple entries per condition',
          'PSV6-STRATEGY-VAR-TRACKING'
        );
        this.hasVarTrackingSuggestion = true;
      }
    }
    
    // Suggest time-based filtering for high-frequency strategies
    if (this.totalOrderCount >= 2 && !this.hasTimeFiltering && !this.hasTimeFilterSuggestion) {
      this.addInfo(
        1,
        1,
        'Consider adding time-based filtering to limit backtesting period and reduce order count',
        'PSV6-STRATEGY-TIME-FILTER-SUGGESTION'
      );
      this.hasTimeFilterSuggestion = true;
    }
    
    // Suggest order cancellation
    const hasOrderCalls = this.strategyOrderCalls.some(call => call.orderType === 'order');
    const hasCancelCalls = this.strategyOrderCalls.some(call => call.orderType === 'cancel');
    
    if (hasOrderCalls && !hasCancelCalls) {
      this.addInfo(
        1,
        1,
        'Consider using strategy.cancel() to clean up unfilled orders',
        'PSV6-STRATEGY-CANCEL-SUGGESTION'
      );
    }
    
    // Recognize good practices
    if (this.strategyOrderCalls.length > 0) {
      if (this.hasTimeFiltering) {
        this.addInfo(1, 1, 'Good practice: Time-based filtering detected for order management', 'PSV6-STRATEGY-GOOD-PRACTICE');
      }
      // Also recognize good practice if entry tracking via var + position_size management is present
      const hasVarEntryTracking = this.usingAst
        ? this.astHasVarEntryTracking
        : this.context.cleanLines.some(line => /var\s+bool\s+\w*entered\w*/.test(line));
      const hasPosSizeReset = this.usingAst
        ? this.astHasPositionSizeReset
        : this.context.cleanLines.some(line => /strategy\.position_size\s*==\s*0/.test(line));
      if (hasVarEntryTracking && hasPosSizeReset) {
        this.addInfo(1, 1, 'Good practice: Entry tracking with var and position size checks', 'PSV6-STRATEGY-GOOD-PRACTICE');
      }
    }
  }

  // Helper methods
  private extractBalancedParentheses(line: string, openParenIndex: number): string | null {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = openParenIndex; i < line.length; i++) {
      const char = line[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
      } else if (!inString) {
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            return line.substring(openParenIndex + 1, i);
          }
        }
      }
    }
    
    return null;
  }

  private parseArguments(argsString: string): string[] {
    if (!argsString.trim()) return [];
    
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
        current += char;
      } else if (!inString && char === '(') {
        depth++;
        current += char;
      } else if (!inString && char === ')') {
        depth--;
        current += char;
      } else if (!inString && char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      args.push(current.trim());
    }
    
    return args;
  }

  private getOrderType(functionName: string): StrategyOrderCall['orderType'] {
    if (functionName === 'entry') return 'entry';
    if (functionName === 'exit') return 'exit';
    if (functionName === 'order') return 'order';
    if (functionName === 'close' || functionName === 'close_all') return 'close';
    if (functionName === 'cancel' || functionName === 'cancel_all') return 'cancel';
    return 'entry'; // default
  }

  private extractEntryId(functionName: string, args: string[]): string | undefined {
    if ((functionName === 'entry' || functionName === 'order') && args.length > 0) {
      return args[0].replace(/['"]/g, ''); // Remove quotes
    }
    if (functionName === 'exit' && args.length > 1) {
      const fromEntryMatch = args.find(arg => arg.includes('from_entry'));
      if (fromEntryMatch) {
        const match = fromEntryMatch.match(/from_entry\s*=\s*["']([^"']+)["']/);
        return match ? match[1] : undefined;
      }
    }
    return undefined;
  }

  private findParameter(args: string[], paramName: string): string | undefined {
    for (const arg of args) {
      if (arg.includes(`${paramName}=`)) {
        const match = arg.match(new RegExp(`${paramName}\\s*=\\s*([^,]+)`));
        return match ? match[1].trim() : undefined;
      }
    }
    return undefined;
  }

  private isNegativeNumber(value: string): boolean {
    const trimmed = value.trim();
    const num = parseFloat(trimmed);
    return !isNaN(num) && num < 0;
  }

  private isInConditionalBlock(lineNum: number): boolean {
    // Simple check for conditional context by looking at indentation
    const line = this.context.cleanLines[lineNum - 1];
    const currentIndent = line.length - line.trimStart().length;

    // Look backwards for if/else statements
    for (let i = lineNum - 2; i >= 0; i--) {
      const prevLine = this.context.cleanLines[i];
      const prevIndent = prevLine.length - prevLine.trimStart().length;

      if (prevIndent < currentIndent && /^\s*(if|else)\b/.test(prevLine)) {
        return true;
      }

      if (prevIndent <= currentIndent && prevLine.trim() !== '') {
        break;
      }
    }

    return false;
  }

  private collectStrategyOrdersAst(program: ProgramNode): void {
    const loopStack: Array<'for' | 'while'> = [];
    const conditionalStack: Array<{ hasExpensive: boolean }> = [];

    visit(program, {
      ForStatement: {
        enter: () => {
          loopStack.push('for');
          this.astHasLoop = true;
        },
        exit: () => {
          loopStack.pop();
        },
      },
      WhileStatement: {
        enter: () => {
          loopStack.push('while');
          this.astHasLoop = true;
        },
        exit: () => {
          loopStack.pop();
        },
      },
      IfStatement: {
        enter: (path) => {
          const hasExpensive = this.expressionContainsExpensiveFunction(path.node.test);
          conditionalStack.push({ hasExpensive });
        },
        exit: () => {
          conditionalStack.pop();
        },
      },
      ScriptDeclaration: {
        enter: (path) => {
          if (path.node.scriptType === 'strategy') {
            for (const argument of path.node.arguments) {
              if (argument.name?.name === 'pyramiding') {
                const value = this.getNumericLiteralValue(argument.value);
                if (typeof value === 'number') {
                  this.pyramidingLevel = value;
                }
              }
            }
          }
        },
      },
      VariableDeclaration: {
        enter: (path) => {
          if (path.node.declarationKind === 'var' && /entered/i.test(path.node.identifier.name)) {
            this.astHasVarEntryTracking = true;
          }
        },
      },
      MemberExpression: {
        enter: (path) => {
          const name = this.getExpressionQualifiedName(path.node);
          if (!name) {
            return;
          }

          this.astMemberNames.add(name);

          if (name.startsWith('strategy.opentrades')) {
            this.astHasOpenTradesReference = true;
          }

          if (name === 'strategy.closedtrades.size' || name === 'strategy.opentrades.size') {
            this.astHasOrderCountTracking = true;
          }

          if (name === 'strategy.position_size') {
            this.astHasPositionSizeReference = true;
          }

          if (name === 'strategy.closedtrades.first_index') {
            const parent = path.parent?.node ?? null;
            if (parent?.kind === 'ExpressionStatement' && path.key === 'expression') {
              this.astFirstIndexStandalone.push({
                line: path.node.loc.start.line,
                column: path.node.loc.start.column,
              });
            }
          }

          if (name === 'input.time') {
            this.hasTimeFiltering = true;
          }
        },
      },
      BinaryExpression: {
        enter: (path) => {
          if (!this.hasTimeFiltering && this.binaryExpressionIndicatesTimeFilter(path.node)) {
            this.hasTimeFiltering = true;
          }

          if (!this.astHasPositionSizeReset && this.binaryExpressionIndicatesPositionSizeReset(path.node)) {
            this.astHasPositionSizeReset = true;
          }
        },
      },
      CallExpression: {
        enter: (path) => {
          const qualifiedName = this.getExpressionQualifiedName(path.node.callee);
          if (qualifiedName && EXPENSIVE_CALCULATION_FUNCTIONS.has(qualifiedName)) {
            this.astComplexCalculations.add(qualifiedName);
          }

          if (qualifiedName === 'timestamp' || qualifiedName === 'tradeDateIsAllowed') {
            this.hasTimeFiltering = true;
          }

          if (qualifiedName === 'input.time') {
            this.hasTimeFiltering = true;
          }

          this.processAstOrderCall(
            path as NodePath<CallExpressionNode>,
            loopStack.length > 0,
            conditionalStack.length > 0,
            conditionalStack.some(ctx => ctx.hasExpensive),
          );
        },
      },
    });
  }

  private processAstOrderCall(
    path: NodePath<CallExpressionNode>,
    inLoop: boolean,
    inConditional: boolean,
    hasExpensiveCondition: boolean,
  ): void {
    const node = path.node;
    const qualifiedName = this.getExpressionQualifiedName(node.callee);
    if (!qualifiedName || !qualifiedName.startsWith('strategy.')) {
      return;
    }

    if (!STRATEGY_ORDER_FUNCTIONS.has(qualifiedName)) {
      return;
    }

    const baseName = qualifiedName.slice('strategy.'.length);
    const line = node.loc.start.line;
    const column = node.loc.start.column;
    const args = node.args.map(argument => this.argumentToString(argument));
    const orderType = this.getOrderType(baseName);
    const entryId = this.extractEntryId(baseName, args);

    const orderCall: StrategyOrderCall = {
      functionName: qualifiedName,
      line,
      column,
      arguments: args,
      entryId,
      orderType,
      inLoop,
      inConditional,
      hasExpensiveCondition,
    };

    this.strategyOrderCalls.push(orderCall);
    this.totalOrderCount++;

    if (orderType === 'entry') {
      const currentCount = this.entriesPerLine.get(line) || 0;
      this.entriesPerLine.set(line, currentCount + 1);
    }

    this.validateOrderCall(orderCall);
  }

  private expressionContainsExpensiveFunction(expression: ExpressionNode): boolean {
    let found = false;

    visit(expression, {
      CallExpression: {
        enter: (path) => {
          if (found) {
            return false;
          }
          const name = this.getExpressionQualifiedName(path.node.callee);
          if (name && EXPENSIVE_CALCULATION_FUNCTIONS.has(name)) {
            found = true;
            return false;
          }
          return;
        },
      },
      MemberExpression: {
        enter: (path) => {
          if (found) {
            return false;
          }
          const name = this.getExpressionQualifiedName(path.node);
          if (name && EXPENSIVE_CALCULATION_FUNCTIONS.has(name)) {
            found = true;
            return false;
          }
          return;
        },
      },
    });

    return found;
  }

  private argumentToString(argument: ArgumentNode): string {
    const valueText = this.getNodeSource(argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
  }

  private getNodeSource(node: ExpressionNode | ArgumentNode | CallExpressionNode): string {
    const lines = this.context.lines ?? this.context.cleanLines ?? [];
    if (!node.loc) {
      return '';
    }
    const startLineIndex = Math.max(0, node.loc.start.line - 1);
    const endLineIndex = Math.max(0, node.loc.end.line - 1);
    if (startLineIndex === endLineIndex) {
      const line = lines[startLineIndex] ?? '';
      return line.slice(
        Math.max(0, node.loc.start.column - 1),
        Math.max(0, node.loc.end.column - 1),
      );
    }
    const parts: string[] = [];
    const firstLine = lines[startLineIndex] ?? '';
    parts.push(firstLine.slice(Math.max(0, node.loc.start.column - 1)));
    for (let index = startLineIndex + 1; index < endLineIndex; index++) {
      parts.push(lines[index] ?? '');
    }
    const lastLine = lines[endLineIndex] ?? '';
    parts.push(lastLine.slice(0, Math.max(0, node.loc.end.column - 1)));
    return parts.join('\n');
  }

  private getExpressionQualifiedName(expression: ExpressionNode): string | null {
    if (expression.kind === 'Identifier') {
      return expression.name;
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

  private getNumericLiteralValue(expression: ExpressionNode): number | null {
    if (expression.kind === 'NumberLiteral') {
      return expression.value;
    }
    return null;
  }

  private binaryExpressionIndicatesTimeFilter(expression: BinaryExpressionNode): boolean {
    const operators = new Set(['>=', '<=', '>', '<']);
    if (!operators.has(expression.operator)) {
      return false;
    }

    const hasTimeIdentifier = this.expressionHasIdentifier(expression.left, name => name === 'time')
      || this.expressionHasIdentifier(expression.right, name => name === 'time');

    if (!hasTimeIdentifier) {
      return false;
    }

    const otherSideHasDateIdentifier = this.expressionHasIdentifier(expression.left, name => /date/i.test(name))
      || this.expressionHasIdentifier(expression.right, name => /date/i.test(name));

    return otherSideHasDateIdentifier;
  }

  private binaryExpressionIndicatesPositionSizeReset(expression: BinaryExpressionNode): boolean {
    if (!['==', '==='].includes(expression.operator)) {
      return false;
    }

    if (this.expressionHasMemberName(expression.left, name => name === 'strategy.position_size') && this.expressionIsZero(expression.right)) {
      return true;
    }

    if (this.expressionHasMemberName(expression.right, name => name === 'strategy.position_size') && this.expressionIsZero(expression.left)) {
      return true;
    }

    return false;
  }

  private expressionHasIdentifier(expression: ExpressionNode, predicate: (name: string) => boolean): boolean {
    let found = false;
    visit(expression, {
      Identifier: {
        enter: (path) => {
          if (found) {
            return false;
          }
          if (predicate(path.node.name)) {
            found = true;
            return false;
          }
          return;
        },
      },
    });
    return found;
  }

  private expressionHasMemberName(expression: ExpressionNode, predicate: (name: string) => boolean): boolean {
    let found = false;
    visit(expression, {
      MemberExpression: {
        enter: (path) => {
          if (found) {
            return false;
          }
          const name = this.getExpressionQualifiedName(path.node);
          if (name && predicate(name)) {
            found = true;
            return false;
          }
          return;
        },
      },
      Identifier: {
        enter: (path) => {
          if (found) {
            return false;
          }
          if (predicate(path.node.name)) {
            found = true;
            return false;
          }
          return;
        },
      },
    });
    return found;
  }

  private expressionIsZero(expression: ExpressionNode): boolean {
    if (expression.kind === 'NumberLiteral') {
      return expression.value === 0;
    }

    let isZero = false;
    visit(expression, {
      NumberLiteral: {
        enter: (path) => {
          if (path.node.value === 0) {
            isZero = true;
            return false;
          }
          return;
        },
      },
    });
    return isZero;
  }

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    if (!config.ast || config.ast.mode === 'disabled') {
      return null;
    }
    return isAstValidationContext(this.context) ? (this.context as AstValidationContext) : null;
  }

  private addError(line: number, column: number, message: string, code: string): void {
    this.errors.push({
      line,
      column,
      message,
      severity: 'error',
      code
    });
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({
      line,
      column,
      message,
      severity: 'warning',
      code
    });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({
      line,
      column,
      message,
      severity: 'info',
      code
    });
  }

  // Getter methods for other modules
  getStrategyOrderCalls(): StrategyOrderCall[] {
    return [...this.strategyOrderCalls];
  }

  getOrderPatterns(): OrderPattern[] {
    return [...this.orderPatterns];
  }

  getTotalOrderCount(): number {
    return this.totalOrderCount;
  }

  getPyramidingLevel(): number {
    return this.pyramidingLevel;
  }

  hasTimeBasedFiltering(): boolean {
    return this.hasTimeFiltering;
  }
}

function isAstValidationContext(context: ValidationContext): context is AstValidationContext {
  return 'ast' in context;
}
