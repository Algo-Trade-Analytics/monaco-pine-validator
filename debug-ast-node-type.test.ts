import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug AST Node Type', () => {
  it('should check what AST node type is generated for if expressions', () => {
    const code = `//@version=6
strategy("Test", overlay = true)

maHigh = if bandType == 1
    ta.ema(high, bandLength)
else if bandType == 2
    ta.sma(high, bandLength)
else
    smma(high, bandLength)

plot(close)`;

    const validator = new EnhancedModularValidator();
    
    // Force AST parsing by using primary mode
    const result = validator.validate(code, { ast: { mode: 'primary' } });

    console.log('\n=== AST NODE TYPE DEBUG ===');
    console.log('AST available:', !!validator.context?.ast);
    
    if (validator.context?.ast) {
      // Find the assignment statement
      const assignmentNode = validator.context.ast.body.find(node => 
        node.kind === 'VariableDeclaration' || node.kind === 'AssignmentStatement'
      );
      
      if (assignmentNode) {
        console.log('Assignment node kind:', assignmentNode.kind);
        
        if (assignmentNode.kind === 'AssignmentStatement') {
          const assignment = assignmentNode as any;
          console.log('Assignment right side kind:', assignment.right?.kind);
          
          if (assignment.right?.kind === 'IfExpression') {
            console.log('✅ Found IfExpression node!');
            console.log('IfExpression test:', assignment.right.test?.kind);
            console.log('IfExpression consequent:', assignment.right.consequent?.kind);
            console.log('IfExpression alternate:', assignment.right.alternate?.kind);
          } else {
            console.log('❌ Right side is NOT IfExpression, it is:', assignment.right?.kind);
          }
        }
      } else {
        console.log('❌ No assignment statement found');
      }
    }
    
    console.log('\nTotal errors:', result.errors.length);
    const indentErrors = result.errors.filter(e => e.code.includes('INDENT'));
    console.log('Indentation errors:', indentErrors.length);
  });
});
