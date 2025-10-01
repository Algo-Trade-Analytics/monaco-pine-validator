import { parseWithChevrotain } from './core/ast/parser';
import { visit } from './core/ast/traversal';

console.log('═══════════════════════════════════════════════════════════════');
console.log('INVESTIGATING: var array<type> declarations in AST');
console.log('═══════════════════════════════════════════════════════════════\n');

const testCases = [
  {
    name: 'var with array type',
    code: `//@version=6
indicator("Test")
var array<int> x = array.new<int>()`
  },
  {
    name: 'let with array type',
    code: `//@version=6
indicator("Test")
let array<int> x = array.new<int>()`
  },
  {
    name: 'var with chart.point',
    code: `//@version=6
indicator("Test")
var array<chart.point> points = array.new<chart.point>()`
  }
];

for (const testCase of testCases) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test: ${testCase.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log('Code:', testCase.code);
  
  const result = parseWithChevrotain(testCase.code, 'test.pine');
  
  if (result.errors && result.errors.length > 0) {
    console.log('\n❌ Parse errors:');
    result.errors.forEach(e => console.log(`  - Line ${e.line}: ${e.message}`));
  }
  
  if (!result.ast) {
    console.log('\n❌ No AST produced');
    continue;
  }
  
  console.log('\n📋 AST Body:');
  result.ast.body.forEach((node, i) => {
    console.log(`\n[${i}] ${node.kind}:`);
    console.log(JSON.stringify(node, null, 2));
  });
  
  console.log('\n🔍 Visitor Analysis:');
  
  let visitedNodes = {
    VariableDeclaration: 0,
    ExpressionStatement: 0,
    BinaryExpression: 0,
    AssignmentStatement: 0
  };
  
  visit(result.ast, {
    VariableDeclaration: {
      enter: (path) => {
        visitedNodes.VariableDeclaration++;
        const node = path.node as any;
        console.log(`  ✅ VariableDeclaration (kind: ${node.declarationKind}, name: ${node.identifier?.name})`);
      }
    },
    ExpressionStatement: {
      enter: (path) => {
        visitedNodes.ExpressionStatement++;
        const node = path.node as any;
        console.log(`  ✅ ExpressionStatement (expression.kind: ${node.expression?.kind})`);
      }
    },
    BinaryExpression: {
      enter: (path) => {
        visitedNodes.BinaryExpression++;
        const node = path.node as any;
        console.log(`  ✅ BinaryExpression (operator: ${node.operator})`);
      }
    },
    AssignmentStatement: {
      enter: (path) => {
        visitedNodes.AssignmentStatement++;
        console.log(`  ✅ AssignmentStatement`);
      }
    }
  });
  
  console.log('\n📊 Visitor Summary:', visitedNodes);
}

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('CONCLUSION:');
console.log('═══════════════════════════════════════════════════════════════');
console.log('Based on the above output, we can determine:');
console.log('1. Are var declarations visited as VariableDeclaration?');
console.log('2. What AST structure do they have?');
console.log('3. How does it differ from let declarations?');
console.log('═══════════════════════════════════════════════════════════════\n');


