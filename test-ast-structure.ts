import { ChevrotainAstService } from './core/ast/service.js';
import { visit } from './core/ast/traversal.js';

const code = `//@version=6
indicator("NA Comparison")
cond = close == na
plot(cond ? 1 : 0)
`;

const service = new ChevrotainAstService();
const parseResult = service.parse(code, { filename: 'test.pine' });

console.log('AST Structure:');
console.log('=================');

if (parseResult.ast) {
  let depth = 0;
  
  const visitor = (kind: string) => ({
    enter: (path: any) => {
      const indent = '  '.repeat(depth);
      const node = path.node;
      const nodeInfo = `${node.kind} (line ${node.loc.start.line})`;
      
      // Add special information for specific node types
      if (node.kind === 'Identifier') {
        console.log(`${indent}${nodeInfo} name="${(node as any).name}"`);
      } else if (node.kind === 'BinaryExpression') {
        console.log(`${indent}${nodeInfo} operator="${(node as any).operator}"`);
      } else {
        console.log(`${indent}${nodeInfo}`);
      }
      
      depth++;
    },
    exit: () => {
      depth--;
    }
  });
  
  // Create a visitor map for all node types
  const allVisitors: any = {};
  const nodeTypes = [
    'Program', 'ScriptDeclaration', 'VariableDeclaration', 'AssignmentStatement', 
    'BinaryExpression', 'Identifier', 'CallExpression', 'MemberExpression',
    'ExpressionStatement', 'ConditionalExpression', 'IfStatement', 'WhileStatement',
    'ForStatement', 'SwitchStatement', 'SwitchCase', 'ReturnStatement',
    'FunctionDeclaration', 'Parameter', 'BlockStatement', 'Argument',
    'NumberLiteral', 'StringLiteral', 'BooleanLiteral', 'NullLiteral',
    'ArrayLiteral', 'TupleExpression', 'IndexExpression', 'UnaryExpression',
    'TypeDeclaration', 'TypeField', 'TypeReference', 'ImportDeclaration',
    'EnumDeclaration', 'EnumMember', 'VersionDirective', 'Comment',
    'BreakStatement', 'ContinueStatement', 'RepeatStatement', 'IfExpression',
    'ArrowFunctionExpression', 'MatrixLiteral'
  ];
  
  for (const type of nodeTypes) {
    allVisitors[type] = visitor(type);
  }
  
  visit(parseResult.ast, allVisitors);
}

