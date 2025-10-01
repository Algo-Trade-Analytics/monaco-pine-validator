import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { MarkerSeverity, createMarkerFromSyntaxError, } from '../ast/diagnostics';
import { createHoverEntries, createSemanticModel, } from './semantic-model';
function normalisePosition(value, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
        return fallback;
    }
    return Math.floor(value);
}
class DefaultWorkerValidator extends EnhancedModularValidator {
    getAstContext() {
        return this.context;
    }
}
function mergeConfig(base, override) {
    const merged = { ...(base ?? {}) };
    if (override) {
        Object.assign(merged, override);
    }
    const baseAst = base?.ast ?? {};
    const overrideAst = override?.ast ?? {};
    merged.ast = {
        mode: 'primary',
        service: null,
        ...baseAst,
        ...overrideAst,
    };
    return merged;
}
function normaliseConfig(config, fallbackService) {
    const astConfig = config.ast ?? {};
    return {
        ...config,
        ast: {
            ...astConfig,
            mode: astConfig.mode ?? 'primary',
            service: astConfig.service ?? fallbackService ?? null,
        },
    };
}
function configsEqual(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        if (key === 'ast') {
            const astA = a.ast ?? {};
            const astB = b.ast ?? {};
            if ((astA.mode ?? 'primary') !== (astB.mode ?? 'primary')) {
                return false;
            }
            if ((astA.service ?? null) !== (astB.service ?? null)) {
                return false;
            }
            continue;
        }
        const valueA = a[key];
        const valueB = b[key];
        if (Array.isArray(valueA) || Array.isArray(valueB)) {
            if (JSON.stringify(valueA ?? []) !== JSON.stringify(valueB ?? [])) {
                return false;
            }
            continue;
        }
        if (valueA !== valueB) {
            return false;
        }
    }
    return true;
}
function createValidatorInstance(options, config) {
    if (options.createValidator) {
        return options.createValidator(config);
    }
    return new DefaultWorkerValidator(config);
}
function toMarkerData(issue, severity, source) {
    const startLine = normalisePosition(issue.line, 1);
    const startColumn = normalisePosition(issue.column, 1);
    const endLine = normalisePosition(issue.line, startLine);
    const endColumn = Math.max(startColumn + 1, normalisePosition(issue.column, startColumn));
    return {
        message: issue.message,
        severity,
        source,
        code: issue.code,
        startLineNumber: startLine,
        startColumn,
        endLineNumber: endLine,
        endColumn,
    };
}
export function createMonacoWorkerHarness(options = {}) {
    const { markerSource, validatorConfig, astService } = options;
    const baseConfig = normaliseConfig(mergeConfig(validatorConfig, undefined), astService);
    let activeConfig = baseConfig;
    let validator = createValidatorInstance(options, activeConfig);
    let lastSource = null;
    let lastVersion = null;
    let lastResponse = null;
    let lastContext = null;
    function ensureValidator(configOverride) {
        if (!configOverride) {
            return;
        }
        const merged = normaliseConfig(mergeConfig(baseConfig, configOverride), astService);
        if (!configsEqual(merged, activeConfig)) {
            activeConfig = merged;
            validator = createValidatorInstance(options, activeConfig);
            lastSource = null;
            lastVersion = null;
            lastResponse = null;
            lastContext = null;
        }
    }
    return {
        async validate(request) {
            ensureValidator(request.config);
            const requestedVersion = request.version;
            const version = typeof requestedVersion === 'number'
                ? requestedVersion
                : (lastVersion ?? 0) + 1;
            if (lastResponse &&
                lastSource === request.code &&
                lastVersion === version) {
                return lastResponse;
            }
            const result = validator.validate(request.code);
            const context = validator.getAstContext();
            const syntaxMarkers = context.astDiagnostics.syntaxErrors.map((error) => createMarkerFromSyntaxError(error, { source: markerSource }));
            const issueMarkers = [];
            const severityMap = [
                { list: result.errors, severity: MarkerSeverity.Error },
                { list: result.warnings, severity: MarkerSeverity.Warning },
                { list: result.info ?? [], severity: MarkerSeverity.Info },
            ];
            for (const { list, severity } of severityMap) {
                for (const issue of list) {
                    issueMarkers.push(toMarkerData(issue, severity, markerSource));
                }
            }
            const semanticModel = createSemanticModel(context);
            const hoverData = createHoverEntries(context, result, semanticModel);
            const response = {
                version,
                markers: [...syntaxMarkers, ...issueMarkers],
                syntaxMarkers,
                result,
                scriptType: result.scriptType,
                semanticModel,
                hoverData,
            };
            lastSource = request.code;
            lastVersion = version;
            lastResponse = response;
            lastContext = context;
            return response;
        },
        getLastContext() {
            return lastContext;
        },
    };
}
