import { describe, expect, it } from 'vitest';
import { IndentationError, SyntaxError } from '../../pynescript/ast/error';

describe('PineScript AST errors', () => {
  it('captures structured details from positional arguments', () => {
    const error = new SyntaxError('oops', 'script.ps', 2, 4, '    foo()');
    expect(error.details).toEqual({
      filename: 'script.ps',
      lineno: 2,
      offset: 4,
      text: '    foo()',
      end_lineno: null,
      end_offset: null,
    });
    expect(error.toString()).toContain('File "script.ps", line 2');
    expect(error.toString()).toContain('^');
  });

  it('accepts structured error payloads', () => {
    const error = new SyntaxError('bad indent', {
      filename: 'script.ps',
      lineno: 1,
      offset: 0,
      text: 'bad',
      end_lineno: 1,
      end_offset: 3,
    });
    expect(error.toString()).toContain('bad indent');
    expect(error.details?.end_lineno).toBe(1);
  });

  it('supports specialized error subclasses', () => {
    const error = new IndentationError('indent', 'script.ps', 3, 2, '  foo');
    expect(error).toBeInstanceOf(SyntaxError);
    expect(error.name).toBe('SyntaxError');
  });
});
