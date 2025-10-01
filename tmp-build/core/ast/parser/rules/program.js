import { CompilerAnnotation, Newline, VersionDirective } from '../tokens';
import { attachCompilerAnnotations } from '../parser-utils';
import { createCompilerAnnotationNode, createVersionDirectiveNode } from '../node-builders';
export function createProgramRule(parser) {
    return parser.createRule('program', () => {
        const directives = [];
        const body = [];
        parser.repeatMany(() => parser.consumeToken(Newline));
        parser.repeatMany(() => {
            directives.push(parser.invokeSubrule(parser.versionDirective));
            parser.repeatMany(() => parser.consumeToken(Newline, 2), 3);
        }, 2);
        parser.repeatMany(() => parser.consumeToken(Newline, 3), 4);
        parser.repeatMany(() => {
            const annotations = [];
            parser.repeatMany(() => parser.consumeToken(Newline, 6), 9);
            parser.repeatMany(() => {
                const annotationToken = parser.consumeToken(CompilerAnnotation);
                annotations.push(createCompilerAnnotationNode(annotationToken));
                parser.repeatMany(() => parser.consumeToken(Newline, 5), 8);
            }, 7);
            const statementNode = parser.invokeSubrule(parser.statement);
            attachCompilerAnnotations(statementNode, annotations);
            body.push(statementNode);
            parser.repeatMany(() => parser.consumeToken(Newline, 4), 6);
        }, 5);
        return { directives, body };
    });
}
export function createVersionDirectiveRule(parser) {
    return parser.createRule('versionDirective', () => {
        const token = parser.consumeToken(VersionDirective);
        return createVersionDirectiveNode(token);
    });
}
