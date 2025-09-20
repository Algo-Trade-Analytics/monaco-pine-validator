import { describe, expect, it } from 'vitest';
import { createChevrotainAstService } from '../../core/ast/parser';
import { ancestors, findParent, traverse } from '../../core/ast/traversal';

const service = createChevrotainAstService();

describe('AST traversal helpers', () => {
  const source = `//@version=6\nindicator("My script", overlay=true)\nvar foo = bar()\nfoo = baz`;
  const { ast } = service.parse(source, { allowErrors: false });
  if (!ast) {
    throw new Error('Expected parser to produce an AST for traversal tests');
  }
  const program = ast;

  it('visits nodes depth-first in declaration order', () => {
    const seen: Array<{ kind: string; key: string | null; index: number | null }> = [];
    traverse(program, {
      enter(path) {
        seen.push({ kind: path.node.kind, key: path.key, index: path.index });
      },
    });

    expect(seen.map((entry) => entry.kind)).toEqual([
      'Program',
      'VersionDirective',
      'ScriptDeclaration',
      'CallExpression',
      'Identifier',
      'Argument',
      'StringLiteral',
      'Argument',
      'Identifier',
      'BooleanLiteral',
      'VariableDeclaration',
      'Identifier',
      'CallExpression',
      'Identifier',
      'AssignmentStatement',
      'Identifier',
      'Identifier',
    ]);

    const overlayArgument = seen.find(
      (entry) => entry.kind === 'Argument' && entry.index === 1,
    );
    expect(overlayArgument?.key).toBe('args');

    const boolLiteral = seen.find((entry) => entry.kind === 'BooleanLiteral');
    expect(boolLiteral?.key).toBe('value');
  });

  it('finds parent call expressions for argument nodes', () => {
    const parents: string[] = [];
    traverse(program, {
      Argument(path) {
        if (path.node.value.kind === 'BooleanLiteral') {
          const parentCall = findParent(path, 'CallExpression');
          expect(parentCall).not.toBeNull();
          parents.push(parentCall!.node.kind);
          expect(parentCall!.node.args).toContain(path.node);
        }
      },
    });

    expect(parents).toEqual(['CallExpression']);
  });

  it('collects ancestor chain up to the program root', () => {
    traverse(program, {
      BooleanLiteral(path) {
        const lineage = ancestors(path).map((ancestor) => ancestor.node.kind);
        expect(lineage).toEqual(['Argument', 'CallExpression', 'ScriptDeclaration', 'Program']);
      },
    });
  });
});
