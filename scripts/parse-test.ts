import { parseWithChevrotain } from '../core/ast/parser/parse.ts';

console.log('starting parse test');

const code = `//@version=6
indicator("String Test")
length = str.length(123)
contains = str.contains(123, "world")
pos = str.pos("hello", 123)
repeat = str.repeat("hello", "3")`;

try {
  const result = parseWithChevrotain(code, { allowErrors: true });
  console.log(JSON.stringify(result.diagnostics, null, 2));
  console.log(result.ast ? 'AST present' : 'No AST');
} catch (error) {
  console.error('Parse error caught:', error);
}
