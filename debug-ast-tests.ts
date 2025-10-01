import { describe, it, expect } from 'vitest';
import { InputFunctionsValidatorHarness } from './tests/ast/input-functions-validator-ast.test';
import { StringFunctionsValidatorHarness } from './tests/ast/string-functions-validator-ast.test';
import {
  createIdentifier,
  createMemberExpression,
  createNumberLiteral,
  createStringLiteral,
  createArgument,
  createCallExpression,
  createExpressionStatement,
  createProgram,
  createAssignmentStatement,
} from './tests/ast/test-node-builders';
import { FunctionAstService } from './tests/ast/test-ast-service';
import { createAstDiagnostics } from './tests/ast/test-diagnostics';

console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST 1: InputFunctionsValidator - Parameter Counts');
console.log('═══════════════════════════════════════════════════════════════\n');

const source1 = 'input.float(5)';
const inputIdentifier = createIdentifier('input', source1.indexOf('input'), 1);
const floatIdentifier = createIdentifier('float', source1.indexOf('float'), 1);
const callee1 = createMemberExpression(inputIdentifier, floatIdentifier, source1.indexOf('input'), source1.indexOf('float') + 'float'.length, 1);

const numberStart = source1.indexOf('5');
const numberLiteral = createNumberLiteral(5, '5', numberStart, 1);
const argument1 = createArgument(numberLiteral, numberStart, numberStart + 1, 1);

const call1 = createCallExpression(callee1, [argument1], 0, source1.length, 1);
const statement1 = createExpressionStatement(call1, 0, source1.length, 1);
const program1 = createProgram([statement1], 0, source1.length, 1, 1);

const service1 = new FunctionAstService(() => ({ ast: program1, diagnostics: createAstDiagnostics() }));
const harness1 = new InputValidatorHarness(service1);

console.log('Code:', source1);
console.log('Expected: PSV6-FUNCTION-PARAM-COUNT error');

const result1 = harness1.validate(source1);
console.log('Actual errors:', result1.errors.length);
console.log('Error codes:', result1.errors.map(e => e.code));
if (result1.errors.length > 0) {
  result1.errors.forEach(e => console.log(`  - [${e.code}] ${e.message}`));
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TEST 2: StringFunctionsValidator - str.format Placeholders');
console.log('═══════════════════════════════════════════════════════════════\n');

const source2 = 'formatted = str.format("{0} {1}", close)';
const formattedIdentifier = createIdentifier('formatted', 0, 1);
const strIdentifier = createIdentifier('str', 12, 1);
const formatIdentifier = createIdentifier('format', 16, 1);
const callee2 = createMemberExpression(strIdentifier, formatIdentifier, 12, 22, 1);

const formatLiteral = createStringLiteral('{0} {1}', '"{0} {1}"', 23, 1);
const formatArgument = createArgument(formatLiteral, 23, 32, 1);

const closeIdentifier = createIdentifier('close', 34, 1);
const closeArgument = createArgument(closeIdentifier, 34, 39, 1);

const call2 = createCallExpression(callee2, [formatArgument, closeArgument], 12, 40, 1);
const assignment2 = createAssignmentStatement(formattedIdentifier, call2, 0, 40, 1);
const program2 = createProgram([assignment2], 0, 40, 1, 1);

const service2 = new FunctionAstService(() => ({ ast: program2, diagnostics: createAstDiagnostics() }));
const harness2 = new StringFunctionsHarness(service2);

console.log('Code:', source2);
console.log('Expected: PSV6-STR-FORMAT-INVALID error');

const result2 = harness2.validate(source2);
console.log('Actual errors:', result2.errors.length);
console.log('Error codes:', result2.errors.map(e => e.code));
if (result2.errors.length > 0) {
  result2.errors.forEach(e => console.log(`  - [${e.code}] ${e.message}`));
}

