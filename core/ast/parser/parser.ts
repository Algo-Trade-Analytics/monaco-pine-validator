import { EmbeddedActionsParser } from 'chevrotain';
import { AllTokens, LBracket } from './tokens';

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

  constructor() {
    super(AllTokens, {
      recoveryEnabled: true,
      maxLookahead: 1,
      skipValidations: true,
    });
    this.performSelfAnalysis();
  }

  public override reset(): void {
    super.reset();
    this.lineIndentCache.clear();
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

  public ifStatement = createIfStatementRule(this);

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

  public expression = createExpressionRule(this);

  public conditionalExpression = createConditionalExpressionRule(this);

  public nullishCoalescingExpression = createNullishCoalescingExpressionRule(this);

  public logicalOrExpression = createLogicalOrExpressionRule(this);

  public logicalAndExpression = createLogicalAndExpressionRule(this);

  public equalityExpression = createEqualityExpressionRule(this);

  public relationalExpression = createRelationalExpressionRule(this);

  public additiveExpression = createAdditiveExpressionRule(this);

  public multiplicativeExpression = createMultiplicativeExpressionRule(this);

  public unaryExpression = createUnaryExpressionRule(this);

  public callTypeReference = createCallTypeReferenceRule(this);

  public callExpression = createCallExpressionRule(this);

  public memberExpression = createMemberExpressionRule(this);

  public argumentList = createArgumentListRule(this);

  public argument = createArgumentRule(this);

  public bracketExpression = createBracketExpressionRule(this);

  public primaryExpression = createPrimaryExpressionRule(this);

  public identifierExpression = createIdentifierExpressionRule(this);

  public ifExpression = createIfExpressionRule(this);

  public forExpression = createForExpressionRule(this);

  public whileExpression = createWhileExpressionRule(this);

  public switchExpression = createSwitchExpressionRule(this);
}
