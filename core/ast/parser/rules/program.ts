import { CompilerAnnotation, Newline, VersionDirective } from '../tokens';
import { attachCompilerAnnotations } from '../parser-utils';
import { createCompilerAnnotationNode, createVersionDirectiveNode } from '../node-builders';
import type { VersionDirectiveNode, StatementNode, CompilerAnnotationNode } from '../../nodes';
import type { PineParser } from '../parser';

export function createProgramRule(parser: PineParser) {
  return parser.createRule('program', () => {
    const directives: VersionDirectiveNode[] = [];
    const body: StatementNode[] = [];

    parser.repeatMany(() => parser.consumeToken(Newline));

    parser.repeatMany(() => {
      directives.push(parser.invokeSubrule(parser.versionDirective));
      parser.repeatMany(() => parser.consumeToken(Newline, 2), 3);
    }, 2);

    parser.repeatMany(() => parser.consumeToken(Newline, 3), 4);

    parser.repeatMany(() => {
      const annotations: CompilerAnnotationNode[] = [];

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

export function createVersionDirectiveRule(parser: PineParser) {
  return parser.createRule('versionDirective', () => {
    const token = parser.consumeToken(VersionDirective);
    return createVersionDirectiveNode(token);
  });
}
