import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { TypeInferenceValidator } from '../../modules/type-inference-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createArgument,
  createAssignmentStatement,
  createBinaryExpression,
  createBooleanLiteral,
  createCallExpression,
  createIdentifier,
  createIfStatement,
  createMemberExpression,
  createNumberLiteral,
  createProgram,
  createStringLiteral,
  createTypeReference,
  createVariableDeclaration,
} from './fixtures';

class TypeInferenceHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service }, enableTypeChecking: true, enableControlFlowAnalysis: true });
    this.registerModule(new TypeInferenceValidator());
  }

  // The harness bypasses legacy validators and relies exclusively on AST fixtures.
  protected runCoreValidation(): void {}
}

describe('TypeInferenceValidator (AST)', () => {
  it('reports assignment mismatches for typed declarations', () => {
    const floatDecl = createVariableDeclaration(createIdentifier('price', 0, 1), 0, 22, 1, {
      typeAnnotation: createTypeReference('float', 6, 1),
      initializer: createStringLiteral('100.5', '"100.5"', 18, 1),
    });

    const intDecl = createVariableDeclaration(createIdentifier('count', 0, 2), 0, 18, 2, {
      typeAnnotation: createTypeReference('int', 5, 2),
      initializer: createBooleanLiteral(true, 15, 2),
    });

    const boolDecl = createVariableDeclaration(createIdentifier('flag', 0, 3), 0, 18, 3, {
      typeAnnotation: createTypeReference('bool', 5, 3),
      initializer: createNumberLiteral(10, '10', 16, 3),
    });

    const program = createProgram([floatDecl, intDecl, boolDecl], 0, 24, 1, 3);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TypeInferenceHarness(service);

    const source = ['float price = "100.5"', 'int count = true', 'bool flag = 10'].join('\n');
    const result = harness.validate(source);

    const errorCodes = result.errors.map((error) => error.code);

    expect(errorCodes).toContain('PSV6-TYPE-ASSIGNMENT-MISMATCH');
    expect(errorCodes).toContain('PSV6-TYPE-ANNOTATION-MISMATCH');
  });

  it('flags function parameter mismatches and redundant conversions', () => {
    const taIdentifier = createIdentifier('ta', 0, 1);
    const smaIdentifier = createIdentifier('sma', 3, 1);
    const smaMember = createMemberExpression(taIdentifier, smaIdentifier, 0, 7, 1);
    const smaArgs = [
      createArgument(createStringLiteral('close', '"close"', 8, 1), 8, 15, 1),
      createArgument(createStringLiteral('20', '"20"', 17, 1), 17, 21, 1),
    ];
    const smaCall = createCallExpression(smaMember, smaArgs, 0, 21, 1);

    const mathIdentifier = createIdentifier('math', 0, 2);
    const maxIdentifier = createIdentifier('max', 5, 2);
    const maxMember = createMemberExpression(mathIdentifier, maxIdentifier, 0, 8, 2);
    const maxArgs = [
      createArgument(createNumberLiteral(10, '10', 9, 2), 9, 11, 2),
      createArgument(createStringLiteral('20', '"20"', 13, 2), 13, 17, 2),
    ];
    const maxCall = createCallExpression(maxMember, maxArgs, 0, 17, 2);

    const strIdentifier = createIdentifier('str', 0, 3);
    const tostringIdentifier = createIdentifier('tostring', 4, 3);
    const tostringMember = createMemberExpression(strIdentifier, tostringIdentifier, 0, 12, 3);
    const tostringArgs = [createArgument(createStringLiteral('message', '"message"', 13, 3), 13, 22, 3)];
    const tostringCall = createCallExpression(tostringMember, tostringArgs, 0, 22, 3);

    const program = createProgram([smaCall, maxCall, tostringCall], 0, 24, 1, 3);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TypeInferenceHarness(service);

    const source = [
      'ta.sma("close", "20")',
      'math.max(10, "20")',
      'str.tostring("message")',
    ].join('\n');
    const result = harness.validate(source);

    const errorCodes = result.errors.map((error) => error.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(errorCodes).toContain('PSV6-TYPE-FUNCTION-PARAM-MISMATCH');
    expect(infoCodes).toContain('PSV6-TYPE-CONVERSION-REDUNDANT-STRING');
  });

  it('emits conditional and na safety diagnostics', () => {
    const literalCondition = createIfStatement(
      createNumberLiteral(10, '10', 3, 1),
      createAssignmentStatement(createIdentifier('noop', 4, 2), createNumberLiteral(1, '1', 10, 2), 0, 12, 2),
      null,
      0,
      12,
      1,
    );

    const closeCondition = createIfStatement(
      createIdentifier('close', 3, 3),
      createAssignmentStatement(createIdentifier('noop', 4, 4), createNumberLiteral(1, '1', 10, 4), 0, 12, 4),
      null,
      0,
      12,
      3,
    );

    const valueAssign = createVariableDeclaration(createIdentifier('value', 0, 5), 0, 14, 5, {
      initializer: createNumberLiteral(10, '10', 8, 5),
    });

    const valueCondition = createIfStatement(
      createIdentifier('value', 3, 6),
      createAssignmentStatement(createIdentifier('noop', 4, 7), createNumberLiteral(1, '1', 10, 7), 0, 12, 7),
      null,
      0,
      12,
      6,
    );

    const naAddition = createAssignmentStatement(
      createIdentifier('result', 0, 8),
      createBinaryExpression('+', createIdentifier('na', 9, 8), createNumberLiteral(10, '10', 14, 8), 9, 16, 8),
      0,
      16,
      8,
    );

    const naComparison = createAssignmentStatement(
      createIdentifier('comparison', 0, 9),
      createBinaryExpression('==', createIdentifier('na', 12, 9), createNumberLiteral(0, '0', 18, 9), 12, 19, 9),
      0,
      19,
      9,
    );

    const naAssign = createAssignmentStatement(createIdentifier('holder', 0, 10), createIdentifier('na', 10, 10), 0, 12, 10);

    const program = createProgram(
      [literalCondition, closeCondition, valueAssign, valueCondition, naAddition, naComparison, naAssign],
      0,
      24,
      1,
      10,
    );

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TypeInferenceHarness(service);

    const source = [
      'if 10',
      '    noop := 1',
      'if close',
      '    noop := 1',
      'value = 10',
      'if value',
      '    noop := 1',
      'result = na + 10',
      'comparison = na == 0',
      'holder = na',
    ].join('\n');
    const result = harness.validate(source);

    const warningCodes = result.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('PSV6-TYPE-CONDITIONAL-TYPE');
    expect(warningCodes).toContain('PSV6-TYPE-CONVERSION-IMPLICIT-BOOL');
    expect(warningCodes).toContain('PSV6-TYPE-SAFETY-NA-ARITHMETIC');
    expect(warningCodes).toContain('PSV6-TYPE-SAFETY-NA-COMPARISON');
    expect(warningCodes).toContain('PSV6-TYPE-SAFETY-NA-FUNCTION');
  });

  it('suggests annotations and warns about implicit conversions', () => {
    const suggestionDecl = createVariableDeclaration(createIdentifier('message', 0, 1), 0, 20, 1, {
      initializer: createStringLiteral('hello', '"hello"', 11, 1),
    });

    const redundantDecl = createVariableDeclaration(createIdentifier('threshold', 0, 2), 0, 26, 2, {
      typeAnnotation: createTypeReference('float', 10, 2),
      initializer: createNumberLiteral(1.5, '1.5', 22, 2),
    });

    const floatToIntDecl = createVariableDeclaration(createIdentifier('count', 0, 3), 0, 22, 3, {
      typeAnnotation: createTypeReference('int', 6, 3),
      initializer: createNumberLiteral(10.5, '10.5', 17, 3),
    });

    const unknownCall = createVariableDeclaration(createIdentifier('result', 0, 4), 0, 26, 4, {
      initializer: createCallExpression(createIdentifier('some_unknown_function', 9, 4), [], 9, 29, 4),
    });

    const program = createProgram([suggestionDecl, redundantDecl, floatToIntDecl, unknownCall], 0, 32, 1, 4);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new TypeInferenceHarness(service);

    const source = [
      'message = "hello"',
      'float threshold = 1.5',
      'int count = 10.5',
      'result = some_unknown_function()',
    ].join('\n');
    const result = harness.validate(source);

    const warningCodes = result.warnings.map((warning) => warning.code);
    const infoCodes = result.info.map((info) => info.code);

    expect(infoCodes).toContain('PSV6-TYPE-ANNOTATION-SUGGESTION');
    expect(infoCodes).toContain('PSV6-TYPE-ANNOTATION-REDUNDANT');
    expect(warningCodes).toContain('PSV6-TYPE-CONVERSION-FLOAT-TO-INT');
    expect(warningCodes).toContain('PSV6-TYPE-INFERENCE-AMBIGUOUS');
  });
});
