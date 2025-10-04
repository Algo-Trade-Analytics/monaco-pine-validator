import { parseWithChevrotain } from './core/ast/parser/parse.js';
import { visit } from './core/ast/traversal.js';
import fs from 'fs';

const code = fs.readFileSync('test_issue.pine', 'utf8');

console.log('=== Debugging Enum AST ===');
const parseResult = parseWithChevrotain(code);

if (parseResult.ast) {
  console.log('Looking for PaletteOpt identifiers...\n');
  
  visit(parseResult.ast, {
    Identifier: {
      enter: (path) => {
        if (path.node.name === 'PaletteOpt') {
          console.log(`Found PaletteOpt at line ${path.node.loc.start.line}`);
          console.log(`  Parent node:`, path.parent);
          console.log(`  Key: ${path.key}`);
        }
      }
    }
  });
}
