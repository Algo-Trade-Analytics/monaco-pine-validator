import { parseWithChevrotain } from './core/ast/parser/parse.js';
import fs from 'fs';

const code = fs.readFileSync('test_issue.pine', 'utf8');

console.log('=== Testing Issue ===');
const parseResult = parseWithChevrotain(code);

console.log('Parse result:', parseResult.ast ? '✅ SUCCESS' : '❌ FAILED');

if (!parseResult.ast) {
  console.log('Error:', parseResult.diagnostics);
}
