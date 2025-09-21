import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import type {
  AstValidationContext,
  ValidationError,
  ValidationResult,
  ValidatorConfig,
} from '../types';
import type { AstService } from '../ast/types';
import {
  MarkerSeverity,
  type MarkerData,
  createMarkerFromSyntaxError,
} from '../ast/diagnostics';

function normalisePosition(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.floor(value);
}

type WorkerValidator = EnhancedModularValidator & {
  getAstContext(): AstValidationContext;
};

class DefaultWorkerValidator extends EnhancedModularValidator implements WorkerValidator {
  getAstContext(): AstValidationContext {
    return this.context;
  }
}

export interface WorkerHarnessOptions {
  readonly markerSource?: string;
  readonly validatorConfig?: Partial<ValidatorConfig>;
  readonly astService?: AstService;
  readonly createValidator?: (config: Partial<ValidatorConfig>) => WorkerValidator;
}

export interface WorkerValidationRequest {
  readonly code: string;
  readonly version?: number;
  readonly config?: Partial<ValidatorConfig>;
}

export interface WorkerValidationResponse {
  readonly version: number;
  readonly markers: MarkerData[];
  readonly syntaxMarkers: MarkerData[];
  readonly result: ValidationResult;
  readonly scriptType: ValidationResult['scriptType'];
}

export interface MonacoWorkerHarness {
  validate(request: WorkerValidationRequest): Promise<WorkerValidationResponse>;
  getLastContext(): AstValidationContext | null;
}

function mergeConfig(
  base: Partial<ValidatorConfig> | undefined,
  override: Partial<ValidatorConfig> | undefined,
): Partial<ValidatorConfig> {
  const merged: Partial<ValidatorConfig> = { ...(base ?? {}) };
  if (override) {
    Object.assign(merged, override);
  }

  const baseAst = base?.ast ?? {};
  const overrideAst = override?.ast ?? {};
  merged.ast = {
    ...baseAst,
    ...overrideAst,
  };

  return merged;
}

function normaliseConfig(
  config: Partial<ValidatorConfig>,
  fallbackService: AstService | undefined,
): Partial<ValidatorConfig> {
  const astConfig = config.ast ?? {};
  return {
    ...config,
    ast: {
      ...astConfig,
      mode: astConfig.mode ?? 'primary',
      service: astConfig.service ?? fallbackService ?? astConfig.service ?? null,
    },
  };
}

function configsEqual(a: Partial<ValidatorConfig>, b: Partial<ValidatorConfig>): boolean {
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

    const valueA = (a as Record<string, unknown>)[key];
    const valueB = (b as Record<string, unknown>)[key];
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

function createValidatorInstance(
  options: WorkerHarnessOptions,
  config: Partial<ValidatorConfig>,
): WorkerValidator {
  if (options.createValidator) {
    return options.createValidator(config);
  }
  return new DefaultWorkerValidator(config);
}

function toMarkerData(
  issue: ValidationError,
  severity: MarkerSeverity,
  source: string | undefined,
): MarkerData {
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

export function createMonacoWorkerHarness(
  options: WorkerHarnessOptions = {},
): MonacoWorkerHarness {
  const { markerSource, validatorConfig, astService } = options;
  const baseConfig = normaliseConfig(mergeConfig(validatorConfig, undefined), astService);
  let activeConfig = baseConfig;
  let validator = createValidatorInstance(options, activeConfig);
  let lastSource: string | null = null;
  let lastVersion: number | null = null;
  let lastResponse: WorkerValidationResponse | null = null;
  let lastContext: AstValidationContext | null = null;

  function ensureValidator(configOverride: Partial<ValidatorConfig> | undefined): void {
    if (!configOverride) {
      return;
    }
    const merged = normaliseConfig(
      mergeConfig(baseConfig, configOverride),
      astService,
    );
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
    async validate(request: WorkerValidationRequest): Promise<WorkerValidationResponse> {
      ensureValidator(request.config);

      const requestedVersion = request.version;
      const version = typeof requestedVersion === 'number'
        ? requestedVersion
        : (lastVersion ?? 0) + 1;

      if (
        lastResponse &&
        lastSource === request.code &&
        lastVersion === version
      ) {
        return lastResponse;
      }

      const result = validator.validate(request.code);
      const context = validator.getAstContext();
      const syntaxMarkers = context.astDiagnostics.syntaxErrors.map((error) =>
        createMarkerFromSyntaxError(error, { source: markerSource }),
      );

      const issueMarkers: MarkerData[] = [];
      const severityMap: Array<{ list: ValidationError[]; severity: MarkerSeverity }> = [
        { list: result.errors, severity: MarkerSeverity.Error },
        { list: result.warnings, severity: MarkerSeverity.Warning },
        { list: result.info ?? [], severity: MarkerSeverity.Info },
      ];

      for (const { list, severity } of severityMap) {
        for (const issue of list) {
          issueMarkers.push(toMarkerData(issue, severity, markerSource));
        }
      }

      const response: WorkerValidationResponse = {
        version,
        markers: [...syntaxMarkers, ...issueMarkers],
        syntaxMarkers,
        result,
        scriptType: result.scriptType,
      };

      lastSource = request.code;
      lastVersion = version;
      lastResponse = response;
      lastContext = context;

      return response;
    },

    getLastContext(): AstValidationContext | null {
      return lastContext;
    },
  };
}
