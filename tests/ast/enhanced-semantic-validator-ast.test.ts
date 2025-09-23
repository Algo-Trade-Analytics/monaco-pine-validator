import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedSemanticValidator } from '../../modules/enhanced-semantic-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBlock,
  createCallExpression,
  createConditionalExpression,
  createFunctionDeclaration,
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createReturn,
  createTypeReference,
  createVariableDeclaration,
} from './fixtures';

class EnhancedSemanticHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service }, enableInfo: true });
    this.registerModule(new EnhancedSemanticValidator());
  }

  protected runCoreValidation(): void {}
}

function createQualifiedTypeReference(
  qualifier: string,
  baseType: string,
  start: number,
  line: number,
): ReturnType<typeof createTypeReference> {
  const qualifierRef = createTypeReference(qualifier, start, line);
  qualifierRef.generics.push(createTypeReference(baseType, start + qualifier.length + 1, line));
  return qualifierRef;
}

describe('EnhancedSemanticValidator (AST)', () => {
  it('emits PSV6-TYPE-FLOW when series values assign to simple declarations', () => {
    const seriesType = createQualifiedTypeReference('series', 'float', 0, 1);
    const simpleType = createQualifiedTypeReference('simple', 'int', 0, 2);

    const smaCallee = createMemberExpression(createIdentifier('ta', 0, 1), createIdentifier('sma', 3, 1), 0, 7, 1);
    const smaCall = createCallExpression(
      smaCallee,
      [
        createArgument(createIdentifier('close', 8, 1), 8, 13, 1),
        createArgument(createNumberLiteral(14, '14', 14, 1), 14, 16, 1),
      ],
      0,
      16,
      1,
    );

    const seriesDeclaration = createVariableDeclaration(createIdentifier('source', 0, 1), 0, 22, 1, {
      declarationKind: 'var',
      typeAnnotation: seriesType,
      initializer: smaCall,
    });

    const simpleDeclaration = createVariableDeclaration(createIdentifier('len', 0, 2), 0, 24, 2, {
      declarationKind: 'simple',
      typeAnnotation: simpleType,
      initializer: createIdentifier('source', 20, 2),
    });

    const program = createProgram([seriesDeclaration, simpleDeclaration], 0, 24, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedSemanticHarness(service);

    const source = [
      'series float source = ta.sma(close, 14)',
      'simple int len = source',
    ].join('\n');

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-TYPE-FLOW');
  });

  it('emits PSV6-TYPE-FLOW when series declarations consume input identifiers', () => {
    const inputType = createQualifiedTypeReference('input', 'int', 0, 1);
    const seriesType = createQualifiedTypeReference('series', 'float', 0, 2);

    const inputDeclaration = createVariableDeclaration(createIdentifier('userInput', 0, 1), 0, 24, 1, {
      declarationKind: 'simple',
      typeAnnotation: inputType,
      initializer: createNumberLiteral(10, '10', 18, 1),
    });

    const seriesInitializer = createBinaryExpression(
      '+',
      createIdentifier('userInput', 18, 2),
      createIdentifier('close', 31, 2),
      18,
      36,
      2,
    );

    const seriesDeclaration = createVariableDeclaration(createIdentifier('result', 0, 2), 0, 36, 2, {
      declarationKind: 'var',
      typeAnnotation: seriesType,
      initializer: seriesInitializer,
    });

    const program = createProgram([inputDeclaration, seriesDeclaration], 0, 36, 1, 2);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedSemanticHarness(service);

    const source = [
      'input int userInput = 10',
      'series float result = userInput + close',
    ].join('\n');

    const result = harness.validate(source);
    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-TYPE-FLOW');
  });

  it('suggests annotations for complex assignments without declarations', () => {
    const comparison = createBinaryExpression(
      '>',
      createIdentifier('close', 8, 1),
      createIdentifier('open', 17, 1),
      8,
      21,
      1,
    );

    const ternary = createConditionalExpression(
      comparison,
      createNumberLiteral(1, '1', 25, 1),
      createNumberLiteral(0, '0', 29, 1),
      8,
      29,
      1,
    );

    const assignment = createAssignmentStatement(createIdentifier('myVar', 0, 1), ternary, 0, 29, 1);
    const program = createProgram([assignment], 0, 29, 1, 1);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedSemanticHarness(service);

    const source = 'myVar = close > open ? 1 : 0';
    const result = harness.validate(source);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-TYPE-INFERENCE');
  });

  it('suggests return type annotations for ambiguous functions', () => {
    const comparison = createBinaryExpression(
      '>',
      createIdentifier('close', 13, 1),
      createIdentifier('open', 22, 1),
      13,
      26,
      1,
    );

    const ternary = createConditionalExpression(
      comparison,
      createNumberLiteral(1, '1', 30, 1),
      createNumberLiteral(0, '0', 34, 1),
      13,
      34,
      1,
    );

    const returnStatement = createReturn(ternary, 9, 34, 1);
    const body = createBlock([returnStatement], 9, 34, 1, 1);
    const fnDeclaration = createFunctionDeclaration(createIdentifier('computeSignal', 0, 1), [], body, 0, 34, 1, 1);

    const program = createProgram([fnDeclaration], 0, 34, 1, 1);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedSemanticHarness(service);

    const source = 'computeSignal() => close > open ? 1 : 0';
    const result = harness.validate(source);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-TYPE-INFERENCE');
  });

  it('does not suggest return types when annotations are present', () => {
    const returnStatement = createReturn(createNumberLiteral(1, '1', 18, 1), 9, 18, 1);
    const body = createBlock([returnStatement], 9, 18, 1, 1);
    const fnDeclaration = createFunctionDeclaration(
      createIdentifier('computeValue', 0, 1),
      [],
      body,
      0,
      18,
      1,
      1,
      { returnType: createTypeReference('int', 0, 1) },
    );

    const program = createProgram([fnDeclaration], 0, 18, 1, 1);
    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedSemanticHarness(service);

    const source = 'int computeValue() => 1';
    const result = harness.validate(source);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).not.toContain('PSV6-TYPE-INFERENCE');
  });
});
