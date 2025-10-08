import { EmbeddedActionsParser, type IToken, type TokenType } from 'chevrotain';
import { AllTokens, LBracket } from './tokens';
import type {
  ExpressionNode,
  IfExpressionNode,
  IfStatementNode,
  ParserRecoveryError,
  VirtualToken,
} from '../nodes';

import {
  createAssignmentStartGuard,
  createCollectDeclarationTokensHelper,
  createCollectFunctionHeadTokensHelper,
  createCollectParameterTokensHelper,
  createFunctionDeclarationStartGuard,
  createGetLineIndentHelper,
  createNextSignificantTokenHelper,
  createParseIfExpressionBranchHelper,
  createParseIndentedBlockHelper,
  createTupleAssignmentStartGuard,
  createVariableDeclarationStartGuard,
} from './helpers';
import { createProgramRule, createVersionDirectiveRule } from './rules/program';
import { createStatementRule } from './rules/statements';
import {
  createAdditiveExpressionRule,
  createArgumentListRule,
  createArgumentRule,
  createBracketExpressionRule,
  createCallExpressionRule,
  createArrowFunctionExpressionRule,
  createCallTypeReferenceRule,
  createConditionalExpressionRule,
  createEqualityExpressionRule,
  createExpressionRule,
  createForExpressionRule,
  createIdentifierExpressionRule,
  createIfExpressionRule,
  createLogicalAndExpressionRule,
  createLogicalOrExpressionRule,
  createMemberExpressionRule,
  createMultiplicativeExpressionRule,
  createNullishCoalescingExpressionRule,
  createPrimaryExpressionRule,
  createRelationalExpressionRule,
  createSwitchExpressionRule,
  createUnaryExpressionRule,
  createWhileExpressionRule,
} from './rules/expressions';
import {
  createEnumDeclarationRule,
  createEnumMemberRule,
  createFunctionDeclarationRule,
  createImportDeclarationRule,
  createParameterListRule,
  createParameterRule,
  createScriptDeclarationRule,
  createTypeDeclarationRule,
  createTypeFieldRule,
  createVariableDeclarationRule,
} from './rules/declarations';
import {
  createAssignmentStatementRule,
  createBreakStatementRule,
  createContinueStatementRule,
  createExpressionStatementRule,
  createForIteratorTargetRule,
  createForStatementRule,
  createIfStatementRule,
  createParseForLoop,
  createParseSwitchStructure,
  createParseWhileLoop,
  createRepeatStatementRule,
  createReturnStatementRule,
  createSwitchCaseRule,
  createSwitchStatementRule,
  createTupleAssignmentStatementRule,
  createWhileStatementRule,
} from './rules/control-flow';

type ConsumeMethod = (tokenType: any, options?: unknown) => IToken;
type SubruleMethod = (...args: any[]) => any;
type DslMethod = (...args: any[]) => any;
type RuleMethod<T> = (...args: any[]) => T;
type OrAlternative<T> = { ALT: () => T } & Record<string, unknown>;
type ActionMethod = (callback: () => void) => void;
type BacktrackMethod = <T>(production: () => T) => () => T;

type RecoveryError = {
  token: IToken;
  message: string;
  code?: string;
  suggestion?: string;
};

type ArgumentListRecovery = {
  virtualSeparators: VirtualToken[];
  virtualArguments?: VirtualToken[];
  virtualArgumentDetails?: {
    token: VirtualToken;
    position: 'first' | 'middle' | 'trailing';
  }[];
  virtualClosing?: VirtualToken | null;
  errors: ParserRecoveryError[];
};

export class PineParser extends EmbeddedActionsParser {
  private lineIndentCache = new Map<number, number>();

  public nextSignificantToken = createNextSignificantTokenHelper(this);

  public getLineIndent = createGetLineIndentHelper(this, this.lineIndentCache);

  public collectDeclarationTokens = createCollectDeclarationTokensHelper(this);

  public collectFunctionHeadTokens = createCollectFunctionHeadTokensHelper(this);

  public collectParameterTokens = createCollectParameterTokensHelper(this);

  public isFunctionDeclarationStart = createFunctionDeclarationStartGuard(this);

  public isVariableDeclarationStart = createVariableDeclarationStartGuard(this);

  public isTupleAssignmentStart = createTupleAssignmentStartGuard(this);

  public isAssignmentStart = createAssignmentStartGuard(this);

  public recoveryErrors: RecoveryError[] = [];
  private argumentListRecovery: ArgumentListRecovery | null = null;

  constructor() {
    super(AllTokens, {
      recoveryEnabled: true,
      maxLookahead: 1,
      skipValidations: true,
    });
    const baseTokenMatcher = (this as any).tokenMatcher;
    (this as any).tokenMatcher = ((token: any, tokType: any) => {
      if (!tokType) {
        return false;
      }
      return baseTokenMatcher.call(this, token, tokType);
    });
    this.performSelfAnalysis();
    this.removeInvalidRecoveryTokens();
  }

  public override reset(): void {
    super.reset();
    this.lineIndentCache.clear();
    this.recoveryErrors.length = 0;
    this.argumentListRecovery = null;
  }

  public program = createProgramRule(this);

  public versionDirective = createVersionDirectiveRule(this);

  public statement = createStatementRule(this);

  public arrowFunctionExpression = createArrowFunctionExpressionRule(this);

  public parseIndentedBlock = createParseIndentedBlockHelper(this);

  public parseIfExpressionBranch = createParseIfExpressionBranchHelper(this);

  public expressionStatement = createExpressionStatementRule(this);

  public tupleAssignmentStatement = createTupleAssignmentStatementRule(this);

  public assignmentStatement = createAssignmentStatementRule(this);

  public ifStatement: RuleMethod<IfStatementNode> = createIfStatementRule(this);

  public forStatement = createForStatementRule(this);

  public parseForLoop = createParseForLoop(this);

  public forIteratorTarget = createForIteratorTargetRule(this);

  public switchStatement = createSwitchStatementRule(this);

  public parameter = createParameterRule(this);

  public parameterList = createParameterListRule(this);

  public functionDeclaration = createFunctionDeclarationRule(this);

  public scriptDeclaration = createScriptDeclarationRule(this);

  public importDeclaration = createImportDeclarationRule(this);

  public enumMember = createEnumMemberRule(this);

  public enumDeclaration = createEnumDeclarationRule(this);

  public typeField = createTypeFieldRule(this);

  public typeDeclaration = createTypeDeclarationRule(this);

  public variableDeclaration = createVariableDeclarationRule(this);

  public switchCase = createSwitchCaseRule(this);

  public parseSwitchStructure = createParseSwitchStructure(this);

  public whileStatement = createWhileStatementRule(this);

  public parseWhileLoop = createParseWhileLoop(this);

  public repeatStatement = createRepeatStatementRule(this);

  public returnStatement = createReturnStatementRule(this);

  public breakStatement = createBreakStatementRule(this);

  public continueStatement = createContinueStatementRule(this);

  public assignmentTarget = this.RULE('assignmentTarget', () => {
    if (this.LA(1).tokenType === LBracket) {
      return this.SUBRULE(this.bracketExpression, { ARGS: ['tuple'] });
    }
    return this.SUBRULE(this.memberExpression);
  });

  public expression: RuleMethod<ExpressionNode> = createExpressionRule(this);

  public conditionalExpression: RuleMethod<ExpressionNode> = createConditionalExpressionRule(this);

  public nullishCoalescingExpression = createNullishCoalescingExpressionRule(this);

  public logicalOrExpression = createLogicalOrExpressionRule(this);

  public logicalAndExpression = createLogicalAndExpressionRule(this);

  public equalityExpression = createEqualityExpressionRule(this);

  public relationalExpression = createRelationalExpressionRule(this);

  public additiveExpression = createAdditiveExpressionRule(this);

  public multiplicativeExpression = createMultiplicativeExpressionRule(this);

  public unaryExpression: RuleMethod<ExpressionNode> = createUnaryExpressionRule(this);

  public callTypeReference = createCallTypeReferenceRule(this);

  public callExpression = createCallExpressionRule(this);

  public memberExpression = createMemberExpressionRule(this);

  public argumentList = createArgumentListRule(this);

  public argument = createArgumentRule(this);

  public bracketExpression = createBracketExpressionRule(this);

  public primaryExpression = createPrimaryExpressionRule(this);

  public identifierExpression = createIdentifierExpressionRule(this);

  public ifExpression: RuleMethod<IfExpressionNode> = createIfExpressionRule(this);

  public forExpression = createForExpressionRule(this);

  public whileExpression = createWhileExpressionRule(this);

  public switchExpression = createSwitchExpressionRule(this);

  private getDslMethod<T extends (...args: any[]) => any>(baseName: string, occurrence: number): T {
    const methodName = occurrence <= 1 ? baseName : `${baseName}${occurrence}`;
    const bound = (this as Record<string, unknown>)[methodName];
    if (typeof bound !== 'function') {
      throw new Error(`Parser method ${methodName} is not available.`);
    }
    return bound.bind(this) as T;
  }

  public lookAhead(offset: number): IToken {
    return this.LA(offset);
  }

  public getInputTokens(): IToken[] {
    return this.input;
  }

  public consumeToken(tokenType: any, occurrence = 1, options?: unknown): IToken {
    if (!tokenType) {
      // Fallback for cases where helpers pass through a previously consumed token instance.
      // Chevrotain's lexer adapter exposes a consumeToken helper that advances the input.
      // @ts-expect-error – consumeToken exists on the underlying lexer adapter but is not declared in the typings.
      super.consumeToken();
      return this.LA(0);
    }
    const method = this.getDslMethod<ConsumeMethod>('CONSUME', occurrence);
    return options === undefined ? method(tokenType) : method(tokenType, options);
  }

  public invokeSubrule<R extends (...args: any[]) => any>(
    rule: R,
    occurrence = 1,
    options?: unknown,
  ): ReturnType<R> {
    const method = this.getDslMethod<SubruleMethod>('SUBRULE', occurrence);
    const result = options === undefined ? method(rule) : method(rule, options);
    return result as ReturnType<R>;
  }

  public optional<T>(callback: () => T, occurrence = 1): T | undefined {
    const method = this.getDslMethod<DslMethod>('OPTION', occurrence);
    return method(callback) as T | undefined;
  }

  public repeatMany(callback: () => void, occurrence = 1): void {
    const method = this.getDslMethod<DslMethod>('MANY', occurrence);
    method(callback);
  }

  public choose<T>(alternatives: OrAlternative<T>[], occurrence = 1): T {
    const method = this.getDslMethod<DslMethod>('OR', occurrence);
    return method(alternatives) as T;
  }

  public createRule<R extends RuleMethod<any>>(name: string, implementation: R): R {
    return this.RULE(name, implementation) as R;
  }

  public runAction(callback: () => void): void {
    const method = this.getDslMethod<ActionMethod>('ACTION', 1);
    method(callback);
  }

  public backtrack<T>(production: () => T): () => T {
    const method = this.getDslMethod<BacktrackMethod>('BACKTRACK', 1);
    return method(production);
  }

  public reportRecoveryError(
    token: IToken,
    message: string,
    extras: Partial<Omit<RecoveryError, 'token' | 'message'>> = {},
  ): void {
    this.recoveryErrors.push({
      token,
      message,
      ...extras,
    });
  }

  public setArgumentListRecovery(recovery: ArgumentListRecovery | null): void {
    this.argumentListRecovery = recovery;
  }

  public consumeArgumentListRecovery(): ArgumentListRecovery | null {
    const recovery = this.argumentListRecovery;
    this.argumentListRecovery = null;
    return recovery;
  }

  private removeInvalidRecoveryTokens(): void {
    const parserInternals = this as unknown as {
      resyncFollows?: Record<string, (TokenType | undefined)[]>;
    };

    const { resyncFollows } = parserInternals;
    if (!resyncFollows) {
      return;
    }

    for (const followKey of Object.keys(resyncFollows)) {
      const followSet = resyncFollows[followKey];
      if (!Array.isArray(followSet)) {
        continue;
      }

      resyncFollows[followKey] = followSet.filter(
        (tokenType): tokenType is TokenType => tokenType !== undefined,
      );
    }
  }
}
