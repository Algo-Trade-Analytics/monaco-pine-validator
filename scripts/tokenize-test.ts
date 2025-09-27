import { PineLexer } from '../core/ast/parser/tokens.ts';

const code = `//@version=6
indicator("String Test")
length = str.length(123)
contains = str.contains(123, "world")
pos = str.pos("hello", 123)
repeat = str.repeat("hello", "3")`;

const result = PineLexer.tokenize(code);
console.log('tokens length', result.tokens.length);
console.log('errors', result.errors);
console.log(result.tokens.map(t => ({ type: t.tokenType.name, image: t.image }))); 
