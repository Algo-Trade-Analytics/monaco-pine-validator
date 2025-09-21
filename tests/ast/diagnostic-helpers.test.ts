import { describe, expect, it } from 'vitest';

import {
  MarkerSeverity,
  createMarker,
  createMarkerFromSyntaxError,
  getMarkerRange,
  getMarkerRangeFromLocation,
} from '../../core/ast/diagnostics';
import { SyntaxError } from '../../pynescript/ast/error';
import { createIdentifier } from './fixtures';
import { type CommentNode, createLocation, createPosition } from '../../core/ast/nodes';

describe('diagnostic helpers', () => {
  it('converts node locations into Monaco compatible ranges', () => {
    const identifier = createIdentifier('foo', 2);

    expect(getMarkerRange(identifier)).toEqual({
      startLineNumber: 1,
      startColumn: 3,
      endLineNumber: 1,
      endColumn: 6,
    });

    expect(createMarker(identifier, 'unknown identifier')).toEqual({
      message: 'unknown identifier',
      severity: MarkerSeverity.Error,
      startLineNumber: 1,
      startColumn: 3,
      endLineNumber: 1,
      endColumn: 6,
    });
  });

  it('normalises malformed end columns and multi-line spans', () => {
    const node: CommentNode = {
      kind: 'Comment',
      value: '/* comment */',
      style: 'block',
      loc: createLocation(
        createPosition(2, 5, 12),
        createPosition(4, 0, 30),
      ),
      range: [12, 30],
    };

    expect(getMarkerRangeFromLocation(node.loc)).toEqual({
      startLineNumber: 2,
      startColumn: 5,
      endLineNumber: 4,
      endColumn: 6,
    });
  });

  it('maps syntax errors to markers with safe fallbacks', () => {
    const error = new SyntaxError('Unexpected token', {
      filename: 'script.pine',
      lineno: 3,
      offset: 7,
      text: 'foo = )',
      end_lineno: 3,
      end_offset: 8,
    });

    expect(createMarkerFromSyntaxError(error, { source: 'parser' })).toEqual({
      message: 'Unexpected token',
      severity: MarkerSeverity.Error,
      source: 'parser',
      startLineNumber: 3,
      startColumn: 7,
      endLineNumber: 3,
      endColumn: 8,
    });

    const withoutDetails = new SyntaxError('Parser crashed');
    expect(createMarkerFromSyntaxError(withoutDetails, { severity: MarkerSeverity.Warning })).toEqual({
      message: 'Parser crashed',
      severity: MarkerSeverity.Warning,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 2,
    });
  });
});
