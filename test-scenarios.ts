import { EnhancedModularValidator } from './EnhancedModularValidator.js';

const scenarios = [
  {
    name: 'na_comparison_warning',
    code: `//@version=6\nindicator("NA Comparison")\ncond = close == na\nplot(cond ? 1 : 0)\n`,
    expect: { warnings: ['PS023', 'PSV6-TYPE-SAFETY-NA-COMPARISON', 'PSV6-TYPE-SAFETY-NA-FUNCTION'] }
  },
  {
    name: 'request_security_missing_param',
    code: `//@version=6\nindicator("Request Security")\nres = request.security(syminfo.tickerid, "D")\nplot(res)\n`,
    expect: {
      errors: ['PSV6-FUNCTION-PARAM-COUNT', 'PSV6-FUNCTION-PARAM-TYPE', 'PSV6-REQUEST-PARAMS'],
      warnings: ['PSV6-REPAINT-SECURITY', 'PSV6-ENUM-COMPARISON-TYPE-MISMATCH', 'PSV6-REQUEST-DYNAMIC-SYMBOL']
    }
  },
  {
    name: 'input_string_default_non_literal',
    code: `//@version=6\nindicator("Input String Non Literal")\nname = input.string(close, "Name")\nplot(close)`,
    expect: { warnings: ['PSV6-INPUT-DEFAULT-TYPE', 'PSV6-TYPE-SAFETY-NA-FUNCTION'] }
  },
];

const validator = new EnhancedModularValidator();

scenarios.forEach(scenario => {
  console.log(`\nTesting: ${scenario.name}`);
  const result = validator.validate(scenario.code);
  const codes = {
    errors: result.errors.map(e => e.code),
    warnings: result.warnings.map(w => w.code),
  };
  console.log('  Got errors:', codes.errors);
  console.log('  Expected errors:', scenario.expect.errors || []);
  console.log('  Got warnings:', codes.warnings);
  console.log('  Expected warnings:', scenario.expect.warnings || []);
});

