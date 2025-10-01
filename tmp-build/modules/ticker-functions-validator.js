/**
 * Ticker Functions Validator for Pine Script v6
 * Covers specialized ticker.* constructors/modifiers and inheritance chains
 */
import { visit } from '../core/ast/traversal';
import { getNodeSource as extractNodeSource } from '../core/ast/source-utils';
export class TickerFunctionsValidator {
    constructor() {
        this.name = 'TickerFunctionsValidator';
        this.priority = 66;
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    getDependencies() {
        return ['CoreValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.astContext = this.getAstContext(config);
        const ast = this.astContext?.ast;
        if (!ast) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                info: [],
                typeMap: new Map(),
                scriptType: context.scriptType,
            };
        }
        this.collectTickerCallDataAst(ast);
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: context.scriptType,
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
    }
    collectTickerCallDataAst(program) {
        visit(program, {
            CallExpression: {
                enter: (path) => {
                    this.processAstTickerCall(path);
                },
            },
        });
    }
    processAstTickerCall(path) {
        const call = path.node;
        const qualifiedName = this.getExpressionQualifiedName(call.callee);
        if (!qualifiedName || !qualifiedName.startsWith('ticker.')) {
            return;
        }
        const line = call.loc.start.line;
        const column = call.loc.start.column;
        switch (qualifiedName) {
            case 'ticker.modify':
                this.handleTickerModifyAst(call, line, column);
                break;
            case 'ticker.renko':
                this.handleTickerRenkoAst(call, line, column);
                break;
            case 'ticker.pointfigure':
                this.handleTickerPointFigureAst(call, line, column);
                break;
            case 'ticker.kagi':
                this.handleTickerKagiAst(call, line, column);
                break;
            case 'ticker.heikinashi':
                this.info.push({
                    code: 'PSV6-TICKER-HEIKIN',
                    message: 'Detected ticker.heikinashi transform',
                    line,
                    column,
                    severity: 'info',
                });
                break;
            case 'ticker.inherit':
                this.info.push({
                    code: 'PSV6-TICKER-INHERIT',
                    message: 'Detected ticker.inherit usage',
                    line,
                    column,
                    severity: 'info',
                });
                break;
            case 'ticker.new':
                this.info.push({
                    code: 'PSV6-TICKER-NEW',
                    message: 'Detected ticker.new usage',
                    line,
                    column,
                    severity: 'info',
                });
                break;
            default:
                break;
        }
    }
    handleTickerModifyAst(call, line, column) {
        this.info.push({
            code: 'PSV6-TICKER-MODIFY',
            message: 'Detected ticker.modify usage',
            line,
            column,
            severity: 'info',
        });
        const allowedNamed = new Set(['session', 'adjustment', 'backadjustment', 'settlement_as_close']);
        const namedArgs = this.extractNamedArguments(call.args);
        for (const [name, argument] of namedArgs) {
            if (!allowedNamed.has(name)) {
                this.errors.push({
                    code: 'PSV6-TICKER-MODIFY-UNKNOWN-PARAM',
                    message: `Unknown parameter '${name}' in ticker.modify`,
                    line,
                    column: this.getArgumentColumn(argument),
                    severity: 'error',
                });
            }
        }
        const settlementArg = namedArgs.get('settlement_as_close');
        if (settlementArg) {
            this.info.push({
                code: 'PSV6-TICKER-SETTLEMENT',
                message: 'Detected settlement_as_close parameter in ticker.modify',
                line,
                column: this.getArgumentColumn(settlementArg),
                severity: 'info',
            });
            const value = this.getArgumentValueText(settlementArg);
            if (!/\bsettlement_as_close\.(?:on|off|inherit)\b/.test(value)) {
                this.errors.push({
                    code: 'PSV6-TICKER-SETTLEMENT-VALUE',
                    message: `Invalid settlement_as_close value: ${value}`,
                    line,
                    column: this.getArgumentColumn(settlementArg),
                    severity: 'error',
                });
            }
        }
        const adjustmentArg = namedArgs.get('adjustment');
        if (adjustmentArg) {
            const value = this.getArgumentValueText(adjustmentArg);
            if (!/\badjustment\.(?:dividends|splits|none)\b/.test(value)) {
                this.errors.push({
                    code: 'PSV6-TICKER-ADJ-VALUE',
                    message: `Invalid adjustment value: ${value}`,
                    line,
                    column: this.getArgumentColumn(adjustmentArg),
                    severity: 'error',
                });
            }
        }
        const backAdjustmentArg = namedArgs.get('backadjustment');
        if (backAdjustmentArg) {
            const value = this.getArgumentValueText(backAdjustmentArg);
            if (!/\bbackadjustment\.(?:inherit|on|off)\b/.test(value)) {
                this.errors.push({
                    code: 'PSV6-TICKER-BACKADJ-VALUE',
                    message: `Invalid backadjustment value: ${value}`,
                    line,
                    column: this.getArgumentColumn(backAdjustmentArg),
                    severity: 'error',
                });
            }
        }
        const sessionArg = namedArgs.get('session');
        if (sessionArg) {
            const value = this.getArgumentValueText(sessionArg);
            if (!/\bsession\.(?:extended|regular)\b/.test(value)) {
                this.errors.push({
                    code: 'PSV6-TICKER-SESSION-VALUE',
                    message: `Invalid session value: ${value}`,
                    line,
                    column: this.getArgumentColumn(sessionArg),
                    severity: 'error',
                });
            }
        }
    }
    handleTickerRenkoAst(call, line, column) {
        this.info.push({
            code: 'PSV6-TICKER-RENKO',
            message: 'Detected ticker.renko specialized constructor',
            line,
            column,
            severity: 'info',
        });
        const { positional, named } = this.partitionArguments(call.args);
        if (positional.length >= 2) {
            const sizeType = this.getArgumentValueText(positional[1]);
            if (!/^"ATR"$/i.test(sizeType)) {
                this.errors.push({
                    code: 'PSV6-TICKER-RENKO-SIZETYPE',
                    message: `Unexpected renko size type: ${sizeType}. Expected "ATR"`,
                    line,
                    column: this.getArgumentColumn(positional[1]),
                    severity: 'error',
                });
            }
        }
        if (positional.length >= 3) {
            const sizeValue = this.getArgumentValueText(positional[2]);
            if (!/^\d+(?:\.\d+)?$/.test(sizeValue)) {
                this.errors.push({
                    code: 'PSV6-TICKER-RENKO-SIZE-TYPE',
                    message: `Renko size must be numeric literal, got: ${sizeValue}`,
                    line,
                    column: this.getArgumentColumn(positional[2]),
                    severity: 'error',
                });
            }
        }
        const requestWicks = named.get('request_wicks');
        if (requestWicks) {
            const value = this.getArgumentValueText(requestWicks);
            if (!/^(true|false)$/.test(value)) {
                this.errors.push({
                    code: 'PSV6-TICKER-RENKO-WICKS-TYPE',
                    message: `request_wicks must be bool literal, got: ${value}`,
                    line,
                    column: this.getArgumentColumn(requestWicks),
                    severity: 'error',
                });
            }
        }
        const sourceArg = named.get('source');
        if (sourceArg) {
            const value = this.getArgumentValueText(sourceArg);
            if (!/^"OHLC"$/.test(value)) {
                this.errors.push({
                    code: 'PSV6-TICKER-RENKO-SOURCE',
                    message: `source must be "OHLC" for advanced renko, got: ${value}`,
                    line,
                    column: this.getArgumentColumn(sourceArg),
                    severity: 'error',
                });
            }
        }
    }
    handleTickerPointFigureAst(call, line, column) {
        this.info.push({
            code: 'PSV6-TICKER-PNF',
            message: 'Detected ticker.pointfigure specialized constructor',
            line,
            column,
            severity: 'info',
        });
        const { positional } = this.partitionArguments(call.args);
        if (positional.length >= 2) {
            const source = this.getArgumentValueText(positional[1]);
            if (!/^"hl"$/i.test(source)) {
                this.errors.push({
                    code: 'PSV6-TICKER-PNF-SOURCE',
                    message: `pointfigure source should be "hl", got: ${source}`,
                    line,
                    column: this.getArgumentColumn(positional[1]),
                    severity: 'error',
                });
            }
        }
        if (positional.length >= 3) {
            const sizeType = this.getArgumentValueText(positional[2]);
            if (!/^"PercentageLTP"$/i.test(sizeType)) {
                this.errors.push({
                    code: 'PSV6-TICKER-PNF-SIZE-TYPE',
                    message: `pointfigure sizing type should be "PercentageLTP", got: ${sizeType}`,
                    line,
                    column: this.getArgumentColumn(positional[2]),
                    severity: 'error',
                });
            }
        }
        if (positional.length >= 4) {
            const boxSize = this.getArgumentValueText(positional[3]);
            if (!/^\d+(?:\.\d+)?$/.test(boxSize)) {
                this.errors.push({
                    code: 'PSV6-TICKER-PNF-BOXSIZE',
                    message: `pointfigure box size must be numeric literal, got: ${boxSize}`,
                    line,
                    column: this.getArgumentColumn(positional[3]),
                    severity: 'error',
                });
            }
        }
        if (positional.length >= 5) {
            const reversal = this.getArgumentValueText(positional[4]);
            if (!/^\d+$/.test(reversal)) {
                this.errors.push({
                    code: 'PSV6-TICKER-PNF-REVERSAL-TYPE',
                    message: `pointfigure reversal must be integer literal, got: ${reversal}`,
                    line,
                    column: this.getArgumentColumn(positional[4]),
                    severity: 'error',
                });
            }
        }
    }
    handleTickerKagiAst(call, line, column) {
        this.info.push({
            code: 'PSV6-TICKER-KAGI',
            message: 'Detected ticker.kagi specialized constructor',
            line,
            column,
            severity: 'info',
        });
        const namedArgs = this.extractNamedArguments(call.args);
        const paramArg = namedArgs.get('param');
        if (paramArg) {
            const value = this.getArgumentValueText(paramArg);
            if (!/^\d+(?:\.\d+)?$/.test(value)) {
                this.errors.push({
                    code: 'PSV6-TICKER-KAGI-PARAM-TYPE',
                    message: `kagi param must be numeric literal, got: ${value}`,
                    line,
                    column: this.getArgumentColumn(paramArg),
                    severity: 'error',
                });
            }
        }
        const styleArg = namedArgs.get('style');
        if (styleArg) {
            const value = this.getArgumentValueText(styleArg);
            if (!/^"ATR"$/i.test(value)) {
                this.errors.push({
                    code: 'PSV6-TICKER-KAGI-STYLE',
                    message: `kagi style must be "ATR" for advanced usage, got: ${value}`,
                    line,
                    column: this.getArgumentColumn(styleArg),
                    severity: 'error',
                });
            }
        }
    }
    partitionArguments(args) {
        const positional = [];
        const named = new Map();
        for (const argument of args) {
            if (argument.name) {
                named.set(argument.name.name, argument);
            }
            else {
                positional.push(argument);
            }
        }
        return { positional, named };
    }
    extractNamedArguments(args) {
        return this.partitionArguments(args).named;
    }
    getArgumentValueText(argument) {
        return this.getExpressionText(argument.value);
    }
    getArgumentColumn(argument) {
        if (argument.name) {
            return argument.name.loc.start.column;
        }
        return argument.value.loc.start.column;
    }
    getExpressionText(expression) {
        switch (expression.kind) {
            case 'StringLiteral':
                return expression.raw;
            case 'NumberLiteral':
                return expression.raw;
            case 'BooleanLiteral':
                return expression.value ? 'true' : 'false';
            case 'Identifier':
                return expression.name;
            case 'MemberExpression': {
                const member = expression;
                if (member.computed) {
                    return extractNodeSource(this.context, member);
                }
                const objectText = this.getExpressionText(member.object);
                return `${objectText}.${member.property.name}`;
            }
            case 'CallExpression':
                return extractNodeSource(this.context, expression);
            default:
                return extractNodeSource(this.context, expression);
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
                return null;
            }
            return `${objectName}.${member.property.name}`;
        }
        return null;
    }
    getAstContext(config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return isAstValidationContext(this.context) ? this.context : null;
    }
}
function isAstValidationContext(context) {
    return context.ast !== undefined;
}
