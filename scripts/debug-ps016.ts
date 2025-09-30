import { ChevrotainAstService } from '../core/ast/service.ts';
import { visit } from '../core/ast/traversal.ts';

const code = `//@version=6
indicator("UDT field reassignment")

type Point
    float x
    float y

method setX(this<Point>, float value) =>
    this.x = value

p = Point.new(0.0, 0.0)
p.setX(1.0)
plot(close)`;

const service = new ChevrotainAstService();
const result = service.parse(code, { filename: 'test.pine' });
console.log('AST exists:', !!result.ast);
console.log('Diagnostics count:', result.diagnostics.syntaxErrors.length);

if (!result.ast) {
  process.exit(1);
}

visit(result.ast, {
  AssignmentStatement: {
    enter: (path) => {
      const node = path.node;
      console.log('Assignment at line', node.loc.start.line, 'operator', node.operator);
      if (node.left.kind === 'MemberExpression') {
        const member = node.left;
        console.log('  Member object kind:', member.object.kind);
        if (member.object.kind === 'Identifier') {
          console.log('  Member object name:', member.object.name);
        }
        console.log('  Member property kind:', member.property.kind);
        if (member.property.kind === 'Identifier') {
          console.log('  Member property name:', member.property.name);
        }
      }
    }
  }
});
