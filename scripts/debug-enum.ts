import { EnhancedModularValidator } from '../EnhancedModularValidator.ts';

const validator: any = new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  ast: { mode: 'primary' },
});

const code = `//@version=6
indicator("Enum Function Type Test")

enum Status
    ACTIVE
    INACTIVE

enum Color
    RED
    BLUE

f(status) =>
    status == Status.ACTIVE

result = f(Color.RED)
`;

const result = validator.validate(code);
console.log('errors', result.errors.map((e: any) => ({ code: e.code, message: e.message, line: e.line })));
const enumValidator = validator.modules.find((m: any) => m.name === 'EnumValidator');
console.log('param map', Array.from(enumValidator.astFunctionParams.entries()).map(([k, params]: [string, any[]]) => [k, params.map((p) => p.identifier.name)]));
console.log('enum hints', Array.from(enumValidator.functionParamEnumHints.entries()));
