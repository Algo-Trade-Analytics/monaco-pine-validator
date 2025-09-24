/**
 * Scope Management Validation Module
 *
 * Handles variable scope, declaration validation, and access control for Pine Script v6.
 * Extracts scope management logic from EnhancedPineScriptValidator.
 */

import {
  type ValidationModule,
  type ValidationContext,
  type ValidatorConfig,
  type ValidationError,
  type ValidationResult,
  type AstValidationContext,
  type SymbolKind,
  type SymbolRecord,
} from '../core/types';
import { KEYWORDS, NAMESPACES, PSEUDO_VARS, WILDCARD_IDENT } from '../core/constants';
import type { IdentifierNode, ProgramNode } from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

export class ScopeValidator implements ValidationModule {
  name = 'ScopeValidator';
  priority = 80; // High priority, runs after CoreValidator

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];

  private astDuplicateWarningSites = new Set<string>();
  private astShadowWarningSites = new Set<string>();
  private astUndefinedWarningSites = new Set<string>();
  private astInvalidIdentifierErrorSites = new Set<string>();
  private astKeywordErrorSites = new Set<string>();

  getDependencies(): string[] {
    return ['CoreValidator']; // Depends on core validation
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.reset();

    const astContext = this.isAstContext(context) && context.ast ? context : null;
    if (!astContext?.ast) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        typeMap: context.typeMap ?? new Map(),
        scriptType: context.scriptType ?? null,
      };
    }

    this.validateWithAst(astContext);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: context.typeMap ?? new Map(),
      scriptType: context.scriptType ?? null,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];

    this.astDuplicateWarningSites.clear();
    this.astShadowWarningSites.clear();
    this.astUndefinedWarningSites.clear();
    this.astInvalidIdentifierErrorSites.clear();
    this.astKeywordErrorSites.clear();
  }

  private addError(line: number, column: number, message: string, code?: string): void {
    this.errors.push({ line, column, message, severity: 'error', code });
  }

  private addWarning(line: number, column: number, message: string, code?: string): void {
    this.warnings.push({ line, column, message, severity: 'warning', code });
  }

  private addInfo(line: number, column: number, message: string, code?: string): void {
    this.info.push({ line, column, message, severity: 'info', code });
  }

  private isAstContext(context: ValidationContext): context is AstValidationContext {
    return 'ast' in context;
  }

  private validateWithAst(context: AstValidationContext): void {
    const program = context.ast;
    if (!program) {
      return;
    }

    const identifierPaths = this.collectAstIdentifierPaths(program);

    this.emitAstDuplicateDeclarationWarnings(context);
    this.emitAstShadowingWarnings(context);
    this.emitAstUndefinedReferenceWarnings(context, identifierPaths);
    this.emitAstIdentifierDeclarationErrors(context);
  }

  private collectAstIdentifierPaths(program: ProgramNode): Map<IdentifierNode, NodePath<IdentifierNode>> {
    const paths = new Map<IdentifierNode, NodePath<IdentifierNode>>();

    visit(program, {
      Identifier: {
        enter: (path) => {
          paths.set(path.node, path as NodePath<IdentifierNode>);
        },
      },
    });

    return paths;
  }

  private emitAstDuplicateDeclarationWarnings(context: AstValidationContext): void {
    for (const record of context.symbolTable.values()) {
      const entries = this.extractAstDeclarationEntries(record);
      if (!entries.length) {
        continue;
      }

      const byScope = new Map<string, typeof entries>();
      for (const entry of entries) {
        if (!entry.scopeId) {
          continue;
        }
        if (!byScope.has(entry.scopeId)) {
          byScope.set(entry.scopeId, []);
        }
        byScope.get(entry.scopeId)!.push(entry);
      }

      for (const declarations of byScope.values()) {
        if (declarations.length <= 1) {
          continue;
        }
        const sorted = [...declarations].sort((a, b) => {
          if (a.location.line === b.location.line) {
            return a.location.column - b.location.column;
          }
          return a.location.line - b.location.line;
        });
        for (let i = 1; i < sorted.length; i++) {
          const duplicate = sorted[i];
          const siteKey = `${duplicate.location.line}:${record.name}`;
          if (this.astDuplicateWarningSites.has(siteKey)) {
            continue;
          }
          this.astDuplicateWarningSites.add(siteKey);
          this.addWarning(
            duplicate.location.line,
            duplicate.location.column,
            `Identifier '${record.name}' already declared in this block; use ':=' to reassign.`,
            'PSW03',
          );
        }
      }
    }
  }

  private shouldCheckAstIdentifierName(kind: SymbolKind): boolean {
    return kind === 'variable' || kind === 'unknown';
  }

  private isValidIdentifierName(name: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
  }

  private isKeywordCompatibleIdentifier(name: string): boolean {
    if (!name) {
      return true;
    }

    if (KEYWORDS.has(name) || PSEUDO_VARS.has(name)) {
      return false;
    }

    return true;
  }

  private emitAstShadowingWarnings(context: AstValidationContext): void {
    for (const record of context.symbolTable.values()) {
      const entries = this.extractAstDeclarationEntries(record);
      if (entries.length <= 1) {
        continue;
      }

      for (const entry of entries) {
        if (!entry.scopeId) {
          continue;
        }

        const shadowKey = `${entry.location.line}:${record.name}`;
        if (this.astShadowWarningSites.has(shadowKey)) {
          continue;
        }

        let parentId = context.scopeGraph.nodes.get(entry.scopeId)?.parent ?? null;
        while (parentId) {
          const ancestor = entries.find((candidate) => candidate.scopeId === parentId);
          if (ancestor) {
            this.astShadowWarningSites.add(shadowKey);
            this.addWarning(
              entry.location.line,
              entry.location.column,
              `Identifier '${record.name}' shadows an outer declaration.`,
              'PSW04',
            );
            break;
          }
          parentId = context.scopeGraph.nodes.get(parentId)?.parent ?? null;
        }
      }
    }
  }

  private extractAstDeclarationEntries(record: SymbolRecord): Array<{
    scopeId: string | null;
    location: { line: number; column: number };
    kind: SymbolKind;
  }> {
    const metadata = record.metadata ?? {};
    const scopes = (metadata.declarationScopes as string[] | undefined) ?? [];
    const kinds = (metadata.declarationKinds as SymbolKind[] | undefined) ?? [];
    const entries: Array<{ scopeId: string | null; location: { line: number; column: number }; kind: SymbolKind }> = [];

    record.declarations.forEach((location, index) => {
      const scopeId = scopes[index] ?? null;
      const kind = kinds[index] ?? record.kind;
      if (!this.shouldCheckAstDeclarationKind(kind)) {
        return;
      }
      entries.push({
        scopeId,
        location: { line: location.line, column: location.column },
        kind,
      });
    });

    return entries;
  }

  private shouldCheckAstDeclarationKind(kind: SymbolKind): boolean {
    return kind === 'variable' || kind === 'unknown' || kind === 'type';
  }

  private emitAstUndefinedReferenceWarnings(
    context: AstValidationContext,
    identifierPaths: Map<IdentifierNode, NodePath<IdentifierNode>>,
  ): void {
    const ignoredNames = this.createAstIgnoredNameSet(context);

    const declaredNames = new Set<string>();
    for (const record of context.symbolTable.values()) {
      if (!record.declarations.length) {
        continue;
      }

      const metadataKinds = (record.metadata?.declarationKinds as SymbolKind[] | undefined) ?? [];
      if (metadataKinds.length === 0) {
        declaredNames.add(record.name);
        continue;
      }

      if (metadataKinds.some((kind) => this.shouldCheckAstDeclarationKind(kind) || kind === 'parameter')) {
        declaredNames.add(record.name);
      }
    }

    for (const record of context.symbolTable.values()) {
      if (declaredNames.has(record.name)) {
        continue;
      }

      if (this.shouldIgnoreAstUndefinedName(record.name, ignoredNames)) {
        continue;
      }

      for (const reference of record.references) {
        const node = reference.node;
        if (!node || node.kind !== 'Identifier') {
          continue;
        }

        if (!this.shouldEmitAstUndefinedForNode(node as IdentifierNode, identifierPaths)) {
          continue;
        }

        const siteKey = `${reference.line}:${reference.column}:${record.name}`;
        if (this.astUndefinedWarningSites.has(siteKey)) {
          continue;
        }
        this.astUndefinedWarningSites.add(siteKey);

        this.addWarning(
          reference.line,
          reference.column,
          `Potential undefined reference '${record.name}'.`,
          'PSU02',
        );
      }
    }
  }

  private emitAstIdentifierDeclarationErrors(context: AstValidationContext): void {
    for (const record of context.symbolTable.values()) {
      const entries = this.extractAstDeclarationEntries(record);
      if (!entries.length) {
        continue;
      }

      for (const entry of entries) {
        if (!this.shouldCheckAstIdentifierName(entry.kind)) {
          continue;
        }

        const siteKey = `${entry.location.line}:${entry.location.column}:${record.name}`;

        if (!this.isValidIdentifierName(record.name)) {
          if (this.astInvalidIdentifierErrorSites.has(siteKey)) {
            continue;
          }
          this.astInvalidIdentifierErrorSites.add(siteKey);
          this.addError(
            entry.location.line,
            entry.location.column,
            `Invalid identifier '${record.name}'.`,
            'PS006',
          );
          continue;
        }

        if (!this.isKeywordCompatibleIdentifier(record.name)) {
          if (this.astKeywordErrorSites.has(siteKey)) {
            continue;
          }
          this.astKeywordErrorSites.add(siteKey);
          this.addError(
            entry.location.line,
            entry.location.column,
            `Identifier '${record.name}' conflicts with a Pine keyword/builtin.`,
            'PS007',
          );
        }
      }
    }
  }

  private createAstIgnoredNameSet(context: AstValidationContext): Set<string> {
    const ignored = new Set<string>();

    for (const name of KEYWORDS) ignored.add(name);
    for (const name of PSEUDO_VARS) ignored.add(name);
    for (const name of NAMESPACES) ignored.add(name);
    for (const name of WILDCARD_IDENT) ignored.add(name);

    context.functionNames.forEach((name) => ignored.add(name));
    context.methodNames.forEach((name) => ignored.add(name));
    context.usedVars.forEach((name) => ignored.add(name));
    context.declaredVars.forEach((_line, declaredName) => ignored.add(declaredName));

    for (const params of context.functionParams.values()) {
      for (const rawParam of params) {
        const cleaned = rawParam.trim().replace(/<[^>]*>/g, '');
        const fragments = cleaned.split(/\s+/);
        const identifier = fragments[fragments.length - 1];
        if (identifier) {
          ignored.add(identifier);
        }
      }
    }

    ignored.add('this');

    return ignored;
  }

  private shouldIgnoreAstUndefinedName(name: string, ignoredNames: Set<string>): boolean {
    if (!name || ignoredNames.has(name)) {
      return true;
    }

    return false;
  }

  private shouldEmitAstUndefinedForNode(
    node: IdentifierNode,
    identifierPaths: Map<IdentifierNode, NodePath<IdentifierNode>>,
  ): boolean {
    const path = identifierPaths.get(node);
    if (!path) {
      return false;
    }

    const parent = path.parent;
    if (!parent) {
      return false;
    }

    const key = path.key;
    switch (parent.node.kind) {
      case 'VariableDeclaration':
      case 'TypeDeclaration':
      case 'TypeField':
      case 'FunctionDeclaration':
      case 'Parameter':
      case 'ScriptDeclaration':
        return key !== 'identifier';
      case 'AssignmentStatement':
        return key !== 'left';
      case 'CallExpression':
        return key !== 'callee';
      case 'MemberExpression':
        return key !== 'property';
      case 'Argument':
        return key !== 'name';
      case 'TypeReference':
        return false;
      default:
        break;
    }

    return true;
  }
}
