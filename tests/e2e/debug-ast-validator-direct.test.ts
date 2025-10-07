import { describe, it, expect } from 'vitest';
import { validateIndentationWithAST } from '../../core/ast/indentation-validator-ast';
import { ChevrotainAstService } from '../../core/ast/service';
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
    const astService = new ChevrotainAstService();
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
    
    // Check what AST node types are generated
    console.log('\n=== AST NODE ANALYSIS ===');
    const analyzeNodes = (node: any, depth = 0): void => {
      if (node && typeof node === 'object' && node.kind) {
        console.log(`${'  '.repeat(depth)}${node.kind} at line ${node.loc?.start?.line || 'unknown'}`);
        
        // Special handling for assignment statements
        if (node.kind === 'AssignmentStatement') {
          console.log(`${'  '.repeat(depth + 1)}Left: ${node.left?.kind || 'unknown'}`);
          console.log(`${'  '.repeat(depth + 1)}Right: ${node.right?.kind || 'unknown'}`);
          
          if (node.right?.kind === 'IfExpression') {
            console.log(`${'  '.repeat(depth + 1)}✅ Found IfExpression in assignment!`);
          }
        }
        
        // Recursively analyze children
        const children = Object.values(node).filter(v => 
          v && typeof v === 'object' && (v.kind || Array.isArray(v))
        );
        children.forEach(child => {
          if (Array.isArray(child)) {
            child.forEach(item => analyzeNodes(item, depth + 1));
          } else {
            analyzeNodes(child, depth + 1);
          }
        });
      }
    };
    
    analyzeNodes(parseResult.ast);
  });
});
