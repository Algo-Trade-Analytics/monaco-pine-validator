import { EOF, type IToken } from 'chevrotain';
import type {
  AssignmentStatementNode,
  BlockStatementNode,
  ExpressionNode,
  IdentifierNode,
  IfStatementNode,
  StatementNode,
  SwitchCaseNode,
  SwitchStatementNode,
  VariableDeclarationNode,
} from '../../nodes';
import {
  cloneIdentifierNode,
  createAssignmentStatementNode,
  createBinaryExpressionNode,
  createBreakStatementNode,
  createContinueStatementNode,
  createExpressionStatementNode,
  createBlockStatementNode,
  createForStatementNode,
  createIdentifierNode,
  createIfStatementNode,
  createNumberNode,
  createPlaceholderExpression,
  createRepeatStatementNode,
  createReturnStatementNode,
  createSwitchCaseNode,
  createSwitchStatementNode,
  createSyntheticToken,
  createTupleExpressionNode,
  createWhileStatementNode,
  tokenIndent,
} from '../node-builders';
import { attachLoopResultBinding } from '../helpers';
import type { PineParser } from '../parser';
import {
  Break,
  By,
  ColonEqual,
  Comma,
  Continue,
  Else,
  Equal,
  FatArrow,
  For,
  Identifier as IdentifierToken,
  If,
  In,
  LBracket,
  LessEqual,
  MinusEqual,
  Newline,
  NumberLiteral as NumberToken,
  PercentEqual,
  Plus,
  PlusEqual,
  Repeat,
  Return,
  RBracket,
  SlashEqual,
  StarEqual,
  To,
  Until,
  While,
} from '../tokens';

function extractLoopResult(block: BlockStatementNode): ExpressionNode | null {
  if (block.body.length === 0) {
    return null;
  }

  const lastStatement = block.body[block.body.length - 1];
  if (lastStatement.kind === 'ExpressionStatement') {
    return lastStatement.expression;
  }
  if (lastStatement.kind === 'ReturnStatement') {
    return lastStatement.argument;
  }

  return null;
}

function isStatementTerminator(tokenType: unknown): boolean {
  return tokenType === Newline || tokenType === EOF || tokenType === Else;
}

function isForInLoopHeader(parser: PineParser): boolean {
  let offset = 1;
  let bracketDepth = 0;

  while (true) {
    const token = parser.lookAhead(offset);
    const tokenType = token.tokenType;

    if (tokenType === EOF || tokenType === Newline) {
      return false;
    }

    if (tokenType === In && bracketDepth === 0) {
      return true;
    }

    if (
      tokenType === Equal ||
      tokenType === ColonEqual ||
      tokenType === PlusEqual ||
      tokenType === MinusEqual ||
      tokenType === StarEqual ||
      tokenType === SlashEqual ||
      tokenType === PercentEqual ||
      tokenType === To ||
      tokenType === By ||
      tokenType === FatArrow
    ) {
      return false;
    }

    if (tokenType === LBracket) {
      bracketDepth += 1;
    } else if (tokenType === RBracket && bracketDepth > 0) {
      bracketDepth -= 1;
    }

    offset += 1;
  }
}

function parseSwitchCaseConsequent(
  parser: PineParser,
  caseIndent: number,
): { statements: StatementNode[]; endToken: IToken | undefined } {
  const statements: StatementNode[] = [];

  const nextTokenType = parser.lookAhead(1).tokenType;

  if (nextTokenType === Newline) {
    const block = parser.parseIndentedBlock(caseIndent);
    statements.push(...block.body);
    return { statements, endToken: parser.lookAhead(0) };
  }

  if (isStatementTerminator(nextTokenType)) {
    return { statements, endToken: parser.lookAhead(0) };
  }

  const expression = parser.invokeSubrule(parser.expression);
  statements.push(createExpressionStatementNode(expression));
  return { statements, endToken: parser.lookAhead(0) };
}

export function createExpressionStatementRule(parser: PineParser) {
  return parser.createRule('expressionStatement', () => {
    const expression = parser.invokeSubrule(parser.expression);
    
    // Support comma operator for sequence expressions (e.g., "a := 1, b := 2")
    // Pine Script allows comma-separated expressions in statement position
    if (parser.lookAhead(1).tokenType === Comma) {
      const expressions: ExpressionNode[] = [expression];
      while (parser.lookAhead(1).tokenType === Comma) {
        parser.consumeToken(Comma);
        // Allow newlines after comma
        while (parser.lookAhead(1).tokenType === Newline) {
          parser.consumeToken(Newline);
        }
        expressions.push(parser.invokeSubrule(parser.expression, expressions.length + 1));
      }
      // Wrap multiple expressions in a tuple expression to represent the sequence
      const startToken = (expression as any).startToken || parser.lookAhead(0);
      const endToken = (expressions[expressions.length - 1] as any).endToken || parser.lookAhead(0);
      const tuple = createTupleExpressionNode(expressions, startToken, endToken);
      return createExpressionStatementNode(tuple);
    }
    
    return createExpressionStatementNode(expression);
  });
}

export function createTupleAssignmentStatementRule(parser: PineParser) {
  return parser.createRule('tupleAssignmentStatement', () => {
    const left = parser.invokeSubrule(parser.bracketExpression, 1, { ARGS: ['tuple'] });
    const operator = parser.choose<IToken>([
      { ALT: () => parser.consumeToken(Equal) },
      { ALT: () => parser.consumeToken(ColonEqual) },
      { ALT: () => parser.consumeToken(PlusEqual) },
      { ALT: () => parser.consumeToken(MinusEqual) },
      { ALT: () => parser.consumeToken(StarEqual) },
      { ALT: () => parser.consumeToken(SlashEqual) },
      { ALT: () => parser.consumeToken(PercentEqual) },
    ]);
    const right = parser.invokeSubrule(parser.expression);
    const endToken = parser.lookAhead(0);
    const assignment = createAssignmentStatementNode(left, right as ExpressionNode | undefined, operator, endToken);
    const operatorImage = operator.image;
    if ((operatorImage === '=' || operatorImage === ':=') && right) {
      attachLoopResultBinding(right, {
        kind: 'tupleAssignment',
        target: assignment.left,
        operator: operatorImage,
      });
    }
    return assignment;
  });
}

export function createAssignmentStatementRule(parser: PineParser) {
  return parser.createRule('assignmentStatement', () => {
    const left = parser.invokeSubrule(parser.assignmentTarget);
    const operator = parser.choose<IToken>([
      { ALT: () => parser.consumeToken(Equal) },
      { ALT: () => parser.consumeToken(ColonEqual) },
      { ALT: () => parser.consumeToken(PlusEqual) },
      { ALT: () => parser.consumeToken(MinusEqual) },
      { ALT: () => parser.consumeToken(StarEqual) },
      { ALT: () => parser.consumeToken(SlashEqual) },
      { ALT: () => parser.consumeToken(PercentEqual) },
    ]);
    const right = parser.invokeSubrule(parser.expression);
    const endToken = parser.lookAhead(0);
    const assignment = createAssignmentStatementNode(left, right as ExpressionNode | undefined, operator, endToken);
    const operatorImage = operator.image;
    if ((operatorImage === '=' || operatorImage === ':=') && right) {
      attachLoopResultBinding(right, {
        kind: 'assignment',
        target: assignment.left,
        operator: operatorImage,
      });
    }
    return assignment;
  });
}

export function createIfStatementRule(parser: PineParser): () => IfStatementNode {
  return parser.createRule('ifStatement', (...args: unknown[]) => {
    const indentOverride = args[0] as number | undefined;
    const ifToken = parser.consumeToken(If);
    const test = parser.invokeSubrule(parser.expression);
    const indent = indentOverride ?? tokenIndent(ifToken);
    const consequent = parser.parseIndentedBlock(indent);

    let alternate: StatementNode | null = null;

    let offset = 1;
    while (parser.lookAhead(offset).tokenType === Newline) {
      offset += 1;
    }
    const potentialElse = parser.lookAhead(offset);
    if (potentialElse.tokenType === Else && tokenIndent(potentialElse) <= indent) {
      while (parser.lookAhead(1).tokenType === Newline) {
        parser.consumeToken(Newline);
      }
      const elseToken = parser.consumeToken(Else);
      if (parser.lookAhead(1).tokenType === If) {
        alternate = parser.invokeSubrule(parser.ifStatement, 2, { ARGS: [tokenIndent(elseToken)] });
      } else if (parser.lookAhead(1).tokenType === Newline) {
        alternate = parser.parseIndentedBlock(tokenIndent(elseToken));
      } else {
        const alternateStatement = parser.invokeSubrule(parser.statement, 2);
        alternate = alternateStatement;
      }
    }

    const endToken = parser.lookAhead(0);
    return createIfStatementNode(test, consequent, alternate, ifToken, endToken);
  });
}

export function createForStatementRule(parser: PineParser) {
  return parser.createRule('forStatement', () => {
    const forToken = parser.consumeToken(For);
    return parser.parseForLoop(forToken);
  });
}

export function createParseForLoop(parser: PineParser) {
  return (forToken: IToken) => {
    let initializer: VariableDeclarationNode | AssignmentStatementNode | null = null;
    let iterator: ExpressionNode | null = null;
    let iterable: ExpressionNode | null = null;

    if (isForInLoopHeader(parser)) {
      iterator = parser.invokeSubrule(parser.forIteratorTarget);
      parser.consumeToken(In);
      iterable = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
    } else {
      if (parser.isVariableDeclarationStart()) {
        const varDecl = parser.invokeSubrule(parser.variableDeclaration);
        // Handle multi-variable declarations (BlockStatementNode containing multiple VariableDeclarationNodes)
        initializer = varDecl.kind === 'BlockStatement' 
          ? (varDecl as BlockStatementNode).body[0] as VariableDeclarationNode
          : varDecl as VariableDeclarationNode;
      } else if (parser.isAssignmentStart()) {
        initializer = parser.invokeSubrule(parser.assignmentStatement);
      }
    }

    const loopIdentifier: IdentifierNode | null = initializer
      ? initializer.kind === 'VariableDeclaration'
        ? initializer.identifier
        : initializer.kind === 'AssignmentStatement' && initializer.left.kind === 'Identifier'
          ? (initializer.left as IdentifierNode)
          : null
      : null;

    let test: ExpressionNode | null = null;
    let update: ExpressionNode | null = null;

    if (!iterable && parser.lookAhead(1).tokenType === To) {
      const toToken = parser.consumeToken(To);
      const endExpression = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
      const endToken = parser.lookAhead(0);

      const testIdentifier = cloneIdentifierNode(loopIdentifier);
      if (testIdentifier) {
        const operatorToken = createSyntheticToken('<=', LessEqual, toToken);
        test = createBinaryExpressionNode(testIdentifier, operatorToken, endExpression, endToken);
      } else {
        test = endExpression;
      }

      if (parser.lookAhead(1).tokenType === By) {
        const byToken = parser.consumeToken(By);
        const stepExpression = parser.invokeSubrule(parser.expression, 2) ?? createPlaceholderExpression();
        const updateEndToken = parser.lookAhead(0);
        const updateIdentifier = cloneIdentifierNode(loopIdentifier);
        if (updateIdentifier) {
          const operatorToken = createSyntheticToken('+', Plus, byToken);
          update = createBinaryExpressionNode(updateIdentifier, operatorToken, stepExpression, updateEndToken);
        } else {
          update = stepExpression;
        }
      } else {
        const updateIdentifier = cloneIdentifierNode(loopIdentifier);
        if (updateIdentifier) {
          const defaultStepToken = createSyntheticToken('1', NumberToken, toToken);
          const defaultStep = createNumberNode(defaultStepToken);
          const operatorToken = createSyntheticToken('+', Plus, toToken);
          update = createBinaryExpressionNode(updateIdentifier, operatorToken, defaultStep, defaultStepToken);
        }
      }
    }

    const body = parser.parseIndentedBlock(tokenIndent(forToken));
    const result = extractLoopResult(body);
    const endToken = parser.lookAhead(0);
    return createForStatementNode(
      initializer,
      iterator,
      iterable,
      test,
      update,
      body,
      result,
      forToken,
      endToken,
    );
  };
}

export function createForIteratorTargetRule(parser: PineParser) {
  return parser.createRule('forIteratorTarget', (): ExpressionNode => {
    const next = parser.lookAhead(1);
    if (next.tokenType === LBracket) {
      const tuple = parser.invokeSubrule(parser.bracketExpression, 1, { ARGS: ['tuple'] });
      return (tuple as ExpressionNode) ?? createPlaceholderExpression();
    }

    const identifierToken = parser.consumeToken(IdentifierToken);
    return createIdentifierNode(identifierToken);
  });
}

export function createSwitchStatementRule(parser: PineParser) {
  return parser.createRule('switchStatement', () => parser.invokeSubrule(parser.switchExpression));
}

export function createSwitchCaseRule(parser: PineParser) {
  return parser.createRule('switchCase', () => {
    const startToken = parser.lookAhead(1);
    let test: ExpressionNode | null = null;

    if (startToken.tokenType === FatArrow) {
      const arrowToken = parser.consumeToken(FatArrow);
      const { statements, endToken } = parseSwitchCaseConsequent(parser, tokenIndent(startToken));
      return createSwitchCaseNode(test, statements, startToken, arrowToken, endToken);
    }

    test = parser.invokeSubrule(parser.expression);
    const arrowToken = parser.consumeToken(FatArrow);
    const { statements, endToken } = parseSwitchCaseConsequent(parser, tokenIndent(startToken));
    return createSwitchCaseNode(test, statements, startToken, arrowToken, endToken);
  });
}

export function createParseSwitchStructure(parser: PineParser) {
  return (switchToken: IToken): SwitchStatementNode => {
    const discriminant = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
    let indent = tokenIndent(switchToken);
    const cases: SwitchCaseNode[] = [];

    let lastToken: IToken | undefined;

    if (parser.lookAhead(1).tokenType === Newline) {
      lastToken = parser.consumeToken(Newline);
    }

    let lookaheadOffset = 1;
    let lookahead = parser.lookAhead(lookaheadOffset);
    while (lookahead.tokenType === Newline) {
      lookaheadOffset += 1;
      lookahead = parser.lookAhead(lookaheadOffset);
    }
    if (lookahead.tokenType !== EOF) {
      const lookaheadIndent = tokenIndent(lookahead);
      if (lookaheadIndent <= indent) {
        indent = Math.max(0, lookaheadIndent - 1);
      }
    }

    let shouldBreak = false;
    while (!shouldBreak) {
      let next = parser.lookAhead(1);

      while (next.tokenType === Newline) {
        let innerOffset = 2;
        let innerLookahead = parser.lookAhead(innerOffset);
        while (innerLookahead.tokenType === Newline) {
          innerOffset += 1;
          innerLookahead = parser.lookAhead(innerOffset);
        }

        if (innerLookahead.tokenType === EOF) {
          const newlineToken = parser.consumeToken(Newline);
          lastToken = newlineToken;
          next = parser.lookAhead(1);
          continue;
        }

        if (tokenIndent(innerLookahead) <= indent) {
          shouldBreak = true;
          break;
        }

        const newlineToken = parser.consumeToken(Newline);
        lastToken = newlineToken;
        next = parser.lookAhead(1);
      }

      if (shouldBreak) {
        break;
      }

      next = parser.lookAhead(1);
      if (next.tokenType === EOF || tokenIndent(next) <= indent) {
        break;
      }

      const caseNode = parser.invokeSubrule(parser.switchCase);
      cases.push(caseNode);
      lastToken = parser.lookAhead(0);
    }

    const endToken = parser.lookAhead(0) ?? lastToken ?? switchToken;
    return createSwitchStatementNode(discriminant, cases, switchToken, endToken);
  };
}

export function createWhileStatementRule(parser: PineParser) {
  return parser.createRule('whileStatement', () => {
    const whileToken = parser.consumeToken(While);
    return parser.parseWhileLoop(whileToken);
  });
}

export function createParseWhileLoop(parser: PineParser) {
  return (whileToken: IToken) => {
    const test = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
    const body = parser.parseIndentedBlock(tokenIndent(whileToken));
    const result = extractLoopResult(body);
    const endToken = parser.lookAhead(0);
    return createWhileStatementNode(test, body, result, whileToken, endToken);
  };
}

export function createRepeatStatementRule(parser: PineParser) {
  return parser.createRule('repeatStatement', () => {
    const repeatToken = parser.consumeToken(Repeat);
    const body = parser.parseIndentedBlock(tokenIndent(repeatToken));
    const result = extractLoopResult(body);
    parser.repeatMany(() => parser.consumeToken(Newline));
    const untilToken = parser.consumeToken(Until);
    const test = parser.invokeSubrule(parser.expression) ?? createPlaceholderExpression();
    const endToken = parser.lookAhead(0);
    return createRepeatStatementNode(body, test, result, repeatToken, endToken ?? untilToken);
  });
}

export function createReturnStatementRule(parser: PineParser) {
  return parser.createRule('returnStatement', () => {
    const returnToken = parser.consumeToken(Return);
    let argument: ExpressionNode | null = null;
    const nextTokenType = parser.lookAhead(1).tokenType;
    if (!isStatementTerminator(nextTokenType)) {
      argument = parser.invokeSubrule(parser.expression) ?? null;
    }
    const endToken = argument ? parser.lookAhead(0) : returnToken;
    return createReturnStatementNode(returnToken, argument, endToken);
  });
}

export function createBreakStatementRule(parser: PineParser) {
  return parser.createRule('breakStatement', () => {
    const token = parser.consumeToken(Break);
    return createBreakStatementNode(token);
  });
}

export function createContinueStatementRule(parser: PineParser) {
  return parser.createRule('continueStatement', () => {
    const token = parser.consumeToken(Continue);
    return createContinueStatementNode(token);
  });
}
