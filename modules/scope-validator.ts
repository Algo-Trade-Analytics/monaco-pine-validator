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
  type ScopeGraph,
  type SymbolRecord,
} from '../core/types';
import { ValidationHelper } from '../core/validation-helper';
import { KEYWORDS, NAMESPACES, PSEUDO_VARS, WILDCARD_IDENT } from '../core/constants';
import type { IdentifierNode, ProgramNode, TypeDeclarationNode, Node } from '../core/ast/nodes';
import { visit, type NodePath } from '../core/ast/traversal';

export class ScopeValidator implements ValidationModule {
  name = 'ScopeValidator';
  priority = 80; // High priority, runs after CoreValidator

  private helper = new ValidationHelper();

  private astDuplicateWarningSites = new Set<string>();
  private astShadowWarningSites = new Set<string>();
  private astUndefinedWarningSites = new Set<string>();
  private astInvalidIdentifierErrorSites = new Set<string>();
  private astKeywordErrorSites = new Set<string>();
  private astUdtFieldLocations = new Set<string>();

  getDependencies(): string[] {
    return ['CoreValidator']; // Depends on core validation
  }

  validate(context: ValidationContext, _config: ValidatorConfig): ValidationResult {
    this.reset();

    const astContext = this.isAstContext(context) && context.ast ? context : null;
    if (!astContext?.ast) {
      return this.helper.buildResult(context);
    }

    this.validateWithAst(astContext);

    return this.helper.buildResult(context);
  }

  private reset(): void {
    this.helper.reset();

    this.astDuplicateWarningSites.clear();
    this.astShadowWarningSites.clear();
    this.astUndefinedWarningSites.clear();
    this.astInvalidIdentifierErrorSites.clear();
    this.astKeywordErrorSites.clear();
    this.astUdtFieldLocations.clear();
  }



  private isAstContext(context: ValidationContext): context is AstValidationContext {
    return 'ast' in context;
  }

  private validateWithAst(context: AstValidationContext): void {
    const program = context.ast;
    if (!program) {
      return;
    }

    this.collectAstUdtFieldLocations(program);
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

  private collectAstUdtFieldLocations(program: ProgramNode): void {
    this.astUdtFieldLocations.clear();

    visit(program, {
      TypeDeclaration: {
        enter: (path) => {
          for (const field of path.node.fields) {
            const { line, column } = field.identifier.loc.start;
            this.astUdtFieldLocations.add(`${line}:${column}`);
          }
        },
      },
    });
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
          this.helper.addWarning(
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
            this.helper.addWarning(
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
      const key = `${location.line}:${location.column}`;
      if (this.astUdtFieldLocations.has(key)) {
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
    const scopedDeclarations = new Map<string, string[]>(); // name -> scopeIds where declared
    
    // Also check typeMap for enum declarations
    if (context.typeMap) {
      for (const [name, typeInfo] of context.typeMap) {
        if (typeInfo.type === 'enum' && typeInfo.isConst) {
          declaredNames.add(name);
        }
      }
    }
    
    for (const record of context.symbolTable.values()) {
      if (!record.declarations.length) {
        continue;
      }

      const metadataKinds = (record.metadata?.declarationKinds as SymbolKind[] | undefined) ?? [];
      if (metadataKinds.length === 0) {
        declaredNames.add(record.name);
        continue;
      }

      // Check if this is a parameter - parameters are scope-limited
      const isParameter = metadataKinds.some((kind) => kind === 'parameter');
      const declarationScopes = (record.metadata?.declarationScopes as string[] | undefined) ?? [];
      
      if (isParameter && declarationScopes.length > 0) {
        // Store parameter declarations with their scope IDs
        scopedDeclarations.set(record.name, declarationScopes);
      } else if (metadataKinds.some((kind) => this.shouldCheckAstDeclarationKind(kind))) {
        // Non-parameter declarations are available globally
        declaredNames.add(record.name);
      }
    }

    for (const record of context.symbolTable.values()) {
      // Skip if globally declared
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

        // Check if this is a scoped declaration (parameter)
        const paramScopes = scopedDeclarations.get(record.name);
        if (paramScopes) {
          // Check if reference is within any of the parameter's scopes
          const referencePath = identifierPaths.get(node);
          if (referencePath && this.isReferenceInScopes(referencePath, paramScopes, context.scopeGraph)) {
            // Reference is valid within parameter's scope
            continue;
          }
        }

        const siteKey = `${reference.line}:${reference.column}:${record.name}`;
        if (this.astUndefinedWarningSites.has(siteKey)) {
          continue;
        }
        this.astUndefinedWarningSites.add(siteKey);

        this.helper.addError(
          reference.line,
          reference.column,
          `Undefined variable '${record.name}'.`,
          'PSU02',
        );
      }
    }
  }

  private isReferenceInScopes(referencePath: NodePath<IdentifierNode>, targetScopes: string[], scopeGraph: ScopeGraph): boolean {
    // Find which scope this reference is in by walking up the AST
    let current: NodePath<Node> | null = referencePath;
    
    while (current) {
      const node = current.node;
      
      // Check if current node has scope information
      if (node.range && scopeGraph?.nodes) {
        for (const [scopeId, scopeNode] of scopeGraph.nodes.entries()) {
          // Check if this reference is within one of the target scopes
          if (targetScopes.includes(scopeId)) {
            // Check if reference position is within scope's range
            const refStart = node.range[0];
            const scopeRange = scopeNode.metadata?.range;
            if (Array.isArray(scopeRange) && scopeRange.length >= 2 && refStart >= scopeRange[0] && refStart <= scopeRange[1]) {
              return true;
            }
          }
        }
      }
      
      current = current.parent;
    }
    
    return false;
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
          this.helper.addError(
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
          this.helper.addError(
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

    // Add Pine Script built-ins (system-defined)
    for (const name of KEYWORDS) ignored.add(name);
    for (const name of PSEUDO_VARS) ignored.add(name);
    for (const name of NAMESPACES) ignored.add(name);
    for (const name of WILDCARD_IDENT) ignored.add(name);

    // Add user-defined functions and methods
    context.functionNames.forEach((name) => ignored.add(name));
    context.methodNames.forEach((name) => ignored.add(name));
    
    // Add user-defined variables (but NOT parameters - they're scope-limited)
    context.usedVars.forEach((name) => ignored.add(name));
    context.declaredVars.forEach((_line, declaredName) => ignored.add(declaredName));

    // NOTE: Function parameters are NOT added here because they are scope-limited.
    // They are handled separately in emitAstUndefinedReferenceWarnings via scopedDeclarations.
    // This ensures parameters like 's' in 'toSize(s)' are only valid inside that function.

    // Special case: 'this' is valid in method contexts
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
        // For properties in member expressions, never check them for undefined
        // because they're part of the member expression syntax, not standalone identifiers
        if (key === 'property') {
          return false; // Don't emit undefined error for properties
        }
        // For objects in member expressions, still check them
        return true;
      case 'Argument':
        // For named arguments like 'group = GRP_PAL', we want to check the value (GRP_PAL)
        // but not the name (group). The key 'name' refers to the argument name, 'value' refers to the argument value.
        return key === 'value';
      case 'TypeReference':
        return false;
      default:
        break;
    }

    return true;
  }
}
