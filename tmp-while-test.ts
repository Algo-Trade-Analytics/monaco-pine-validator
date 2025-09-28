import { WhileLoopValidator } from './modules/while-loop-validator.ts';

const validator = new WhileLoopValidator();
const code = `//@version=6
indicator("Missing End Test")

i = 0
while i < 10
    i := i + 1

plot(close)`;

const context = {
  lines: code.split('\n'),
  cleanLines: code.split('\n'),
  rawLines: code.split('\n'),
  typeMap: new Map(),
  usedVars: new Set(),
  declaredVars: new Map(),
  functionNames: new Set(),
  methodNames: new Set(),
  functionParams: new Map(),
  scriptType: null,
  version: 6,
  hasVersion: true,
  firstVersionLine: 1,
};

const config = {
  targetVersion: 6,
  strictMode: true,
  allowDeprecated: false,
  enableTypeChecking: true,
  enableControlFlowAnalysis: true,
  enablePerformanceAnalysis: true,
  enablePerformanceChecks: true,
  enableStyleChecks: true,
  customRules: [],
  ignoredCodes: [],
  ast: { mode: 'disabled' as const },
};

const result = validator.validate(context as any, config as any);
console.log('errors', result.errors.map(e => e.code));
