import { parseWithChevrotain } from './core/ast/parser';

const code = `//@version=6
indicator("Malformed Linefill Test")
line1 = line.new(bar_index, high, bar_index[1], low[1])
line2 = line.new(bar_index, low, bar_index[1], high[1])
linefill.new(line1, line2,)
linefill.set_color(fill, color=)
`;

console.log('Parsing code with malformed syntax...\n');

const result = parseWithChevrotain(code, 'test.pine');

console.log('Parse errors:', result.errors?.length || 0);
if (result.errors && result.errors.length > 0) {
  result.errors.forEach(e => {
    console.log(`  - Line ${e.line}: ${e.message}`);
  });
}

console.log('\nAST body length:', result.ast?.body.length);

if (result.ast) {
  // Find the linefill.new call
  result.ast.body.forEach((stmt, i) => {
    if (stmt.kind === 'AssignmentStatement') {
      console.log(`\nStatement ${i}: ${stmt.kind}`);
    } else if (stmt.kind === 'ExpressionStatement') {
      const expr = (stmt as any).expression;
      if (expr && expr.kind === 'CallExpression') {
        const callee = expr.callee;
        if (callee.kind === 'MemberExpression') {
          const obj = callee.object;
          const prop = callee.property;
          if (obj.kind === 'Identifier' && prop.kind === 'Identifier') {
            const funcName = `${obj.name}.${prop.name}`;
            console.log(`\nStatement ${i}: CallExpression - ${funcName}`);
            console.log('  Arguments:', expr.arguments.length);
            expr.arguments.forEach((arg: any, j: number) => {
              console.log(`    Arg ${j}: kind=${arg.kind}, ${arg.name ? `name=${arg.name}` : ''}`);
              if (arg.kind === 'NamedArgument') {
                console.log(`      name: ${arg.name}, value: ${arg.value ? arg.value.kind : 'undefined'}`);
              }
            });
          }
        }
      }
    }
  });
}

