const SOURCE_CACHE = new WeakMap();
function resolveSourceText(context) {
    if (typeof context.sourceText === 'string' && context.sourceText.length > 0) {
        return context.sourceText;
    }
    if (Array.isArray(context.rawLines) && context.rawLines.length > 0) {
        const joined = context.rawLines.join('\n');
        context.sourceText = joined;
        return joined;
    }
    if (Array.isArray(context.cleanLines) && context.cleanLines.length > 0) {
        const joined = context.cleanLines.join('\n');
        context.sourceText = joined;
        return joined;
    }
    if (Array.isArray(context.lines) && context.lines.length > 0) {
        const joined = context.lines.join('\n');
        context.sourceText = joined;
        return joined;
    }
    context.sourceText = context.sourceText ?? '';
    return context.sourceText;
}
function buildCache(context) {
    const text = resolveSourceText(context);
    let cached = SOURCE_CACHE.get(context);
    if (cached && cached.text === text) {
        return cached;
    }
    const lines = text.split('\n');
    const lineOffsets = new Array(lines.length);
    let offset = 0;
    for (let index = 0; index < lines.length; index++) {
        lineOffsets[index] = offset;
        offset += lines[index].length;
        if (index < lines.length - 1) {
            offset += 1; // account for newline separator
        }
    }
    cached = { text, lines, lineOffsets };
    SOURCE_CACHE.set(context, cached);
    return cached;
}
function positionToOffset(cache, location) {
    const { line, column } = location;
    const { lineOffsets, text, lines } = cache;
    if (lines.length === 0) {
        return 0;
    }
    if (line <= 0) {
        return Math.max(0, column - 1);
    }
    const index = Math.min(Math.max(line - 1, 0), lineOffsets.length - 1);
    const base = lineOffsets[index] ?? 0;
    const clampedColumn = Math.max(column - 1, 0);
    return Math.min(base + clampedColumn, text.length);
}
function sliceByRange(cache, range) {
    const [rawStart, rawEnd] = range;
    if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) {
        return '';
    }
    const start = Math.max(0, Math.min(rawStart, cache.text.length));
    const end = Math.max(start, Math.min(rawEnd, cache.text.length));
    return cache.text.slice(start, end);
}
export function getSourceText(context) {
    return buildCache(context).text;
}
export function getSourceLines(context) {
    return buildCache(context).lines;
}
export function getSourceLine(context, lineNumber) {
    const cache = buildCache(context);
    if (lineNumber <= 0 || lineNumber > cache.lines.length) {
        return '';
    }
    return cache.lines[lineNumber - 1] ?? '';
}
export function sliceSourceRange(context, range) {
    if (!range) {
        return '';
    }
    const cache = buildCache(context);
    return sliceByRange(cache, range);
}
export function sliceSourceLocation(context, loc) {
    if (!loc) {
        return '';
    }
    const cache = buildCache(context);
    const start = positionToOffset(cache, loc.start);
    const end = positionToOffset(cache, loc.end);
    if (end <= start) {
        return '';
    }
    return cache.text.slice(start, end);
}
export function getNodeSource(context, node) {
    if (!node) {
        return '';
    }
    if (node.loc) {
        return sliceSourceLocation(context, node.loc);
    }
    if (Array.isArray(node.range)) {
        return sliceSourceRange(context, node.range);
    }
    const cache = buildCache(context);
    if (cache.lines.length === 0) {
        return '';
    }
    const firstLine = cache.lines[0] ?? '';
    return firstLine.trim().length > 0 ? firstLine : '';
}
