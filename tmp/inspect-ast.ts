import { ChevrotainAstService } from '../core/ast/service';

const code = `//@version=6
indicator("Test")
complexFunc() =>
    if close > open
        if volume > ta.sma(volume, 20)
            if high > ta.highest(high, 10)
                if low < ta.lowest(low, 10)
                    if rsi > 70
                        if macd > 0
                            1
                        else
                            2
                    else
                        3
                else
                    4
            else
                5
        else
            6
    else
        7`;

const service = new ChevrotainAstService();
let result;
try {
  result = service.parse(code, { allowErrors: true, filename: 'input.pine' });
} catch (err) {
  console.error('parse error', err);
  process.exit(1);
}

console.log('syntax errors', result.diagnostics.syntaxErrors);
if (!result.ast) {
  console.log('No AST produced');
  process.exit(0);
}

function dump(node: any, depth = 0) {
  const indent = '  '.repeat(depth);
  console.log(indent + node.kind);
  if (Array.isArray(node.directives)) {
    node.directives.forEach((child: any) => dump(child, depth + 1));
  }
  if (Array.isArray(node.body)) {
    node.body.forEach((child: any) => dump(child, depth + 1));
  }
  if (node.consequent) {
    dump(node.consequent, depth + 1);
  }
  if (node.alternate) {
    dump(node.alternate, depth + 1);
  }
  if (node.argument) {
    dump(node.argument, depth + 1);
  }
  if (node.expression) {
    dump(node.expression, depth + 1);
  }
  if (node.test) {
    dump(node.test, depth + 1);
  }
  if (Array.isArray(node.params)) {
    node.params.forEach((child: any) => dump(child, depth + 1));
  }
  if (node.body && node.body.kind) {
    dump(node.body, depth + 1);
  }
}

dump(result.ast);
