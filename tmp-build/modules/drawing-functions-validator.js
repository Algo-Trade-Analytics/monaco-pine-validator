/**
 * Drawing Functions Validator
 *
 * Validates Pine Script v6 Drawing functions and operations:
 * - Line drawing functions (line.new, line.set_*, line.delete, etc.)
 * - Label drawing functions (label.new, label.set_*, label.delete, etc.)
 * - Box drawing functions (box.new, box.set_*, box.delete, etc.)
 * - Table drawing functions (table.new, table.cell_*, table.delete, etc.)
 * - Drawing performance analysis
 * - Drawing best practices suggestions
 *
 * Priority 2.1: HIGH PRIORITY GAPS - Drawing Functions (5% Coverage)
 */
import { TEXT_SIZE_CONSTANTS, TEXT_STYLE_CONSTANTS } from '../core/constants';
import { visit, findAncestor } from '../core/ast/traversal';
import { getNodeSource } from '../core/ast/source-utils';
export class DrawingFunctionsValidator {
    constructor() {
        this.name = 'DrawingFunctionsValidator';
        this.priority = 86; // High priority - drawing functions are essential for Pine Script
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.astContext = null;
        // Drawing function tracking
        this.drawingFunctionCalls = [];
        this.drawingObjectCount = 0;
        this.createdDrawingVariables = new Set();
        this.deletedDrawingVariables = new Set();
    }
    getDependencies() {
        return ['TypeValidator', 'FunctionValidator'];
    }
    validate(context, config) {
        this.reset();
        this.context = context;
        this.config = config;
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
        try {
            this.collectDrawingDataAst(this.astContext.ast);
        }
        catch (error) {
            if (process.env.VALIDATOR_DEBUG_DRAWING === '1') {
                console.error('[DrawingFunctionsValidator] collect error', error);
            }
            throw error;
        }
        // Post-process validations
        try {
            this.validateDrawingPerformance();
        }
        catch (error) {
            // Silently handle performance validation errors to prevent breaking validation
        }
        try {
            this.validateDrawingBestPractices();
        }
        catch (error) {
            // Silently handle best practices validation errors to prevent breaking validation
        }
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
        this.drawingFunctionCalls = [];
        this.drawingObjectCount = 0;
        this.createdDrawingVariables.clear();
        this.deletedDrawingVariables.clear();
    }
    addError(line, column, message, code, suggestion) {
        if (process.env.VALIDATOR_DEBUG_DRAWING === '1') {
            console.error('[DrawingFunctionsValidator] error', { line, column, message, code });
        }
        // Only generate errors for clearly invalid cases
        if (this.isClearlyInvalid(message, code)) {
            this.errors.push({ line, column, message, severity: 'error', code, suggestion });
        }
        else {
            // Generate warnings for ambiguous cases
            this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
        }
    }
    addWarning(line, column, message, code, suggestion) {
        if (process.env.VALIDATOR_DEBUG_DRAWING === '1') {
            console.warn('[DrawingFunctionsValidator] warning', { line, column, message, code });
        }
        this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
    }
    addInfo(line, column, message, code, suggestion) {
        if (process.env.VALIDATOR_DEBUG_DRAWING === '1') {
            console.info('[DrawingFunctionsValidator] info', { line, column, message, code });
        }
        this.info.push({ line, column, message, severity: 'info', code, suggestion });
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
        // Unknown drawing function errors are clearly invalid
        if (code === 'PSV6-LINE-UNKNOWN-FUNCTION' ||
            code === 'PSV6-LABEL-UNKNOWN-FUNCTION' ||
            code === 'PSV6-BOX-UNKNOWN-FUNCTION' ||
            code === 'PSV6-TABLE-UNKNOWN-FUNCTION') {
            return true;
        }
        // Invalid drawing function usage is clearly invalid
        if (code === 'PSV6-DRAWING-INVALID') {
            return true;
        }
        // Label text style/size type errors are invalid
        if (code === 'PSV6-LABEL-TEXT-STYLE' || code === 'PSV6-LABEL-TEXT-SIZE') {
            return true;
        }
        // For performance and best practice issues, generate warnings
        return false;
    }
    collectDrawingDataAst(program) {
        const loopStack = [];
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
                    this.processAstDrawingCall(path, loopStack.length > 0);
                },
            },
        });
    }
    processAstDrawingCall(path, inLoop) {
        const call = path.node;
        if (call.callee.kind !== 'MemberExpression') {
            return;
        }
        const member = call.callee;
        if (member.computed) {
            return;
        }
        const namespace = this.getNamespaceName(member.object);
        if (!namespace || !this.isDrawingNamespace(namespace)) {
            return;
        }
        const functionName = member.property.name;
        const args = call.args.map((argument) => this.getArgumentText(argument));
        const assignedIdentifier = this.extractAssignedIdentifier(path);
        const line = member.property.loc.start.line;
        const column = member.property.loc.start.column;
        const callInfo = {
            namespace,
            functionName,
            line,
            column,
            arguments: args,
            inLoop,
            argumentNodes: call.args,
            assignedIdentifier,
        };
        this.drawingFunctionCalls.push(callInfo);
        if (functionName === 'new') {
            this.drawingObjectCount++;
            if (assignedIdentifier) {
                this.createdDrawingVariables.add(assignedIdentifier);
            }
        }
        if (functionName === 'delete') {
            const deletedTarget = this.extractIdentifierFromArgument(call.args[0]);
            if (deletedTarget) {
                this.deletedDrawingVariables.add(deletedTarget);
            }
        }
        this.validateDrawingFunction(namespace, functionName, args, line, column);
    }
    validateDrawingFunction(namespace, functionName, args, lineNum, column) {
        switch (namespace) {
            case 'line':
                this.validateLineFunction(functionName, args, lineNum, column);
                break;
            case 'label':
                this.validateLabelFunction(functionName, args, lineNum, column);
                break;
            case 'box':
                this.validateBoxFunction(functionName, args, lineNum, column);
                break;
            case 'table':
                this.validateTableFunction(functionName, args, lineNum, column);
                break;
        }
    }
    validateLineFunction(functionName, args, lineNum, column) {
        switch (functionName) {
            case 'new':
                this.validateLineNew(args, lineNum, column);
                break;
            case 'set_xy1':
                this.validateLineSetXY1(args, lineNum, column);
                break;
            case 'set_xy2':
                this.validateLineSetXY2(args, lineNum, column);
                break;
            case 'set_x1':
                this.validateLineSetX1(args, lineNum, column);
                break;
            case 'set_y1':
                this.validateLineSetY1(args, lineNum, column);
                break;
            case 'set_x2':
                this.validateLineSetX2(args, lineNum, column);
                break;
            case 'set_y2':
                this.validateLineSetY2(args, lineNum, column);
                break;
            case 'set_color':
                this.validateLineSetColor(args, lineNum, column);
                break;
            case 'set_width':
                this.validateLineSetWidth(args, lineNum, column);
                break;
            case 'set_style':
                this.validateLineSetStyle(args, lineNum, column);
                break;
            case 'delete':
                this.validateLineDelete(args, lineNum, column);
                break;
            default:
                this.addError(lineNum, column, `Unknown line function: line.${functionName}`, 'PSV6-LINE-UNKNOWN-FUNCTION');
        }
    }
    validateLineNew(args, lineNum, column) {
        if (args.length < 4) {
            this.addError(lineNum, column, 'line.new() requires at least 4 parameters (x1, y1, x2, y2)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate coordinate parameters
        for (let i = 0; i < 4; i++) {
            if (!this.isValidCoordinate(args[i])) {
                // obvious type mismatch -> error with generic code expected by tests
                if (/^\s*("[^"]*"|'[^']*'|true|false)\s*$/.test(args[i])) {
                    this.addError(lineNum, column, `Invalid parameter type for line.new() coordinate ${i + 1}`, 'PSV6-FUNCTION-PARAM-TYPE');
                }
                else {
                    this.addWarning(lineNum, column, `line.new() parameter ${i + 1} should be a valid coordinate`, 'PSV6-LINE-COORDINATE-TYPE');
                }
            }
        }
        // Validate optional parameters
        this.validateLineOptionalParameters(args.slice(4), lineNum, column);
    }
    validateLineSetXY1(args, lineNum, column) {
        if (args.length !== 3) {
            this.addError(lineNum, column, 'line.set_xy1() requires exactly 3 parameters (id, x1, y1)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLineSetXY2(args, lineNum, column) {
        if (args.length !== 3) {
            this.addError(lineNum, column, 'line.set_xy2() requires exactly 3 parameters (id, x2, y2)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLineSetColor(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'line.set_color() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isColorExpression(args[1])) {
            if (/^\s*("[^"]*"|'[^']*')\s*$/.test(args[1])) {
                this.addError(lineNum, column, 'Invalid parameter type for line.set_color()', 'PSV6-FUNCTION-PARAM-TYPE');
            }
            else {
                this.addWarning(lineNum, column, 'line.set_color() color parameter should be a color expression', 'PSV6-LINE-COLOR-TYPE');
            }
        }
    }
    validateLineSetWidth(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'line.set_width() requires exactly 2 parameters (id, width)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const width = this.extractNumericValue(args[1]);
        if (width !== null && (width < 1 || width > 10)) {
            this.addWarning(lineNum, column, 'line.set_width() width should be between 1 and 10', 'PSV6-LINE-WIDTH-RANGE');
        }
    }
    validateLineSetStyle(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'line.set_style() requires exactly 2 parameters (id, style)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isLineStyleConstant(args[1])) {
            this.addWarning(lineNum, column, 'line.set_style() style should be a line style constant', 'PSV6-LINE-STYLE-TYPE');
        }
    }
    validateLineDelete(args, lineNum, column) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'line.delete() requires exactly 1 parameter (id)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLineSetX1(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'line.set_x1() requires exactly 2 parameters (id, x1)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLineSetY1(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'line.set_y1() requires exactly 2 parameters (id, y1)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLineSetX2(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'line.set_x2() requires exactly 2 parameters (id, x2)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLineSetY2(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'line.set_y2() requires exactly 2 parameters (id, y2)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLineOptionalParameters(args, lineNum, column) {
        // Validate optional parameters like color, width, style
        for (const arg of args) {
            if (arg.includes('color=')) {
                const colorValue = arg.split('=')[1].trim();
                if (!this.isColorExpression(colorValue)) {
                    this.addWarning(lineNum, column, 'line.new() color parameter should be a color expression', 'PSV6-LINE-COLOR-TYPE');
                }
            }
            else if (arg.includes('width=')) {
                const widthValue = arg.split('=')[1].trim();
                const width = this.extractNumericValue(widthValue);
                if (width !== null && (width < 1 || width > 10)) {
                    this.addWarning(lineNum, column, 'line.new() width should be between 1 and 10', 'PSV6-LINE-WIDTH-RANGE');
                }
            }
            else if (arg.includes('style=')) {
                const styleValue = arg.split('=')[1].trim();
                if (!this.isLineStyleConstant(styleValue)) {
                    this.addWarning(lineNum, column, 'line.new() style should be a line style constant', 'PSV6-LINE-STYLE-TYPE');
                }
            }
        }
    }
    validateLabelFunction(functionName, args, lineNum, column) {
        switch (functionName) {
            case 'new':
                this.validateLabelNew(args, lineNum, column);
                break;
            case 'set_text':
                this.validateLabelSetText(args, lineNum, column);
                break;
            case 'set_color':
                this.validateLabelSetColor(args, lineNum, column);
                break;
            case 'set_style':
                this.validateLabelSetStyle(args, lineNum, column);
                break;
            case 'set_size':
                this.validateLabelSetSize(args, lineNum, column);
                break;
            case 'set_x':
                this.validateLabelSetX(args, lineNum, column);
                break;
            case 'set_y':
                this.validateLabelSetY(args, lineNum, column);
                break;
            case 'delete':
                this.validateLabelDelete(args, lineNum, column);
                break;
            default:
                this.addError(lineNum, column, `Unknown label function: label.${functionName}`, 'PSV6-LABEL-UNKNOWN-FUNCTION');
        }
    }
    validateLabelNew(args, lineNum, column) {
        if (args.length < 3) {
            this.addError(lineNum, column, 'label.new() requires at least 3 parameters (x, y, text)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate coordinate parameters
        for (let i = 0; i < 2; i++) {
            if (!this.isValidCoordinate(args[i])) {
                // obvious string/bool -> error with generic code expected by tests
                if (/^\s*("[^"]*"|'[^']*'|true|false)\s*$/.test(args[i])) {
                    this.addError(lineNum, column, `Invalid parameter type for label.new() coordinate ${i + 1}`, 'PSV6-FUNCTION-PARAM-TYPE');
                }
                else {
                    this.addWarning(lineNum, column, `label.new() parameter ${i + 1} should be a valid coordinate`, 'PSV6-LABEL-COORDINATE-TYPE');
                }
            }
        }
        // Validate text parameter
        if (!this.isStringLiteral(args[2])) {
            this.addWarning(lineNum, column, 'label.new() text parameter should be a string literal', 'PSV6-LABEL-TEXT-TYPE');
        }
        // Optional named parameters: textsize=, textstyle=
        for (let i = 3; i < args.length; i++) {
            const a = args[i];
            const mSize = a.match(/\btextsize\s*=\s*([^,]+)$/);
            if (mSize) {
                const val = mSize[1].trim();
                if (!this.isValidTextSizeOrPoints(val)) {
                    this.addError(lineNum, column, 'label.new() textsize must be a size constant or valid point size (6..72)', 'PSV6-LABEL-TEXT-SIZE');
                }
            }
            const mStyle = a.match(/\btextstyle\s*=\s*([^,]+)$/);
            if (mStyle) {
                const val = mStyle[1].trim();
                if (!this.isValidTextStyle(val)) {
                    this.addError(lineNum, column, 'label.new() textstyle must be a valid text style constant', 'PSV6-LABEL-TEXT-STYLE');
                }
            }
        }
    }
    validateLabelSetText(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'label.set_text() requires exactly 2 parameters (id, text)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLabelSetColor(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'label.set_color() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLabelSetStyle(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'label.set_style() requires exactly 2 parameters (id, style)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLabelSetSize(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'label.set_size() requires exactly 2 parameters (id, size)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isValidTextSizeOrPoints(args[1])) {
            this.addError(lineNum, column, 'label.set_size() size must be a size constant or valid point size (6..72)', 'PSV6-LABEL-TEXT-SIZE');
        }
    }
    validateLabelSetX(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'label.set_x() requires exactly 2 parameters (id, x)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLabelSetY(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'label.set_y() requires exactly 2 parameters (id, y)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateLabelDelete(args, lineNum, column) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'label.delete() requires exactly 1 parameter (id)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateBoxFunction(functionName, args, lineNum, column) {
        switch (functionName) {
            case 'new':
                this.validateBoxNew(args, lineNum, column);
                break;
            case 'set_bgcolor':
                this.validateBoxSetBgcolor(args, lineNum, column);
                break;
            case 'set_border_color':
                this.validateBoxSetBorderColor(args, lineNum, column);
                break;
            case 'set_border_width':
                this.validateBoxSetBorderWidth(args, lineNum, column);
                break;
            case 'set_border_style':
                this.validateBoxSetBorderStyle(args, lineNum, column);
                break;
            case 'set_left':
                this.validateBoxSetLeft(args, lineNum, column);
                break;
            case 'set_right':
                this.validateBoxSetRight(args, lineNum, column);
                break;
            case 'set_top':
                this.validateBoxSetTop(args, lineNum, column);
                break;
            case 'set_bottom':
                this.validateBoxSetBottom(args, lineNum, column);
                break;
            case 'delete':
                this.validateBoxDelete(args, lineNum, column);
                break;
            default:
                this.addError(lineNum, column, `Unknown box function: box.${functionName}`, 'PSV6-BOX-UNKNOWN-FUNCTION');
        }
    }
    validateBoxNew(args, lineNum, column) {
        if (args.length < 4) {
            this.addError(lineNum, column, 'box.new() requires at least 4 parameters (left, top, right, bottom)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate coordinate parameters
        for (let i = 0; i < 4; i++) {
            if (!this.isValidCoordinate(args[i])) {
                if (/^\s*("[^"]*"|'[^']*'|true|false)\s*$/.test(args[i])) {
                    this.addError(lineNum, column, `Invalid parameter type for box.new() coordinate ${i + 1}`, 'PSV6-FUNCTION-PARAM-TYPE');
                }
                else {
                    this.addWarning(lineNum, column, `box.new() parameter ${i + 1} should be a valid coordinate`, 'PSV6-BOX-COORDINATE-TYPE');
                }
            }
        }
    }
    validateBoxSetBgcolor(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'box.set_bgcolor() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isColorExpression(args[1])) {
            if (/^\s*("[^"]*"|'[^']*')\s*$/.test(args[1])) {
                this.addError(lineNum, column, 'Invalid parameter type for box.set_bgcolor()', 'PSV6-FUNCTION-PARAM-TYPE');
            }
            else {
                this.addWarning(lineNum, column, 'box.set_bgcolor() color parameter should be a color expression', 'PSV6-BOX-COLOR-TYPE');
            }
        }
    }
    validateBoxSetBorderColor(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'box.set_border_color() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateBoxSetBorderWidth(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'box.set_border_width() requires exactly 2 parameters (id, width)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const width = this.extractNumericValue(args[1]);
        if (width === null && args[1].trim() !== 'na') {
            if (/^\s*("[^"]*"|'[^']*')\s*$/.test(args[1])) {
                this.addError(lineNum, column, 'Invalid parameter type for box.set_border_width()', 'PSV6-FUNCTION-PARAM-TYPE');
            }
            else {
                this.addWarning(lineNum, column, 'box.set_border_width() width should be a number', 'PSV6-BOX-WIDTH-TYPE');
            }
        }
    }
    validateBoxSetBorderStyle(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'box.set_border_style() requires exactly 2 parameters (id, style)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateBoxDelete(args, lineNum, column) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'box.delete() requires exactly 1 parameter (id)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateBoxSetLeft(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'box.set_left() requires exactly 2 parameters (id, left)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateBoxSetRight(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'box.set_right() requires exactly 2 parameters (id, right)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateBoxSetTop(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'box.set_top() requires exactly 2 parameters (id, top)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateBoxSetBottom(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'box.set_bottom() requires exactly 2 parameters (id, bottom)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateTableFunction(functionName, args, lineNum, column) {
        switch (functionName) {
            case 'new':
                this.validateTableNew(args, lineNum, column);
                break;
            case 'cell':
                this.validateTableCell(args, lineNum, column);
                break;
            case 'cell_set_text':
                this.validateTableCellSetText(args, lineNum, column);
                break;
            case 'cell_set_bgcolor':
                this.validateTableCellSetBgcolor(args, lineNum, column);
                break;
            case 'cell_set_text_color':
                this.validateTableCellSetTextColor(args, lineNum, column);
                break;
            case 'cell_set_text_size':
                this.validateTableCellSetTextSize(args, lineNum, column);
                break;
            case 'clear':
                this.validateTableClear(args, lineNum, column);
                break;
            case 'set_position':
                this.validateTableSetPosition(args, lineNum, column);
                break;
            case 'set_bgcolor':
                this.validateTableSetBgcolor(args, lineNum, column);
                break;
            case 'set_border_color':
                this.validateTableSetBorderColor(args, lineNum, column);
                break;
            case 'set_border_width':
                this.validateTableSetBorderWidth(args, lineNum, column);
                break;
            case 'set_frame_color':
                this.validateTableSetFrameColor(args, lineNum, column);
                break;
            case 'set_frame_width':
                this.validateTableSetFrameWidth(args, lineNum, column);
                break;
            case 'delete':
                this.validateTableDelete(args, lineNum, column);
                break;
            default:
                this.addError(lineNum, column, `Unknown table function: table.${functionName}`, 'PSV6-TABLE-UNKNOWN-FUNCTION');
        }
    }
    validateTableNew(args, lineNum, column) {
        if (args.length < 3) {
            this.addError(lineNum, column, 'table.new() requires at least 3 parameters (position, columns, rows)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Validate position parameter
        if (!this.isPositionConstant(args[0])) {
            if (/^\s*("[^"]*"|'[^']*')\s*$/.test(args[0])) {
                this.addError(lineNum, column, 'Invalid parameter type for table.new() position', 'PSV6-FUNCTION-PARAM-TYPE');
            }
            else {
                this.addWarning(lineNum, column, 'table.new() position should be a position constant', 'PSV6-TABLE-POSITION-TYPE');
            }
        }
        // Validate columns and rows parameters
        for (let i = 1; i < 3; i++) {
            const value = this.extractNumericValue(args[i]);
            if (value === null || value < 1) {
                this.addWarning(lineNum, column, `table.new() parameter ${i + 1} should be a positive integer`, 'PSV6-TABLE-DIMENSION-TYPE');
            }
        }
    }
    validateTableCell(args, lineNum, column) {
        if (args.length < 4) {
            this.addError(lineNum, column, 'table.cell() requires at least 4 parameters (id, x, y, text)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateTableCellSetText(args, lineNum, column) {
        if (args.length !== 4) {
            this.addError(lineNum, column, 'table.cell_set_text() requires exactly 4 parameters (id, column, row, text)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        // Recommend literal strings for static content
        if (!this.isStringLiteral(args[3])) {
            this.addWarning(lineNum, column, 'table.cell_set_text() text should be a string literal when static', 'PSV6-TABLE-CELL-TEXT-TYPE');
        }
    }
    validateTableCellSetBgcolor(args, lineNum, column) {
        if (args.length !== 4) {
            this.addError(lineNum, column, 'table.cell_set_bgcolor() requires exactly 4 parameters (id, x, y, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isColorExpression(args[3])) {
            this.addWarning(lineNum, column, 'table.cell_set_bgcolor() color parameter should be a color expression', 'PSV6-TABLE-CELL-COLOR-TYPE');
        }
    }
    validateTableCellSetTextColor(args, lineNum, column) {
        if (args.length !== 4) {
            this.addError(lineNum, column, 'table.cell_set_text_color() requires exactly 4 parameters (id, x, y, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isColorExpression(args[3])) {
            this.addWarning(lineNum, column, 'table.cell_set_text_color() color parameter should be a color expression', 'PSV6-TABLE-CELL-COLOR-TYPE');
        }
    }
    validateTableCellSetTextSize(args, lineNum, column) {
        if (args.length !== 4) {
            this.addError(lineNum, column, 'table.cell_set_text_size() requires exactly 4 parameters (id, x, y, size)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isValidTextSizeOrPoints(args[3])) {
            this.addWarning(lineNum, column, 'table.cell_set_text_size() size should be a size constant or 6..72', 'PSV6-TABLE-CELL-TEXT-SIZE');
        }
    }
    validateTableClear(args, lineNum, column) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'table.clear() requires exactly 1 parameter (id)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateTableSetPosition(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'table.set_position() requires exactly 2 parameters (id, position)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isPositionConstant(args[1])) {
            if (/^\s*("[^"]*"|'[^']*')\s*$/.test(args[1])) {
                this.addError(lineNum, column, 'Invalid parameter type for table.set_position() position', 'PSV6-FUNCTION-PARAM-TYPE');
            }
            else {
                this.addWarning(lineNum, column, 'table.set_position() position should be a position constant', 'PSV6-TABLE-POSITION-TYPE');
            }
        }
    }
    validateTableSetBgcolor(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'table.set_bgcolor() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isColorExpression(args[1])) {
            if (/^\s*("[^"]*"|'[^']*')\s*$/.test(args[1])) {
                this.addError(lineNum, column, 'Invalid parameter type for table.set_bgcolor()', 'PSV6-FUNCTION-PARAM-TYPE');
            }
            else {
                this.addWarning(lineNum, column, 'table.set_bgcolor() color should be a color expression', 'PSV6-TABLE-COLOR-TYPE');
            }
        }
    }
    validateTableSetBorderColor(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'table.set_border_color() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isColorExpression(args[1])) {
            if (/^\s*("[^"]*"|'[^']*')\s*$/.test(args[1])) {
                this.addError(lineNum, column, 'Invalid parameter type for table.set_border_color()', 'PSV6-FUNCTION-PARAM-TYPE');
            }
            else {
                this.addWarning(lineNum, column, 'table.set_border_color() color should be a color expression', 'PSV6-TABLE-COLOR-TYPE');
            }
        }
    }
    validateTableSetBorderWidth(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'table.set_border_width() requires exactly 2 parameters (id, width)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const width = this.extractNumericValue(args[1]);
        if (width === null) {
            this.addError(lineNum, column, 'Invalid parameter type for table.set_border_width()', 'PSV6-FUNCTION-PARAM-TYPE');
            return;
        }
        if (width <= 0) {
            this.addWarning(lineNum, column, 'table.set_border_width() width should be > 0', 'PSV6-TABLE-BORDER-WIDTH');
        }
        if (width > 10) {
            this.addInfo(lineNum, column, 'Very thick table borders may affect readability', 'PSV6-DRAWING-STYLE-SUGGESTION');
        }
    }
    validateTableSetFrameColor(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'table.set_frame_color() requires exactly 2 parameters (id, color)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        if (!this.isColorExpression(args[1])) {
            if (/^\s*("[^"]*"|'[^']*')\s*$/.test(args[1])) {
                this.addError(lineNum, column, 'Invalid parameter type for table.set_frame_color()', 'PSV6-FUNCTION-PARAM-TYPE');
            }
            else {
                this.addWarning(lineNum, column, 'table.set_frame_color() color should be a color expression', 'PSV6-TABLE-COLOR-TYPE');
            }
        }
    }
    validateTableSetFrameWidth(args, lineNum, column) {
        if (args.length !== 2) {
            this.addError(lineNum, column, 'table.set_frame_width() requires exactly 2 parameters (id, width)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
        const width = this.extractNumericValue(args[1]);
        if (width === null) {
            this.addError(lineNum, column, 'Invalid parameter type for table.set_frame_width()', 'PSV6-FUNCTION-PARAM-TYPE');
            return;
        }
        if (width <= 0) {
            this.addWarning(lineNum, column, 'table.set_frame_width() width should be > 0', 'PSV6-TABLE-FRAME-WIDTH');
        }
        if (width > 10) {
            this.addInfo(lineNum, column, 'Very thick table frames may affect readability', 'PSV6-DRAWING-STYLE-SUGGESTION');
        }
    }
    validateTableDelete(args, lineNum, column) {
        if (args.length !== 1) {
            this.addError(lineNum, column, 'table.delete() requires exactly 1 parameter (id)', 'PSV6-FUNCTION-PARAM-COUNT');
            return;
        }
    }
    validateDrawingPerformance() {
        // Check for too many drawing objects
        if (this.drawingObjectCount > 15) {
            this.addWarning(1, 1, `Too many drawing objects detected (${this.drawingObjectCount}). Consider limiting the number of drawing objects.`, 'PSV6-DRAWING-TOO-MANY');
        }
        // Check for drawing objects in loops
        for (const call of this.drawingFunctionCalls) {
            if (call.functionName === 'new' && call.inLoop) {
                this.addWarning(call.line, call.column, 'Creating drawing objects in loops may cause performance issues', 'PSV6-DRAWING-IN-LOOP');
            }
        }
        // Check for complex drawing expressions
        for (const call of this.drawingFunctionCalls) {
            if (call.functionName === 'new' && this.hasComplexExpression(call.arguments)) {
                this.addWarning(call.line, call.column, 'Complex expressions in drawing functions may cause performance issues', 'PSV6-DRAWING-COMPLEX-EXPRESSION');
            }
        }
    }
    validateDrawingBestPractices() {
        // Check for objects that are created but not deleted
        for (const obj of this.createdDrawingVariables) {
            if (!this.deletedDrawingVariables.has(obj)) {
                this.addInfo(1, 1, `Drawing object '${obj}' is created but not deleted. Consider adding cleanup code.`, 'PSV6-DRAWING-CLEANUP-SUGGESTION');
            }
        }
        // Check for poor naming conventions
        const poorNames = new Set(['l', 'lb', 'b', 't', 'line', 'label', 'box', 'table']);
        for (const call of this.drawingFunctionCalls) {
            if (call.functionName === 'new' && call.assignedIdentifier && poorNames.has(call.assignedIdentifier)) {
                this.addInfo(call.line, call.column, `Consider using a more descriptive name instead of '${call.assignedIdentifier}'`, 'PSV6-DRAWING-NAMING-SUGGESTION');
            }
        }
        // Check for poor positioning
        for (const call of this.drawingFunctionCalls) {
            if (call.functionName === 'new' && call.arguments.length >= 4) {
                const x1 = this.extractNumericValue(call.arguments[0]);
                const y1 = this.extractNumericValue(call.arguments[1]);
                const x2 = this.extractNumericValue(call.arguments[2]);
                const y2 = this.extractNumericValue(call.arguments[3]);
                if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                    if (x1 === x2 && y1 === y2) {
                        this.addInfo(call.line, call.column, 'Drawing object has same start and end points', 'PSV6-DRAWING-POSITION-SUGGESTION');
                    }
                    if (Math.abs(x1) > 100000 || Math.abs(y1) > 100000 || Math.abs(x2) > 100000 || Math.abs(y2) > 100000) {
                        this.addInfo(call.line, call.column, 'Drawing object has extreme coordinate values', 'PSV6-DRAWING-POSITION-SUGGESTION');
                    }
                }
            }
        }
        // Check for poor styling
        for (const call of this.drawingFunctionCalls) {
            if (call.functionName === 'new') {
                for (const arg of call.arguments) {
                    if (arg.includes('width=')) {
                        const widthValue = arg.split('=')[1].trim();
                        const width = this.extractNumericValue(widthValue);
                        if (width !== null && width > 5) {
                            this.addInfo(call.line, call.column, 'Very thick drawing lines may affect readability', 'PSV6-DRAWING-STYLE-SUGGESTION');
                        }
                    }
                }
            }
        }
    }
    extractNumericValue(arg) {
        const trimmed = arg.trim();
        const match = trimmed.match(/^[+\-]?\d+(\.\d+)?$/);
        return match ? parseFloat(trimmed) : null;
    }
    isStringLiteral(arg) {
        const trimmed = arg.trim();
        return (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"));
    }
    isValidCoordinate(arg) {
        const trimmed = arg.trim();
        if (trimmed === 'na')
            return true;
        const numValue = this.extractNumericValue(trimmed);
        return numValue !== null;
    }
    isColorExpression(value) {
        const trimmed = value.trim();
        return trimmed.includes('color.') ||
            trimmed.startsWith('#') ||
            trimmed.startsWith('rgb') ||
            trimmed === 'na';
    }
    isValidTextSizeOrPoints(value) {
        const trimmed = value.trim();
        if (TEXT_SIZE_CONSTANTS.has(trimmed))
            return true;
        const num = this.extractNumericValue(trimmed);
        if (num !== null) {
            return num >= 6 && num <= 72;
        }
        return !!trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
    }
    isValidTextStyle(value) {
        const trimmed = value.trim();
        if (TEXT_STYLE_CONSTANTS.has(trimmed))
            return true;
        return !!trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*$/);
    }
    isLineStyleConstant(value) {
        const trimmed = value.trim();
        const lineStyles = [
            'line.style_solid', 'line.style_dashed', 'line.style_dotted',
            'line.style_arrow_left', 'line.style_arrow_right'
        ];
        return lineStyles.some(style => trimmed.includes(style));
    }
    isPositionConstant(value) {
        const trimmed = value.trim();
        const positions = [
            'position.top_left', 'position.top_center', 'position.top_right',
            'position.middle_left', 'position.middle_center', 'position.middle_right',
            'position.bottom_left', 'position.bottom_center', 'position.bottom_right'
        ];
        return positions.some(pos => trimmed.includes(pos));
    }
    hasComplexExpression(args) {
        const complexPatterns = [
            /ta\./,
            /math\./,
            /str\./,
            /\(/,
            /\+|\-|\*|\//
        ];
        return args.some(arg => complexPatterns.some(pattern => pattern.test(arg)));
    }
    // Getter methods for other modules
    getDrawingFunctionCalls() {
        return [...this.drawingFunctionCalls];
    }
    getDrawingObjectCount() {
        return this.drawingObjectCount;
    }
    getArgumentText(argument) {
        if (!argument.value) {
            if (process.env.VALIDATOR_DEBUG_DRAWING === '1') {
                console.error('[DrawingFunctionsValidator] argument without value', argument);
            }
            return '';
        }
        let valueRaw;
        try {
            valueRaw = this.getExpressionText(argument.value);
        }
        catch (error) {
            if (process.env.VALIDATOR_DEBUG_DRAWING === '1') {
                console.error('[DrawingFunctionsValidator] failed to extract argument text', {
                    argument,
                    error,
                });
            }
            throw error;
        }
        const valueText = valueRaw?.trim?.() ?? '';
        if (argument.name) {
            return `${argument.name.name}=${valueText}`;
        }
        return valueText;
    }
    getExpressionText(expression) {
        switch (expression.kind) {
            case 'StringLiteral':
                return expression.raw;
            case 'NumberLiteral':
                return (expression.raw ??
                    String(expression.value));
            case 'BooleanLiteral': {
                const literal = expression;
                return literal.value ? 'true' : 'false';
            }
            case 'Identifier':
                return expression.name;
            case 'MemberExpression': {
                const member = expression;
                if (member.computed) {
                    return getNodeSource(this.context, member).trim();
                }
                const objectText = this.getExpressionText(member.object);
                return `${objectText}.${member.property.name}`;
            }
            default:
                return getNodeSource(this.context, expression).trim();
        }
    }
    getNamespaceName(expression) {
        if (expression.kind === 'Identifier') {
            return expression.name;
        }
        if (expression.kind === 'MemberExpression') {
            const member = expression;
            if (member.computed) {
                return null;
            }
            return this.getNamespaceName(member.object);
        }
        return null;
    }
    extractAssignedIdentifier(path) {
        const assignmentPath = findAncestor(path, (ancestor) => {
            const kind = ancestor.node.kind;
            return kind === 'AssignmentStatement' || kind === 'VariableDeclaration';
        });
        if (!assignmentPath) {
            return null;
        }
        if (assignmentPath.node.kind === 'AssignmentStatement') {
            const assignment = assignmentPath.node;
            if (assignment.left.kind === 'Identifier') {
                return assignment.left.name;
            }
        }
        if (assignmentPath.node.kind === 'VariableDeclaration') {
            const declaration = assignmentPath.node;
            return declaration.identifier.name;
        }
        return null;
    }
    extractIdentifierFromArgument(argument) {
        if (!argument || !argument.value) {
            return null;
        }
        if (argument.value.kind === 'Identifier') {
            return argument.value.name;
        }
        return null;
    }
    isDrawingNamespace(namespace) {
        return namespace === 'line' || namespace === 'label' || namespace === 'box' || namespace === 'table';
    }
    getAstContext(config) {
        if (!config.ast || config.ast.mode === 'disabled') {
            return null;
        }
        return isAstValidationContext(this.context) ? this.context : null;
    }
}
function isAstValidationContext(context) {
    return 'ast' in context;
}
