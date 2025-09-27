import { BaseValidator } from '../../core/base-validator';
import { FunctionAstService } from '../../core/ast/service';
import { parseWithChevrotain } from '../../core/ast/parser';
import type { ValidationModule, ValidationResult, ValidatorConfig } from '../../core/types';
import type { ProgramNode, ScriptDeclarationNode } from '../../core/ast/nodes';

/**
 * Helper function to check if validation result has specific error codes
 */
export function expectHas(result: ValidationResult, expected: {
  errors?: string[];
  warnings?: string[];
  info?: string[];
}): void {
  if (expected.errors) {
    const errorCodes = result.errors.map(e => e.code).filter(Boolean);
    expect(errorCodes).toEqual(expect.arrayContaining(expected.errors));
  }
  
  if (expected.warnings) {
    const warningCodes = result.warnings.map(w => w.code).filter(Boolean);
    expect(warningCodes).toEqual(expect.arrayContaining(expected.warnings));
  }
  
  if (expected.info) {
    const infoCodes = result.info.map(i => i.code).filter(Boolean);
    expect(infoCodes).toEqual(expect.arrayContaining(expected.info));
  }
}

/**
 * Helper function to check if validation result has no errors
 */
export function expectNoErrors(result: ValidationResult): void {
  expect(result.errors).toEqual([]);
}

/**
 * Helper function to check if validation result has no warnings
 */
export function expectNoWarnings(result: ValidationResult): void {
  expect(result.warnings).toEqual([]);
}

/**
 * Helper function to check if validation result is valid
 */
export function expectValid(result: ValidationResult): void {
  expect(result.isValid).toBe(true);
}

/**
 * Helper function to check if validation result is invalid
 */
export function expectInvalid(result: ValidationResult): void {
  expect(result.isValid).toBe(false);
}

/**
 * Helper function to check if validation result lacks specific error codes
 */
export function expectLacks(result: ValidationResult, expected: {
  errors?: string[];
  warnings?: string[];
  info?: string[];
}): void {
  if (expected.errors) {
    const errorCodes = result.errors.map(e => e.code).filter(Boolean);
    expected.errors.forEach(code => {
      expect(errorCodes).not.toContain(code);
    });
  }
  
  if (expected.warnings) {
    const warningCodes = result.warnings.map(w => w.code).filter(Boolean);
    expected.warnings.forEach(code => {
      expect(warningCodes).not.toContain(code);
    });
  }
  
  if (expected.info) {
    const infoCodes = result.info.map(i => i.code).filter(Boolean);
    expected.info.forEach(code => {
      expect(infoCodes).not.toContain(code);
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// AST-backed module harness utilities
// ──────────────────────────────────────────────────────────────────────────────

export class ModuleValidationHarness extends BaseValidator {
  private static readonly defaultAstService = new FunctionAstService((source, options) =>
    parseWithChevrotain(source, { allowErrors: true, ...options }),
  );

  constructor(modules: ValidationModule | ValidationModule[], config: Partial<ValidatorConfig> = {}) {
    super({
      ...config,
      ast: {
        mode: 'primary',
        service: ModuleValidationHarness.defaultAstService,
        ...(config.ast ?? {}),
      },
    });

    const list = Array.isArray(modules) ? modules : [modules];
    for (const module of list) {
      this.registerModule(module);
    }
  }

  protected runCoreValidation(): void {
    // No core validation in harness – we only execute the registered modules.
  }

  run(code: string, config: Partial<ValidatorConfig> = {}): ValidationResult {
    this.rebuildConfig({
      ...config,
      ast: {
        mode: 'primary',
        service: ModuleValidationHarness.defaultAstService,
        ...(config.ast ?? {}),
      },
    });

    this.reset();
    this.prepareContext(code);
    if (!this.context.ast) {
      return;
    }
    this.ensureScriptType();
    this.runValidation();
    return this.buildResult();
  }

  private ensureScriptType(): void {
    if (this.context.scriptType) {
      return;
    }

    const program = this.context.ast as ProgramNode | null;
    if (!program) {
      return;
    }

    const declaration = this.findScriptDeclaration(program);
    if (!declaration) {
      return;
    }

    this.scriptType = declaration.scriptType;
    this.context.scriptType = declaration.scriptType;
  }

  private findScriptDeclaration(program: ProgramNode): ScriptDeclarationNode | null {
    for (const node of program.body) {
      if (node.kind === 'ScriptDeclaration') {
        return node as ScriptDeclarationNode;
      }
    }
    return null;
  }
}

export function createModuleHarness(
  modules: ValidationModule | ValidationModule[],
  config: Partial<ValidatorConfig> = {},
): ModuleValidationHarness {
  return new ModuleValidationHarness(modules, config);
}

export function runModuleValidation(
  modules: ValidationModule | ValidationModule[],
  code: string,
  config: Partial<ValidatorConfig> = {},
): ValidationResult {
  const harness = createModuleHarness(modules, config);
  return harness.run(code, config);
}
