import { describe, expect, it } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { FunctionAstService } from '../../core/ast/service';
import { buildScopeGraph } from '../../core/ast/scope';
import { inferTypes } from '../../core/ast/type-inference';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBlock,
  createCallExpression,
  createFunctionDeclaration,
  createIdentifier,
  createParameter,
  createReturn,
  createScriptDeclaration,
  createStringLiteral,
  createVariableDeclaration,
} from './fixtures';
import {
  createLocation,
  createPosition,
  createRange,
  type ExpressionStatementNode,
  type ProgramNode,
  type StatementNode,
} from '../../core/ast/nodes';
import {
  createAstDiagnostics,
  type ScopeGraph,
  type ScopeNode,
  type SymbolRecord,
  type SymbolTable,
  type TypeEnvironment,
  type TypeMetadata,
} from '../../core/ast/types';
import { type ValidationError, type ValidationResult } from '../../core/types';
import { createBuiltinConstantsProgram } from './fixtures';

function createProgram(body: StatementNode[]): ProgramNode {
  const start = createPosition(1, 1, 0);
  const end = body.length > 0 ? body[body.length - 1].loc.end : start;
  const rangeEnd = body.length > 0 ? body[body.length - 1].range[1] : 0;

  return {
    kind: 'Program',
    directives: [],
    body,
    loc: createLocation(start, end),
    range: createRange(0, rangeEnd),
  };
}

function normaliseScopeNode(node: ScopeNode) {
  return {
    id: node.id,
    kind: node.kind,
    parent: node.parent,
    children: Array.from(node.children).sort(),
    symbols: Array.from(node.symbols).sort(),
    metadata: node.metadata ?? {},
  };
}

function summariseScopeGraph(scopeGraph: ScopeGraph) {
  return {
    root: scopeGraph.root,
    nodes: Array.from(scopeGraph.nodes.values())
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(normaliseScopeNode),
  };
}

function summariseLocations(locations: SymbolRecord['declarations']): Array<{
  line: number;
  column: number;
  node: string | null;
}> {
  return locations
    .map((location) => ({
      line: location.line,
      column: location.column,
      node: location.node ? location.node.kind : null,
    }))
    .sort((a, b) => a.line - b.line || a.column - b.column);
}

function summariseSymbolTable(symbolTable: SymbolTable) {
  return Array.from(symbolTable.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, record]) => ({
      name,
      kind: record.kind,
      declarations: summariseLocations(record.declarations),
      references: summariseLocations(record.references),
      metadata: record.metadata ?? {},
    }));
}

function simplifyMetadata(metadata: TypeMetadata | undefined | null) {
  if (!metadata) {
    return null;
  }
  return {
    kind: metadata.kind,
    certainty: metadata.certainty,
    sources: [...metadata.sources].sort(),
  };
}

function summariseTypeEnvironment(environment: TypeEnvironment, labelledNodes: Record<string, { node: object | null }>) {
  const identifiers = Array.from(environment.identifiers.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, metadata]) => ({
      name,
      kind: metadata.kind,
      certainty: metadata.certainty,
      sources: [...metadata.sources].sort(),
    }));

  const nodeSummaries: Record<string, ReturnType<typeof simplifyMetadata>> = {};
  Object.entries(labelledNodes).forEach(([label, entry]) => {
    const node = entry.node;
    const metadata = node ? environment.nodeTypes.get(node as never) : undefined;
    nodeSummaries[label] = simplifyMetadata(metadata);
  });

  return { identifiers, nodes: nodeSummaries };
}

function normaliseValidationMessages(messages: ValidationError[]) {
  return messages
    .map((entry) => ({
      line: entry.line,
      column: entry.column,
      severity: entry.severity,
      code: entry.code ?? null,
      message: entry.message,
      suggestion: entry.suggestion ?? null,
      relatedLines: entry.relatedLines ? [...entry.relatedLines] : [],
    }))
    .sort((a, b) =>
      a.line - b.line ||
      a.column - b.column ||
      a.severity.localeCompare(b.severity) ||
      (a.code ?? '').localeCompare(b.code ?? '') ||
      a.message.localeCompare(b.message),
    );
}

function summariseValidation(result: ValidationResult) {
  return {
    isValid: result.isValid,
    errors: normaliseValidationMessages(result.errors),
    warnings: normaliseValidationMessages(result.warnings),
    info: normaliseValidationMessages(result.info),
  };
}

describe('semantic golden coverage', () => {
  it('captures scope, symbol, and type metadata for a representative script', () => {
    const scriptIdentifier = createIdentifier('my_indicator', 0, 1);
    const scriptNameLiteral = createStringLiteral('Example', '"Example"', 15, 1);
    const scriptDeclaration = createScriptDeclaration(
      'indicator',
      scriptIdentifier,
      [createArgument(scriptNameLiteral, 14, 24, 1)],
      0,
      20,
      1,
    );

    const accumulatorIdentifier = createIdentifier('accumulator', 0, 2);
    const builtinClose = createIdentifier('close', 15, 2);
    const accumulatorDeclaration = createVariableDeclaration(accumulatorIdentifier, 0, 20, 2, {
      declarationKind: 'var',
      initializer: builtinClose,
    });

    const assignmentTarget = createIdentifier('accumulator', 0, 3);
    const nzCallee = createIdentifier('nz', 12, 3);
    const nzArgument = createArgument(createIdentifier('accumulator', 15, 3), 12, 27, 3);
    const nzCall = createCallExpression(nzCallee, [nzArgument], 12, 28, 3);
    const addition = createBinaryExpression(
      '+',
      nzCall,
      createIdentifier('close', 30, 3),
      12,
      40,
      3,
    );
    const accumulatorAssignment = createAssignmentStatement(assignmentTarget, addition, 0, 40, 3);

    const functionIdentifier = createIdentifier('calcSeries', 0, 4);
    const parameterInput = createParameter('input', 12, 4);
    const parameterFactor = createParameter('factor', 24, 4);
    const localIdentifier = createIdentifier('localValue', 4, 5);
    const nestedNzCall = createCallExpression(
      createIdentifier('nz', 16, 5),
      [createArgument(createIdentifier('accumulator', 19, 5), 16, 34, 5)],
      16,
      35,
      5,
    );
    const localDeclaration = createVariableDeclaration(localIdentifier, 4, 36, 5, {
      initializer: nestedNzCall,
    });
    const returnStatement = createReturn(localIdentifier, 38, 48, 5);
    const functionBody = createBlock([localDeclaration, returnStatement], 2, 50, 5, 5);
    const functionDeclaration = createFunctionDeclaration(
      functionIdentifier,
      [parameterInput, parameterFactor],
      functionBody,
      0,
      52,
      4,
      5,
    );

    const plotCall = createCallExpression(
      createIdentifier('plot', 0, 6),
      [createArgument(createIdentifier('accumulator', 5, 6), 5, 20, 6)],
      0,
      21,
      6,
    );
    const plotStatement: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: plotCall,
      loc: createLocation(createPosition(6, 1, 0), createPosition(6, 22, 21)),
      range: createRange(0, 21),
    };

    const program = createProgram([
      scriptDeclaration,
      accumulatorDeclaration,
      accumulatorAssignment,
      functionDeclaration,
      plotStatement,
    ]);

    const { scopeGraph, symbolTable } = buildScopeGraph(program);
    const typeEnvironment = inferTypes(program);

    const summary = {
      scopeGraph: summariseScopeGraph(scopeGraph),
      symbolTable: summariseSymbolTable(symbolTable),
      types: summariseTypeEnvironment(typeEnvironment, {
        scriptIdentifier: { node: scriptIdentifier },
        accumulatorIdentifier: { node: accumulatorIdentifier },
        builtinClose: { node: builtinClose },
        assignmentAddition: { node: addition },
        nzCall: { node: nzCall },
        nestedNzCall: { node: nestedNzCall },
        plotCall: { node: plotCall },
        localIdentifier: { node: localIdentifier },
        functionIdentifier: { node: functionIdentifier },
        parameterInput: { node: parameterInput.identifier },
        parameterFactor: { node: parameterFactor.identifier },
      }),
    };

    expect(summary).toMatchInlineSnapshot(`
      {
        "scopeGraph": {
          "nodes": [
            {
              "children": [
                "scope-1",
              ],
              "id": "scope-0",
              "kind": "module",
              "metadata": {
                "directives": 0,
                "nodeKind": "Program",
                "range": [
                  0,
                  21,
                ],
              },
              "parent": null,
              "symbols": [
                "accumulator",
                "calcSeries",
                "my_indicator",
              ],
            },
            {
              "children": [],
              "id": "scope-1",
              "kind": "function",
              "metadata": {
                "export": false,
                "functionName": "calcSeries",
                "nodeKind": "BlockStatement",
                "range": [
                  2,
                  50,
                ],
              },
              "parent": "scope-0",
              "symbols": [
                "factor",
                "input",
                "localValue",
              ],
            },
          ],
          "root": "scope-0",
        },
        "symbolTable": [
          {
            "declarations": [
              {
                "column": 1,
                "line": 2,
                "node": "Identifier",
              },
            ],
            "kind": "variable",
            "metadata": {
              "declarationScopes": [
                "scope-0",
              ],
            },
            "name": "accumulator",
            "references": [
              {
                "column": 1,
                "line": 3,
                "node": "Identifier",
              },
              {
                "column": 16,
                "line": 3,
                "node": "Identifier",
              },
              {
                "column": 20,
                "line": 5,
                "node": "Identifier",
              },
              {
                "column": 6,
                "line": 6,
                "node": "Identifier",
              },
            ],
          },
          {
            "declarations": [
              {
                "column": 1,
                "line": 4,
                "node": "Identifier",
              },
            ],
            "kind": "function",
            "metadata": {
              "declarationScopes": [
                "scope-0",
              ],
            },
            "name": "calcSeries",
            "references": [],
          },
          {
            "declarations": [],
            "kind": "unknown",
            "metadata": {},
            "name": "close",
            "references": [
              {
                "column": 16,
                "line": 2,
                "node": "Identifier",
              },
              {
                "column": 31,
                "line": 3,
                "node": "Identifier",
              },
            ],
          },
          {
            "declarations": [
              {
                "column": 25,
                "line": 4,
                "node": "Identifier",
              },
            ],
            "kind": "parameter",
            "metadata": {
              "declarationScopes": [
                "scope-1",
              ],
            },
            "name": "factor",
            "references": [],
          },
          {
            "declarations": [
              {
                "column": 13,
                "line": 4,
                "node": "Identifier",
              },
            ],
            "kind": "parameter",
            "metadata": {
              "declarationScopes": [
                "scope-1",
              ],
            },
            "name": "input",
            "references": [],
          },
          {
            "declarations": [
              {
                "column": 5,
                "line": 5,
                "node": "Identifier",
              },
            ],
            "kind": "variable",
            "metadata": {
              "declarationScopes": [
                "scope-1",
              ],
            },
            "name": "localValue",
            "references": [
              {
                "column": 5,
                "line": 5,
                "node": "Identifier",
              },
            ],
          },
          {
            "declarations": [
              {
                "column": 1,
                "line": 1,
                "node": "Identifier",
              },
            ],
            "kind": "namespace",
            "metadata": {
              "declarationScopes": [
                "scope-0",
              ],
            },
            "name": "my_indicator",
            "references": [],
          },
          {
            "declarations": [],
            "kind": "unknown",
            "metadata": {},
            "name": "nz",
            "references": [
              {
                "column": 13,
                "line": 3,
                "node": "Identifier",
              },
              {
                "column": 17,
                "line": 5,
                "node": "Identifier",
              },
            ],
          },
          {
            "declarations": [],
            "kind": "unknown",
            "metadata": {},
            "name": "plot",
            "references": [
              {
                "column": 1,
                "line": 6,
                "node": "Identifier",
              },
            ],
          },
        ],
        "types": {
          "identifiers": [
            {
              "certainty": "inferred",
              "kind": "series",
              "name": "accumulator",
              "sources": [
                "argument:value",
                "assignment:target",
                "binary:+",
              ],
            },
            {
              "certainty": "certain",
              "kind": "function",
              "name": "calcSeries",
              "sources": [
                "function:declaration",
              ],
            },
            {
              "certainty": "certain",
              "kind": "series",
              "name": "close",
              "sources": [
                "binary:right",
                "identifier:builtin:series",
              ],
            },
            {
              "certainty": "inferred",
              "kind": "unknown",
              "name": "factor",
              "sources": [
                "parameter:declaration",
                "parameter:factor",
              ],
            },
            {
              "certainty": "inferred",
              "kind": "unknown",
              "name": "input",
              "sources": [
                "parameter:declaration",
                "parameter:input",
              ],
            },
            {
              "certainty": "inferred",
              "kind": "series",
              "name": "localValue",
              "sources": [
                "call:builtin:nz",
                "return:argument",
                "variable:declaration",
              ],
            },
            {
              "certainty": "certain",
              "kind": "unknown",
              "name": "my_indicator",
              "sources": [
                "script:identifier",
              ],
            },
            {
              "certainty": "inferred",
              "kind": "unknown",
              "name": "nz",
              "sources": [
                "call:callee",
              ],
            },
            {
              "certainty": "inferred",
              "kind": "unknown",
              "name": "plot",
              "sources": [
                "call:callee",
              ],
            },
          ],
          "nodes": {
            "accumulatorIdentifier": {
              "certainty": "certain",
              "kind": "series",
              "sources": [
                "identifier:builtin:series",
                "variable:declaration",
              ],
            },
            "assignmentAddition": {
              "certainty": "inferred",
              "kind": "series",
              "sources": [
                "binary:+",
              ],
            },
            "builtinClose": {
              "certainty": "certain",
              "kind": "series",
              "sources": [
                "identifier:builtin:series",
              ],
            },
            "functionIdentifier": {
              "certainty": "certain",
              "kind": "function",
              "sources": [
                "function:declaration",
              ],
            },
            "localIdentifier": {
              "certainty": "inferred",
              "kind": "series",
              "sources": [
                "call:builtin:nz",
                "return:argument",
                "variable:declaration",
              ],
            },
            "nestedNzCall": {
              "certainty": "inferred",
              "kind": "series",
              "sources": [
                "call:builtin:nz",
              ],
            },
            "nzCall": {
              "certainty": "inferred",
              "kind": "series",
              "sources": [
                "call:builtin:nz",
              ],
            },
            "parameterFactor": {
              "certainty": "inferred",
              "kind": "unknown",
              "sources": [
                "parameter:declaration",
                "parameter:factor",
              ],
            },
            "parameterInput": {
              "certainty": "inferred",
              "kind": "unknown",
              "sources": [
                "parameter:declaration",
                "parameter:input",
              ],
            },
            "plotCall": {
              "certainty": "certain",
              "kind": "void",
              "sources": [
                "call:builtin:plot",
              ],
            },
            "scriptIdentifier": {
              "certainty": "certain",
              "kind": "unknown",
              "sources": [
                "script:identifier",
              ],
            },
          },
        },
      }
    `);
  });
});

describe('semantic dual-run guardrail', () => {
  it('emits richer AST diagnostics even when legacy scanning misses constants', () => {
    const source = `//@version=6\n` +
      `indicator("Builtin AST")\n` +
      `var tfDaily = timeframe.isdaily\n` +
      `var displaySetting = display.all\n` +
      `var extendSetting = extend.right\n` +
      `var formatSetting = format.price\n` +
      `var currencySetting = currency.USD\n` +
      `var scaleSetting = scale.left\n` +
      `var adjustmentSetting = adjustment.none\n` +
      `var backadjustmentSetting = backadjustment.off\n`;

    const legacyValidator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true,
      ast: { mode: 'disabled' },
    });
    const legacyResult = legacyValidator.validate(source);

    const astProgram = createBuiltinConstantsProgram();
    const astService = new FunctionAstService(() => ({
      ast: astProgram,
      diagnostics: createAstDiagnostics(),
    }));
    const astValidator = new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enablePerformanceAnalysis: true,
      ast: { mode: 'shadow', service: astService },
    });
    const astResult = astValidator.validate(source);

    const astSummary = summariseValidation(astResult);
    const legacySummary = summariseValidation(legacyResult);

    const astCodes = astSummary.info.map((entry) => entry.code);
    const legacyCodes = legacySummary.info.map((entry) => entry.code);

    expect(legacyCodes).toEqual(['PSV6-ALERT-NO-CONDITIONS']);
    expect(astCodes).toEqual([
      'PSV6-ADJUSTMENT-USAGE',
      'PSV6-ALERT-NO-CONDITIONS',
      'PSV6-BUILTIN-VARS-INFO',
      'PSV6-CURRENCY-USAGE',
      'PSV6-DISPLAY-USAGE',
      'PSV6-SCALE-USAGE',
      'PSV6-TIMEFRAME-CONSTANT',
      'PSV6-DISPLAY-CONSTANT',
      'PSV6-EXTEND-CONSTANT',
      'PSV6-FORMAT-CONSTANT',
      'PSV6-CURRENCY-CONSTANT',
      'PSV6-SCALE-CONSTANT',
      'PSV6-ADJUSTMENT-CONSTANT',
      'PSV6-BACKADJUSTMENT-CONSTANT',
    ]);

    expect(astSummary.warnings).toEqual(legacySummary.warnings);
  });
});
