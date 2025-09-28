import { ModuleValidationHarness } from '../tests/specs/test-utils.ts';
import { EnumValidator } from '../modules/enum-validator.ts';

const harness: any = new ModuleValidationHarness(new EnumValidator());
const code = `//@version=6
indicator("Enum Function Type Test")

enum Status
    ACTIVE
    INACTIVE

enum Color
    RED
    BLUE

f(status) =>
    if status == Status.ACTIVE
        "Active"
    else
        "Inactive"

result = f(Color.RED)
plot(close)`;

const result = harness.run(code);
const module = harness.modules.find((m: any) => m.name === 'EnumValidator');
console.log('function params map size', module.astFunctionParams.size);
console.log('errors', result.errors.map((e: any) => e.code));
