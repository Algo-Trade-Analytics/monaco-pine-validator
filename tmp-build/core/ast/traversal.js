export function createPath(node, parent, key, index) {
    return { node, parent, key, index };
}
export function visit(node, visitors, parent = null, key = null, index = null) {
    if (!node) {
        return;
    }
    const path = createPath(node, parent, key, index);
    const kind = node.kind;
    const visitor = visitors[kind];
    let shouldTraverse = true;
    if (visitor?.enter) {
        const result = visitor.enter(path);
        if (result === false || result === 'skip') {
            shouldTraverse = false;
        }
    }
    if (shouldTraverse) {
        visitChildren(path, (child) => {
            visit(child.node, visitors, child.parent, child.key, child.index);
        });
    }
    if (visitor?.exit) {
        visitor.exit(path);
    }
}
export function visitChildren(path, iteratee) {
    for (const child of collectChildren(path)) {
        iteratee(child);
    }
}
export function findAncestor(path, predicate) {
    let current = path?.parent ?? null;
    while (current) {
        if (predicate(current)) {
            return current;
        }
        current = current.parent;
    }
    return null;
}
function collectChildren(path) {
    const { node } = path;
    const children = [];
    const push = (child, key, index = null) => {
        if (child) {
            children.push({ node: child, parent: path, key, index });
        }
    };
    if (node.leadingComments) {
        node.leadingComments.forEach((comment, commentIndex) => {
            push(comment, 'leadingComments', commentIndex);
        });
    }
    if (node.trailingComments) {
        node.trailingComments.forEach((comment, commentIndex) => {
            push(comment, 'trailingComments', commentIndex);
        });
    }
    switch (node.kind) {
        case 'Program': {
            const program = node;
            program.directives.forEach((directive, directiveIndex) => {
                push(directive, 'directives', directiveIndex);
            });
            program.body.forEach((statement, statementIndex) => {
                push(statement, 'body', statementIndex);
            });
            break;
        }
        case 'VersionDirective':
            break;
        case 'ScriptDeclaration': {
            const declaration = node;
            push(declaration.identifier, 'identifier');
            declaration.arguments.forEach((argument, argumentIndex) => {
                push(argument, 'arguments', argumentIndex);
            });
            break;
        }
        case 'ImportDeclaration': {
            const declaration = node;
            push(declaration.path, 'path');
            push(declaration.alias, 'alias');
            break;
        }
        case 'BlockStatement': {
            const block = node;
            block.body.forEach((statement, statementIndex) => {
                push(statement, 'body', statementIndex);
            });
            break;
        }
        case 'ExpressionStatement': {
            const expression = node;
            push(expression.expression, 'expression');
            break;
        }
        case 'ArrowFunctionExpression': {
            const arrow = node;
            arrow.params.forEach((param, paramIndex) => {
                push(param, 'params', paramIndex);
            });
            push(arrow.body, 'body');
            break;
        }
        case 'ReturnStatement': {
            const returnStmt = node;
            push(returnStmt.argument, 'argument');
            break;
        }
        case 'VariableDeclaration': {
            const declaration = node;
            push(declaration.identifier, 'identifier');
            push(declaration.typeAnnotation, 'typeAnnotation');
            push(declaration.initializer, 'initializer');
            break;
        }
        case 'AssignmentStatement': {
            const assignment = node;
            push(assignment.left, 'left');
            push(assignment.right, 'right');
            break;
        }
        case 'TupleExpression': {
            const tuple = node;
            tuple.elements.forEach((element, elementIndex) => {
                push(element, 'elements', elementIndex);
            });
            break;
        }
        case 'ArrayLiteral': {
            const arrayLiteral = node;
            arrayLiteral.elements.forEach((element, elementIndex) => {
                push(element, 'elements', elementIndex);
            });
            break;
        }
        case 'EnumDeclaration': {
            const enumDeclaration = node;
            push(enumDeclaration.identifier, 'identifier');
            enumDeclaration.members.forEach((member, memberIndex) => {
                push(member, 'members', memberIndex);
            });
            break;
        }
        case 'EnumMember': {
            const member = node;
            push(member.identifier, 'identifier');
            push(member.value, 'value');
            break;
        }
        case 'TypeDeclaration': {
            const typeDeclaration = node;
            push(typeDeclaration.identifier, 'identifier');
            typeDeclaration.fields.forEach((field, fieldIndex) => {
                push(field, 'fields', fieldIndex);
            });
            break;
        }
        case 'TypeField': {
            const field = node;
            push(field.identifier, 'identifier');
            push(field.typeAnnotation, 'typeAnnotation');
            break;
        }
        case 'FunctionDeclaration': {
            const fn = node;
            push(fn.identifier, 'identifier');
            fn.params.forEach((param, paramIndex) => {
                push(param, 'params', paramIndex);
            });
            push(fn.body, 'body');
            break;
        }
        case 'IfStatement': {
            const ifStatement = node;
            push(ifStatement.test, 'test');
            push(ifStatement.consequent, 'consequent');
            push(ifStatement.alternate, 'alternate');
            break;
        }
        case 'IfExpression': {
            const ifExpression = node;
            push(ifExpression.test, 'test');
            push(ifExpression.consequent, 'consequent');
            push(ifExpression.alternate, 'alternate');
            break;
        }
        case 'RepeatStatement': {
            const repeatStatement = node;
            push(repeatStatement.body, 'body');
            push(repeatStatement.test, 'test');
            push(repeatStatement.result, 'result');
            break;
        }
        case 'WhileStatement': {
            const whileStatement = node;
            push(whileStatement.test, 'test');
            push(whileStatement.body, 'body');
            push(whileStatement.result, 'result');
            break;
        }
        case 'MemberExpression': {
            const member = node;
            push(member.object, 'object');
            push(member.property, 'property');
            break;
        }
        case 'ForStatement': {
            const forStatement = node;
            push(forStatement.initializer, 'initializer');
            push(forStatement.iterator, 'iterator');
            push(forStatement.iterable, 'iterable');
            push(forStatement.test, 'test');
            push(forStatement.update, 'update');
            push(forStatement.body, 'body');
            push(forStatement.result, 'result');
            break;
        }
        case 'SwitchStatement': {
            const switchStatement = node;
            push(switchStatement.discriminant, 'discriminant');
            switchStatement.cases.forEach((caseNode, caseIndex) => {
                push(caseNode, 'cases', caseIndex);
            });
            break;
        }
        case 'SwitchCase': {
            const switchCase = node;
            push(switchCase.test, 'test');
            switchCase.consequent.forEach((statement, statementIndex) => {
                push(statement, 'consequent', statementIndex);
            });
            break;
        }
        case 'BreakStatement':
        case 'ContinueStatement':
            break;
        case 'Parameter': {
            const param = node;
            push(param.identifier, 'identifier');
            push(param.typeAnnotation, 'typeAnnotation');
            push(param.defaultValue, 'defaultValue');
            break;
        }
        case 'CallExpression': {
            const call = node;
            push(call.callee, 'callee');
            call.args.forEach((argument, argIndex) => {
                push(argument, 'args', argIndex);
            });
            break;
        }
        case 'Argument': {
            const argument = node;
            push(argument.name, 'name');
            push(argument.value, 'value');
            break;
        }
        case 'BinaryExpression': {
            const binary = node;
            push(binary.left, 'left');
            push(binary.right, 'right');
            break;
        }
        case 'UnaryExpression': {
            const unary = node;
            push(unary.argument, 'argument');
            break;
        }
        case 'ConditionalExpression': {
            const conditional = node;
            push(conditional.test, 'test');
            push(conditional.consequent, 'consequent');
            push(conditional.alternate, 'alternate');
            break;
        }
        case 'IndexExpression': {
            const indexExpression = node;
            push(indexExpression.object, 'object');
            push(indexExpression.index, 'index');
            break;
        }
        case 'MatrixLiteral': {
            const matrix = node;
            matrix.rows.forEach((row, rowIndex) => {
                row.forEach((element, columnIndex) => {
                    push(element, `rows.${rowIndex}`, columnIndex);
                });
            });
            break;
        }
        case 'Identifier':
        case 'NumberLiteral':
        case 'StringLiteral':
        case 'BooleanLiteral':
        case 'NullLiteral':
        case 'ColorLiteral':
            break;
        case 'TypeReference': {
            const typeReference = node;
            push(typeReference.name, 'name');
            typeReference.generics.forEach((genericNode, genericIndex) => {
                push(genericNode, 'generics', genericIndex);
            });
            break;
        }
        case 'Comment':
        case 'CompilerAnnotation':
            break;
        default: {
            const exhaustiveCheck = node;
            void exhaustiveCheck;
            throw new Error('Unhandled node kind in traversal');
        }
    }
    return children;
}
