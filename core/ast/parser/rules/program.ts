import { CompilerAnnotation, Dedent, Indent, Newline, Semicolon, VersionDirective } from '../tokens';
import { attachCompilerAnnotations } from '../parser-utils';
import { createCompilerAnnotationNode, createVersionDirectiveNode } from '../node-builders';
import type { VersionDirectiveNode, StatementNode, CompilerAnnotationNode } from '../../nodes';
import type { PineParser } from '../parser';

export function createProgramRule(parser: PineParser) {
  return parser.createRule('program', () => {
    const directives: VersionDirectiveNode[] = [];
    const body: StatementNode[] = [];
    const consumeStructuralPadding = () => {
      parser.repeatMany(() => {
        parser.choose([
          { ALT: () => parser.consumeToken(Newline) },
          { ALT: () => parser.consumeToken(Semicolon) },
          { ALT: () => parser.consumeToken(Indent) },
          { ALT: () => parser.consumeToken(Dedent) },
        ]);
      });
    };

    consumeStructuralPadding();

    parser.repeatMany(() => {
      directives.push(parser.invokeSubrule(parser.versionDirective));
      parser.repeatMany(() => {
        parser.choose([
          { ALT: () => parser.consumeToken(Newline, 2) },
          { ALT: () => parser.consumeToken(Semicolon) },
          { ALT: () => parser.consumeToken(Indent) },
          { ALT: () => parser.consumeToken(Dedent) },
        ]);
      }, 3);
    }, 2);

    parser.repeatMany(() => {
      parser.choose([
        { ALT: () => parser.consumeToken(Newline, 3) },
        { ALT: () => parser.consumeToken(Semicolon) },
        { ALT: () => parser.consumeToken(Indent) },
        { ALT: () => parser.consumeToken(Dedent) },
      ]);
    }, 4);

    parser.repeatMany(() => {
      const annotations: CompilerAnnotationNode[] = [];

      parser.repeatMany(() => {
        parser.choose([
          { ALT: () => parser.consumeToken(Newline, 6) },
          { ALT: () => parser.consumeToken(Semicolon) },
          { ALT: () => parser.consumeToken(Indent) },
          { ALT: () => parser.consumeToken(Dedent) },
        ]);
      }, 9);

      parser.repeatMany(() => {
        const annotationToken = parser.consumeToken(CompilerAnnotation);
        annotations.push(createCompilerAnnotationNode(annotationToken));
        parser.repeatMany(() => {
          parser.choose([
            { ALT: () => parser.consumeToken(Newline, 5) },
            { ALT: () => parser.consumeToken(Semicolon) },
            { ALT: () => parser.consumeToken(Indent) },
            { ALT: () => parser.consumeToken(Dedent) },
          ]);
        }, 8);
      }, 7);

      const statementNode = parser.invokeSubrule(parser.statement);
      attachCompilerAnnotations(statementNode, annotations);
      body.push(statementNode);

      parser.repeatMany(() => {
        parser.choose([
          { ALT: () => parser.consumeToken(Newline, 4) },
          { ALT: () => parser.consumeToken(Semicolon) },
          { ALT: () => parser.consumeToken(Indent) },
          { ALT: () => parser.consumeToken(Dedent) },
        ]);
      }, 6);
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
