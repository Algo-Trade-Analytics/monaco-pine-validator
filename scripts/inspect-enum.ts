import { parseWithChevrotain } from '../core/ast/parser/index.ts';

const code = `//@version=6
indicator("Enum Test")

enum MyEnum
    VALUE1
    123INVALID
    VALUE3

plot(close)`;

const result = parseWithChevrotain(code, { allowErrors: true });
console.log('diagnostics', result.diagnostics);
console.log(JSON.stringify(result.ast, null, 2));
