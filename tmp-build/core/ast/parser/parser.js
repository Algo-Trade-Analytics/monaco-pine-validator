import { EmbeddedActionsParser } from 'chevrotain';
import { AllTokens, LBracket } from './tokens';
import { createAssignmentStartGuard, createCollectDeclarationTokensHelper, createCollectFunctionHeadTokensHelper, createCollectParameterTokensHelper, createFunctionDeclarationStartGuard, createGetLineIndentHelper, createNextSignificantTokenHelper, createParseIfExpressionBranchHelper, createParseIndentedBlockHelper, createTupleAssignmentStartGuard, createVariableDeclarationStartGuard, } from './helpers';
import { createProgramRule, createVersionDirectiveRule } from './rules/program';
import { createStatementRule } from './rules/statements';
import { createAdditiveExpressionRule, createArgumentListRule, createArgumentRule, createBracketExpressionRule, createCallExpressionRule, createArrowFunctionExpressionRule, createCallTypeReferenceRule, createConditionalExpressionRule, createEqualityExpressionRule, createExpressionRule, createForExpressionRule, createIdentifierExpressionRule, createIfExpressionRule, createLogicalAndExpressionRule, createLogicalOrExpressionRule, createMemberExpressionRule, createMultiplicativeExpressionRule, createNullishCoalescingExpressionRule, createPrimaryExpressionRule, createRelationalExpressionRule, createSwitchExpressionRule, createUnaryExpressionRule, createWhileExpressionRule, } from './rules/expressions';
import { createEnumDeclarationRule, createEnumMemberRule, createFunctionDeclarationRule, createImportDeclarationRule, createParameterListRule, createParameterRule, createScriptDeclarationRule, createTypeDeclarationRule, createTypeFieldRule, createVariableDeclarationRule, } from './rules/declarations';
import { createAssignmentStatementRule, createBreakStatementRule, createContinueStatementRule, createExpressionStatementRule, createForIteratorTargetRule, createForStatementRule, createIfStatementRule, createParseForLoop, createParseSwitchStructure, createParseWhileLoop, createRepeatStatementRule, createReturnStatementRule, createSwitchCaseRule, createSwitchStatementRule, createTupleAssignmentStatementRule, createWhileStatementRule, } from './rules/control-flow';
export class PineParser extends EmbeddedActionsParser {
    constructor() {
        super(AllTokens, {
            recoveryEnabled: true,
            maxLookahead: 1,
            skipValidations: true,
        });
        this.lineIndentCache = new Map();
        this.nextSignificantToken = createNextSignificantTokenHelper(this);
        this.getLineIndent = createGetLineIndentHelper(this, this.lineIndentCache);
        this.collectDeclarationTokens = createCollectDeclarationTokensHelper(this);
        this.collectFunctionHeadTokens = createCollectFunctionHeadTokensHelper(this);
        this.collectParameterTokens = createCollectParameterTokensHelper(this);
        this.isFunctionDeclarationStart = createFunctionDeclarationStartGuard(this);
        this.isVariableDeclarationStart = createVariableDeclarationStartGuard(this);
        this.isTupleAssignmentStart = createTupleAssignmentStartGuard(this);
        this.isAssignmentStart = createAssignmentStartGuard(this);
        this.program = createProgramRule(this);
        this.versionDirective = createVersionDirectiveRule(this);
        this.statement = createStatementRule(this);
        this.arrowFunctionExpression = createArrowFunctionExpressionRule(this);
        this.parseIndentedBlock = createParseIndentedBlockHelper(this);
        this.parseIfExpressionBranch = createParseIfExpressionBranchHelper(this);
        this.expressionStatement = createExpressionStatementRule(this);
        this.tupleAssignmentStatement = createTupleAssignmentStatementRule(this);
        this.assignmentStatement = createAssignmentStatementRule(this);
        this.ifStatement = createIfStatementRule(this);
        this.forStatement = createForStatementRule(this);
        this.parseForLoop = createParseForLoop(this);
        this.forIteratorTarget = createForIteratorTargetRule(this);
        this.switchStatement = createSwitchStatementRule(this);
        this.parameter = createParameterRule(this);
        this.parameterList = createParameterListRule(this);
        this.functionDeclaration = createFunctionDeclarationRule(this);
        this.scriptDeclaration = createScriptDeclarationRule(this);
        this.importDeclaration = createImportDeclarationRule(this);
        this.enumMember = createEnumMemberRule(this);
        this.enumDeclaration = createEnumDeclarationRule(this);
        this.typeField = createTypeFieldRule(this);
        this.typeDeclaration = createTypeDeclarationRule(this);
        this.variableDeclaration = createVariableDeclarationRule(this);
        this.switchCase = createSwitchCaseRule(this);
        this.parseSwitchStructure = createParseSwitchStructure(this);
        this.whileStatement = createWhileStatementRule(this);
        this.parseWhileLoop = createParseWhileLoop(this);
        this.repeatStatement = createRepeatStatementRule(this);
        this.returnStatement = createReturnStatementRule(this);
        this.breakStatement = createBreakStatementRule(this);
        this.continueStatement = createContinueStatementRule(this);
        this.assignmentTarget = this.RULE('assignmentTarget', () => {
            if (this.LA(1).tokenType === LBracket) {
                return this.SUBRULE(this.bracketExpression, { ARGS: ['tuple'] });
            }
            return this.SUBRULE(this.memberExpression);
        });
        this.expression = createExpressionRule(this);
        this.conditionalExpression = createConditionalExpressionRule(this);
        this.nullishCoalescingExpression = createNullishCoalescingExpressionRule(this);
        this.logicalOrExpression = createLogicalOrExpressionRule(this);
        this.logicalAndExpression = createLogicalAndExpressionRule(this);
        this.equalityExpression = createEqualityExpressionRule(this);
        this.relationalExpression = createRelationalExpressionRule(this);
        this.additiveExpression = createAdditiveExpressionRule(this);
        this.multiplicativeExpression = createMultiplicativeExpressionRule(this);
        this.unaryExpression = createUnaryExpressionRule(this);
        this.callTypeReference = createCallTypeReferenceRule(this);
        this.callExpression = createCallExpressionRule(this);
        this.memberExpression = createMemberExpressionRule(this);
        this.argumentList = createArgumentListRule(this);
        this.argument = createArgumentRule(this);
        this.bracketExpression = createBracketExpressionRule(this);
        this.primaryExpression = createPrimaryExpressionRule(this);
        this.identifierExpression = createIdentifierExpressionRule(this);
        this.ifExpression = createIfExpressionRule(this);
        this.forExpression = createForExpressionRule(this);
        this.whileExpression = createWhileExpressionRule(this);
        this.switchExpression = createSwitchExpressionRule(this);
        this.performSelfAnalysis();
    }
    reset() {
        super.reset();
        this.lineIndentCache.clear();
    }
    getDslMethod(baseName, occurrence) {
        const methodName = occurrence <= 1 ? baseName : `${baseName}${occurrence}`;
        const bound = this[methodName];
        if (typeof bound !== 'function') {
            throw new Error(`Parser method ${methodName} is not available.`);
        }
        return bound.bind(this);
    }
    lookAhead(offset) {
        return this.LA(offset);
    }
    getInputTokens() {
        return this.input;
    }
    consumeToken(tokenType, occurrence = 1, options) {
        if (!tokenType) {
            // Fallback for cases where helpers pass through a previously consumed token instance.
            // Chevrotain's lexer adapter exposes a consumeToken helper that advances the input.
            // @ts-expect-error – consumeToken exists on the underlying lexer adapter but is not declared in the typings.
            super.consumeToken();
            return this.LA(0);
        }
        const method = this.getDslMethod('CONSUME', occurrence);
        return options === undefined ? method(tokenType) : method(tokenType, options);
    }
    invokeSubrule(rule, occurrence = 1, options) {
        const method = this.getDslMethod('SUBRULE', occurrence);
        const result = options === undefined ? method(rule) : method(rule, options);
        return result;
    }
    optional(callback, occurrence = 1) {
        const method = this.getDslMethod('OPTION', occurrence);
        return method(callback);
    }
    repeatMany(callback, occurrence = 1) {
        const method = this.getDslMethod('MANY', occurrence);
        method(callback);
    }
    choose(alternatives, occurrence = 1) {
        const method = this.getDslMethod('OR', occurrence);
        return method(alternatives);
    }
    createRule(name, implementation) {
        return this.RULE(name, implementation);
    }
    runAction(callback) {
        const method = this.getDslMethod('ACTION', 1);
        method(callback);
    }
    backtrack(production) {
        const method = this.getDslMethod('BACKTRACK', 1);
        return method(production);
    }
}
