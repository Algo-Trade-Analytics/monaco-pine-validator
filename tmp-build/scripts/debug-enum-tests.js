import { ModuleValidationHarness } from '../tests/specs/test-utils.ts';
import { EnumValidator } from '../modules/enum-validator.ts';
const harness = new ModuleValidationHarness(new EnumValidator());
const samples = [
    {
        name: 'invalid value names',
        code: `//@version=6
indicator("Invalid Enum Test")

enum MyEnum
    VALUE1
    123INVALID
    VALUE3

plot(close)`
    },
    {
        name: 'assignment mismatch',
        code: `//@version=6
indicator("Enum Type Mismatch Test")

enum Status
    ACTIVE
    INACTIVE

int current_status = Status.ACTIVE
plot(close)`
    },
    {
        name: 'function mismatch',
        code: `//@version=6
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
plot(close)`
    }
];
for (const sample of samples) {
    const result = harness.run(sample.code);
    console.log('---', sample.name, '---');
    console.log('errors', result.errors.map(e => e.code));
    console.log('warnings', result.warnings.map(w => w.code));
}
