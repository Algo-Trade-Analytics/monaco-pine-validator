import { describe, expect, it } from 'vitest';
import {
  createControlFlowFixture,
  createIndicatorScriptFixture,
  createNamespaceAccessFixture,
  createSwitchMatrixFixture,
} from './fixtures';
import type { AssignmentStatementNode, SwitchStatementNode } from '../../core/ast/nodes';

describe('AST fixtures', () => {
  it('matches the indicator script snapshot', () => {
    const program = createIndicatorScriptFixture();
    expect(program).toMatchInlineSnapshot(`
      {
        "body": [
          {
            "annotations": [],
            "arguments": [
              {
                "kind": "Argument",
                "loc": {
                  "end": {
                    "column": 42,
                    "line": 2,
                    "offset": 41,
                  },
                  "start": {
                    "column": 27,
                    "line": 2,
                    "offset": 26,
                  },
                },
                "name": {
                  "kind": "Identifier",
                  "loc": {
                    "end": {
                      "column": 32,
                      "line": 2,
                      "offset": 31,
                    },
                    "start": {
                      "column": 27,
                      "line": 2,
                      "offset": 26,
                    },
                  },
                  "name": "title",
                  "range": [
                    26,
                    31,
                  ],
                },
                "range": [
                  26,
                  41,
                ],
                "value": {
                  "kind": "StringLiteral",
                  "loc": {
                    "end": {
                      "column": 42,
                      "line": 2,
                      "offset": 41,
                    },
                    "start": {
                      "column": 33,
                      "line": 2,
                      "offset": 32,
                    },
                  },
                  "range": [
                    32,
                    41,
                  ],
                  "raw": ""Example"",
                  "value": "Example",
                },
              },
            ],
            "identifier": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 30,
                  "line": 2,
                  "offset": 29,
                },
                "start": {
                  "column": 23,
                  "line": 2,
                  "offset": 22,
                },
              },
              "name": "example",
              "range": [
                22,
                29,
              ],
            },
            "kind": "ScriptDeclaration",
            "loc": {
              "end": {
                "column": 46,
                "line": 2,
                "offset": 45,
              },
              "start": {
                "column": 14,
                "line": 2,
                "offset": 13,
              },
            },
            "range": [
              13,
              45,
            ],
            "scriptType": "indicator",
          },
          {
            "annotations": [],
            "body": {
              "body": [
                {
                  "argument": {
                    "kind": "Identifier",
                    "loc": {
                      "end": {
                        "column": 68,
                        "line": 4,
                        "offset": 67,
                      },
                      "start": {
                        "column": 67,
                        "line": 4,
                        "offset": 66,
                      },
                    },
                    "name": "x",
                    "range": [
                      66,
                      67,
                    ],
                  },
                  "kind": "ReturnStatement",
                  "loc": {
                    "end": {
                      "column": 73,
                      "line": 4,
                      "offset": 72,
                    },
                    "start": {
                      "column": 63,
                      "line": 4,
                      "offset": 62,
                    },
                  },
                  "range": [
                    62,
                    72,
                  ],
                },
              ],
              "kind": "BlockStatement",
              "loc": {
                "end": {
                  "column": 76,
                  "line": 5,
                  "offset": 75,
                },
                "start": {
                  "column": 61,
                  "line": 4,
                  "offset": 60,
                },
              },
              "range": [
                60,
                75,
              ],
            },
            "export": false,
            "identifier": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 54,
                  "line": 3,
                  "offset": 53,
                },
                "start": {
                  "column": 51,
                  "line": 3,
                  "offset": 50,
                },
              },
              "name": "foo",
              "range": [
                50,
                53,
              ],
            },
            "kind": "FunctionDeclaration",
            "loc": {
              "end": {
                "column": 91,
                "line": 5,
                "offset": 90,
              },
              "start": {
                "column": 47,
                "line": 3,
                "offset": 46,
              },
            },
            "params": [
              {
                "defaultValue": null,
                "identifier": {
                  "kind": "Identifier",
                  "loc": {
                    "end": {
                      "column": 57,
                      "line": 3,
                      "offset": 56,
                    },
                    "start": {
                      "column": 56,
                      "line": 3,
                      "offset": 55,
                    },
                  },
                  "name": "x",
                  "range": [
                    55,
                    56,
                  ],
                },
                "kind": "Parameter",
                "loc": {
                  "end": {
                    "column": 57,
                    "line": 3,
                    "offset": 56,
                  },
                  "start": {
                    "column": 56,
                    "line": 3,
                    "offset": 55,
                  },
                },
                "range": [
                  55,
                  56,
                ],
                "typeAnnotation": null,
              },
            ],
            "range": [
              46,
              90,
            ],
            "returnType": null,
          },
          {
            "expression": {
              "args": [
                {
                  "kind": "Argument",
                  "loc": {
                    "end": {
                      "column": 102,
                      "line": 6,
                      "offset": 101,
                    },
                    "start": {
                      "column": 100,
                      "line": 6,
                      "offset": 99,
                    },
                  },
                  "name": null,
                  "range": [
                    99,
                    101,
                  ],
                  "value": {
                    "kind": "NumberLiteral",
                    "loc": {
                      "end": {
                        "column": 102,
                        "line": 6,
                        "offset": 101,
                      },
                      "start": {
                        "column": 101,
                        "line": 6,
                        "offset": 100,
                      },
                    },
                    "range": [
                      100,
                      101,
                    ],
                    "raw": "1",
                    "value": 1,
                  },
                },
              ],
              "callee": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 95,
                    "line": 6,
                    "offset": 94,
                  },
                  "start": {
                    "column": 92,
                    "line": 6,
                    "offset": 91,
                  },
                },
                "name": "foo",
                "range": [
                  91,
                  94,
                ],
              },
              "kind": "CallExpression",
              "loc": {
                "end": {
                  "column": 103,
                  "line": 6,
                  "offset": 102,
                },
                "start": {
                  "column": 92,
                  "line": 6,
                  "offset": 91,
                },
              },
              "range": [
                91,
                102,
              ],
              "typeArguments": [],
            },
            "kind": "ExpressionStatement",
            "loc": {
              "end": {
                "column": 103,
                "line": 6,
                "offset": 102,
              },
              "start": {
                "column": 92,
                "line": 6,
                "offset": 91,
              },
            },
            "range": [
              91,
              102,
            ],
          },
        ],
        "directives": [
          {
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
            "version": 6,
          },
        ],
        "kind": "Program",
        "loc": {
          "end": {
            "column": 103,
            "line": 6,
            "offset": 102,
          },
          "start": {
            "column": 1,
            "line": 1,
            "offset": 0,
          },
        },
        "range": [
          0,
          102,
        ],
      }
    `);
  });

  it('matches the namespace access snapshot', () => {
    const program = createNamespaceAccessFixture();
    expect(program).toMatchInlineSnapshot(`
      {
        "body": [
          {
            "annotations": [],
            "declarationKind": "var",
            "identifier": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 23,
                  "line": 1,
                  "offset": 22,
                },
                "start": {
                  "column": 21,
                  "line": 1,
                  "offset": 20,
                },
              },
              "name": "tf",
              "range": [
                20,
                22,
              ],
            },
            "initializer": {
              "computed": false,
              "kind": "MemberExpression",
              "loc": {
                "end": {
                  "column": 17,
                  "line": 1,
                  "offset": 16,
                },
                "start": {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "object": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 10,
                    "line": 1,
                    "offset": 9,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "name": "timeframe",
                "range": [
                  0,
                  9,
                ],
              },
              "property": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 17,
                    "line": 1,
                    "offset": 16,
                  },
                  "start": {
                    "column": 11,
                    "line": 1,
                    "offset": 10,
                  },
                },
                "name": "period",
                "range": [
                  10,
                  16,
                ],
              },
              "range": [
                0,
                16,
              ],
            },
            "kind": "VariableDeclaration",
            "loc": {
              "end": {
                "column": 37,
                "line": 1,
                "offset": 36,
              },
              "start": {
                "column": 21,
                "line": 1,
                "offset": 20,
              },
            },
            "range": [
              20,
              36,
            ],
            "typeAnnotation": null,
          },
          {
            "annotations": [],
            "declarationKind": "var",
            "identifier": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 68,
                  "line": 2,
                  "offset": 67,
                },
                "start": {
                  "column": 61,
                  "line": 2,
                  "offset": 60,
                },
              },
              "name": "isDaily",
              "range": [
                60,
                67,
              ],
            },
            "initializer": {
              "computed": false,
              "kind": "MemberExpression",
              "loc": {
                "end": {
                  "column": 59,
                  "line": 2,
                  "offset": 58,
                },
                "start": {
                  "column": 41,
                  "line": 2,
                  "offset": 40,
                },
              },
              "object": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 50,
                    "line": 2,
                    "offset": 49,
                  },
                  "start": {
                    "column": 41,
                    "line": 2,
                    "offset": 40,
                  },
                },
                "name": "timeframe",
                "range": [
                  40,
                  49,
                ],
              },
              "property": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 58,
                    "line": 2,
                    "offset": 57,
                  },
                  "start": {
                    "column": 51,
                    "line": 2,
                    "offset": 50,
                  },
                },
                "name": "isdaily",
                "range": [
                  50,
                  57,
                ],
              },
              "range": [
                40,
                58,
              ],
            },
            "kind": "VariableDeclaration",
            "loc": {
              "end": {
                "column": 83,
                "line": 2,
                "offset": 82,
              },
              "start": {
                "column": 61,
                "line": 2,
                "offset": 60,
              },
            },
            "range": [
              60,
              82,
            ],
            "typeAnnotation": null,
          },
        ],
        "directives": [],
        "kind": "Program",
        "loc": {
          "end": {
            "column": 83,
            "line": 2,
            "offset": 82,
          },
          "start": {
            "column": 1,
            "line": 1,
            "offset": 0,
          },
        },
        "range": [
          0,
          82,
        ],
      }
    `);
  });

  it('matches the control flow snapshot', () => {
    const program = createControlFlowFixture();
    expect(program).toMatchInlineSnapshot(`
      {
        "body": [
          {
            "alternate": null,
            "consequent": {
              "body": [
                {
                  "expression": {
                    "alternate": {
                      "kind": "Identifier",
                      "loc": {
                        "end": {
                          "column": 84,
                          "line": 3,
                          "offset": 83,
                        },
                        "start": {
                          "column": 81,
                          "line": 3,
                          "offset": 80,
                        },
                      },
                      "name": "bar",
                      "range": [
                        80,
                        83,
                      ],
                    },
                    "consequent": {
                      "kind": "Identifier",
                      "loc": {
                        "end": {
                          "column": 80,
                          "line": 3,
                          "offset": 79,
                        },
                        "start": {
                          "column": 77,
                          "line": 3,
                          "offset": 76,
                        },
                      },
                      "name": "foo",
                      "range": [
                        76,
                        79,
                      ],
                    },
                    "kind": "ConditionalExpression",
                    "loc": {
                      "end": {
                        "column": 84,
                        "line": 3,
                        "offset": 83,
                      },
                      "start": {
                        "column": 71,
                        "line": 3,
                        "offset": 70,
                      },
                    },
                    "range": [
                      70,
                      83,
                    ],
                    "test": {
                      "kind": "Identifier",
                      "loc": {
                        "end": {
                          "column": 75,
                          "line": 3,
                          "offset": 74,
                        },
                        "start": {
                          "column": 71,
                          "line": 3,
                          "offset": 70,
                        },
                      },
                      "name": "flag",
                      "range": [
                        70,
                        74,
                      ],
                    },
                  },
                  "kind": "ExpressionStatement",
                  "loc": {
                    "end": {
                      "column": 85,
                      "line": 3,
                      "offset": 84,
                    },
                    "start": {
                      "column": 69,
                      "line": 3,
                      "offset": 68,
                    },
                  },
                  "range": [
                    68,
                    84,
                  ],
                },
              ],
              "kind": "BlockStatement",
              "loc": {
                "end": {
                  "column": 91,
                  "line": 4,
                  "offset": 90,
                },
                "start": {
                  "column": 66,
                  "line": 3,
                  "offset": 65,
                },
              },
              "range": [
                65,
                90,
              ],
            },
            "kind": "IfStatement",
            "loc": {
              "end": {
                "column": 91,
                "line": 3,
                "offset": 90,
              },
              "start": {
                "column": 61,
                "line": 3,
                "offset": 60,
              },
            },
            "range": [
              60,
              90,
            ],
            "test": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 67,
                  "line": 3,
                  "offset": 66,
                },
                "start": {
                  "column": 61,
                  "line": 3,
                  "offset": 60,
                },
              },
              "name": "ifCond",
              "range": [
                60,
                66,
              ],
            },
          },
          {
            "body": {
              "body": [
                {
                  "annotations": [],
                  "declarationKind": "var",
                  "identifier": {
                    "kind": "Identifier",
                    "loc": {
                      "end": {
                        "column": 113,
                        "line": 5,
                        "offset": 112,
                      },
                      "start": {
                        "column": 103,
                        "line": 5,
                        "offset": 102,
                      },
                    },
                    "name": "loopResult",
                    "range": [
                      102,
                      112,
                    ],
                  },
                  "initializer": {
                    "kind": "Identifier",
                    "loc": {
                      "end": {
                        "column": 120,
                        "line": 5,
                        "offset": 119,
                      },
                      "start": {
                        "column": 111,
                        "line": 5,
                        "offset": 110,
                      },
                    },
                    "name": "loopGuard",
                    "range": [
                      110,
                      119,
                    ],
                  },
                  "kind": "VariableDeclaration",
                  "loc": {
                    "end": {
                      "column": 113,
                      "line": 5,
                      "offset": 112,
                    },
                    "start": {
                      "column": 101,
                      "line": 5,
                      "offset": 100,
                    },
                  },
                  "range": [
                    100,
                    112,
                  ],
                  "typeAnnotation": null,
                },
              ],
              "kind": "BlockStatement",
              "loc": {
                "end": {
                  "column": 121,
                  "line": 6,
                  "offset": 120,
                },
                "start": {
                  "column": 99,
                  "line": 5,
                  "offset": 98,
                },
              },
              "range": [
                98,
                120,
              ],
            },
            "kind": "WhileStatement",
            "loc": {
              "end": {
                "column": 121,
                "line": 5,
                "offset": 120,
              },
              "start": {
                "column": 96,
                "line": 5,
                "offset": 95,
              },
            },
            "range": [
              95,
              120,
            ],
            "result": null,
            "resultBinding": null,
            "test": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 106,
                  "line": 5,
                  "offset": 105,
                },
                "start": {
                  "column": 97,
                  "line": 5,
                  "offset": 96,
                },
              },
              "name": "loopGuard",
              "range": [
                96,
                105,
              ],
            },
          },
          {
            "body": {
              "body": [
                {
                  "expression": {
                    "kind": "Identifier",
                    "loc": {
                      "end": {
                        "column": 154,
                        "line": 8,
                        "offset": 153,
                      },
                      "start": {
                        "column": 151,
                        "line": 8,
                        "offset": 150,
                      },
                    },
                    "name": "idx",
                    "range": [
                      150,
                      153,
                    ],
                  },
                  "kind": "ExpressionStatement",
                  "loc": {
                    "end": {
                      "column": 153,
                      "line": 8,
                      "offset": 152,
                    },
                    "start": {
                      "column": 149,
                      "line": 8,
                      "offset": 148,
                    },
                  },
                  "range": [
                    148,
                    152,
                  ],
                },
              ],
              "kind": "BlockStatement",
              "loc": {
                "end": {
                  "column": 161,
                  "line": 9,
                  "offset": 160,
                },
                "start": {
                  "column": 146,
                  "line": 8,
                  "offset": 145,
                },
              },
              "range": [
                145,
                160,
              ],
            },
            "initializer": {
              "annotations": [],
              "declarationKind": "var",
              "identifier": {
                "kind": "Identifier",
                "loc": {
                  "end": {
                    "column": 136,
                    "line": 7,
                    "offset": 135,
                  },
                  "start": {
                    "column": 133,
                    "line": 7,
                    "offset": 132,
                  },
                },
                "name": "idx",
                "range": [
                  132,
                  135,
                ],
              },
              "initializer": {
                "kind": "NumberLiteral",
                "loc": {
                  "end": {
                    "column": 138,
                    "line": 7,
                    "offset": 137,
                  },
                  "start": {
                    "column": 137,
                    "line": 7,
                    "offset": 136,
                  },
                },
                "range": [
                  136,
                  137,
                ],
                "raw": "0",
                "value": 0,
              },
              "kind": "VariableDeclaration",
              "loc": {
                "end": {
                  "column": 139,
                  "line": 7,
                  "offset": 138,
                },
                "start": {
                  "column": 133,
                  "line": 7,
                  "offset": 132,
                },
              },
              "range": [
                132,
                138,
              ],
              "typeAnnotation": null,
            },
            "iterable": null,
            "iterator": null,
            "kind": "ForStatement",
            "loc": {
              "end": {
                "column": 161,
                "line": 7,
                "offset": 160,
              },
              "start": {
                "column": 131,
                "line": 7,
                "offset": 130,
              },
            },
            "range": [
              130,
              160,
            ],
            "result": null,
            "resultBinding": null,
            "test": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 148,
                  "line": 7,
                  "offset": 147,
                },
                "start": {
                  "column": 141,
                  "line": 7,
                  "offset": 140,
                },
              },
              "name": "hasNext",
              "range": [
                140,
                147,
              ],
            },
            "update": {
              "kind": "Identifier",
              "loc": {
                "end": {
                  "column": 146,
                  "line": 7,
                  "offset": 145,
                },
                "start": {
                  "column": 143,
                  "line": 7,
                  "offset": 142,
                },
              },
              "name": "idx",
              "range": [
                142,
                145,
              ],
            },
          },
        ],
        "directives": [],
        "kind": "Program",
        "loc": {
          "end": {
            "column": 161,
            "line": 9,
            "offset": 160,
          },
          "start": {
            "column": 51,
            "line": 3,
            "offset": 50,
          },
        },
        "range": [
          50,
          160,
        ],
      }
    `);
  });

  it('describes the switch and matrix fixture structure', () => {
    const program = createSwitchMatrixFixture();
    expect(program.body.map((node) => node.kind)).toEqual(['VariableDeclaration', 'SwitchStatement']);

    const switchNode = program.body[1] as SwitchStatementNode;
    expect(switchNode.cases).toHaveLength(3);
    expect(switchNode.cases.map((caseNode) => (caseNode.test ? 'test' : 'default'))).toEqual([
      'test',
      'test',
      'default',
    ]);

    const secondCase = switchNode.cases[1];
    const assignment = secondCase.consequent[0] as AssignmentStatementNode;
    expect(assignment.right?.kind).toBe('IndexExpression');
  });
});
