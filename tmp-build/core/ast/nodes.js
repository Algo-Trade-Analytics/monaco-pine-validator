export function createPosition(line = 1, column = 1, offset = 0) {
    return { line, column, offset };
}
export function createLocation(start, end) {
    return { start, end };
}
export function createRange(start, end) {
    return [start, end];
}
