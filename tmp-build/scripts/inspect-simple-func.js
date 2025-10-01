import { parseWithChevrotain } from '../core/ast/parser/index.ts';
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
`;
try {
    const result = parseWithChevrotain(code, { allowErrors: true });
    console.log('diagnostics', result.diagnostics);
    console.log(JSON.stringify(result.ast?.body, null, 2));
}
catch (error) {
    console.error('parse error', error);
}
