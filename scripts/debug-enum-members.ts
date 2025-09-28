import { parseWithChevrotain } from '../core/ast/parser/index.ts';

const code = `//@version=6
indicator("Enum Test")

enum MyEnum
    VALUE1
    123INVALID
    VALUE3

plot(close)`;

const result = parseWithChevrotain(code, { allowErrors: true });
const enumDecl = result.ast?.body.find(node => node.kind === 'EnumDeclaration');
if (enumDecl) {
  const members = (enumDecl as any).members;
  console.log('member count', members.length);
  for (const member of members) {
    console.log({
      name: member.identifier?.name,
      loc: member.identifier?.loc,
      source: code.split('\n')[member.identifier?.loc?.start.line - 1]?.slice(member.identifier?.loc?.start.column - 1, member.identifier?.loc?.end.column - 1)
    });
  }
} else {
  console.log('no enum decl');
}
