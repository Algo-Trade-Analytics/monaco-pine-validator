import { iterFields } from './helper';
import { AST } from './node';

export class NodeVisitor {
  visit<T = unknown>(node: AST): T {
    const methodName = `visit_${node.constructor.name}`;
    const visitor = (this as any)[methodName];
    if (typeof visitor === 'function') {
      return visitor.call(this, node);
    }
    return this.genericVisit(node) as T;
  }

  protected genericVisit(node: AST): unknown {
    for (const [, value] of iterFields(node)) {
      if (value instanceof AST) {
        this.visit(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof AST) {
            this.visit(item);
          }
        }
      }
    }
    return undefined;
  }
}
