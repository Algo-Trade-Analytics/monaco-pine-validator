import { EnhancedModularValidator } from './EnhancedModularValidator';

const validator = new EnhancedModularValidator();
const cases: Record<string, string> = {
  'non-integer version': `//@version=6\nindicator("Test")\nimport "user/lib/v1.5" as myLib`,
  'double slash': `//@version=6\nindicator("Test")\nimport "user//lib/1" as myLib`,
  'missing version': `//@version=6\nindicator("Test")\nimport "user/lib" as myLib`,
  'alias conflict fn': `//@version=6\nindicator("Test")\nmyFunc() => 1\nimport "user/lib/1" as myFunc`,
  'valid': `//@version=6\nindicator("Test")\nimport "user/lib/1" as myLib`,
};

for (const [label, code] of Object.entries(cases)) {
  const result = validator.validate(code);
  const errors = result.errors.map((e) => `${e.code}:${e.message}`);
  console.log(label, errors);
}
