import { CompilerAnnotation, Newline, VersionDirective } from '../tokens';
import { attachCompilerAnnotations } from '../parser-utils';
import {
  createCompilerAnnotationNode,
  createVersionDirectiveNode,
  type VersionDirectiveNode,
  type StatementNode,
  type CompilerAnnotationNode,
} from '../node-builders';
import type { PineParser } from '../parser';

export function createProgramRule(parser: PineParser) {
  return parser.RULE('program', () => {
    const directives: VersionDirectiveNode[] = [];
    const body: StatementNode[] = [];

    parser.MANY(() => parser.CONSUME(Newline));

    parser.MANY2(() => {
      directives.push(parser.SUBRULE(parser.versionDirective));
      parser.MANY3(() => parser.CONSUME2(Newline));
    });

    parser.MANY4(() => parser.CONSUME3(Newline));

    parser.MANY5(() => {
      const annotations: CompilerAnnotationNode[] = [];

      parser.MANY7(() => {
        const annotationToken = parser.CONSUME(CompilerAnnotation);
        annotations.push(createCompilerAnnotationNode(annotationToken));
        parser.MANY8(() => parser.CONSUME5(Newline));
      });

      const statementNode = parser.SUBRULE(parser.statement);
      attachCompilerAnnotations(statementNode, annotations);
      body.push(statementNode);
      parser.MANY6(() => parser.CONSUME4(Newline));
    });

    return { directives, body };
  });
}

export function createVersionDirectiveRule(parser: PineParser) {
  return parser.RULE('versionDirective', () => {
    const token = parser.CONSUME(VersionDirective);
    return createVersionDirectiveNode(token);
  });
}
