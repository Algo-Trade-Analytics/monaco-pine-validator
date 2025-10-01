require('ts-node/register/transpile-only');
(async () => {
  const { EnhancedModularValidator } = await import('./EnhancedModularValidator.ts');
  const validator = new EnhancedModularValidator();
  const code = `//@version=6\nindicator("Test")\nmyFunc() =>\n    if close > open\n        "bullish"\n    else\n        123\nresult = myFunc()\nplot(result)`;
  const result = validator.validate(code);
  console.log('errors', result.errors.map(e => [e.code, e.message]));
})();
