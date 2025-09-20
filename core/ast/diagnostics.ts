import type { AstNode, SourceLocation } from './nodes';
import type {
  AstDiagnosticSeverity,
  AstDiagnostics,
  AstSyntaxError,
} from './types';
import type { ValidationError } from '../types';

export type MonacoMarkerSeverity = 2 | 4 | 8;

export interface AstMarkerData {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: MonacoMarkerSeverity;
  code?: string;
  source?: string;
}

export interface DiagnosticDetails {
  message: string;
  code?: string;
  severity?: AstDiagnosticSeverity;
  suggestion?: string;
}

const MONACO_SEVERITY_MAP: Record<AstDiagnosticSeverity, MonacoMarkerSeverity> = {
  error: 8,
  warning: 4,
  info: 2,
};

const DEFAULT_SEVERITY: AstDiagnosticSeverity = 'error';

interface LocationCoordinates {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

function extractCoordinates(location?: SourceLocation | null): LocationCoordinates {
  const startLineNumber = location?.start.line ?? 1;
  const startColumn = location?.start.column ?? 1;
  const endLineNumber = location?.end.line ?? startLineNumber;
  const endColumn = location?.end.column ?? startColumn;

  return { startLineNumber, startColumn, endLineNumber, endColumn };
}

function resolveSeverity(severity?: AstDiagnosticSeverity): AstDiagnosticSeverity {
  if (!severity) {
    return DEFAULT_SEVERITY;
  }
  return severity;
}

function markerSeverity(severity: AstDiagnosticSeverity): MonacoMarkerSeverity {
  return MONACO_SEVERITY_MAP[severity];
}

export function createValidationErrorFromLocation(
  location: SourceLocation | null | undefined,
  { message, code, severity, suggestion }: DiagnosticDetails,
): ValidationError {
  const { startLineNumber, startColumn } = extractCoordinates(location ?? null);
  const effectiveSeverity = resolveSeverity(severity);

  return {
    line: startLineNumber,
    column: startColumn,
    message,
    severity: effectiveSeverity,
    code,
    suggestion,
  };
}

export function createValidationErrorFromNode(
  node: AstNode | null | undefined,
  details: DiagnosticDetails,
): ValidationError {
  return createValidationErrorFromLocation(node?.loc ?? null, details);
}

export function createMarkerFromLocation(
  location: SourceLocation | null | undefined,
  { message, code, severity }: DiagnosticDetails,
): AstMarkerData {
  const coords = extractCoordinates(location ?? null);
  const effectiveSeverity = resolveSeverity(severity);

  return {
    ...coords,
    message,
    code,
    severity: markerSeverity(effectiveSeverity),
  };
}

export function createMarkerFromNode(
  node: AstNode | null | undefined,
  details: DiagnosticDetails,
): AstMarkerData {
  return createMarkerFromLocation(node?.loc ?? null, details);
}

export function astSyntaxErrorToValidationError(
  error: AstSyntaxError,
  defaults: { severity?: AstDiagnosticSeverity; code?: string } = {},
): ValidationError {
  return createValidationErrorFromLocation(error.loc, {
    message: error.message,
    code: defaults.code ?? error.code,
    severity: defaults.severity ?? error.severity,
  });
}

export function astSyntaxErrorsToValidationErrors(
  diagnostics: AstDiagnostics,
  defaults: { severity?: AstDiagnosticSeverity; code?: string } = {},
): ValidationError[] {
  return diagnostics.syntaxErrors.map((error) =>
    astSyntaxErrorToValidationError(error, defaults),
  );
}

export function astSyntaxErrorToMarker(
  error: AstSyntaxError,
  defaults: { severity?: AstDiagnosticSeverity; code?: string } = {},
): AstMarkerData {
  return createMarkerFromLocation(error.loc, {
    message: error.message,
    code: defaults.code ?? error.code,
    severity: defaults.severity ?? error.severity,
  });
}

export function astSyntaxErrorsToMarkers(
  diagnostics: AstDiagnostics,
  defaults: { severity?: AstDiagnosticSeverity; code?: string } = {},
): AstMarkerData[] {
  return diagnostics.syntaxErrors.map((error) =>
    astSyntaxErrorToMarker(error, defaults),
  );
}
