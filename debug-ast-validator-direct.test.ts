import { describe, it, expect } from 'vitest';
import { validateIndentationWithAST } from '../../core/ast/indentation-validator-ast';
import { createAstService } from '../../core/ast/service';
import type { ProgramNode } from '../../core/ast/nodes';

describe('Debug AST Validator Direct', () => {
  it('should test AST validator directly', async () => {
    const code = `//@version=6
strategy("Test", overlay = true)

maHigh = if bandType == 1
    ta.ema(high, bandLength)
else if bandType == 2
    ta.sma(high, bandLength)
else
    smma(high, bandLength)

plot(close)`;

    console.log('\n=== DIRECT AST VALIDATOR TEST ===');
    
    // Parse the AST
    const astService = createAstService();
    const parseResult = astService.parse(code, { filename: 'test.pine', allowErrors: true });
    
    if (!parseResult.ast) {
      console.log('❌ Failed to parse AST');
      return;
    }
    
    console.log('✅ AST parsed successfully');
    
    // Test AST validator directly
    const errors = validateIndentationWithAST(code, parseResult.ast);
    
    console.log('Total AST validator errors:', errors.length);
    const indentErrors = errors.filter(e => e.code.includes('INDENT'));
    console.log('AST validator indentation errors:', indentErrors.length);
    
    indentErrors.forEach((error, i) => {
      console.log(`${i + 1}. Line ${error.line}: ${error.code} - ${error.message}`);
    });
    
    // Check if the AST contains IfExpression nodes
    console.log('\n=== AST NODE ANALYSIS ===');
    const findIfExpressions = (node: any, depth = 0): void => {
      if (node.kind === 'IfExpression') {
        console.log(`${'  '.repeat(depth)}Found IfExpression at line ${node.loc?.start?.line}`);
      }
      
      // Recursively search children
      const children = Object.values(node).filter(v => 
        v && typeof v === 'object' && v.kind
      );
      children.forEach(child => findIfExpressions(child, depth + 1));
    };
    
    findIfExpressions(parseResult.ast);
  });
});
