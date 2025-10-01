export var MarkerSeverity;
(function (MarkerSeverity) {
    MarkerSeverity[MarkerSeverity["Hint"] = 1] = "Hint";
    MarkerSeverity[MarkerSeverity["Info"] = 2] = "Info";
    MarkerSeverity[MarkerSeverity["Warning"] = 4] = "Warning";
    MarkerSeverity[MarkerSeverity["Error"] = 8] = "Error";
})(MarkerSeverity || (MarkerSeverity = {}));
function normalisePosition(value, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
        return fallback;
    }
    return Math.floor(value);
}
function ensureEndColumn(startLine, startColumn, endLine, endColumn) {
    let resolvedEndLine = endLine;
    if (resolvedEndLine < startLine) {
        resolvedEndLine = startLine;
    }
    let resolvedEndColumn = endColumn;
    if (resolvedEndLine === startLine && resolvedEndColumn <= startColumn) {
        resolvedEndColumn = startColumn + 1;
    }
    if (resolvedEndColumn < 1) {
        resolvedEndColumn = startColumn + 1;
    }
    return { endLine: resolvedEndLine, endColumn: resolvedEndColumn };
}
export function getMarkerRangeFromLocation(location) {
    const startLine = normalisePosition(location?.start?.line, 1);
    const startColumn = normalisePosition(location?.start?.column, 1);
    const rawEndLine = normalisePosition(location?.end?.line, startLine);
    const rawEndColumn = normalisePosition(location?.end?.column, startColumn + 1);
    const { endLine, endColumn } = ensureEndColumn(startLine, startColumn, rawEndLine, rawEndColumn);
    return {
        startLineNumber: startLine,
        startColumn,
        endLineNumber: endLine,
        endColumn,
    };
}
export function getMarkerRange(node) {
    return getMarkerRangeFromLocation(node.loc);
}
export function createMarker(node, message, options = {}) {
    const { severity = MarkerSeverity.Error, source, code } = options;
    const range = getMarkerRange(node);
    return {
        ...range,
        message,
        severity,
        source,
        code,
    };
}
export function createMarkerFromSyntaxError(error, options = {}) {
    const { severity = MarkerSeverity.Error, source, code } = options;
    const details = error.details;
    if (!details) {
        return {
            message: error.message,
            severity,
            source,
            code,
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 2,
        };
    }
    const startLine = normalisePosition(details.lineno, 1);
    const startColumn = normalisePosition(details.offset, 1);
    const rawEndLine = normalisePosition(details.end_lineno ?? details.lineno, startLine);
    const rawEndColumn = normalisePosition(details.end_offset ?? details.offset + 1, startColumn + 1);
    const { endLine, endColumn } = ensureEndColumn(startLine, startColumn, rawEndLine, rawEndColumn);
    return {
        message: error.message,
        severity,
        source,
        code,
        startLineNumber: startLine,
        startColumn,
        endLineNumber: endLine,
        endColumn,
    };
}
