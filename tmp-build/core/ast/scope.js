import { createEmptyScopeGraph, createEmptySymbolTable, createSymbolLocation, createSymbolRecord, } from './types';
export function buildScopeGraph(program) {
    const scopeGraph = createEmptyScopeGraph();
    const symbolTable = createEmptySymbolTable();
    if (!program) {
        return { scopeGraph, symbolTable };
    }
    let scopeCounter = 0;
    const scopeStack = [];
    const pushScope = (kind, source, metadata) => {
        const id = `scope-${scopeCounter++}`;
        const parentFrame = scopeStack[scopeStack.length - 1] ?? null;
        const node = {
            id,
            kind,
            parent: parentFrame?.node.id ?? null,
            children: new Set(),
            symbols: new Set(),
            metadata: {
                nodeKind: source.kind,
                range: source.range,
                ...(metadata ?? {}),
            },
        };
        scopeGraph.nodes.set(id, node);
        if (parentFrame) {
            parentFrame.node.children.add(id);
        }
        else {
            scopeGraph.root = id;
        }
        scopeStack.push({ node });
        return node;
    };
    const popScope = () => {
        scopeStack.pop();
    };
    const currentScope = () => {
        const frame = scopeStack[scopeStack.length - 1];
        return frame?.node ?? null;
    };
    const upsertSymbolRecord = (name, kind, locationNode) => {
        const existing = symbolTable.get(name);
        const location = createSymbolLocation(locationNode, locationNode.loc.start.line, locationNode.loc.start.column);
        if (!existing) {
            const record = createSymbolRecord(name, kind, location);
            const scopeId = currentScope()?.id;
            if (scopeId) {
                record.metadata = {
                    declarationScopes: [scopeId],
                    declarationKinds: [kind],
                };
            }
            symbolTable.set(name, record);
            return record;
        }
        if (existing.kind === 'unknown') {
            existing.kind = kind;
        }
        existing.declarations.push(location);
        const scopeId = currentScope()?.id;
        if (scopeId) {
            if (existing.metadata) {
                const scopes = existing.metadata.declarationScopes ?? [];
                scopes.push(scopeId);
                existing.metadata.declarationScopes = scopes;
                const kinds = existing.metadata.declarationKinds ?? [];
                kinds.push(kind);
                existing.metadata.declarationKinds = kinds;
            }
            else {
                existing.metadata = {
                    declarationScopes: [scopeId],
                    declarationKinds: [kind],
                };
            }
        }
        return existing;
    };
    const declare = (identifier, kind) => {
        if (!identifier) {
            return;
        }
        const scope = currentScope();
        if (!scope) {
            return;
        }
        scope.symbols.add(identifier.name);
        upsertSymbolRecord(identifier.name, kind, identifier);
    };
    const recordReference = (identifier) => {
        if (!identifier) {
            return;
        }
        const location = createSymbolLocation(identifier, identifier.loc.start.line, identifier.loc.start.column);
        const existing = symbolTable.get(identifier.name);
        if (existing) {
            existing.references.push(location);
            return;
        }
        const record = createSymbolRecord(identifier.name, 'unknown');
        record.references.push(location);
        symbolTable.set(identifier.name, record);
    };
    const declareForIterator = (target) => {
        if (!target) {
            return;
        }
        if (target.kind === 'Identifier') {
            declare(target, 'variable');
            return;
        }
        if (target.kind === 'TupleExpression') {
            const tuple = target;
            tuple.elements.forEach((element) => {
                if (element && element.kind === 'Identifier') {
                    declare(element, 'variable');
                }
            });
            return;
        }
        visitExpression(target);
    };
    const visitExpression = (expression) => {
        if (!expression) {
            return;
        }
        switch (expression.kind) {
            case 'Identifier':
                recordReference(expression);
                break;
            case 'CallExpression': {
                const call = expression;
                visitExpression(call.callee);
                call.args.forEach((arg) => {
                    if (arg.name) {
                        recordReference(arg.name);
                    }
                    visitExpression(arg.value);
                });
                break;
            }
            case 'ArrowFunctionExpression': {
                const arrow = expression;
                pushScope('function', arrow.body, { functionName: null, expression: true });
                arrow.params.forEach((param) => {
                    declare(param.identifier, 'parameter');
                    visitExpression(param.defaultValue);
                });
                arrow.body.body.forEach(visitStatement);
                popScope();
                break;
            }
            case 'BinaryExpression': {
                const binary = expression;
                visitExpression(binary.left);
                visitExpression(binary.right);
                break;
            }
            case 'UnaryExpression': {
                const unary = expression;
                visitExpression(unary.argument);
                break;
            }
            case 'MemberExpression': {
                const member = expression;
                visitExpression(member.object);
                recordReference(member.property);
                break;
            }
            case 'IndexExpression': {
                const indexExpression = expression;
                visitExpression(indexExpression.object);
                visitExpression(indexExpression.index);
                break;
            }
            case 'MatrixLiteral': {
                const matrix = expression;
                matrix.rows.forEach((row) => {
                    row.forEach((element) => {
                        visitExpression(element);
                    });
                });
                break;
            }
            case 'TupleExpression': {
                const tuple = expression;
                tuple.elements.forEach((element) => {
                    visitExpression(element);
                });
                break;
            }
            case 'ArrayLiteral': {
                const arrayLiteral = expression;
                arrayLiteral.elements.forEach((element) => {
                    visitExpression(element);
                });
                break;
            }
            case 'ConditionalExpression': {
                const conditional = expression;
                visitExpression(conditional.test);
                visitExpression(conditional.consequent);
                visitExpression(conditional.alternate);
                break;
            }
            case 'IfExpression': {
                const ifExpression = expression;
                visitExpression(ifExpression.test);
                visitStatement(ifExpression.consequent);
                if (ifExpression.alternate) {
                    if (ifExpression.alternate.kind === 'IfExpression') {
                        visitExpression(ifExpression.alternate);
                    }
                    else {
                        visitStatement(ifExpression.alternate);
                    }
                }
                break;
            }
            default:
                break;
        }
    };
    const visitStatement = (statement) => {
        switch (statement.kind) {
            case 'VariableDeclaration': {
                const variable = statement;
                declare(variable.identifier, 'variable');
                visitExpression(variable.initializer);
                break;
            }
            case 'AssignmentStatement': {
                const assignment = statement;
                visitExpression(assignment.left);
                visitExpression(assignment.right);
                break;
            }
            case 'EnumDeclaration': {
                const enumDeclaration = statement;
                declare(enumDeclaration.identifier, 'enum');
                enumDeclaration.members.forEach((member) => {
                    declare(member.identifier, 'variable');
                    visitExpression(member.value);
                });
                break;
            }
            case 'EnumMember':
                break;
            case 'TypeDeclaration': {
                const typeDeclaration = statement;
                declare(typeDeclaration.identifier, 'type');
                typeDeclaration.fields.forEach((field) => {
                    declare(field.identifier, 'variable');
                });
                break;
            }
            case 'ImportDeclaration': {
                const importDeclaration = statement;
                declare(importDeclaration.alias, 'namespace');
                break;
            }
            case 'ExpressionStatement': {
                const exprStatement = statement;
                visitExpression(exprStatement.expression);
                break;
            }
            case 'ReturnStatement': {
                const returnStatement = statement;
                visitExpression(returnStatement.argument);
                break;
            }
            case 'BlockStatement': {
                const block = statement;
                pushScope('block', block);
                block.body.forEach(visitStatement);
                popScope();
                break;
            }
            case 'FunctionDeclaration': {
                const fn = statement;
                declare(fn.identifier, 'function');
                pushScope('function', fn.body, {
                    functionName: fn.identifier?.name ?? null,
                    export: fn.export,
                });
                fn.params.forEach((param) => {
                    declare(param.identifier, 'parameter');
                    visitExpression(param.defaultValue);
                });
                fn.body.body.forEach(visitStatement);
                popScope();
                break;
            }
            case 'IfStatement': {
                const ifStatement = statement;
                visitExpression(ifStatement.test);
                visitStatement(ifStatement.consequent);
                if (ifStatement.alternate) {
                    visitStatement(ifStatement.alternate);
                }
                break;
            }
            case 'WhileStatement': {
                const whileStatement = statement;
                visitExpression(whileStatement.test);
                pushScope('loop', whileStatement.body, { loopType: 'while' });
                visitStatement(whileStatement.body);
                visitExpression(whileStatement.result);
                popScope();
                break;
            }
            case 'RepeatStatement': {
                const repeatStatement = statement;
                pushScope('loop', repeatStatement.body, { loopType: 'repeat' });
                visitStatement(repeatStatement.body);
                visitExpression(repeatStatement.result);
                visitExpression(repeatStatement.test);
                popScope();
                break;
            }
            case 'ForStatement': {
                const forStatement = statement;
                pushScope('loop', forStatement.body, { loopType: 'for' });
                if (forStatement.initializer) {
                    visitStatement(forStatement.initializer);
                }
                declareForIterator(forStatement.iterator);
                visitExpression(forStatement.iterable);
                visitExpression(forStatement.test);
                visitExpression(forStatement.update);
                visitStatement(forStatement.body);
                visitExpression(forStatement.result);
                popScope();
                break;
            }
            case 'SwitchStatement': {
                const switchStatement = statement;
                visitExpression(switchStatement.discriminant);
                switchStatement.cases.forEach((caseNode) => {
                    if (caseNode.test) {
                        visitExpression(caseNode.test);
                    }
                    caseNode.consequent.forEach((caseStatement) => {
                        visitStatement(caseStatement);
                    });
                });
                break;
            }
            case 'BreakStatement':
            case 'ContinueStatement':
                break;
            case 'ScriptDeclaration': {
                const script = statement;
                declare(script.identifier, 'namespace');
                script.arguments.forEach((argument) => {
                    if (argument.name) {
                        recordReference(argument.name);
                    }
                    visitExpression(argument.value);
                });
                break;
            }
            default:
                break;
        }
    };
    const visitProgram = (node) => {
        pushScope('module', node, { directives: node.directives.length });
        node.body.forEach(visitStatement);
        popScope();
    };
    visitProgram(program);
    return { scopeGraph, symbolTable };
}
