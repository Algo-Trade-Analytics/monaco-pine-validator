import type { SyntaxError } from '../../pynescript/ast/error';
import type { Node, SourceLocation } from './nodes';

export enum MarkerSeverity {
  Hint = 1,
  Info = 2,
  Warning = 4,
  Error = 8,
}

export interface MarkerRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface MarkerData extends MarkerRange {
  message: string;
  severity: MarkerSeverity;
  source?: string;
  code?: string;
}

export interface MarkerOptions {
  severity?: MarkerSeverity;
  source?: string;
  code?: string;
}

function normalisePosition(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.floor(value);
}

function ensureEndColumn(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): { endLine: number; endColumn: number } {
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

export function getMarkerRangeFromLocation(location: SourceLocation): MarkerRange {
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

export function getMarkerRange(node: Node): MarkerRange {
  return getMarkerRangeFromLocation(node.loc);
}

export function createMarker(
  node: Node,
  message: string,
  options: MarkerOptions = {},
): MarkerData {
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

export function createMarkerFromSyntaxError(
  error: SyntaxError,
  options: MarkerOptions = {},
): MarkerData {
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
