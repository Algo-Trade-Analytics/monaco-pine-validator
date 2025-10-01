/**
 * Lazy Evaluation Validator
 *
 * Validates Pine Script v6 lazy evaluation patterns and potential issues:
 * - Detects historical functions in conditional expressions
 * - Identifies series inconsistency patterns
 * - Warns about performance implications of conditional historical calculations
 * - Suggests best practices for consistent series data
 * - Analyzes switch statements, loops, and complex conditional structures
 *
 * Priority 83: High priority - lazy evaluation can cause subtle bugs and performance issues
 */
import { HISTORICAL_FUNCTIONS, EXPENSIVE_HISTORICAL_FUNCTIONS } from '../core/constants';
import { findAncestor, visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
import { getSourceLines } from '../core/ast/source-utils';
export class LazyEvaluationValidator {
    constructor() {
        this.name = 'LazyEvaluationValidator';
        this.priority = 83; // High priority - lazy evaluation issues can cause subtle bugs
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.hasNestedTernaryHistoricalCall = false;
        // Analysis tracking
        this.conditionalHistoricalCalls = [];
        this.seriesInconsistencies = [];
        this.userFunctionsWithHistorical = new Set();
        this.conditionalHistoricalCount = 0;
        this.emittedByLineAndFunc = new Set();
        this.emittedUserFunctionWarnings = new Set();
        this.emittedMethodWarnings = new Set();
        this.textUserFunctionNames = new Set();
        this.textMethodFunctionNames = new Set();
        this.historicalFunctionPattern = null;
    }
    // State tracking for complex analysis
    getDependencies() {
        return ['TypeValidator', 'FunctionValidator', 'ScopeValidator'];
    }
    validate(context, config) {
        this.reset();
        this.config = config;
        this.astContext = ensureAstContext(context, config);
        if (this.astContext?.ast) {
            this.validateWithAst(this.astContext.ast);
        }
        this.collectFromText(context);
        this.analyzePerformanceImpact();
        this.provideBestPracticesSuggestions();
        const typeMap = new Map();
        typeMap.set('conditional_historical_functions', {
            type: 'analysis',
            isConst: false,
            isSeries: false,
            count: this.conditionalHistoricalCount,
        });
        if (process.env.DEBUG_LAZY_EVAL === '1') {
            console.log('[LazyEvaluationValidator] debug snapshot', {
                errors: this.errors,
                warnings: this.warnings,
                info: this.info,
            });
        }
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap,
            scriptType: null,
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.conditionalHistoricalCalls = [];
        this.seriesInconsistencies = [];
        this.userFunctionsWithHistorical.clear();
        this.conditionalHistoricalCount = 0;
        this.emittedByLineAndFunc.clear();
        this.emittedUserFunctionWarnings.clear();
        this.emittedMethodWarnings.clear();
        this.textUserFunctionNames.clear();
        this.textMethodFunctionNames.clear();
        this.astContext = null;
        this.hasNestedTernaryHistoricalCall = false;
    }
    validateWithAst(program) {
        const pendingUserCalls = [];
        const pendingMethodCalls = [];
        const functionStack = [];
        const ifStatements = [];
        visit(program, {
            FunctionDeclaration: {
                enter: (path) => {
                    const identifier = path.node.identifier;
                    functionStack.push({ name: identifier?.name ?? null, hasHistorical: false });
                },
                exit: () => {
                    const entry = functionStack.pop();
                    if (entry?.name && entry.hasHistorical) {
                        this.userFunctionsWithHistorical.add(entry.name);
                    }
                },
            },
            IfStatement: {
                enter: (path) => {
                    ifStatements.push(path.node);
                },
            },
            CallExpression: {
                enter: (path) => {
                    this.handleAstCallExpression(path, pendingUserCalls, pendingMethodCalls, functionStack);
                },
            },
        });
        this.emitUserFunctionWarnings(pendingUserCalls);
        this.emitMethodWarnings(pendingMethodCalls);
        this.analyzeSeriesConsistencyAst(ifStatements);
    }
    handleAstCallExpression(path, pendingUserCalls, pendingMethodCalls, functionStack) {
        const call = path.node;
        const location = this.getCallLocation(call.callee);
        const qualifiedName = this.getExpressionQualifiedName(call.callee);
        if (qualifiedName && HISTORICAL_FUNCTIONS.has(qualifiedName)) {
            const context = this.determineCallContext(path);
            if (context) {
                this.addConditionalHistoricalCall(qualifiedName, location.line, location.column, context);
                if (context === 'ternary' && this.isNestedTernary(path)) {
                    this.hasNestedTernaryHistoricalCall = true;
                }
            }
            const currentFunction = functionStack[functionStack.length - 1];
            if (currentFunction) {
                currentFunction.hasHistorical = true;
            }
        }
        const calleeInfo = this.getUserFunctionCallInfo(call.callee);
        if (!calleeInfo) {
            return;
        }
        if (calleeInfo.isMethod) {
            pendingMethodCalls.push({ name: calleeInfo.name, line: location.line, column: location.column });
            return;
        }
        const context = this.determineCallContext(path);
        if (context === 'ternary' || context === 'if' || context === 'loop') {
            pendingUserCalls.push({ name: calleeInfo.name, line: location.line, column: location.column, context });
        }
    }
    emitUserFunctionWarnings(calls) {
        for (const call of calls) {
            if (!this.userFunctionsWithHistorical.has(call.name)) {
                continue;
            }
            const key = `${call.name}:${call.line}:${call.column}:${call.context}`;
            if (this.emittedUserFunctionWarnings.has(key)) {
                continue;
            }
            this.emittedUserFunctionWarnings.add(key);
            if (call.context === 'ternary') {
                this.addWarning(call.line, call.column, `User function ${call.name} may have historical dependencies in conditional expression`, 'PSV6-LAZY-EVAL-USER-FUNCTION');
            }
            else {
                this.addWarning(call.line, call.column, `User function ${call.name} may have historical dependencies`, 'PSV6-LAZY-EVAL-USER-FUNCTION');
            }
        }
    }
    emitMethodWarnings(calls) {
        for (const call of calls) {
            if (!this.userFunctionsWithHistorical.has(call.name)) {
                continue;
            }
            const key = `${call.name}:${call.line}:${call.column}`;
            if (this.emittedMethodWarnings.has(key)) {
                continue;
            }
            this.emittedMethodWarnings.add(key);
            this.addWarning(call.line, call.column, `Method call may contain historical dependencies: ${call.name}`, 'PSV6-LAZY-EVAL-METHOD');
        }
    }
    determineCallContext(path) {
        const loopAncestor = findAncestor(path, (ancestor) => ancestor.node.kind === 'ForStatement' || ancestor.node.kind === 'WhileStatement');
        if (loopAncestor) {
            return 'loop';
        }
        const switchAncestor = findAncestor(path, (ancestor) => ancestor.node.kind === 'SwitchCase');
        if (switchAncestor) {
            return 'switch';
        }
        const ternaryAncestor = findAncestor(path, (ancestor) => ancestor.node.kind === 'ConditionalExpression');
        if (ternaryAncestor) {
            return 'ternary';
        }
        const ifAncestor = findAncestor(path, (ancestor) => ancestor.node.kind === 'IfStatement');
        if (ifAncestor) {
            return 'if';
        }
        return null;
    }
    isNestedTernary(path) {
        const ternaryAncestor = findAncestor(path, (ancestor) => ancestor.node.kind === 'ConditionalExpression');
        if (!ternaryAncestor) {
            return false;
        }
        return !!findAncestor(ternaryAncestor, (ancestor) => ancestor.node.kind === 'ConditionalExpression');
    }
    getUserFunctionCallInfo(expression) {
        if (expression.kind === 'Identifier') {
            return { name: expression.name, isMethod: false };
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            if (member.computed) {
                return null;
            }
            return { name: member.property.name, isMethod: true };
        }
        return null;
    }
    getCallLocation(expression) {
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            return { line: member.property.loc.start.line, column: member.property.loc.start.column };
        }
        return { line: expression.loc.start.line, column: expression.loc.start.column };
    }
    addConditionalHistoricalCall(functionName, lineNum, column, context) {
        const isExpensive = EXPENSIVE_HISTORICAL_FUNCTIONS.has(functionName);
        const dedupKey = `${lineNum}|${functionName}|${context}`;
        if (this.emittedByLineAndFunc.has(dedupKey)) {
            return;
        }
        this.emittedByLineAndFunc.add(dedupKey);
        this.conditionalHistoricalCalls.push({
            functionName,
            line: lineNum,
            column,
            context,
            isExpensive,
        });
        if (context === 'if' || context === 'ternary') {
            this.conditionalHistoricalCount++;
        }
        const contextMessages = {
            ternary: `Historical function ${functionName} in conditional expression may cause series inconsistency`,
            if: `Historical function ${functionName} in conditional block may cause incomplete series data`,
            switch: `Historical function ${functionName} in switch statement may cause inconsistent calculations`,
            loop: `Historical function ${functionName} in loop may cause performance issues and series inconsistency`,
            method: `Historical function ${functionName} in method call may cause lazy evaluation issues`,
        };
        const codes = {
            ternary: 'PSV6-LAZY-EVAL-HISTORICAL',
            if: 'PSV6-LAZY-EVAL-CONDITIONAL',
            switch: 'PSV6-LAZY-EVAL-SWITCH',
            loop: 'PSV6-LAZY-EVAL-LOOP',
            method: 'PSV6-LAZY-EVAL-METHOD',
        };
        this.addWarning(lineNum, column, contextMessages[context], codes[context]);
    }
    analyzeSeriesConsistencyAst(ifStatements) {
        for (const statement of ifStatements) {
            const consequentAssignments = this.collectAssignmentsFromStatement(statement.consequent);
            const alternateAssignments = this.collectAssignmentsFromStatement(statement.alternate);
            for (const [variableName, info] of consequentAssignments) {
                const alternateInfo = alternateAssignments.get(variableName);
                if (info.hasHistorical && alternateInfo?.hasNa) {
                    if (process.env.DEBUG_LAZY_EVAL === '1') {
                        console.log('[LazyEvaluationValidator] series inconsistency detected', {
                            variableName,
                            consequent: info,
                            alternate: alternateInfo,
                            startLine: statement.loc.start.line,
                            endLine: statement.loc.end.line,
                        });
                    }
                    const startLine = Math.min(statement.loc.start.line, statement.consequent.loc.start.line, statement.alternate?.loc.start.line ?? statement.loc.start.line);
                    const endLine = Math.max(statement.loc.end.line, statement.consequent.loc.end.line, statement.alternate?.loc.end.line ?? statement.loc.end.line);
                    const line = endLine;
                    const column = statement.loc.start.column ?? 1;
                    this.seriesInconsistencies.push({
                        variableName,
                        line,
                        inconsistencyType: 'conditional_assignment',
                    });
                    this.addWarning(line, column, 'Series may have inconsistent historical data due to conditional assignment', 'PSV6-LAZY-EVAL-SERIES-INCONSISTENCY');
                    this.removeConditionalWarningsInRange(startLine, endLine);
                }
            }
        }
    }
    removeConditionalWarningsInRange(startLine, endLine) {
        this.warnings = this.warnings.filter((warning) => {
            if (warning.code !== 'PSV6-LAZY-EVAL-CONDITIONAL') {
                return true;
            }
            return warning.line < startLine || warning.line > endLine;
        });
    }
    collectAssignmentsFromStatement(statement) {
        const assignments = new Map();
        if (!statement) {
            return assignments;
        }
        visit(statement, {
            AssignmentStatement: {
                enter: (path) => {
                    const node = path.node;
                    if (node.left.kind !== 'Identifier' || !node.right) {
                        return;
                    }
                    const identifier = node.left;
                    const entry = assignments.get(identifier.name) ?? { hasHistorical: false, hasNa: false };
                    if (this.expressionContainsHistoricalCall(node.right)) {
                        entry.hasHistorical = true;
                    }
                    if (this.expressionContainsNa(node.right)) {
                        entry.hasNa = true;
                    }
                    assignments.set(identifier.name, entry);
                },
            },
            VariableDeclaration: {
                enter: (path) => {
                    const node = path.node;
                    const identifier = node.identifier.name;
                    const entry = assignments.get(identifier) ?? { hasHistorical: false, hasNa: false };
                    if (node.initializer && this.expressionContainsHistoricalCall(node.initializer)) {
                        entry.hasHistorical = true;
                    }
                    if (node.initializer && this.expressionContainsNa(node.initializer)) {
                        entry.hasNa = true;
                    }
                    assignments.set(identifier, entry);
                },
            },
        });
        return assignments;
    }
    expressionContainsHistoricalCall(expression) {
        let found = false;
        visit(expression, {
            CallExpression: {
                enter: (path) => {
                    const qualifiedName = this.getExpressionQualifiedName(path.node.callee);
                    if (qualifiedName && HISTORICAL_FUNCTIONS.has(qualifiedName)) {
                        found = true;
                        return false;
                    }
                    return undefined;
                },
            },
        });
        return found;
    }
    expressionContainsNa(expression) {
        let found = false;
        visit(expression, {
            Identifier: {
                enter: (path) => {
                    if (path.node.name === 'na') {
                        found = true;
                        return false;
                    }
                    return undefined;
                },
            },
        });
        return found;
    }
    collectFromText(context) {
        const lines = this.getTextLines(context);
        if (lines.length === 0) {
            return;
        }
        const blockStack = [];
        const ifStack = [];
        const pendingUserCalls = [];
        const pendingMethodCalls = [];
        const pattern = this.getHistoricalFunctionPattern();
        for (let index = 0; index < lines.length; index++) {
            const rawLine = lines[index];
            const lineNumber = index + 1;
            const withoutComment = rawLine.replace(/\/\/.*$/, '');
            const trimmed = withoutComment.trim();
            const indent = rawLine.length - rawLine.trimStart().length;
            const isBlank = trimmed.length === 0;
            const isElseLine = /^else\b/.test(trimmed);
            if (!isBlank && !isElseLine) {
                while (ifStack.length > 0 && indent <= ifStack[ifStack.length - 1].indent) {
                    const ctx = ifStack.pop();
                    this.finalizeTextIfContext(ctx, lineNumber - 1);
                }
            }
            if (!isBlank) {
                while (blockStack.length > 0 && indent <= blockStack[blockStack.length - 1].indent) {
                    blockStack.pop();
                }
            }
            if (isBlank) {
                continue;
            }
            if (/^type\b/.test(trimmed)) {
                blockStack.push({ type: 'type', indent });
            }
            if (/^switch\b/.test(trimmed)) {
                blockStack.push({ type: 'switch', indent });
            }
            if (/^(for|while)\b/.test(trimmed)) {
                blockStack.push({ type: 'loop', indent });
            }
            if (/^if\b/.test(trimmed)) {
                ifStack.push({
                    indent,
                    startLine: lineNumber,
                    consequent: new Map(),
                    alternate: new Map(),
                    inElse: false,
                    elseIndent: null,
                    lastLine: lineNumber,
                });
            }
            let analysisLine = trimmed;
            let isElseRemainder = false;
            if (isElseLine) {
                const current = ifStack[ifStack.length - 1];
                if (current) {
                    current.inElse = true;
                    current.elseIndent = indent;
                    current.lastLine = lineNumber;
                }
                analysisLine = trimmed.replace(/^else\b\s*/, '').trim();
                isElseRemainder = true;
                if (/^if\b/.test(analysisLine)) {
                    ifStack.push({
                        indent,
                        startLine: lineNumber,
                        consequent: new Map(),
                        alternate: new Map(),
                        inElse: false,
                        elseIndent: null,
                        lastLine: lineNumber,
                    });
                }
            }
            const hasTernary = this.isTernaryLine(withoutComment);
            if (hasTernary) {
                const questionCount = (withoutComment.match(/\?/g) || []).length;
                if (questionCount > 1) {
                    this.hasNestedTernaryHistoricalCall = true;
                }
            }
            this.trackIfAssignments(analysisLine, indent, lineNumber, ifStack, isElseRemainder);
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(withoutComment)) !== null) {
                const functionName = match[0];
                const column = match.index + 1;
                const contextType = this.resolveTextContext(withoutComment, trimmed, indent, blockStack, ifStack, hasTernary);
                if (!contextType) {
                    continue;
                }
                this.addConditionalHistoricalCall(functionName, lineNumber, column, contextType);
            }
            pattern.lastIndex = 0;
            const functionMatch = withoutComment.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*=>\s*(.+)$/);
            if (functionMatch) {
                const name = functionMatch[1];
                const body = functionMatch[2];
                const hasHistorical = this.containsHistoricalInText(body);
                const insideType = this.isInsideType(blockStack);
                if (insideType) {
                    this.textMethodFunctionNames.add(name);
                }
                else {
                    this.textUserFunctionNames.add(name);
                }
                if (hasHistorical) {
                    this.userFunctionsWithHistorical.add(name);
                }
            }
            for (const fnName of this.textUserFunctionNames) {
                let searchIndex = -1;
                const target = `${fnName}(`;
                while ((searchIndex = withoutComment.indexOf(target, searchIndex + 1)) !== -1) {
                    if (searchIndex > 0 && /[.A-Za-z0-9_]/.test(withoutComment[searchIndex - 1])) {
                        continue;
                    }
                    const contextType = this.resolveTextContext(withoutComment, trimmed, indent, blockStack, ifStack, hasTernary);
                    if (!contextType || contextType === 'switch') {
                        continue;
                    }
                    pendingUserCalls.push({
                        name: fnName,
                        line: lineNumber,
                        column: searchIndex + 1,
                        context: contextType,
                    });
                }
            }
            for (const methodName of this.textMethodFunctionNames) {
                let searchIndex = -1;
                const target = `.${methodName}(`;
                while ((searchIndex = withoutComment.indexOf(target, searchIndex + 1)) !== -1) {
                    pendingMethodCalls.push({
                        name: methodName,
                        line: lineNumber,
                        column: searchIndex + 2,
                    });
                }
            }
        }
        while (ifStack.length > 0) {
            const ctx = ifStack.pop();
            this.finalizeTextIfContext(ctx, lines.length);
        }
        this.emitUserFunctionWarnings(pendingUserCalls);
        this.emitMethodWarnings(pendingMethodCalls);
    }
    getTextLines(context) {
        const lines = getSourceLines(context);
        return lines.length > 0 ? [...lines] : [];
    }
    getHistoricalFunctionPattern() {
        if (this.historicalFunctionPattern) {
            return this.historicalFunctionPattern;
        }
        const names = Array.from(HISTORICAL_FUNCTIONS)
            .sort((a, b) => b.length - a.length)
            .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        this.historicalFunctionPattern = new RegExp(`\\b(?:${names.join('|')})\\b`, 'g');
        return this.historicalFunctionPattern;
    }
    trackIfAssignments(analysisLine, indent, lineNumber, ifStack, isElseRemainder) {
        if (analysisLine.length === 0) {
            return;
        }
        const assignmentMatch = analysisLine.match(/^(?:var\b[^=]*\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::=|=)\s*(.+)$/);
        if (!assignmentMatch) {
            return;
        }
        const context = this.findActiveIfContext(indent, ifStack, isElseRemainder);
        if (!context) {
            return;
        }
        const [, variable, expression] = assignmentMatch;
        const targetMap = this.isInAlternateSection(context, indent, isElseRemainder)
            ? context.alternate
            : context.consequent;
        const entry = targetMap.get(variable) ?? { hasHistorical: false, hasNa: false };
        if (this.containsHistoricalInText(expression)) {
            entry.hasHistorical = true;
        }
        if (this.containsNaInText(expression)) {
            entry.hasNa = true;
        }
        targetMap.set(variable, entry);
        context.lastLine = lineNumber;
    }
    findActiveIfContext(indent, ifStack, isElseRemainder) {
        for (let idx = ifStack.length - 1; idx >= 0; idx--) {
            const ctx = ifStack[idx];
            const elseIndent = ctx.elseIndent ?? ctx.indent;
            if (ctx.inElse && (isElseRemainder || indent > elseIndent)) {
                return ctx;
            }
            if (indent > ctx.indent) {
                return ctx;
            }
            if (isElseRemainder && indent === ctx.indent) {
                return ctx;
            }
        }
        return null;
    }
    isInAlternateSection(ctx, indent, isElseRemainder) {
        if (!ctx.inElse) {
            return false;
        }
        const elseIndent = ctx.elseIndent ?? ctx.indent;
        return isElseRemainder || indent > elseIndent;
    }
    containsHistoricalInText(text) {
        const pattern = this.getHistoricalFunctionPattern();
        pattern.lastIndex = 0;
        const result = pattern.test(text);
        pattern.lastIndex = 0;
        return result;
    }
    containsNaInText(text) {
        return /\bna\b/.test(text);
    }
    resolveTextContext(line, trimmed, indent, blockStack, ifStack, hasTernary) {
        if (hasTernary) {
            return 'ternary';
        }
        if (this.isLoopLine(trimmed) || blockStack.some((entry) => entry.type === 'loop')) {
            return 'loop';
        }
        if (this.isIfLine(trimmed) || this.isInsideIf(indent, ifStack)) {
            return 'if';
        }
        if (blockStack.some((entry) => entry.type === 'switch')) {
            return 'switch';
        }
        return null;
    }
    isInsideType(blockStack) {
        return blockStack.some((entry) => entry.type === 'type');
    }
    isTernaryLine(line) {
        const questionIndex = line.indexOf('?');
        if (questionIndex === -1) {
            return false;
        }
        const colonIndex = line.indexOf(':', questionIndex + 1);
        return colonIndex !== -1;
    }
    isIfLine(trimmed) {
        return /^if\b/.test(trimmed);
    }
    isLoopLine(trimmed) {
        return /^(for|while)\b/.test(trimmed);
    }
    isInsideIf(indent, ifStack) {
        for (let idx = ifStack.length - 1; idx >= 0; idx--) {
            const ctx = ifStack[idx];
            const elseIndent = ctx.elseIndent ?? ctx.indent;
            if (ctx.inElse && indent > elseIndent) {
                return true;
            }
            if (indent > ctx.indent) {
                return true;
            }
        }
        return false;
    }
    finalizeTextIfContext(ctx, endLine) {
        const finalLine = Math.max(ctx.lastLine, endLine);
        for (const [variableName, info] of ctx.consequent) {
            const alternateInfo = ctx.alternate.get(variableName);
            if (info.hasHistorical && alternateInfo?.hasNa) {
                const alreadyRecorded = this.seriesInconsistencies.some((existing) => existing.variableName === variableName && existing.line === finalLine);
                if (!alreadyRecorded) {
                    this.seriesInconsistencies.push({
                        variableName,
                        line: finalLine,
                        inconsistencyType: 'conditional_assignment',
                    });
                }
                this.addWarning(finalLine, 1, 'Series may have inconsistent historical data due to conditional assignment', 'PSV6-LAZY-EVAL-SERIES-INCONSISTENCY');
                this.removeConditionalWarningsInRange(ctx.startLine, finalLine);
            }
        }
    }
    getExpressionQualifiedName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            if (member.computed) {
                return null;
            }
            const objectName = this.getExpressionQualifiedName(member.object);
            if (!objectName) {
                return member.property.name;
            }
            return `${objectName}.${member.property.name}`;
        }
        return null;
    }
    analyzePerformanceImpact() {
        if (!this.config.enablePerformanceAnalysis)
            return;
        // Check for expensive historical functions in conditionals
        const expensiveCalls = this.conditionalHistoricalCalls.filter(call => call.isExpensive && !call.functionName.startsWith('request.'));
        for (const call of expensiveCalls) {
            this.addWarning(call.line, call.column, `Expensive historical calculation in conditional may impact performance`, 'PSV6-LAZY-EVAL-PERFORMANCE');
        }
        // Warn about many conditional historical calculations
        if (this.conditionalHistoricalCount >= 4) {
            this.addWarning(1, 1, `Multiple conditional historical calculations detected (${this.conditionalHistoricalCount}). Consider pre-calculating values.`, 'PSV6-LAZY-EVAL-MANY-CONDITIONALS');
        }
    }
    provideBestPracticesSuggestions() {
        if (!this.config.enablePerformanceAnalysis)
            return;
        // Suggest pre-calculation for ternary expressions with historical functions
        const ternaryHistoricalCalls = this.conditionalHistoricalCalls.filter(call => call.context === 'ternary');
        const hasNestedTernary = this.hasNestedTernaryHistoricalCall;
        // If nested ternary or multiple historical calls in ternary, prefer pattern suggestion over precalc
        if (hasNestedTernary) {
            if (ternaryHistoricalCalls.length > 0) {
                this.addInfo(ternaryHistoricalCalls[0].line, ternaryHistoricalCalls[0].column, 'Consider using consistent calculation pattern or pre-calculating all variants to avoid lazy evaluation issues', 'PSV6-LAZY-EVAL-PATTERN-SUGGESTION');
            }
        }
        else if (ternaryHistoricalCalls.length > 0) {
            this.addInfo(ternaryHistoricalCalls[0].line, ternaryHistoricalCalls[0].column, 'Consider pre-calculating historical values outside conditional expressions to ensure series consistency', 'PSV6-LAZY-EVAL-PRECALC-SUGGESTION');
        }
        // Suggest var declarations for consistent series
        const conditionalCalls = this.conditionalHistoricalCalls.filter(call => call.context === 'if');
        if (conditionalCalls.length > 0) {
            this.addInfo(conditionalCalls[0].line, conditionalCalls[0].column, 'Consider using var declaration for consistent series initialization across all bars', 'PSV6-LAZY-EVAL-VAR-SUGGESTION');
        }
        // Suggest pattern improvements for complex conditionals
        const switchCalls = this.conditionalHistoricalCalls.filter(call => call.context === 'switch');
        if (switchCalls.length >= 2) {
            this.addInfo(switchCalls[0].line, switchCalls[0].column, 'Consider using consistent calculation pattern or pre-calculating all variants to avoid lazy evaluation issues', 'PSV6-LAZY-EVAL-PATTERN-SUGGESTION');
        }
    }
    addError(line, column, message, code) {
        this.errors.push({
            line,
            column,
            message,
            severity: 'error',
            code
        });
    }
    addWarning(line, column, message, code) {
        this.warnings.push({
            line,
            column,
            message,
            severity: 'warning',
            code
        });
    }
    addInfo(line, column, message, code) {
        this.info.push({
            line,
            column,
            message,
            severity: 'info',
            code
        });
    }
    // Getter methods for other modules
    getConditionalHistoricalCalls() {
        return [...this.conditionalHistoricalCalls];
    }
    getSeriesInconsistencies() {
        return [...this.seriesInconsistencies];
    }
    getUserFunctionsWithHistorical() {
        return new Set(this.userFunctionsWithHistorical);
    }
    getConditionalHistoricalCount() {
        return this.conditionalHistoricalCount;
    }
}
