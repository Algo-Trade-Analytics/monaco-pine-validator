import type { IToken } from 'chevrotain';
import {
  type CompilerAnnotationNode,
  type EnumDeclarationNode,
  type FunctionDeclarationNode,
  type ScriptDeclarationNode,
  type StatementNode,
  type TypeDeclarationNode,
  type VariableDeclarationKind,
  type VariableDeclarationNode,
} from '../nodes';
import { Dot, Identifier as IdentifierToken } from './tokens';

type AnnotatableStatementNode =
  | ScriptDeclarationNode
  | FunctionDeclarationNode
  | TypeDeclarationNode
  | EnumDeclarationNode
  | VariableDeclarationNode;

function isAnnotatableStatement(node: StatementNode): node is AnnotatableStatementNode {
  switch (node.kind) {
    case 'ScriptDeclaration':
    case 'FunctionDeclaration':
    case 'TypeDeclaration':
    case 'EnumDeclaration':
    case 'VariableDeclaration':
      return true;
    default:
      return false;
  }
}

export function attachCompilerAnnotations(
  node: StatementNode,
  annotations: CompilerAnnotationNode[],
): void {
  if (annotations.length === 0) {
    return;
  }

  if (isAnnotatableStatement(node)) {
    node.annotations.push(...annotations);
  }
}

const DECLARATION_KEYWORDS = new Set(['var', 'varip', 'const', 'let', 'simple']);

export function isDeclarationKeywordToken(token: IToken | undefined): boolean {
  if (!token) {
    return false;
  }
  return DECLARATION_KEYWORDS.has(token.image?.toLowerCase() ?? '');
}

export function toDeclarationKind(image: string | undefined): VariableDeclarationKind {
  switch ((image ?? '').toLowerCase()) {
    case 'var':
      return 'var';
    case 'varip':
      return 'varip';
    case 'const':
      return 'const';
    case 'let':
      return 'let';
    case 'simple':
      return 'simple';
    default:
      return 'simple';
  }
}

export function splitDeclarationTokens(
  tokens: IToken[],
): { typeTokens: IToken[]; identifierToken: IToken | undefined } {
  let lastIdentifierIndex = -1;
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (tokens[index]?.tokenType === IdentifierToken) {
      lastIdentifierIndex = index;
      break;
    }
  }

  if (lastIdentifierIndex === -1) {
    return { typeTokens: [], identifierToken: undefined };
  }

  return {
    typeTokens: tokens.slice(0, lastIdentifierIndex),
    identifierToken: tokens[lastIdentifierIndex],
  };
}

const FUNCTION_MODIFIER_KEYWORDS = new Set(['method', 'static']);

export function isFunctionModifierToken(token: IToken | undefined): boolean {
  if (!token) {
    return false;
  }
  return FUNCTION_MODIFIER_KEYWORDS.has(token.image?.toLowerCase() ?? '');
}

export function isExportKeywordToken(token: IToken | undefined): boolean {
  if (!token) {
    return false;
  }
  return (token.image ?? '').toLowerCase() === 'export';
}

export function isTokenKeyword(token: IToken | undefined, keyword: string): boolean {
  return (token?.image ?? '').toLowerCase() === keyword;
}

export function splitFunctionHeadTokens(tokens: IToken[]): { typeTokens: IToken[]; nameTokens: IToken[] } {
  if (tokens.length === 0) {
    return { typeTokens: [], nameTokens: [] };
  }

  let nameStartIndex = tokens.length;

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (token?.tokenType !== IdentifierToken) {
      continue;
    }

    nameStartIndex = index;
    let lookbehind = index - 1;

    while (lookbehind >= 0) {
      const separator = tokens[lookbehind];
      if (separator?.tokenType !== Dot) {
        break;
      }

      const potentialIdentifier = tokens[lookbehind - 1];
      if (potentialIdentifier?.tokenType !== IdentifierToken) {
        break;
      }

      lookbehind -= 2;
      nameStartIndex = lookbehind + 1;
    }

    break;
  }

  if (nameStartIndex >= tokens.length) {
    return { typeTokens: tokens, nameTokens: [] };
  }

  return {
    typeTokens: tokens.slice(0, nameStartIndex),
    nameTokens: tokens.slice(nameStartIndex),
  };
}
