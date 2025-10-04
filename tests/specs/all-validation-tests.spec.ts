import { describe, expect, it } from 'vitest';

type SuiteStatus = 'stable' | 'deferred';

type SuiteDefinition = {
  name: string;
  importModule: () => Promise<unknown>;
  status?: SuiteStatus;
};

const SMOKE_SUITES: SuiteDefinition[] = [
  {
    name: 'Validator smoke tests',
    importModule: () => import('./validator-smoke.spec'),
  },
  {
    name: 'Validator architecture integration tests',
    importModule: () => import('./validator-architecture.spec'),
  },
];

const FULL_SUITES: SuiteDefinition[] = [
  { name: 'Array Validation', importModule: () => import('./array-validation.spec') },
  { name: 'Array Utility Functions Validation', importModule: () => import('./array-utility-functions-validation.spec') },
  { name: 'Map Validation', importModule: () => import('./map-validation.spec'), status: 'deferred' },
  { name: 'String Functions Validation', importModule: () => import('./string-functions-validation.spec') },
  { name: 'String Utility Functions Validation', importModule: () => import('./string-utility-functions-validation.spec') },
  { name: 'Input Functions Validation', importModule: () => import('./input-functions-validation.spec'), status: 'deferred' },
  { name: 'Input Utility Functions Validation', importModule: () => import('./input-utility-functions-validation.spec') },
  { name: 'Advanced Input Parameters Validation', importModule: () => import('./advanced-input-parameters-validation.spec') },
  { name: 'Color Functions Validation', importModule: () => import('./color-functions-validation.spec') },
  { name: 'Drawing Functions Validation', importModule: () => import('./drawing-functions-validation.spec') },
  { name: 'Drawing Utility Functions Validation', importModule: () => import('./drawing-utility-functions-validation.spec') },
  { name: 'Table Advanced Validation', importModule: () => import('./table-advanced-validation.spec') },
  { name: 'Polyline Functions Validation', importModule: () => import('./polyline-functions-validation.spec') },
  { name: 'TA Functions Validation', importModule: () => import('./ta-functions-validation.spec') },
  { name: 'TA Utility Functions Validation', importModule: () => import('./ta-utility-functions-validation.spec') },
  { name: 'Math Functions Validation', importModule: () => import('./math-functions-validation.spec') },
  { name: 'Strategy Functions Validation', importModule: () => import('./strategy-functions-validation.spec') },
  { name: 'Advanced Strategy Functions Validation', importModule: () => import('./advanced-strategy-functions-validation.spec') },
  { name: 'Dynamic Data Validation', importModule: () => import('./dynamic-data-validation.spec') },
  { name: 'Dynamic Request Advanced Validation', importModule: () => import('./dynamic-request-advanced.spec') },
  { name: 'Request Functions Advanced Validation', importModule: () => import('./request-functions-advanced-validation.spec') },
  { name: 'Enum Validation', importModule: () => import('./enum-validation.spec') },
  { name: 'Function Validation', importModule: () => import('./function-validation.spec') },
  { name: 'History Referencing Validation', importModule: () => import('./history-referencing-validation.spec') },
  { name: 'Matrix Validation', importModule: () => import('./matrix-validation.spec'), status: 'deferred' },
  { name: 'Matrix Functions Validation', importModule: () => import('./matrix-functions-validation.spec'), status: 'deferred' },
  { name: 'Chart Functions Validation', importModule: () => import('./chart-functions-validation.spec') },
  { name: 'Strategy Properties Validation', importModule: () => import('./strategy-properties-validation.spec') },
  { name: 'Migration Verification', importModule: () => import('./migration-verification.spec'), status: 'deferred' },
  { name: 'Switch Statement Validation', importModule: () => import('./switch-statement-validation.spec') },
  { name: 'Text Formatting Validation', importModule: () => import('./text-formatting-validation.spec') },
  { name: 'Time/Date Functions Validation', importModule: () => import('./time-date-functions-validation.spec') },
  { name: 'Alert Functions Validation', importModule: () => import('./alert-functions-validation.spec') },
  { name: 'Builtin Variables Validation', importModule: () => import('./builtin-variables-validation.spec') },
  { name: 'Syminfo Variables Validation', importModule: () => import('./syminfo-variables-validation.spec') },
  { name: 'Final Constants Validation', importModule: () => import('./final-constants-validation.spec') },
  { name: 'Constants & Enums Validation', importModule: () => import('./constants-enums-validation.spec'), status: 'deferred' },
  { name: 'Type Inference Validation', importModule: () => import('./type-inference-validation.spec') },
  { name: 'UDT Validation', importModule: () => import('./udt-validation.spec') },
  { name: 'Ultimate Validator Enhanced', importModule: () => import('./ultimate-validator-enhanced.spec') },
  { name: 'Ultimate Validator', importModule: () => import('./ultimate-validator.spec') },
  { name: 'V6 Advanced Features', importModule: () => import('./v6-advanced.spec') },
  { name: 'V6 Comprehensive Features', importModule: () => import('./v6-comprehensive.spec'), status: 'deferred' },
  { name: 'V6 Enhanced Features', importModule: () => import('./v6-enhanced-features.spec') },
  { name: 'Varip Validation', importModule: () => import('./varip-validation.spec') },
  { name: 'While Loop Validation', importModule: () => import('./while-loop-validation.spec') },
  { name: 'Dynamic Loop Validation', importModule: () => import('./dynamic-loop-validation.spec') },
  { name: 'Lazy Evaluation Validation', importModule: () => import('./lazy-evaluation-validation.spec') },
  { name: 'Linefill Validation', importModule: () => import('./linefill-validation.spec') },
  { name: 'Strategy Order Limits Validation', importModule: () => import('./strategy-order-limits-validation.spec') },
  { name: 'Enhanced Textbox Validation', importModule: () => import('./enhanced-textbox-validation.spec') },
  { name: 'Negative Array Indices Fix', importModule: () => import('./negative-array-indices-fix.spec') },
  { name: 'Boolean Optimisation Validation', importModule: () => import('./boolean-optimization-validation.spec') },
  { name: 'Text Typography Validation', importModule: () => import('./text-typography-validation.spec') },
  { name: 'Ticker Validation', importModule: () => import('./ticker-validation.spec') },
  { name: 'Syminfo Session Timezone Advanced', importModule: () => import('./syminfo-session-timezone-advanced.spec') },
  { name: 'Strategy Risk & Commission Advanced', importModule: () => import('./strategy-risk-commission-advanced.spec') },
  { name: 'Validator Scenario Fixtures', importModule: () => import('./validator-scenarios.spec'), status: 'deferred' },
  { name: 'Validator Smoke Suite', importModule: () => import('./validator-smoke.spec') },
  {
    name: 'Validator architecture integration tests',
    importModule: () => import('./validator-architecture.spec'),
  },
];

const isFullSuiteEnabled = process.env.VALIDATOR_FULL_SUITE === '1';
const baseSuites = isFullSuiteEnabled ? FULL_SUITES : SMOKE_SUITES;

const suiteFilters = extractSuiteFilters(process.env.VALIDATOR_SUITE_FILTER);
const filteredSuites = applySuiteFilters(baseSuites, suiteFilters);

const includeDeferred = suiteFilters.length > 0 || process.env.VALIDATOR_INCLUDE_DEFERRED === '1';
const { activeSuites, skippedSuites } = partitionSuites(filteredSuites, includeDeferred);

await loadSuites(activeSuites);

const testSuiteInfo = {
  name: isFullSuiteEnabled
    ? 'Pine Script v6 Validator Full Suite'
    : 'Pine Script v6 Validator Smoke Suite',
  description: isFullSuiteEnabled
    ? 'Comprehensive regression fixtures that exercise the entire EnhancedModularValidator module catalog.'
    : 'Focused smoke assertions that ensure the EnhancedModularValidator pipeline and core diagnostics stay healthy.',
  modules: activeSuites.map((suite) => suite.name),
  totalModules: activeSuites.length,
  mode: isFullSuiteEnabled ? 'full' : 'smoke',
  filter: suiteFilters,
  skipped: skippedSuites.map((suite) => suite.name),
};

describe(`🧪 ${testSuiteInfo.name}`, () => {
  it('loads the validation modules', () => {
    expect(testSuiteInfo.totalModules).toBeGreaterThan(0);
  });
});

displaySuiteMetadata();

async function loadSuites(suites: SuiteDefinition[]): Promise<void> {
  for (const suite of suites) {
    await suite.importModule();
  }
}

function displaySuiteMetadata(): void {
  console.log('🧪 Pine Script v6 Validator Test Suite Loaded');
  console.log(`📊 Mode: ${testSuiteInfo.mode}`);
  console.log(`📊 Total Test Modules: ${testSuiteInfo.totalModules}`);
  console.log('📋 Test Modules:', testSuiteInfo.modules.join(', '));
  if (testSuiteInfo.filter.length > 0) {
    console.log('🎯 Suite Filter:', testSuiteInfo.filter.join(', '));
  }
  if (testSuiteInfo.skipped.length > 0) {
    console.log(
      `⏭️ Deferred Modules: ${testSuiteInfo.skipped.join(', ')} (set VALIDATOR_INCLUDE_DEFERRED=1 to include)`
    );
  }
}

function extractSuiteFilters(rawFilter?: string): string[] {
  if (!rawFilter) {
    return [];
  }
  return rawFilter
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

function partitionSuites(
  suites: SuiteDefinition[],
  includeDeferred: boolean,
): { activeSuites: SuiteDefinition[]; skippedSuites: SuiteDefinition[] } {
  if (includeDeferred) {
    return { activeSuites: suites, skippedSuites: [] };
  }

  const activeSuites: SuiteDefinition[] = [];
  const skippedSuites: SuiteDefinition[] = [];

  for (const suite of suites) {
    if (suite.status === 'deferred') {
      skippedSuites.push(suite);
    } else {
      activeSuites.push(suite);
    }
  }

  if (activeSuites.length === 0 && suites.length > 0) {
    return { activeSuites: suites, skippedSuites: [] };
  }

  return { activeSuites, skippedSuites };
}

function applySuiteFilters(suites: SuiteDefinition[], filters: string[]): SuiteDefinition[] {
  if (filters.length === 0) {
    return suites;
  }

  const filtered = suites.filter((suite) => {
    const suiteName = suite.name.toLowerCase();
    return filters.some((filter) => suiteName.includes(filter));
  });

  if (filtered.length === 0) {
    console.warn(
      `⚠️  VALIDATOR_SUITE_FILTER did not match any modules (filters: ${filters.join(', ')}). Running all ${suites.length} modules instead.`,
    );
    return suites;
  }

  return filtered;
}
