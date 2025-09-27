import { MapValidator } from './modules/map-validator.ts';

const context: any = {
  lines: [
    '//@version=6',
    'indicator("Map Test")',
    '',
    'stringMap = map.new<string>()',
    'intMap = map.new<int>()',
    '',
    'map.put(stringMap, "key", "value")',
    'map.put(intMap, "key", 123)',
    '',
    'map.put(stringMap, "key", 123)',
    'map.put(intMap, "key", "value")'
  ],
  cleanLines: [],
  rawLines: [],
  typeMap: new Map(),
  usedVars: new Set(),
  declaredVars: new Map(),
  functionNames: new Set(),
  methodNames: new Set(),
  functionParams: new Map(),
  scriptType: 'indicator',
  version: 6,
  hasVersion: true,
  firstVersionLine: null
};

const config: any = {
  targetVersion: 6,
  strictMode: true,
  allowDeprecated: false,
  enableTypeChecking: true,
  enableControlFlowAnalysis: true,
  enablePerformanceAnalysis: true,
  customRules: [],
  ignoredCodes: []
};

const validator = new MapValidator();
const result = validator.validate(context, config);
console.log('errors', result.errors);
console.log('warnings', result.warnings);
console.log('typeMap', Array.from(result.typeMap.entries()));
