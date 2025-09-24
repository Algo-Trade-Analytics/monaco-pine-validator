import { describe, expect, it } from 'vitest';
import { BaseValidator } from '../../core/base-validator';
import { EnhancedQualityValidator } from '../../modules/enhanced-quality-validator';
import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createBlock,
  createExpressionStatement,
  createFunctionDeclaration,
  createIdentifier,
  createIfStatement,
  createProgram,
} from './fixtures';

class EnhancedQualityHarness extends BaseValidator {
  constructor(service: FunctionAstService) {
    super({ ast: { mode: 'primary', service } });
    this.registerModule(new EnhancedQualityValidator());
  }

  protected runCoreValidation(): void {}
}

class EnhancedQualityDisabledHarness extends BaseValidator {
  constructor() {
    super({ ast: { mode: 'disabled' } });
    this.registerModule(new EnhancedQualityValidator());
  }

  protected runCoreValidation(): void {}
}

const createNoopStatement = (line: number, name = 'noop') =>
  createExpressionStatement(createIdentifier(name, 4, line), 4, 8, line);

const createSimpleIf = (line: number, name: string): ReturnType<typeof createIfStatement> => {
  const test = createIdentifier(name, 3, line);
  const consequent = createBlock([createNoopStatement(line + 1, `${name}_body`)], 4, 12, line + 1, line + 1);
  return createIfStatement(test, consequent, null, 0, 12, line);
};

describe('EnhancedQualityValidator (AST)', () => {
  it('warns about high script complexity when AST analysis is available', () => {
    const statements = [] as ReturnType<typeof createIfStatement>[];
    const sourceLines: string[] = [];

    for (let i = 0; i < 9; i++) {
      const line = 1 + i * 2;
      const name = `cond${i}`;
      statements.push(createSimpleIf(line, name));
      sourceLines.push(`if ${name}`);
      sourceLines.push('    noop');
    }

    const lastLine = 1 + (statements.length - 1) * 2 + 1;
    const program = createProgram(statements, 0, 12, 1, lastLine);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedQualityHarness(service);

    const result = harness.validate(sourceLines.join('\n'));
    const scriptWarning = result.warnings.find((warning) =>
      warning.message.includes('Script has high cyclomatic complexity'),
    );

    expect(scriptWarning).toBeDefined();
  });

  it('warns about complex and lengthy functions in AST mode', () => {
    const complexStatements = [] as ReturnType<typeof createIfStatement>[];
    const fillerStatements = [] as ReturnType<typeof createExpressionStatement>[];
    const sourceLines = ['complexFn() =>'];

    for (let i = 0; i < 9; i++) {
      const line = 2 + i * 2;
      const name = `cond${i}`;
      complexStatements.push(createSimpleIf(line, name));
      sourceLines.push(`    if ${name}`);
      sourceLines.push('        noop');
    }

    for (let i = 0; i < 52; i++) {
      const line = 2 + complexStatements.length * 2 + i;
      fillerStatements.push(createExpressionStatement(createIdentifier(`line${i}`, 4, line), 4, 12, line));
      sourceLines.push('    filler()');
    }

    const bodyStatements = [...complexStatements, ...fillerStatements];
    const lastLine = fillerStatements[fillerStatements.length - 1].loc.end.line;
    const block = createBlock(bodyStatements, 4, 12, 2, lastLine);
    const fn = createFunctionDeclaration(createIdentifier('complexFn', 0, 1), [], block, 0, 12, 1, lastLine);
    const program = createProgram([fn], 0, 12, 1, lastLine);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedQualityHarness(service);

    const result = harness.validate(sourceLines.join('\n'));
    const messages = result.warnings.map((warning) => warning.message);

    expect(messages.some((message) => message.includes("Function 'complexFn' has high cyclomatic complexity"))).toBe(true);
    expect(messages.some((message) => message.includes("Function 'complexFn' is very long"))).toBe(true);
  });

  it('emits PSV6-QUALITY-DEPTH for excessive nesting depth in AST mode', () => {
    const innerStatement = createNoopStatement(5, 'deep');
    const level3 = createIfStatement(
      createIdentifier('c3', 6, 4),
      createBlock([innerStatement], 8, 12, 5, 5),
      null,
      0,
      12,
      4,
    );
    const level2 = createIfStatement(
      createIdentifier('c2', 4, 3),
      createBlock([level3], 6, 12, 4, 5),
      null,
      0,
      12,
      3,
    );
    const level1 = createIfStatement(
      createIdentifier('c1', 2, 2),
      createBlock([level2], 4, 12, 3, 5),
      null,
      0,
      12,
      2,
    );

    const block = createBlock([level1], 4, 12, 2, 5);
    const fn = createFunctionDeclaration(createIdentifier('nested', 0, 1), [], block, 0, 12, 1, 5);
    const program = createProgram([fn], 0, 12, 1, 5);

    const service = new FunctionAstService(() => ({ ast: program, diagnostics: createAstDiagnostics() }));
    const harness = new EnhancedQualityHarness(service);

    const source = ['nested() =>', '    if c1', '        if c2', '            if c3', '                deep'].join('\n');
    const result = harness.validate(source);

    const depthWarningCodes = result.warnings
      .filter((warning) => warning.code === 'PSV6-QUALITY-DEPTH')
      .map((warning) => warning.message);

    expect(depthWarningCodes.length).toBeGreaterThan(0);
  });

  it('returns no diagnostics when AST mode is disabled', () => {
    const harness = new EnhancedQualityDisabledHarness();

    const result = harness.validate('noop');

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });
});
