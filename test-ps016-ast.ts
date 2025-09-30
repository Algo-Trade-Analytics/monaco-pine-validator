import { ChevrotainAstService } from './core/ast/service.js';
import { visit } from './core/ast/traversal.js';

const code = `//@version=6
indicator("UDT field reassignment")

type Point
    float x
    float y

method setX(this, value) =>
    this.x = value

p = Point.new(0.0, 0.0)
p.setX(1.0)
plot(close)`;

const service = new ChevrotainAstService();
const parseResult = service.parse(code, { filename: 'test.pine' });

console.log('Parse result:');
console.log('  AST exists:', !!parseResult.ast);
console.log('  Diagnostics:', parseResult.diagnostics);

if (parseResult.ast) {
  console.log('\nLooking for AssignmentStatement with this.x =');
  
  visit(parseResult.ast, {
    AssignmentStatement: {
      enter: (path: any) => {
        const node = path.node;
        console.log('\nAssignmentStatement found:');
        console.log('  Line:', node.loc.start.line);
        console.log('  Left kind:', node.left.kind);
        console.log('  Operator:', node.operator);
        
        if (node.left.kind === 'MemberExpression') {
          const member = node.left;
          console.log('  Object kind:', member.object.kind);
          if (member.object.kind === 'Identifier') {
            console.log('  Object name:', member.object.name);
          }
          console.log('  Property:', member.property.name);
        }
      }
    }
  });
}

