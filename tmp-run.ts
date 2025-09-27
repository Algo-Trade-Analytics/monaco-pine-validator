import process from 'node:process';
import { EnhancedModularValidator } from './EnhancedModularValidator.ts';

process.on('uncaughtException', (error) => {
  console.error('uncaught', error);
  if (error && typeof error === 'object') {
    console.error('keys', Object.keys(error));
  }
});

(async () => {
  const validator = new EnhancedModularValidator({
    enableWarnings: true,
    enableInfo: true,
  });

  const code = `//@version=6
indicator("Invalid Enum Test")

enum MyEnum
    VALUE1
    123INVALID
    VALUE3

plot(close)`;

  const result = validator.validate(code);
  console.log('isValid', result.isValid);
  console.log('errors', result.errors.map((e) => ({ code: e.code, message: e.message, line: e.line })));
})();
