import { describe, expect, it } from 'vitest';
import { createChevrotainAstService } from '../../core/ast/parser';
import { normaliseProgramAst } from '../../core/ast/normalizer';

function serialiseScopeGraph(scopeGraph: ReturnType<typeof normaliseProgramAst>['scopeGraph']) {
  const nodes: Record<string, unknown> = {};
  for (const [id, node] of scopeGraph.nodes) {
    nodes[id] = {
      kind: node.kind,
      parent: node.parent,
      children: Array.from(node.children).sort(),
      symbols: Array.from(node.symbols).sort(),
      metadata: node.metadata ?? null,
    };
  }
  return { root: scopeGraph.root, nodes };
}

describe('AST snapshots', () => {
  const service = createChevrotainAstService();

  it('matches the snapshot for a basic indicator script', () => {
    const source = `//@version=6\nindicator("Snapshot", overlay=true)\nvar foo = 1\nbar = foo\nsignal = close > open\nif signal\n    bar = foo\n`; // trailing newline keeps offsets consistent

    const result = service.parse(source, { filename: 'snapshot.pine' });
    expect(result.diagnostics.syntaxErrors).toEqual([]);
    expect(result.ast).not.toBeNull();

    expect(result.ast).toMatchInlineSnapshot(`
      {
        "body": [
          {
            "call": {
              "args": [
                {
                  "kind": "Argument",
                  "loc": {
                    "end": {
                      "column": 21,
                      "line": 2,
                      "offset": 33,
                    },
                    "start": {
                      "column": 11,
                      "line": 2,
                      "offset": 23,
                    },
                  },
                  "name": null,
                  "range": [
                    23,
                    33,
                  ],
                  "value": {
                    "kind": "StringLiteral",
                    "loc": {
                      "end": {
                        "column": 21,
                        "line": 2,
                        "offset": 33,
                      },
                      "start": {
                        "column": 11,
                        "line": 2,
                        "offset": 23,
                      },
                    },
                    "range": [
                      23,
                      33,
                    ],
                    "raw": ""Snapshot"",
                    "value": "Snapshot",
                  },
                },
                {
                  "kind": "Argument",
                  "loc": {
                    "end": {
                      "column": 35,
                      "line": 2,
                      "offset": 47,
                    },
                    "start": {
                      "column": 23,
                      "line": 2,
                      "offset": 35,
                    },
                  },
                  "name": {
                    "kind": "Identifier",
                    "loc": {
                      "end": {
                        "column": 30,
                        "line": 2,
                        "offset": 42,
                      },
                      "start": {
                        "column": 23,
                        "line": 2,
                        "offset": 35,
                      },
                    },
                    "name": "overlay",
                    "range": [
                      35,
                      42,
                    ],
                  },
                  "range": [
                    35,
                    47,
                  ],
                  "value": {
                    "kind": "BooleanLiteral",
                    "loc": {
                      "end": {
                        "column": 35,
                        "line": 2,
                        "offset": 47,
                      },
                      "start": {
                        "column": 31,
                        "line": 2,
                        "offset": 43,
                      },
                    },
                    "range": [
                      43,
                      47,
                    ],
                    "raw": "true",
                    "value": true,
                  },
                },
              ],
              "callee": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 10,
                    "line": 2,
                    "offset": 22,
                  },
                  "start": {
                    "column": 1,
                    "line": 2,
                    "offset": 13,
                  },
                },
                "name": "indicator",
                "range": [
                  13,
                  22,
                ],
              },
              "kind": "CallExpression",
              "loc": {
                "end": {
                  "column": 36,
                  "line": 2,
                  "offset": 48,
                },
                "start": {
                  "column": 1,
                  "line": 2,
                  "offset": 13,
                },
              },
              "range": [
                13,
                48,
              ],
            },
            "kind": "ScriptDeclaration",
            "loc": {
              "end": {
                "column": 36,
                "line": 2,
                "offset": 48,
              },
              "start": {
                "column": 1,
                "line": 2,
                "offset": 13,
              },
            },
            "range": [
              13,
              48,
            ],
            "scriptType": "indicator",
          },
          {
            "identifier": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 8,
                  "line": 3,
                  "offset": 56,
                },
                "start": {
                  "column": 5,
                  "line": 3,
                  "offset": 53,
                },
              },
              "name": "foo",
              "range": [
                53,
                56,
              ],
            },
            "keyword": "var",
            "kind": "VariableDeclaration",
            "loc": {
              "end": {
                "column": 12,
                "line": 3,
                "offset": 60,
              },
              "start": {
                "column": 1,
                "line": 3,
                "offset": 49,
              },
            },
            "range": [
              49,
              60,
            ],
            "value": {
              "kind": "NumberLiteral",
              "loc": {
                "end": {
                  "column": 12,
                  "line": 3,
                  "offset": 60,
                },
                "start": {
                  "column": 11,
                  "line": 3,
                  "offset": 59,
                },
              },
              "range": [
                59,
                60,
              ],
              "raw": "1",
              "value": 1,
            },
          },
          {
            "identifier": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 4,
                  "line": 4,
                  "offset": 64,
                },
                "start": {
                  "column": 1,
                  "line": 4,
                  "offset": 61,
                },
              },
              "name": "bar",
              "range": [
                61,
                64,
              ],
            },
            "kind": "AssignmentStatement",
            "loc": {
              "end": {
                "column": 10,
                "line": 4,
                "offset": 70,
              },
              "start": {
                "column": 1,
                "line": 4,
                "offset": 61,
              },
            },
            "range": [
              61,
              70,
            ],
            "value": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 10,
                  "line": 4,
                  "offset": 70,
                },
                "start": {
                  "column": 7,
                  "line": 4,
                  "offset": 67,
                },
              },
              "name": "foo",
              "range": [
                67,
                70,
              ],
            },
          },
          {
            "identifier": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 7,
                  "line": 5,
                  "offset": 77,
                },
                "start": {
                  "column": 1,
                  "line": 5,
                  "offset": 71,
                },
              },
              "name": "signal",
              "range": [
                71,
                77,
              ],
            },
            "kind": "AssignmentStatement",
            "loc": {
              "end": {
                "column": 22,
                "line": 5,
                "offset": 92,
              },
              "start": {
                "column": 1,
                "line": 5,
                "offset": 71,
              },
            },
            "range": [
              71,
              92,
            ],
            "value": {
              "kind": "BinaryExpression",
              "left": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 15,
                    "line": 5,
                    "offset": 85,
                  },
                  "start": {
                    "column": 10,
                    "line": 5,
                    "offset": 80,
                  },
                },
                "name": "close",
                "range": [
                  80,
                  85,
                ],
              },
              "loc": {
                "end": {
                  "column": 22,
                  "line": 5,
                  "offset": 92,
                },
                "start": {
                  "column": 10,
                  "line": 5,
                  "offset": 80,
                },
              },
              "operator": ">",
              "range": [
                80,
                92,
              ],
              "right": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 22,
                    "line": 5,
                    "offset": 92,
                  },
                  "start": {
                    "column": 18,
                    "line": 5,
                    "offset": 88,
                  },
                },
                "name": "open",
                "range": [
                  88,
                  92,
                ],
              },
            },
          },
          {
            "expression": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 3,
                  "line": 6,
                  "offset": 95,
                },
                "start": {
                  "column": 1,
                  "line": 6,
                  "offset": 93,
                },
              },
              "name": "if",
              "range": [
                93,
                95,
              ],
            },
            "kind": "ExpressionStatement",
            "loc": {
              "end": {
                "column": 3,
                "line": 6,
                "offset": 95,
              },
              "start": {
                "column": 1,
                "line": 6,
                "offset": 93,
              },
            },
            "range": [
              93,
              95,
            ],
          },
          {
            "expression": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 10,
                  "line": 6,
                  "offset": 102,
                },
                "start": {
                  "column": 4,
                  "line": 6,
                  "offset": 96,
                },
              },
              "name": "signal",
              "range": [
                96,
                102,
              ],
            },
            "kind": "ExpressionStatement",
            "loc": {
              "end": {
                "column": 10,
                "line": 6,
                "offset": 102,
              },
              "start": {
                "column": 4,
                "line": 6,
                "offset": 96,
              },
            },
            "range": [
              96,
              102,
            ],
          },
          {
            "identifier": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 8,
                  "line": 7,
                  "offset": 110,
                },
                "start": {
                  "column": 5,
                  "line": 7,
                  "offset": 107,
                },
              },
              "name": "bar",
              "range": [
                107,
                110,
              ],
            },
            "kind": "AssignmentStatement",
            "loc": {
              "end": {
                "column": 14,
                "line": 7,
                "offset": 116,
              },
              "start": {
                "column": 5,
                "line": 7,
                "offset": 107,
              },
            },
            "range": [
              107,
              116,
            ],
            "value": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 14,
                  "line": 7,
                  "offset": 116,
                },
                "start": {
                  "column": 11,
                  "line": 7,
                  "offset": 113,
                },
              },
              "name": "foo",
              "range": [
                113,
                116,
              ],
            },
          },
        ],
        "kind": "Program",
        "loc": {
          "end": {
            "column": 14,
            "line": 7,
            "offset": 116,
          },
          "start": {
            "column": 1,
            "line": 1,
            "offset": 0,
          },
        },
        "range": [
          0,
          116,
        ],
        "version": {
          "kind": "VersionDirective",
          "loc": {
            "end": {
              "column": 13,
              "line": 1,
              "offset": 12,
            },
            "start": {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "range": [
            0,
            12,
          ],
          "raw": "//@version=6",
          "value": 6,
        },
      }
    `);
  });

  it('captures normalised scope and symbols for the snapshot script', () => {
    const source = `//@version=6\nindicator("Snapshot", overlay=true)\nvar foo = 1\nbar = foo\nsignal = close > open\nif signal\n    bar = foo\n`;
    const { ast, diagnostics } = service.parse(source, { filename: 'snapshot.pine' });
    expect(diagnostics.syntaxErrors).toEqual([]);
    const { scopeGraph, symbolTable } = normaliseProgramAst(ast);

    expect(serialiseScopeGraph(scopeGraph)).toMatchInlineSnapshot(`
      {
        "nodes": {
          "module-0": {
            "children": [],
            "kind": "module",
            "metadata": null,
            "parent": null,
            "symbols": [
              "bar",
              "foo",
              "if",
              "indicator",
              "signal",
            ],
          },
        },
        "root": "module-0",
      }
    `);

    const serialisedSymbols = Array.from(symbolTable.entries()).map(([name, record]) => ({
      name,
      kind: record.kind,
      declarations: record.declarations.map((location) => ({
        line: location.line,
        column: location.column,
      })),
      references: record.references.map((location) => ({
        line: location.line,
        column: location.column,
      })),
      metadata: record.metadata ?? null,
    }));

    expect(serialisedSymbols).toMatchInlineSnapshot(`
      [
        {
          "declarations": [],
          "kind": "function",
          "metadata": null,
          "name": "indicator",
          "references": [
            {
              "column": 1,
              "line": 2,
            },
          ],
        },
        {
          "declarations": [
            {
              "column": 5,
              "line": 3,
            },
          ],
          "kind": "variable",
          "metadata": {
            "storage": "var",
          },
          "name": "foo",
          "references": [
            {
              "column": 7,
              "line": 4,
            },
            {
              "column": 11,
              "line": 7,
            },
          ],
        },
        {
          "declarations": [],
          "kind": "variable",
          "metadata": null,
          "name": "bar",
          "references": [
            {
              "column": 1,
              "line": 4,
            },
            {
              "column": 5,
              "line": 7,
            },
          ],
        },
        {
          "declarations": [],
          "kind": "variable",
          "metadata": null,
          "name": "signal",
          "references": [
            {
              "column": 1,
              "line": 5,
            },
            {
              "column": 4,
              "line": 6,
            },
          ],
        },
        {
          "declarations": [],
          "kind": "variable",
          "metadata": null,
          "name": "if",
          "references": [
            {
              "column": 1,
              "line": 6,
            },
          ],
        },
      ]
    `);
  });
});
