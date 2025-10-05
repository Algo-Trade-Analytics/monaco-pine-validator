import { EnhancedModularValidator } from './EnhancedModularValidator.ts';
const validator = new EnhancedModularValidator();
const code = `//@version=6\nindicator("Test")\nmyFunc() =>\n    if close > open\n        return "bullish"\n    else\n        return 123\nresult = myFunc()\nplot(result)`;
const result = validator.validate(code);
console.log('errors', result.errors.map(({ code, line, column, message }) => ({ code, line, column, message })));
console.log('warnings', result.warnings.map(({ code, line, column, message }) => ({ code, line, column, message })));
console.log('info', result.info.map(({ code, line, column, message }) => ({ code, line, column, message })));
