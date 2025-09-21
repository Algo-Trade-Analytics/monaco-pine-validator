import { FunctionAstService } from '../../core/ast/service';
import { createAstDiagnostics } from '../../core/ast/types';
import {
  createIdentifier,
  createMemberExpression,
  createVariableDeclaration,
} from '../ast/fixtures';
import {
  createLocation,
  createPosition,
  createRange,
  type ExpressionNode,
  type MemberExpressionNode,
  type ProgramNode,
  type VariableDeclarationNode,
} from '../../core/ast/nodes';

const IDENTIFIER_CHAIN_PATTERN = /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/g;

function createMemberExpressionChain(parts: string[], start: number, line: number): MemberExpressionNode {
  let expression: ExpressionNode = createIdentifier(parts[0], start, line);
  let currentStart = expression.range[0];

  for (let index = 1; index < parts.length; index += 1) {
    const prefixLength = parts.slice(0, index).join('.').length + 1;
    const propertyStart = start + prefixLength;
    const property = createIdentifier(parts[index], propertyStart, line);
    const end = property.range[1];
    expression = createMemberExpression(expression, property, currentStart, end, line);
    currentStart = expression.range[0];
  }

  return expression as MemberExpressionNode;
}

function createAstProgramFromSource(source: string): ProgramNode {
  const lines = source.split(/\r?\n/);
  const declarations: VariableDeclarationNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const matches = line.matchAll(new RegExp(IDENTIFIER_CHAIN_PATTERN));

    for (const match of matches) {
      const parts = match[0].split('.');
      const member = createMemberExpressionChain(parts, match.index, index + 1);
      const identifier = createIdentifier(`__const_${declarations.length}`, match.index, index + 1);
      const declaration = createVariableDeclaration(
        identifier,
        match.index,
        member.range[1],
        index + 1,
        { declarationKind: 'var', initializer: member },
      );
      declarations.push(declaration);
    }
  }

  const endOffset = source.length;
  const endLine = lines.length > 0 ? lines.length : 1;
  const lastLineLength = lines.length > 0 ? lines[lines.length - 1].length : 0;

  return {
    kind: 'Program',
    directives: [],
    body: declarations,
    loc: createLocation(
      createPosition(1, 1, 0),
      createPosition(endLine, lastLineLength + 1, endOffset),
    ),
    range: createRange(0, endOffset),
  };
}

export function createConstantAstService(): FunctionAstService {
  return new FunctionAstService((source) => ({
    ast: createAstProgramFromSource(source),
    diagnostics: createAstDiagnostics(),
  }));
}
