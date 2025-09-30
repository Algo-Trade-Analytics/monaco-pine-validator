import { ChevrotainAstService } from './core/ast/service.js';
import { visit } from './core/ast/traversal.js';

const code = `//@version=6
strategy("Test Strategy", overlay=true)
if close > open
    strategy.entry("Long", strategy.long)
`;

const service = new ChevrotainAstService();
const parseResult = service.parse(code, { filename: 'test.pine' });

console.log('Parse result:');
console.log('  AST exists:', !!parseResult.ast);

if (parseResult.ast) {
  console.log('\nLooking for strategy() and strategy.entry() calls:');
  
  visit(parseResult.ast, {
    ScriptDeclaration: {
      enter: (path: any) => {
        const node = path.node;
        console.log('\nScriptDeclaration found:');
        console.log('  Script type:', node.scriptType);
        console.log('  Arguments:', node.arguments.length);
        node.arguments.forEach((arg: any, i: number) => {
          console.log(`  Arg ${i}: name=${arg.name?.name}, value kind=${arg.value.kind}`);
        });
      }
    },
    CallExpression: {
      enter: (path: any) => {
        const node = path.node;
        if (node.callee.kind === 'MemberExpression') {
          const member = node.callee;
          if (member.object.kind === 'Identifier' && member.object.name === 'strategy') {
            console.log('\nCallExpression found:');
            console.log('  Function: strategy.' + member.property.name);
            console.log('  Arguments:', node.args.length);
          }
        }
      }
    }
  });
}

