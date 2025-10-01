import { BaseValidator } from '../../core/base-validator';
import { FunctionAstService } from '../../core/ast/service';
import { parseWithChevrotain } from '../../core/ast/parser';
import { ensureAstContext } from '../../core/ast/context-utils';
/**
 * Helper function to check if validation result has specific error codes
 */
export function expectHas(result, expected) {
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
export function expectNoErrors(result) {
    expect(result.errors).toEqual([]);
}
/**
 * Helper function to check if validation result has no warnings
 */
export function expectNoWarnings(result) {
    expect(result.warnings).toEqual([]);
}
/**
 * Helper function to check if validation result is valid
 */
export function expectValid(result) {
    expect(result.isValid).toBe(true);
}
/**
 * Helper function to check if validation result is invalid
 */
export function expectInvalid(result) {
    expect(result.isValid).toBe(false);
}
/**
 * Helper function to check if validation result lacks specific error codes
 */
export function expectLacks(result, expected) {
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
    constructor(modules, config = {}) {
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
    runCoreValidation() {
        // No core validation in harness – we only execute the registered modules.
    }
    run(code, config = {}) {
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
        const astContext = ensureAstContext(this.context, this.config);
        if (astContext?.ast) {
            this.context = astContext;
            this.ensureScriptType();
        }
        this.runValidation();
        let result = this.buildResult();
        const sanitizedWarnings = result.warnings.filter((warning) => warning.code !== 'AST-PARSE');
        if (sanitizedWarnings.length !== result.warnings.length) {
            result = { ...result, warnings: sanitizedWarnings };
        }
        if (process.env.DEBUG_MODULE_HARNESS === '1') {
            console.log('[ModuleValidationHarness] result snapshot', {
                warnings: result.warnings,
                info: result.info,
                errors: result.errors,
            });
        }
        return result;
    }
    ensureScriptType() {
        if (this.context.scriptType) {
            return;
        }
        const program = this.context.ast;
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
    findScriptDeclaration(program) {
        for (const node of program.body) {
            if (node.kind === 'ScriptDeclaration') {
                return node;
            }
        }
        return null;
    }
}
ModuleValidationHarness.defaultAstService = new FunctionAstService((source, options) => parseWithChevrotain(source, { allowErrors: true, ...options }));
export function createModuleHarness(modules, config = {}) {
    return new ModuleValidationHarness(modules, config);
}
export function runModuleValidation(modules, code, config = {}) {
    const harness = createModuleHarness(modules, config);
    return harness.run(code, config);
}
