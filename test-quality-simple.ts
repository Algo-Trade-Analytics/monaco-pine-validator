import { EnhancedModularValidator } from './EnhancedModularValidator.js';
import type { ProgramNode } from './core/ast/nodes.js';

const codeSimple = `//@version=6
indicator("Test")
simpleFunc() =>
    if close > open
        1
    else
        0`;

const validator = new EnhancedModularValidator();

console.log('Test: Simple function (should NOT trigger complexity warning)');
const result = validator.validate(codeSimple);
console.log('  Errors:', result.errors.map(e => e.code));
console.log('  Warnings:', result.warnings.map(w => w.code));

// Try to parse the AST directly
const context = { lines: codeSimple.split('\n'), cleanLines: codeSimple.split('\n') };
import { ChevrotainAstService } from './core/ast/service.js';
const astService = new ChevrotainAstService();
const ast = astService.parseSource(codeSimple);
console.log('\nAST parsed:', ast ? 'yes' : 'no');
if (ast) {
  console.log('AST body statements:', (ast as ProgramNode).body.length);
}

