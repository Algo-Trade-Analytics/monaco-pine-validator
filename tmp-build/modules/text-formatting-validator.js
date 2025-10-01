/**
 * Text Formatting validation module for Pine Script v6
 * Handles validation of text formatting functions, format strings, and performance analysis
 */
import { findAncestor, visit } from '../core/ast/traversal';
import { getNodeSource as extractNodeSource } from '../core/ast/source-utils';
export class TextFormattingValidator {
    constructor() {
        this.name = 'TextFormattingValidator';
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.formatCalls = [];
    }
    getDependencies() {
        return ['SyntaxValidator', 'FunctionValidator'];
    }
    validate(context, config) {
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
                scriptType: null
            };
        }
        this.validateTextFormattingAst(this.astContext.ast);
        this.validateTextFormattingPerformance();
        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            typeMap: new Map(),
            scriptType: null
        };
    }
    reset() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        this.formatCalls = [];
    }
    addError(line, column, message, code) {
        this.errors.push({
            line,
            column,
            message,
            code,
            severity: 'error'
        });
    }
    addWarning(line, column, message, code) {
        this.warnings.push({
            line,
            column,
            message,
            code,
            severity: 'warning'
        });
    }
    addInfo(line, column, message, code) {
        this.info.push({
            line,
            column,
            message,
            code,
            severity: 'info'
        });
    }
    validateFormatString(formatString, parameters, lineNum) {
        // Validate format string syntax first
        this.validateFormatStringSyntax(formatString, lineNum);
        // Extract format placeholders: {0}, {1}, etc.
        const placeholderRegex = /\{(\d+)(?:,([^}]+))?\}/g;
        const placeholders = [];
        let match;
        while ((match = placeholderRegex.exec(formatString)) !== null) {
            const index = parseInt(match[1]);
            const format = match[2];
            placeholders.push({ index, format });
        }
        // Count parameters
        const parameterList = Array.isArray(parameters) ? parameters : this.parseParameterList(parameters);
        const paramCount = parameterList.length;
        // Validate parameter count match
        this.validateParameterCount(placeholders, paramCount, lineNum);
        // Validate format types
        this.validateFormatTypes(placeholders, parameterList, lineNum);
    }
    validateFormatStringSyntax(formatString, lineNum) {
        // Check for unclosed braces
        const openBraces = (formatString.match(/\{/g) || []).length;
        const closeBraces = (formatString.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
            this.addError(lineNum, 1, `Invalid format string: unclosed braces in "${formatString}"`, 'PSV6-TEXT-INVALID-FORMAT');
            return;
        }
        // Check for invalid placeholder syntax
        const invalidPlaceholderRegex = /\{[^}]*$/;
        if (invalidPlaceholderRegex.test(formatString)) {
            this.addError(lineNum, 1, `Invalid format string: unclosed placeholder in "${formatString}"`, 'PSV6-TEXT-INVALID-FORMAT');
        }
    }
    validateParameterCount(placeholders, paramCount, lineNum) {
        // Find the highest placeholder index
        const maxIndex = Math.max(...placeholders.map(p => p.index));
        if (maxIndex >= paramCount) {
            this.addError(lineNum, 1, `Format parameter mismatch: format string expects ${maxIndex + 1} parameters but only ${paramCount} provided`, 'PSV6-TEXT-PARAM-MISMATCH');
        }
    }
    validateFormatTypes(placeholders, parameters, lineNum) {
        const paramList = Array.isArray(parameters) ? parameters : this.parseParameterList(parameters);
        for (const placeholder of placeholders) {
            if (placeholder.format) {
                const paramIndex = placeholder.index;
                if (paramIndex < paramList.length) {
                    const param = paramList[paramIndex].trim();
                    this.validateFormatType(placeholder.format, param, lineNum);
                }
            }
        }
    }
    validateFormatType(format, parameter, lineNum) {
        // Check for numeric format
        if (format.startsWith('number,')) {
            const numericFormat = format.substring(7);
            this.validateNumericFormat(numericFormat, parameter, lineNum);
        }
        // Check for date format
        if (format.startsWith('date,')) {
            const dateFormat = format.substring(5);
            this.validateDateFormat(dateFormat, parameter, lineNum);
        }
        // Check for time format
        if (format.startsWith('time,')) {
            const timeFormat = format.substring(5);
            this.validateTimeFormat(timeFormat, parameter, lineNum);
        }
    }
    validateNumericFormat(format, parameter, lineNum) {
        // Check for valid numeric format patterns
        const validNumericPatterns = [
            /^#+$/, // #, ##, ###
            /^#+\.#+$/, // #.##, ##.##
            /^#+,#+$/, // #,###, ##,###
            /^#+,#+\.#+$/, // #,###.##
            /^#+%$/, // #%, ##%
            /^#+\.#+%$/ // #.##%, ##.##%
        ];
        const isValidFormat = validNumericPatterns.some(pattern => pattern.test(format));
        if (!isValidFormat) {
            this.addWarning(lineNum, 1, `Invalid numeric format: "${format}". Use patterns like #, ##, #.##, #,###, or #%`, 'PSV6-TEXT-INVALID-NUMERIC-FORMAT');
        }
        // Check if parameter is numeric
        if (!this.isNumericParameter(parameter)) {
            this.addWarning(lineNum, 1, `Non-numeric parameter "${parameter}" used with numeric format`, 'PSV6-TEXT-NON-NUMERIC-FORMAT');
        }
    }
    validateDateFormat(format, parameter, lineNum) {
        // Check for valid date format patterns
        const validDatePatterns = [
            /^dd\/MM\/yyyy$/, // dd/MM/yyyy
            /^MM\/dd\/yyyy$/, // MM/dd/yyyy
            /^yyyy-MM-dd$/, // yyyy-MM-dd
            /^dd-MM-yyyy$/, // dd-MM-yyyy
            /^dd\.MM\.yyyy$/, // dd.MM.yyyy
            /^yyyy\/MM\/dd$/ // yyyy/MM/dd
        ];
        const isValidFormat = validDatePatterns.some(pattern => pattern.test(format));
        if (!isValidFormat) {
            this.addWarning(lineNum, 1, `Invalid date format: "${format}". Use patterns like dd/MM/yyyy, MM/dd/yyyy, or yyyy-MM-dd`, 'PSV6-TEXT-INVALID-DATE-FORMAT');
        }
        // Check if parameter is date-related
        if (!this.isDateParameter(parameter)) {
            this.addWarning(lineNum, 1, `Non-date parameter "${parameter}" used with date format`, 'PSV6-TEXT-NON-DATE-FORMAT');
        }
    }
    validateTimeFormat(format, parameter, lineNum) {
        // Check for valid time format patterns
        const validTimePatterns = [
            /^HH:mm:ss$/, // HH:mm:ss
            /^HH:mm$/, // HH:mm
            /^h:mm:ss$/, // h:mm:ss
            /^h:mm$/, // h:mm
            /^HH:mm:ss\.SSS$/ // HH:mm:ss.SSS
        ];
        const isValidFormat = validTimePatterns.some(pattern => pattern.test(format));
        if (!isValidFormat) {
            this.addWarning(lineNum, 1, `Invalid time format: "${format}". Use patterns like HH:mm:ss, HH:mm, or h:mm:ss`, 'PSV6-TEXT-INVALID-TIME-FORMAT');
        }
        // Check if parameter is time-related
        if (!this.isTimeParameter(parameter)) {
            this.addWarning(lineNum, 1, `Non-time parameter "${parameter}" used with time format`, 'PSV6-TEXT-NON-TIME-FORMAT');
        }
    }
    parseParameterList(parameters) {
        const result = [];
        let current = '';
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        for (let i = 0; i < parameters.length; i++) {
            const char = parameters[i];
            if (escapeNext) {
                current += char;
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                current += char;
                continue;
            }
            if (char === '"' && !inString) {
                inString = true;
                current += char;
                continue;
            }
            if (char === '"' && inString) {
                inString = false;
                current += char;
                continue;
            }
            if (char === '(' && !inString) {
                depth++;
                current += char;
                continue;
            }
            if (char === ')' && !inString) {
                depth--;
                current += char;
                continue;
            }
            if (char === ',' && depth === 0 && !inString) {
                result.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        if (current.trim()) {
            result.push(current.trim());
        }
        return result;
    }
    isNumericParameter(parameter) {
        if (parameter.match(/^\d+\.?\d*$/)) {
            return true;
        }
        const numericVariables = ['close', 'open', 'high', 'low', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'];
        if (numericVariables.includes(parameter)) {
            return true;
        }
        if (parameter.includes('+') || parameter.includes('-') || parameter.includes('*') || parameter.includes('/')) {
            return true;
        }
        return false;
    }
    isDateParameter(parameter) {
        const dateVariables = ['time', 'bar_index'];
        if (dateVariables.includes(parameter)) {
            return true;
        }
        if (parameter.includes('time(') || parameter.includes('timestamp(')) {
            return true;
        }
        return false;
    }
    isTimeParameter(parameter) {
        const timeVariables = ['time'];
        if (timeVariables.includes(parameter)) {
            return true;
        }
        if (parameter.includes('time(') || parameter.includes('timestamp(')) {
            return true;
        }
        return false;
    }
    validateTextFormattingAst(program) {
        visit(program, {
            CallExpression: {
                enter: (path) => this.processAstFormatCall(path),
            },
        });
    }
    processAstFormatCall(path) {
        const call = path.node;
        const qualifiedName = this.getExpressionQualifiedName(call.callee);
        if (qualifiedName !== 'str.format') {
            return;
        }
        const [formatArgument, ...rest] = call.args;
        if (!formatArgument) {
            return;
        }
        const { line, column } = call.loc.start;
        const parameterStrings = rest.map((argument) => this.argumentToString(argument));
        let formatString = null;
        if (formatArgument.value.kind === 'StringLiteral') {
            formatString = formatArgument.value.value;
        }
        if (formatString !== null) {
            this.validateFormatString(formatString, parameterStrings, line);
        }
        const loopAncestor = findAncestor(path, (ancestor) => ancestor.node.kind === 'ForStatement' || ancestor.node.kind === 'WhileStatement');
        const placeholderCount = formatString ? (formatString.match(/\{\d+/g) || []).length : 0;
        this.formatCalls.push({
            line,
            column,
            placeholderCount,
            parameterCount: parameterStrings.length,
            loopLine: loopAncestor?.node.loc.start.line ?? null,
        });
    }
    validateTextFormattingPerformance() {
        this.validateTextFormattingInLoopsAst();
        this.validateComplexTextFormattingAst();
    }
    validateTextFormattingInLoopsAst() {
        for (const call of this.formatCalls) {
            if (call.loopLine === null) {
                continue;
            }
            this.addWarning(call.line, call.column, `Text formatting in loop (line ${call.loopLine}). Consider caching formatted text outside the loop for better performance`, 'PSV6-TEXT-PERF-LOOP');
        }
    }
    validateComplexTextFormattingAst() {
        for (const call of this.formatCalls) {
            if (call.placeholderCount >= 3 || call.parameterCount >= 3) {
                this.addWarning(call.line, call.column, `Complex text formatting with ${call.placeholderCount} placeholders and ${call.parameterCount} parameters. Consider breaking into simpler expressions`, 'PSV6-TEXT-PERF-COMPLEX');
            }
        }
    }
    argumentToString(argument) {
        const valueText = extractNodeSource(this.context, argument.value).trim();
        if (argument.name) {
            return `${argument.name.name}=${valueText}`;
        }
        return valueText;
    }
    getNodeSource(node) {
        return extractNodeSource(this.context, node);
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
        if (!('ast' in this.context)) {
            return null;
        }
        const astContext = this.context;
        return astContext.ast ? astContext : null;
    }
}
