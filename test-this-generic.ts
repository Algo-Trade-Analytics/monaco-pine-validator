import { ChevrotainAstService } from './core/ast/service.js';
import { visit } from './core/ast/traversal.js';

const code = `//@version=6
indicator("Test")
type Point
    float x
    float y

method setX(this<Point>, float value) =>
    this.x := value

p = Point.new(0.0, 0.0)
p.setX(1.0)
plot(close)`;

const service = new ChevrotainAstService();
const parseResult = service.parse(code, { filename: 'test.pine' });

console.log('Parse result:');
console.log('  AST exists:', !!parseResult.ast);
console.log('  Diagnostics:', parseResult.diagnostics);

if (parseResult.ast) {
  console.log('\nLooking for method declaration:');
  
  visit(parseResult.ast, {
    FunctionDeclaration: {
      enter: (path: any) => {
        const node = path.node;
        if (node.modifiers?.includes('method')) {
          console.log('\nMethod found:', node.identifier?.name);
          console.log('  Modifiers:', node.modifiers);
          console.log('  Params:', node.params.length);
          
          node.params.forEach((param: any, i: number) => {
            console.log(`  Param ${i}:`);
            console.log(`    Name: ${param.identifier.name}`);
            console.log(`    Has type annotation: ${!!param.typeAnnotation}`);
            if (param.typeAnnotation) {
              console.log(`    Type: ${param.typeAnnotation.name.name}`);
              console.log(`    Generics: ${param.typeAnnotation.generics?.length || 0}`);
            }
          });
        }
      }
    },
    AssignmentStatement: {
      enter: (path: any) => {
        const node = path.node;
        if (node.left.kind === 'MemberExpression') {
          const member = node.left;
          if (member.object.kind === 'Identifier' && member.object.name === 'this') {
            console.log('\nAssignment to this.field found:');
            console.log(`  Field: ${member.property.name}`);
            console.log(`  Operator: ${node.operator}`);
            console.log(`  Line: ${node.loc.start.line}`);
          }
        }
      }
    }
  });
}

