import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicDataValidator } from '../../modules/dynamic-data-validator';
import { ValidationContext, ValidatorConfig } from '../../core/types';
import { expectHas } from './test-utils';

describe('PSV6-REQUEST-ADV: Advanced Request Functions (TDD)', () => {
  let validator: DynamicDataValidator;
  let context: ValidationContext;
  let config: ValidatorConfig;

  beforeEach(() => {
    validator = new DynamicDataValidator();
    context = {
      lines: [],
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
      firstVersionLine: 1
    };
    config = {
      targetVersion: 6,
      strictMode: true,
      allowDeprecated: false,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: true,
      customRules: [],
      ignoredCodes: []
    } as any;
  });

  describe('request.dividends', () => {
    it('requires at least symbol', () => {
      const code = `//@version=6
indicator("req div")
data = request.dividends()
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { errors: ['PSV6-REQUEST-DIVIDENDS-PARAMS'] });
    });

    it('accepts gaps named param with barmerge constant', () => {
      const code = `//@version=6
indicator("req div ok")
data = request.dividends("AAPL", dividends.gross, gaps=barmerge.gaps_on)
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expect(r.errors).toHaveLength(0);
    });

    it('warns on invalid gaps literal', () => {
      const code = `//@version=6
indicator("req div gaps warn")
data = request.dividends("AAPL", dividends.net, gaps="foo")
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { warnings: ['PSV6-REQUEST-GAPS-INVALID'] });
    });
  });

  describe('request.splits', () => {
    it('requires at least symbol', () => {
      const code = `//@version=6
indicator("req splits")
data = request.splits()
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { errors: ['PSV6-REQUEST-SPLITS-PARAMS'] });
    });

    it('warns on unknown split field', () => {
      const code = `//@version=6
indicator("req splits field warn")
data = request.splits("AAPL", "splits.ratio")
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { warnings: ['PSV6-REQUEST-SPLITS-FIELD'] });
    });
  });

  describe('request.earnings', () => {
    it('requires at least symbol', () => {
      const code = `//@version=6
indicator("req earnings")
data = request.earnings()
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { errors: ['PSV6-REQUEST-EARNINGS-PARAMS'] });
    });

    it('warns on unsupported earnings field', () => {
      const code = `//@version=6
indicator("req earnings field warn")
data = request.earnings("AAPL", earnings.future_eps)
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { warnings: ['PSV6-REQUEST-EARNINGS-FIELD'] });
    });
  });

  describe('request.economic', () => {
    it('requires source and code', () => {
      const code = `//@version=6
indicator("req econ")
data = request.economic("FRED")
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { errors: ['PSV6-REQUEST-ECONOMIC-PARAMS'] });
    });
  });

  describe('request.financial', () => {
    it('requires symbol and field', () => {
      const code = `//@version=6
indicator("req fin")
data = request.financial("AAPL")
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { errors: ['PSV6-REQUEST-FINANCIAL-PARAMS'] });
    });

    it('warns on non-string field param', () => {
      const code = `//@version=6
indicator("req fin field warn")
data = request.financial("AAPL", 123)
`;
      context.lines = context.cleanLines = code.split('\n');
      const r = validator.validate(context, config);
      expectHas(r, { warnings: ['PSV6-REQUEST-FINANCIAL-FIELD'] });
    });
  });
});
