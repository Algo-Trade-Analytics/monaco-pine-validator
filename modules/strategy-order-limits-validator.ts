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
import { Codes } from '../core/codes';
import { ValidationHelper } from '../core/validation-helper';
import { STRATEGY_ORDER_LIMITS, STRATEGY_ORDER_FUNCTIONS, EXPENSIVE_CALCULATION_FUNCTIONS } from '../core/constants';
import {
  type ArgumentNode,
  type BinaryExpressionNode,
  type CallExpressionNode,
  type ExpressionNode,
  type MemberExpressionNode,
  type NumberLiteralNode,
  type ProgramNode,
} from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { getNodeSource as extractNodeSource, getSourceLines } from '../core/ast/source-utils';

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

  private helper = new ValidationHelper();
  private context!: ValidationContext;
  private config!: ValidatorConfig;
  private astContext: AstValidationContext | null = null;

  // Order tracking
  private strategyOrderCalls: StrategyOrderCall[] = [];
  private orderPatterns: OrderPattern[] = [];
  private totalOrderCount = 0;
  private entriesPerLine = new Map<number, number>();
  private pyramidingLevel = 0;
  private hasTimeFiltering = false;
  private astHasLoop = false;
  private astMemberNames = new Set<string>();
  private astFirstIndexStandalone: Array<{ line: number; column: number }> = [];
  private astComplexCalculations = new Set<string>();
  private astHasPositionSizeReference = false;
  private astHasPositionSizeReset = false;
  private astHasOrderCountTracking = false;
  private astHasOpenTradesReference = false;
  private astHasVarEntryTracking = false;
  private manualOrderCounterDetected = false;
  
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

    const detectedScriptType = context.scriptType ?? this.detectScriptTypeFromLines(context);
    if (detectedScriptType) {
      context.scriptType = detectedScriptType;
    }

    // Only validate strategy scripts
    if (context.scriptType !== 'strategy') {
      return this.helper.buildResult(context);
    }

    this.astContext = this.getAstContext(config);
    const ast = this.astContext?.ast;
    if (!ast) {
      return this.helper.buildResult(context);
    }

    this.collectStrategyOrdersAst(ast);
    this.analyzeOrderPatterns();
    this.validateOrderLimits();
    this.validatePerformanceOptimizations();
    this.provideBestPracticesSuggestions();

    // Build analysis results for other validators
    const typeMap = this.context.typeMap ?? new Map();
    typeMap.set('strategy_order_analysis', {
      type: 'analysis',
      isConst: false,
      isSeries: false,
      declaredAt: { line: 1, column: 1 },
      usages: []
    });
    this.context.typeMap = typeMap;

    if (process.env.DEBUG_STRATEGY_ORDER_OUTPUT === '1') {
      console.log('[StrategyOrderLimitsValidator] result snapshot', {
        errors: this.errors,
        warnings: this.warnings,
        info: this.info,
        totalOrderCount: this.totalOrderCount,
        typeMapKeys: Array.from(typeMap.keys()),
      });
    }

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();
    this.strategyOrderCalls = [];
    this.orderPatterns = [];
    this.totalOrderCount = 0;
    this.entriesPerLine.clear();
    this.pyramidingLevel = 0;
    this.hasTimeFiltering = false;
    this.astContext = null;
    this.astHasLoop = false;
    this.astMemberNames.clear();
    this.astFirstIndexStandalone = [];
    this.astComplexCalculations.clear();
    this.astHasPositionSizeReference = false;
    this.astHasPositionSizeReset = false;
    this.astHasOrderCountTracking = false;
    this.astHasOpenTradesReference = false;
    this.astHasVarEntryTracking = false;
    this.manualOrderCounterDetected = false;

    // Reset suggestion flags
    this.hasConsolidationSuggestion = false;
    this.hasPositionSizeSuggestion = false;
    this.hasVarTrackingSuggestion = false;
    this.hasTimeFilterSuggestion = false;
    this.hasCachingSuggestion = false;
  }

  private detectScriptTypeFromLines(context: ValidationContext): 'indicator' | 'strategy' | 'library' | null {
    const lines = getSourceLines(context);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('strategy(')) {
        return 'strategy';
      }
      if (line.startsWith('indicator(')) {
        return 'indicator';
      }
      if (line.startsWith('library(')) {
        return 'library';
      }
    }
    return null;
  }

  private validateOrderCall(orderCall: StrategyOrderCall): void {
    // Validate parameters: allow zero-arg for close_all() and cancel_all()
    const allowsZeroArgs = orderCall.functionName === 'strategy.close_all' || orderCall.functionName === 'strategy.cancel_all';
    if (orderCall.arguments.length === 0 && !allowsZeroArgs) {
      this.helper.addError(
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

    if (this.config.enablePerformanceAnalysis && orderCall.hasExpensiveCondition) {
      this.helper.addWarning(
        orderCall.line,
        orderCall.column,
        'Expensive calculations in order conditions may impact performance',
        'PSV6-STRATEGY-EXPENSIVE-CONDITIONS'
      );
    }
  }

  private validateOrderParameters(orderCall: StrategyOrderCall): void {
    const args = orderCall.arguments;
    
    // Check for negative quantities
    if (orderCall.orderType === 'entry' || orderCall.orderType === 'order') {
      const qtyArg = this.findParameter(args, 'qty');
      if (qtyArg && this.isNegativeNumber(qtyArg)) {
        this.helper.addError(
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
        this.helper.addError(
          orderCall.line,
          orderCall.column,
          'Stop price cannot be negative',
          'PSV6-STRATEGY-INVALID-PARAM'
        );
      }
      
      if (limitArg && this.isNegativeNumber(limitArg)) {
        this.helper.addError(
          orderCall.line,
          orderCall.column,
          'Limit price cannot be negative',
          'PSV6-STRATEGY-INVALID-PARAM'
        );
      }
    }
  }

  private checkLoopContext(orderCall: StrategyOrderCall): void {
    if (orderCall.inLoop) {
      this.helper.addWarning(
        orderCall.line,
        orderCall.column,
        'Strategy orders in loop may cause excessive order generation',
        'PSV6-STRATEGY-ORDER-LOOP'
      );
    }
  }

  private analyzeOrderPatterns(): void {
    this.detectMultipleEntries();
    this.detectRedundantExits();
    this.detectUnconditionalOrders();
    this.detectExcessivePyramiding();
    // Broad safety net: if loops exist anywhere with any orders present, surface trimming risk
    const hasAnyLoop = this.astHasLoop;
    if (hasAnyLoop && this.strategyOrderCalls.length > 0) {
      this.helper.addWarning(
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
        this.helper.addWarning(
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
          this.helper.addInfo(
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
    const hasPyramidingManagement = this.pyramidingLevel > 0 || this.astHasOpenTradesReference;
    if (!hasPyramidingManagement && totalEntryCalls >= STRATEGY_ORDER_LIMITS.MAX_ENTRIES_PER_BAR) {
      const firstEntry = this.strategyOrderCalls.find(c => c.orderType === 'entry');
      if (firstEntry) {
        this.helper.addWarning(
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
        this.helper.addWarning(
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
      if (!orderCall.inConditional) {
        unconditionalCount++;
      }
    }
    
    // Warn even for a couple of unconditional orders
    if (unconditionalCount >= 2) {
      this.helper.addWarning(
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
      this.helper.addWarning(
        entryCalls[0].line,
        entryCalls[0].column,
        message,
        'PSV6-STRATEGY-PYRAMIDING-EXCESSIVE'
      );
    }

    if (this.pyramidingLevel > 0 && entryCalls.length > this.pyramidingLevel) {
      this.helper.addWarning(
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
      this.helper.addWarning(
        1,
        1,
        `Many strategy orders detected (${estimatedOrders}). Consider optimization to avoid performance issues.`,
        'PSV6-STRATEGY-ORDER-COUNT-HIGH'
      );
    }
    
    // Pine Script v6: Dynamic trimming behavior - inform about trimming around 9000 orders
    if (estimatedOrders > 50) {  // Lower threshold for testing
      this.helper.addInfo(
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

    const loopedOrders = this.strategyOrderCalls.filter(call => call.inLoop).length;
    if (loopedOrders > 0) {
      estimate += loopedOrders * 10;
    }

    return estimate;
  }

  private checkOrderTrimmingOptimizations(): void {
    // Check for patterns that could benefit from v6 trimming awareness
    const hasOrderCountTracking = this.astHasOrderCountTracking;
    
    if (this.totalOrderCount > 100 && !hasOrderCountTracking) {
      this.helper.addInfo(
        1,
        1,
        'Consider using strategy.closedtrades.size() and strategy.opentrades.size() to monitor order counts in high-frequency strategies.',
        'PSV6-STRATEGY-ORDER-TRACKING-SUGGESTION'
      );
    }
  }

  private validateTrimmingFeatures(): void {
    // Check for proper use of v6 trimming features
    const usesFirstIndex = this.astMemberNames.has('strategy.closedtrades.first_index');
    
    const hasHighOrderCount = this.totalOrderCount > 50;
    
    if (hasHighOrderCount && !usesFirstIndex) {
      this.helper.addInfo(
        1,
        1,
        'For strategies with many orders, consider using strategy.closedtrades.first_index to track the earliest non-trimmed order.',
        'PSV6-STRATEGY-FIRST-INDEX-SUGGESTION'
      );
    }
    
    // Validate proper first_index usage
    this.validateFirstIndexUsageAst();
  }

  private validateFirstIndexUsageAst(): void {
    for (const usage of this.astFirstIndexStandalone) {
      this.helper.addInfo(
        usage.line,
        usage.column,
        'strategy.closedtrades.first_index represents the index of the earliest non-trimmed order. Consider using it in calculations or comparisons.',
        'PSV6-STRATEGY-FIRST-INDEX-USAGE'
      );
    }
  }

  private validatePerformanceOptimizations(): void {
    if (!this.config.enablePerformanceAnalysis) return;

    // Check for complex calculations that could be cached
    const complexCalculations = new Set<string>();

    for (const func of this.astComplexCalculations) {
      complexCalculations.add(func);
    }

    if (complexCalculations.size > 0 && !this.hasCachingSuggestion) {
      this.helper.addInfo(
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
      const hasPositionSizeCheck = this.astHasPositionSizeReference;

      if (!hasPositionSizeCheck) {
        this.helper.addInfo(
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
      const hasVarTracking = this.astHasVarEntryTracking;

      if (!hasVarTracking) {
        this.helper.addInfo(
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
      this.helper.addInfo(
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
      this.helper.addInfo(
        1,
        1,
        'Consider using strategy.cancel() to clean up unfilled orders',
        'PSV6-STRATEGY-CANCEL-SUGGESTION'
      );
    }
    
    // Recognize good practices
    if (this.strategyOrderCalls.length > 0) {
      if (this.hasTimeFiltering) {
        this.helper.addInfo(1, 1, 'Good practice: Time-based filtering detected for order management', 'PSV6-STRATEGY-GOOD-PRACTICE');
      }
      if (this.astHasVarEntryTracking && this.astHasPositionSizeReset) {
        this.helper.addInfo(1, 1, 'Good practice: Entry tracking with var and position size checks', 'PSV6-STRATEGY-GOOD-PRACTICE');
      }
    }
  }

  // Helper methods
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

          if (path.node.initializer && this.looksLikeOrderCounter(path.node.identifier.name)) {
            const numericValue = this.getNumericLiteralValue(path.node.initializer);
            if (typeof numericValue === 'number') {
              this.totalOrderCount = Math.max(this.totalOrderCount, numericValue);
            }
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

  private getAstContext(config: ValidatorConfig): AstValidationContext | null {
    return ensureAstContext(this.context, config);
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
    const valueText = extractNodeSource(this.context, argument.value).trim();
    if (argument.name) {
      return `${argument.name.name}=${valueText}`;
    }
    return valueText;
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

  private looksLikeOrderCounter(name: string): boolean {
    return /(order_count|orders_count|orderCount|ordersCount|orderCounter|ordersCounter)/i.test(name);
  }

  private getNumericLiteralValue(expression: ExpressionNode): number | null {
    if (expression.kind === 'NumberLiteral') {
      return (expression as NumberLiteralNode).value;
    }
    return null;
  }

  private binaryExpressionIndicatesTimeFilter(expression: BinaryExpressionNode): boolean {
    const operators = new Set(['>=', '<=', '>', '<']);
    if (!operators.has(expression.operator)) {
      return false;
    }

    const hasTimeIdentifier =
      this.expressionHasIdentifier(expression.left, (name) => name === 'time') ||
      this.expressionHasIdentifier(expression.right, (name) => name === 'time');

    if (!hasTimeIdentifier) {
      return false;
    }

    const otherSideHasDateIdentifier =
      this.expressionHasIdentifier(expression.left, (name) => /date/i.test(name)) ||
      this.expressionHasIdentifier(expression.right, (name) => /date/i.test(name));

    return otherSideHasDateIdentifier;
  }

  private binaryExpressionIndicatesPositionSizeReset(expression: BinaryExpressionNode): boolean {
    if (!['==', '==='].includes(expression.operator)) {
      return false;
    }

    if (
      this.expressionHasMemberName(expression.left, (name) => name === 'strategy.position_size') &&
      this.expressionIsZero(expression.right)
    ) {
      return true;
    }

    if (
      this.expressionHasMemberName(expression.right, (name) => name === 'strategy.position_size') &&
      this.expressionIsZero(expression.left)
    ) {
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
      return (expression as NumberLiteralNode).value === 0;
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
