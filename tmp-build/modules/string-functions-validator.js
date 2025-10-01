/**
 * String Functions Validator
 *
 * Validates Pine Script v6 String functions and operations:
 * - String function parameter validation
 * - String formatting validation (str.format, str.format_time)
 * - String search validation (str.contains, str.startswith, str.endswith, str.pos, str.match)
 * - String manipulation validation (str.substring, str.replace, str.split, str.upper, str.lower, str.trim, str.repeat)
 * - String conversion validation (str.tostring, str.tonumber)
 * - String performance analysis
 * - String best practices suggestions
 *
 * Priority 1.2: CRITICAL GAPS - String Functions (20% Coverage)
 */
import { visit } from '../core/ast/traversal';
import { getNodeSource } from '../core/ast/source-utils';
export class StringFunctionsValidator {
    constructor() {
        this.name = 'StringFunctionsValidator';
        this.priority = 85; // High priority - string functions are essential for Pine Script
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        // String function tracking
        this.stringFunctionCalls = [];
        this.stringOperations = new Map();
        this.astConcatenationCounts = new Map();
    }
    getDependencies() {
        return ['TypeValidator', 'FunctionValidator'];
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
        this.collectStringDataAst(this.astContext.ast);
        this.validateStringPerformanceAst();
        this.validateStringBestPractices();
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
        this.stringFunctionCalls = [];
        this.stringOperations.clear();
        this.astConcatenationCounts = new Map();
    }
    addError(line, column, message, code, suggestion) {
        // Only generate errors for clearly invalid cases; others as warnings
        if (this.isClearlyInvalid(message, code)) {
            this.errors.push({ line, column, message, severity: 'error', code, suggestion });
        }
        else {
            this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
        }
    }
    addWarning(line, column, message, code, suggestion) {
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    addInfo(line, column, message, code, suggestion) {
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
    }
    collectStringDataAst(program) {
        const loopStack = [];
        this.astConcatenationCounts = new Map();
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
            CallExpression: {
                enter: (path) => {
                    this.processAstStringCall(path, loopStack.length > 0);
                },
            },
            BinaryExpression: {
                enter: (path) => {
                    this.processAstBinaryExpression(path.node);
                },
            },
        });
    }
    collectStringDataFromText() {
        // Text parsing disabled; rely on Chevrotain AST.
    }
    extractArgumentsSection(lines, startLine, startColumn) {
        let buffer = '';
        let depth = 1;
        let lineIndex = startLine;
        let columnIndex = startColumn;
        let inString = false;
        let stringDelimiter = null;
        while (lineIndex < lines.length && depth > 0) {
            const line = (lines[lineIndex] ?? '').replace(/\/\/.*$/, '');
            for (let i = columnIndex; i < line.length; i++) {
                const char = line[i];
                if (inString) {
                    buffer += char;
                    if (char === stringDelimiter && line[i - 1] !== '\\') {
                        inString = false;
                        stringDelimiter = null;
                    }
                    continue;
                }
                if (char === '"' || char === "'") {
                    inString = true;
                    stringDelimiter = char;
                    buffer += char;
                    continue;
                }
                if (char === '(') {
                    depth += 1;
                    buffer += char;
                    continue;
                }
                if (char === ')') {
                    depth -= 1;
                    if (depth === 0) {
                        return buffer.trim();
                    }
                    buffer += char;
                    continue;
                }
                buffer += char;
            }
            buffer += ' ';
            lineIndex += 1;
            columnIndex = 0;
        }
        return buffer.trim();
    }
    splitArguments(argumentSection) {
        const args = [];
        let current = '';
        let depth = 0;
        let inString = false;
        let stringDelimiter = null;
        for (let i = 0; i < argumentSection.length; i++) {
            const char = argumentSection[i];
            if (inString) {
                current += char;
                if (char === stringDelimiter && argumentSection[i - 1] !== '\\') {
                    inString = false;
                    stringDelimiter = null;
                }
                continue;
            }
            if (char === '"' || char === "'") {
                inString = true;
                stringDelimiter = char;
                current += char;
                continue;
            }
            if (char === '(') {
                depth += 1;
                current += char;
                continue;
            }
            if (char === ')') {
                depth -= 1;
                current += char;
                continue;
            }
            if (char === ',' && depth === 0) {
                if (current.trim().length > 0) {
                    args.push(current.trim());
                }
                current = '';
                continue;
            }
            current += char;
        }
        if (current.trim().length > 0) {
            args.push(current.trim());
        }
        return args;
    }
    countStringConcatenations(line) {
        const withoutComment = (line ?? '').replace(/\/\/.*$/, '');
        if (!withoutComment) {
            return 0;
        }
        const hasStringIndicator = withoutComment.includes('"') || withoutComment.includes("'") || withoutComment.includes('str.');
        if (!hasStringIndicator) {
            return 0;
        }
        const matches = withoutComment.match(/\+/g);
        return matches ? matches.length : 0;
    }
    processAstStringCall(path, inLoop) {
        const node = path.node;
        const qualifiedName = this.getExpressionQualifiedName(node.callee);
        if (!qualifiedName || !qualifiedName.startsWith('str.')) {
            return;
        }
        const functionName = qualifiedName.slice('str.'.length);
        const line = node.loc.start.line;
        const column = node.loc.start.column;
        const argumentStrings = node.args.map((argument) => this.argumentToString(argument));
        const argumentNodes = node.args.map((argument) => argument.value);
        this.stringFunctionCalls.push({
            name: functionName,
            line,
            column,
            arguments: argumentStrings,
            argumentNodes,
            node,
            inLoop,
        });
        this.stringOperations.set(functionName, (this.stringOperations.get(functionName) || 0) + 1);
        this.validateStringFunction(functionName, argumentStrings, line, column, argumentNodes);
    }
    processAstBinaryExpression(node) {
        if (node.operator !== '+') {
            return;
        }
        if (!this.isStringConcatenation(node)) {
            return;
        }
        const line = node.loc.start.line;
        this.astConcatenationCounts.set(line, (this.astConcatenationCounts.get(line) || 0) + 1);
    }
    isClearlyInvalid(message, code) {
        // Only generate errors for clearly invalid cases
        // Parameter type errors are clearly invalid
        if (code === 'PSV6-FUNCTION-PARAM-TYPE') {
            return true;
        }
        // Parameter count errors are clearly invalid
        if (code === 'PSV6-FUNCTION-PARAM-COUNT') {
            return true;
        }
        // Format string errors are clearly invalid
        if (code === 'PSV6-STR-FORMAT-INVALID') {
            return true;
        }
        // Invalid conversion parameters should be errors
        if (code === 'PSV6-STR-CONVERSION-INVALID') {
            return true;
        }
        // For other cases, generate warnings instead of errors
        return false;
    }
    validateStringFunction(functionName, args, lineNum, column, argumentNodes = []) {
        switch (functionName) {
            case 'length':
                this.validateStrLength(args, lineNum, column, argumentNodes);
                break;
            case 'contains':
                this.validateStrContains(args, lineNum, column, argumentNodes);
                break;
            case 'startswith':
                this.validateStrStartswith(args, lineNum, column, argumentNodes);
                break;
            case 'endswith':
                this.validateStrEndswith(args, lineNum, column, argumentNodes);
                break;
            case 'pos':
                this.validateStrPos(args, lineNum, column, argumentNodes);
                break;
            case 'substring':
                this.validateStrSubstring(args, lineNum, column, argumentNodes);
                break;
            case 'replace':
                this.validateStrReplace(args, lineNum, column, argumentNodes);
                break;
            case 'split':
                this.validateStrSplit(args, lineNum, column, argumentNodes);
                break;
            case 'upper':
                this.validateStrUpper(args, lineNum, column, argumentNodes);
                break;
            case 'lower':
                this.validateStrLower(args, lineNum, column, argumentNodes);
                break;
            case 'trim':
                this.validateStrTrim(args, lineNum, column, argumentNodes);
                break;
            case 'repeat':
                this.validateStrRepeat(args, lineNum, column, argumentNodes);
                break;
            case 'tostring':
                this.validateStrTostring(args, lineNum, column, argumentNodes);
                break;
            case 'tonumber':
                this.validateStrTonumber(args, lineNum, column, argumentNodes);
                break;
            case 'format':
                this.validateStrFormat(args, lineNum, column, argumentNodes);
                break;
            case 'format_time':
                this.validateStrFormatTime(args, lineNum, column, argumentNodes);
                break;
            case 'match':
                this.validateStrMatch(args, lineNum, column, argumentNodes);
                break;
            default:
                this.addError(lineNum, column, `Unknown string function: str.${functionName}`, 'PSV6-STR-UNKNOWN-FUNCTION');
        }
    }
    validateStrLength(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'str.length() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate parameter type - str.length requires a string parameter
        const arg = args[0].trim();
        const argNode = argumentNodes[0];
        if (!this.isStringLiteral(arg, argNode) && !this.isStringVariable(arg, argNode)) {
            this.addError(lineNum, column, `str.length() requires a string parameter, got: ${arg}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrContains(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'str.contains() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate parameter types - both parameters should be strings
        const arg1 = args[0].trim();
        const arg2 = args[1].trim();
        const argNode1 = argumentNodes[0];
        const argNode2 = argumentNodes[1];
        if (!this.isStringLiteral(arg1, argNode1) && !this.isStringVariable(arg1, argNode1)) {
            this.addError(lineNum, column, `str.contains() first parameter must be a string, got: ${arg1}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (!this.isStringLiteral(arg2, argNode2) && !this.isStringVariable(arg2, argNode2)) {
            this.addError(lineNum, column, `str.contains() second parameter must be a string, got: ${arg2}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrStartswith(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'str.startswith() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const a = args[0].trim();
        const b = args[1].trim();
        const nodeA = argumentNodes[0];
        const nodeB = argumentNodes[1];
        if (!this.isStringLiteral(a, nodeA) && !this.isStringVariable(a, nodeA)) {
            this.addError(lineNum, column, `str.startswith() first parameter must be a string, got: ${a}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (!this.isStringLiteral(b, nodeB) && !this.isStringVariable(b, nodeB)) {
            this.addError(lineNum, column, `str.startswith() second parameter must be a string, got: ${b}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrEndswith(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'str.endswith() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const a = args[0].trim();
        const b = args[1].trim();
        const nodeA = argumentNodes[0];
        const nodeB = argumentNodes[1];
        if (!this.isStringLiteral(a, nodeA) && !this.isStringVariable(a, nodeA)) {
            this.addError(lineNum, column, `str.endswith() first parameter must be a string, got: ${a}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (!this.isStringLiteral(b, nodeB) && !this.isStringVariable(b, nodeB)) {
            this.addError(lineNum, column, `str.endswith() second parameter must be a string, got: ${b}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrPos(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'str.pos() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate parameter types - both parameters should be strings
        const arg1 = args[0].trim();
        const arg2 = args[1].trim();
        const nodeA = argumentNodes[0];
        const nodeB = argumentNodes[1];
        if (!this.isStringLiteral(arg1, nodeA) && !this.isStringVariable(arg1, nodeA)) {
            this.addError(lineNum, column, `str.pos() first parameter must be a string, got: ${arg1}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (!this.isStringLiteral(arg2, nodeB) && !this.isStringVariable(arg2, nodeB)) {
            this.addError(lineNum, column, `str.pos() second parameter must be a string, got: ${arg2}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrSubstring(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 3) {
            this.addError(lineNum, column, 'str.substring() requires exactly 3 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate start and end indices are integers
        const startIndex = this.extractNumericValue(args[1], argumentNodes[1]);
        const endIndex = this.extractNumericValue(args[2], argumentNodes[2]);
        if (startIndex === null) {
            this.addError(lineNum, column, 'substring start index must be numeric', 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (endIndex === null) {
            this.addError(lineNum, column, 'substring end index must be numeric', 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (startIndex !== null && startIndex < 0) {
            this.addWarning(lineNum, column, 'Start index should not be negative', 'PSV6-STR-SUBSTRING-NEGATIVE-INDEX');
        }
        if (endIndex !== null && startIndex !== null && endIndex < startIndex) {
            this.addWarning(lineNum, column, 'End index should not be less than start index', 'PSV6-STR-SUBSTRING-INVALID-RANGE');
        }
    }
    validateStrReplace(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 3) {
            this.addError(lineNum, column, 'str.replace() requires exactly 3 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const s = args[0].trim();
        const find = args[1].trim();
        const rep = args[2].trim();
        const nodeS = argumentNodes[0];
        const nodeFind = argumentNodes[1];
        const nodeRep = argumentNodes[2];
        if (!this.isStringLiteral(s, nodeS) && !this.isStringVariable(s, nodeS)) {
            this.addError(lineNum, column, `str.replace() first parameter must be a string, got: ${s}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (!this.isStringLiteral(find, nodeFind) && !this.isStringVariable(find, nodeFind)) {
            this.addError(lineNum, column, `str.replace() second parameter must be a string, got: ${find}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (!this.isStringLiteral(rep, nodeRep) && !this.isStringVariable(rep, nodeRep)) {
            this.addError(lineNum, column, `str.replace() third parameter must be a string, got: ${rep}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrSplit(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'str.split() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const s = args[0].trim();
        const delim = args[1].trim();
        const nodeS = argumentNodes[0];
        const nodeDelim = argumentNodes[1];
        if (!this.isStringLiteral(s, nodeS) && !this.isStringVariable(s, nodeS)) {
            this.addError(lineNum, column, `str.split() first parameter must be a string, got: ${s}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
        if (!this.isStringLiteral(delim, nodeDelim) && !this.isStringVariable(delim, nodeDelim)) {
            this.addError(lineNum, column, `str.split() second parameter must be a string, got: ${delim}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrUpper(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'str.upper() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const s = args[0].trim();
        const nodeS = argumentNodes[0];
        if (!this.isStringLiteral(s, nodeS) && !this.isStringVariable(s, nodeS)) {
            this.addError(lineNum, column, `str.upper() parameter must be a string, got: ${s}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrLower(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'str.lower() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const s = args[0].trim();
        const nodeS = argumentNodes[0];
        if (!this.isStringLiteral(s, nodeS) && !this.isStringVariable(s, nodeS)) {
            this.addError(lineNum, column, `str.lower() parameter must be a string, got: ${s}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrTrim(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'str.trim() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const s = args[0].trim();
        const nodeS = argumentNodes[0];
        if (!this.isStringLiteral(s, nodeS) && !this.isStringVariable(s, nodeS)) {
            this.addError(lineNum, column, `str.trim() parameter must be a string, got: ${s}`, 'PSV6-FUNCTION-PARAM-TYPE');
        }
    }
    validateStrRepeat(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'str.repeat() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate count is a positive integer
        const count = this.extractNumericValue(args[1], argumentNodes[1]);
        if (count === null) {
            this.addError(lineNum, column, 'Repeat count must be an integer', 'PSV6-FUNCTION-PARAM-TYPE');
            return;
        }
        if (count !== null && count < 0) {
            this.addWarning(lineNum, column, 'Repeat count should not be negative', 'PSV6-STR-REPEAT-NEGATIVE-COUNT');
        }
        if (count !== null && count > 1000) {
            this.addWarning(lineNum, column, 'Large repeat count may impact performance', 'PSV6-STR-REPEAT-LARGE-COUNT');
        }
    }
    validateStrTostring(args, lineNum, column, argumentNodes = []) {
        if (args.length === 0 || args.length > 2) {
            this.addError(lineNum, column, 'str.tostring() accepts 1 or 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Suggest if converting a string literal directly
        const valueArg = args[0].trim();
        const valueNode = argumentNodes[0];
        if (this.isStringLiteral(valueArg, valueNode)) {
            this.addInfo(lineNum, column, 'Avoid str.tostring() on a string literal', 'PSV6-STR-LITERAL-SUGGESTION');
        }
        // Validate optional format argument when present
        if (args.length === 2) {
            const formatArg = args[1].trim();
            const formatNode = argumentNodes[1];
            const allowedFormats = new Set([
                'format.inherit',
                'format.mintick',
                'format.percent',
                'format.price',
                'format.integer',
                'format.volume'
            ]);
            if (!allowedFormats.has(formatArg) && !this.isStringLiteral(formatArg, formatNode)) {
                this.addWarning(lineNum, column, 'Unrecognised format specifier for str.tostring()', 'PSV6-STR-CONVERSION-INVALID');
            }
        }
    }
    validateStrTonumber(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'str.tonumber() requires exactly 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Check if parameter is already a string literal (suggestion)
        const arg = args[0].trim();
        const node = argumentNodes[0];
        if (node?.kind === 'StringLiteral' && /^(?:\d+(?:\.\d+)?)$/.test(node.value)) {
            this.addInfo(lineNum, column, 'Consider using numeric literal instead of str.tonumber() with string literal', 'PSV6-STR-LITERAL-SUGGESTION');
        }
        // Invalid conversion parameter types
        if (/^[+\-]?\d+(?:\.[0-9]+)?$/.test(arg) || /^(true|false|na)$/.test(arg)) {
            this.addError(lineNum, column, 'Invalid parameter type for str.tonumber(), expected string', 'PSV6-STR-CONVERSION-INVALID');
        }
    }
    validateStrFormat(args, lineNum, column, argumentNodes = []) {
        if (args.length < 1) {
            this.addError(lineNum, column, 'str.format() requires at least 1 parameter', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const formatString = args[0];
        const formatNode = argumentNodes[0];
        // Validate format string
        if (!this.isStringLiteral(formatString, formatNode)) {
            this.addError(lineNum, column, 'Invalid format string (should be a string literal)', 'PSV6-STR-FORMAT-INVALID');
            return;
        }
        // Count format placeholders
        const placeholders = this.countFormatPlaceholders(formatString);
        const expectedArgs = placeholders + 1; // +1 for format string itself
        if (args.length !== expectedArgs) {
            this.addError(lineNum, column, `str.format() expects ${expectedArgs} parameters (${placeholders} format placeholders), got ${args.length}`, 'PSV6-STR-FORMAT-INVALID');
        }
        // Check for invalid format placeholders
        if (this.hasInvalidFormatPlaceholders(formatString)) {
            this.addError(lineNum, column, 'Invalid format string: incomplete or malformed placeholders', 'PSV6-STR-FORMAT-INVALID');
        }
    }
    validateStrFormatTime(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'str.format_time() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate format string
        const formatString = args[1];
        const formatNode = argumentNodes[1];
        if (this.isStringLiteral(formatString, formatNode) && !this.isValidTimeFormat(formatString)) {
            this.addWarning(lineNum, column, 'Invalid or unusual time format string', 'PSV6-STR-FORMAT-TIME-INVALID');
        }
    }
    validateStrMatch(args, lineNum, column, argumentNodes = []) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'str.match() requires exactly 2 parameters', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate regex pattern
        const pattern = args[1];
        const patternNode = argumentNodes[1];
        if (this.isStringLiteral(pattern, patternNode)) {
            try {
                new RegExp(pattern.replace(/^"|"$/g, ''));
            }
            catch (e) {
                this.addError(lineNum, column, 'Invalid regex pattern in str.match()', 'PSV6-STR-MATCH-INVALID-REGEX');
            }
        }
    }
    validateStringPerformanceAst() {
        const expensiveFunctions = new Set(['format', 'split', 'replace', 'match']);
        const countsByLine = new Map();
        for (const call of this.stringFunctionCalls) {
            countsByLine.set(call.line, (countsByLine.get(call.line) || 0) + 1);
            if (call.inLoop) {
                this.addWarning(call.line, call.column, 'String operation in loop', 'PSV6-STR-PERF-LOOP');
            }
            if (expensiveFunctions.has(call.name)) {
                this.addWarning(call.line, call.column, `Expensive str.${call.name}() call`, 'PSV6-STR-PERF-COMPLEX');
            }
        }
        for (const [line, count] of countsByLine) {
            if (count > 1) {
                this.addWarning(line, 1, 'Complex string operations on one line', 'PSV6-STR-PERF-COMPLEX');
            }
        }
        for (const [line, count] of this.astConcatenationCounts) {
            if (count >= 1) {
                this.addInfo(line, 1, 'Consider using str.format() instead of multiple string concatenations', 'PSV6-STR-FORMAT-SUGGESTION');
            }
            if (count >= 2) {
                this.addWarning(line, 1, 'Excessive string concatenation', 'PSV6-STR-PERF-CONCAT');
            }
        }
    }
    validateStringBestPractices() {
        // Detect repeated identical calls across lines
        const counts = new Map();
        for (const call of this.stringFunctionCalls) {
            const key = `${call.name}(${call.arguments.join(',')})`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        for (const [key, cnt] of counts) {
            if (cnt >= 3) {
                const funcName = key.split('(')[0];
                this.addInfo(1, 1, `Multiple similar str.${funcName}() operations detected. Consider caching results.`, 'PSV6-STR-CACHE-SUGGESTION');
            }
        }
    }
    // Helper methods
    isStringConcatenation(node) {
        if (!this.astContext) {
            return false;
        }
        const metadata = this.astContext.typeEnvironment.nodeTypes.get(node);
        if (metadata?.kind === 'string' || metadata?.kind === 'series') {
            return true;
        }
        return this.isStringExpression(node.left) || this.isStringExpression(node.right);
    }
    isStringExpression(expression) {
        if (expression.kind === 'StringLiteral') {
            return true;
        }
        if (!this.astContext) {
            return false;
        }
        const metadata = this.astContext.typeEnvironment.nodeTypes.get(expression);
        if (metadata?.kind === 'string' || metadata?.kind === 'series') {
            return true;
        }
        if (expression.kind === 'Identifier') {
            const identifier = expression;
            const identifierType = this.astContext.typeEnvironment.identifiers.get(identifier.name);
            if (identifierType?.kind === 'string' || identifierType?.kind === 'series') {
                return true;
            }
        }
        if (expression.kind === 'CallExpression') {
            const call = expression;
            const calleeName = this.getExpressionQualifiedName(call.callee);
            if (calleeName && calleeName.startsWith('str.')) {
                return true;
            }
        }
        return false;
    }
    argumentToString(argument) {
        const valueText = getNodeSource(this.context, argument.value).trim();
        if (argument.name) {
            return `${argument.name.name}=${valueText}`;
        }
        return valueText;
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
    extractNumericValue(arg, node) {
        if (node) {
            if (node.kind === 'NumberLiteral') {
                return node.value;
            }
            if (node.kind === 'UnaryExpression') {
                const unary = node;
                if (unary.argument.kind === 'NumberLiteral') {
                    const value = unary.argument.value;
                    return unary.operator === '-' ? -value : value;
                }
            }
        }
        const trimmed = arg.trim();
        const match = trimmed.match(/^[+\-]?\d+(\.\d+)?$/);
        return match ? parseFloat(trimmed) : null;
    }
    isStringLiteral(arg, node) {
        if (node?.kind === 'StringLiteral') {
            return true;
        }
        const trimmed = arg.trim();
        return (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"));
    }
    isStringVariable(value, node) {
        if (node) {
            if (node.kind === 'StringLiteral') {
                return true;
            }
            const metadata = this.astContext?.typeEnvironment.nodeTypes.get(node);
            if (metadata?.kind === 'string' || metadata?.kind === 'series') {
                return true;
            }
            if (node.kind === 'Identifier') {
                const identifier = node;
                const identifierType = this.astContext?.typeEnvironment.identifiers.get(identifier.name);
                if (identifierType?.kind === 'string' || identifierType?.kind === 'series') {
                    return true;
                }
            }
        }
        // Be more lenient - only flag clearly non-string values
        if (/^\d+\.?\d*$/.test(value) || value === 'true' || value === 'false' || value === 'na' || value === 'null') {
            return false;
        }
        // Assume anything else could be a string variable or function call
        return true;
    }
    countFormatPlaceholders(formatString) {
        // Remove quotes and count {n} patterns
        const cleanString = formatString.replace(/^"|"$|^'|'$/g, '');
        const matches = cleanString.match(/\{\d+\}/g);
        return matches ? matches.length : 0;
    }
    hasInvalidFormatPlaceholders(formatString) {
        const cleanString = formatString.replace(/^"|"$|^'|'$/g, '');
        // Check for incomplete placeholders like { or {abc}
        return /\{[^}]*$|\{[^0-9}]+[^}]*\}/.test(cleanString);
    }
    isValidTimeFormat(formatString) {
        const cleanString = formatString.replace(/^"|"$|^'|'$/g, '');
        // Basic validation for common time format patterns
        const validPatterns = ['yyyy', 'MM', 'dd', 'HH', 'mm', 'ss', '-', ':', ' '];
        return validPatterns.some(pattern => cleanString.includes(pattern));
    }
    // Getter methods for other modules
    getStringFunctionCalls() {
        return [...this.stringFunctionCalls];
    }
    getStringOperations() {
        return new Map(this.stringOperations);
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
