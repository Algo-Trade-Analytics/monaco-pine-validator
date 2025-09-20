import { describe, expect, it } from 'vitest';
import {
  astSyntaxErrorToMarker,
  astSyntaxErrorToValidationError,
  astSyntaxErrorsToMarkers,
  astSyntaxErrorsToValidationErrors,
  createMarkerFromNode,
  createValidationErrorFromNode,
} from '../../core/ast/diagnostics';
import { createAstDiagnostics } from '../../core/ast/types';

const baseError = {
  code: 'AST-PARSER',
  severity: 'error' as const,
  phase: 'parsing' as const,
};

const sampleNode = {
  kind: 'Identifier' as const,
  name: 'foo',
  loc: {
    start: { line: 2, column: 4, offset: 10 },
    end: { line: 2, column: 7, offset: 13 },
  },
  range: [10, 13] as const,
};

describe('AST diagnostics helpers', () => {
  it('creates validation errors from nodes with defaults', () => {
    const error = createValidationErrorFromNode(sampleNode, {
      message: 'Something went wrong',
    });

    expect(error).toEqual({
      line: 2,
      column: 4,
      message: 'Something went wrong',
      severity: 'error',
      code: undefined,
      suggestion: undefined,
    });
  });

  it('creates validation errors with explicit severity and code', () => {
    const error = createValidationErrorFromNode(sampleNode, {
      message: 'Warn about identifier',
      code: 'AST-WARN',
      severity: 'warning',
    });

    expect(error.severity).toBe('warning');
    expect(error.code).toBe('AST-WARN');
  });

  it('creates Monaco marker data from nodes', () => {
    const marker = createMarkerFromNode(sampleNode, {
      message: 'Highlight identifier',
    });

    expect(marker).toEqual({
      startLineNumber: 2,
      startColumn: 4,
      endLineNumber: 2,
      endColumn: 7,
      message: 'Highlight identifier',
      code: undefined,
      severity: 8,
    });
  });

  it('converts syntax errors into validation errors with overrides', () => {
    const diagnostics = createAstDiagnostics([
      {
        ...baseError,
        message: 'Unexpected token',
        range: [5, 6],
        loc: {
          start: { line: 1, column: 6, offset: 5 },
          end: { line: 1, column: 7, offset: 6 },
        },
      },
    ]);

    const errors = astSyntaxErrorsToValidationErrors(diagnostics, {
      code: 'AST-SYNTAX',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      line: 1,
      column: 6,
      severity: 'error',
      code: 'AST-SYNTAX',
    });
  });

  it('converts syntax errors into marker data', () => {
    const syntaxError = {
      ...baseError,
      message: 'Missing closing parenthesis',
      range: [15, 20] as const,
      loc: {
        start: { line: 4, column: 3, offset: 15 },
        end: { line: 4, column: 8, offset: 20 },
      },
    };

    const marker = astSyntaxErrorToMarker(syntaxError, { severity: 'warning' });

    expect(marker).toMatchObject({
      startLineNumber: 4,
      endColumn: 8,
      severity: 4,
    });
  });

  it('maps multiple syntax errors to markers', () => {
    const diagnostics = createAstDiagnostics([
      {
        ...baseError,
        message: 'First issue',
        range: [0, 1],
        loc: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 2, offset: 1 },
        },
      },
      {
        ...baseError,
        message: 'Second issue',
        range: [2, 3],
        loc: {
          start: { line: 2, column: 5, offset: 2 },
          end: { line: 2, column: 6, offset: 3 },
        },
      },
    ]);

    const markers = astSyntaxErrorsToMarkers(diagnostics);

    expect(markers).toHaveLength(2);
    expect(markers[1]).toMatchObject({
      startLineNumber: 2,
      startColumn: 5,
      severity: 8,
    });
  });

  it('creates individual validation errors from syntax errors', () => {
    const syntaxError = {
      ...baseError,
      message: 'Something broke',
      range: [3, 4] as const,
      loc: {
        start: { line: 3, column: 2, offset: 3 },
        end: { line: 3, column: 5, offset: 4 },
      },
      code: 'AST-CUSTOM',
    };

    const error = astSyntaxErrorToValidationError(syntaxError, { severity: 'warning' });

    expect(error).toMatchObject({
      code: 'AST-CUSTOM',
      severity: 'warning',
      line: 3,
      column: 2,
    });
  });
});
