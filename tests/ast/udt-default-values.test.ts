import { describe, it, expect } from 'vitest';
import { parseWithChevrotain } from '../../core/ast/parser';
import { ProgramNode, TypeDeclarationNode, TypeFieldNode } from '../../core/ast/pine-types';

describe('UDT with default values', () => {
  it('parses type fields with default values', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      '',
      'type Vals',
      '    int start  = na',
      '    float  top = na',
      '    float  bot = na',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    const typeDecl = program.body.find((node) => node.kind === 'TypeDeclaration') as TypeDeclarationNode;
    
    expect(typeDecl).toBeDefined();
    expect(typeDecl.identifier.name).toBe('Vals');
    expect(typeDecl.fields).toHaveLength(3);

    const [startField, topField, botField] = typeDecl.fields as [TypeFieldNode, TypeFieldNode, TypeFieldNode];
    expect(startField.identifier.name).toBe('start');
    expect(startField.typeAnnotation?.name.name).toBe('int');
    expect(topField.identifier.name).toBe('top');
    expect(topField.typeAnnotation?.name.name).toBe('float');
    expect(botField.identifier.name).toBe('bot');
    expect(botField.typeAnnotation?.name.name).toBe('float');
  });

  it('parses type fields with mixed default values and no default values', () => {
    const source = [
      '//@version=6',
      'indicator("Test")',
      '',
      'type Mixed',
      '    int a',
      '    float b = 0.0',
      '    string c = "default"',
      '    bool d',
    ].join('\n');

    const { ast, diagnostics } = parseWithChevrotain(source);

    expect(diagnostics.syntaxErrors).toHaveLength(0);
    expect(ast).not.toBeNull();

    const program = ast as ProgramNode;
    const typeDecl = program.body.find((node) => node.kind === 'TypeDeclaration') as TypeDeclarationNode;
    
    expect(typeDecl).toBeDefined();
    expect(typeDecl.identifier.name).toBe('Mixed');
    expect(typeDecl.fields).toHaveLength(4);
  });
});

