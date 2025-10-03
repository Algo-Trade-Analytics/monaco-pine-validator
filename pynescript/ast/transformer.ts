import { iterFields } from './helper';
import { AST } from './node';
import { NodeVisitor } from './visitor';

export class NodeTransformer extends NodeVisitor {
  protected override genericVisit(node: AST): AST | null {
    for (const [field, oldValue] of iterFields(node)) {
      if (Array.isArray(oldValue)) {
        const newValues: unknown[] = [];
        for (const value of oldValue) {
          let result = value;
          if (value instanceof AST) {
            result = this.visit(value);
            if (result === null || result === undefined) {
              continue;
            }
            if (Array.isArray(result)) {
              newValues.push(...result);
              continue;
            }
          }
          newValues.push(result);
        }
        (oldValue as unknown[]).splice(0, oldValue.length, ...newValues);
      } else if (oldValue instanceof AST) {
        const newNode = this.visit(oldValue);
        if (newNode === null || newNode === undefined) {
          delete (node as unknown as Record<string, unknown>)[field];
        } else {
          (node as unknown as Record<string, unknown>)[field] = newNode;
        }
      }
    }
    return node;
  }
}
