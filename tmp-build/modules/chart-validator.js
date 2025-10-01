/**
 * Chart Validator Module
 *
 * Handles validation for Pine Script v6 chart.* functions:
 * - PSV6-CHART-POINT-PARAM: Chart point parameter validation
 * - PSV6-CHART-POINT-TYPE: Chart point type compatibility
 * - PSV6-CHART-PERFORMANCE: Chart point performance warnings
 */
import { visit } from '../core/ast/traversal';
import { ensureAstContext } from '../core/ast/context-utils';
// chart.point.* function specifications
const CHART_POINT_FUNCTIONS = new Map([
    ['chart.point.new', { minParams: 2, maxParams: 2, description: 'Creates a chart point with time and price' }],
    ['chart.point.now', { minParams: 1, maxParams: 1, description: 'Creates a chart point at current time' }],
    ['chart.point.from_index', { minParams: 2, maxParams: 2, description: 'Creates a chart point from bar index' }],
    ['chart.point.from_time', { minParams: 2, maxParams: 2, description: 'Creates a chart point from timestamp' }],
]);
const CHART_POINT_PROPERTIES = new Set(['time', 'index', 'price']);
export class ChartValidator {
    constructor() {
        this.name = 'ChartValidator';
        this.priority = 70;
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.context = null;
        this.chartPointCalls = [];
        this.chartPointCreationsPerBar = 0;
    }
    debug(payload) {
        if (process.env.DEBUG_CHART === '1') {
            console.log('[ChartValidator]', payload);
        }
    }
    getDependencies() {
        return ['CoreValidator', 'TypeInferenceValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.astContext = ensureAstContext(context, config);
        const program = this.astContext?.ast ?? null;
        if (!program) {
            return this.buildResult();
        }
        this.validateWithAst(program);
        return this.buildResult();
    }
    validateWithAst(program) {
        this.collectChartData(program);
        this.validateChartPointCalls();
        this.validateChartPerformance();
    }
    collectChartData(program) {
        visit(program, {
            CallExpression: {
                enter: (path) => {
                    this.handleChartCall(path);
                },
            },
        });
    }
    handleChartCall(path) {
        const node = path.node;
        const qualifiedName = this.getExpressionQualifiedName(node.callee);
        if (!qualifiedName) {
            return;
        }
        // Detect chart.point.* function calls
        if (CHART_POINT_FUNCTIONS.has(qualifiedName)) {
            this.chartPointCalls.push({
                node,
                functionName: qualifiedName,
                paramCount: node.args.length,
            });
            this.chartPointCreationsPerBar++;
        }
    }
    validateChartPointCalls() {
        for (const call of this.chartPointCalls) {
            const spec = CHART_POINT_FUNCTIONS.get(call.functionName);
            if (!spec) {
                continue;
            }
            // Validate parameter count
            if (call.paramCount < spec.minParams) {
                this.addError(call.node.loc.start.line, call.node.loc.start.column, `${call.functionName}() requires at least ${spec.minParams} parameter(s), got ${call.paramCount}`, 'PSV6-CHART-POINT-PARAM', spec.description);
            }
            else if (call.paramCount > spec.maxParams) {
                this.addError(call.node.loc.start.line, call.node.loc.start.column, `${call.functionName}() accepts at most ${spec.maxParams} parameter(s), got ${call.paramCount}`, 'PSV6-CHART-POINT-PARAM', spec.description);
            }
            // Validate that price parameter is numeric (second parameter for most functions)
            if (call.paramCount >= 1) {
                const priceParam = call.functionName === 'chart.point.now'
                    ? call.node.args[0]?.value
                    : call.node.args[1]?.value;
                if (priceParam && this.isStringLiteral(priceParam)) {
                    this.addError(priceParam.loc.start.line, priceParam.loc.start.column, `Price parameter for ${call.functionName}() must be numeric, not string`, 'PSV6-CHART-POINT-TYPE');
                }
            }
        }
    }
    validateChartPerformance() {
        // Warn if creating chart points on every bar (potential performance issue)
        if (this.chartPointCreationsPerBar > 0) {
            const firstCall = this.chartPointCalls[0];
            if (firstCall) {
                this.addWarning(firstCall.node.loc.start.line, firstCall.node.loc.start.column, 'Creating chart points on every bar may hit drawing limits (500 per script)', 'PSV6-CHART-PERFORMANCE', 'Consider creating chart points conditionally or with size limits');
            }
        }
    }
    isStringLiteral(expression) {
        return expression.kind === 'StringLiteral';
    }
    getExpressionQualifiedName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            const objectName = this.getExpressionQualifiedName(member.object);
            if (!objectName) {
                return null;
            }
            return `${objectName}.${member.property.name}`;
        }
        return null;
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.context = null;
        this.chartPointCalls = [];
        this.chartPointCreationsPerBar = 0;
    }
    addError(line, column, message, code, suggestion) {
        this.errors.push({ line, column, message, severity: 'error', code, suggestion });
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    addInfo(line, column, message, code, suggestion) {
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
    }
    buildResult() {
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: null,
        };
    }
}
