import { EnumDef, ForIn, ForTo, If, Switch, While, stmt } from './node';
import { NodeVisitor } from './visitor';

const STRUCTURE_NODES = new Set([ForTo, ForIn, While, If, Switch]);

type Structure = ForTo | ForIn | While | If | Switch;

function isStructure(node: unknown): node is Structure {
  for (const ctor of STRUCTURE_NODES) {
    if (node instanceof ctor) {
      return true;
    }
  }
  return false;
}

export class StatementCollector extends NodeVisitor {
  override visit_Script(node: any): Iterable<stmt> {
    return this.collectFromList(node.body);
  }

  override visit_FunctionDef(node: any): Iterable<stmt> {
    return this.visitWithBody(node);
  }

  override visit_TypeDef(node: any): Iterable<stmt> {
    return this.visitWithBody(node);
  }

  override visit_EnumDef(node: EnumDef): Iterable<stmt> {
    return [node];
  }

  override visit_Assign(node: any): Iterable<stmt> {
    return this.visitWithValue(node);
  }

  override visit_ReAssign(node: any): Iterable<stmt> {
    return this.visitWithValue(node);
  }

  override visit_AugAssign(node: any): Iterable<stmt> {
    return this.visitWithValue(node);
  }

  override visit_Import(node: stmt): Iterable<stmt> {
    return [node];
  }

  override visit_Expr(node: any): Iterable<stmt> {
    const items: stmt[] = [node];
    if (isStructure(node.value)) {
      items.push(...this.visit(node.value));
    }
    return items;
  }

  override visit_Break(node: stmt): Iterable<stmt> {
    return [node];
  }

  override visit_Continue(node: stmt): Iterable<stmt> {
    return [node];
  }

  override visit_ForTo(node: ForTo): Iterable<stmt> {
    return this.collectFromList(node.body);
  }

  override visit_ForIn(node: ForIn): Iterable<stmt> {
    return this.collectFromList(node.body);
  }

  override visit_While(node: While): Iterable<stmt> {
    return this.collectFromList(node.body);
  }

  override visit_If(node: If): Iterable<stmt> {
    return [...this.collectFromList(node.body), ...this.collectFromList(node.orelse)];
  }

  override visit_Switch(node: Switch): Iterable<stmt> {
    const items: stmt[] = [];
    for (const caseNode of node.cases) {
      items.push(...this.visit(caseNode));
    }
    return items;
  }

  override visit_Case(node: any): Iterable<stmt> {
    return this.collectFromList(node.body);
  }

  private visitWithBody(node: any): Iterable<stmt> {
    const items: stmt[] = [node];
    items.push(...this.collectFromList(node.body));
    return items;
  }

  private visitWithValue(node: any): Iterable<stmt> {
    const items: stmt[] = [node];
    if (isStructure(node.value)) {
      items.push(...this.visit(node.value));
    }
    return items;
  }

  private collectFromList(nodes: stmt[]): stmt[] {
    const items: stmt[] = [];
    for (const entry of nodes) {
      if (entry instanceof stmt) {
        const result = this.visit(entry) as Iterable<stmt> | stmt | null | undefined;
        if (!result) {
          continue;
        }
        if (Array.isArray(result)) {
          items.push(...result);
        } else if (typeof (result as any)[Symbol.iterator] === 'function') {
          items.push(...(result as Iterable<stmt>));
        } else if (result instanceof stmt) {
          items.push(result);
        }
      }
    }
    return items;
  }
}
