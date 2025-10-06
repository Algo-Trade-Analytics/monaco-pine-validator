import { visit } from './traversal';
import type { ExpressionNode, MemberExpressionNode, ProgramNode } from './nodes';

export interface QualifiedMemberReference {
  name: string;
  node: MemberExpressionNode;
  line: number;
  column: number;
}

export function getQualifiedExpressionName(expression: ExpressionNode): string | null {
  if (expression.kind === 'Identifier') {
    return expression.name;
  }

  if (expression.kind === 'MemberExpression') {
    if (expression.computed) {
      return null;
    }

    const objectName = getQualifiedExpressionName(expression.object);
    if (!objectName) {
      return null;
    }

    return `${objectName}.${expression.property.name}`;
  }

  return null;
}

export function getQualifiedMemberName(member: MemberExpressionNode): string | null {
  if (member.computed) {
    return null;
  }

  return getQualifiedExpressionName(member);
}

export function getQualifiedMember(member: MemberExpressionNode): QualifiedMemberReference | null {
  const name = getQualifiedMemberName(member);
  if (!name) {
    return null;
  }

  const start = member.property?.loc?.start ?? member.loc.start;

  return {
    name,
    node: member,
    line: start.line,
    column: start.column,
  };
}

export function visitQualifiedMembers(
  program: ProgramNode,
  iteratee: (member: QualifiedMemberReference) => void,
): void {
  visit(program, {
    MemberExpression: {
      enter: ({ node }) => {
        const qualified = getQualifiedMember(node as MemberExpressionNode);
        if (qualified) {
          iteratee(qualified);
        }
      },
    },
  });
}

export function updateUsage(map: Map<string, number>, key: string): number {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next;
}
