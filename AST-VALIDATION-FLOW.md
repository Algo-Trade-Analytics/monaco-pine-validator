# AST-Based Validation Flow

## Yes, We Use AST! 🌳

The scope validator is **fully AST-driven**. Here's the complete flow:

## 1. Parse Code → AST

```typescript
// Source code
const code = `//@version=6
indicator("Test")
toSize(s) =>
    s == "tiny" ? size.tiny : size.small
plot(toSize(lblSize))`;

// Parser creates AST
const ast = parser.parse(code);
```

**AST Structure:**
```
ProgramNode
├── VersionDirective (v6)
├── ScriptDeclaration (indicator)
├── FunctionDeclaration (toSize)
│   ├── Parameter (s)
│   └── Body
│       └── ConditionalExpression
└── ExpressionStatement (plot call)
```

## 2. Build Scope Graph from AST

```typescript
// core/ast/scope.ts
const { scopeGraph, symbolTable } = buildScopeGraph(ast);
```

### Scope Graph
Tracks **where** variables are declared:

```
scope-0 (module)
├── symbols: ['lblSize', 'toSize']
└── children: [scope-1]
    
scope-1 (function: toSize)
├── symbols: ['s']          // Parameter only valid HERE
├── parent: scope-0
└── range: [line 3-4]
```

### Symbol Table
Tracks **what** variables exist:

```javascript
{
  's': {
    kind: 'parameter',
    declarations: [{ line: 3, column: 8 }],
    references: [{ line: 4, column: 5 }],  // Inside function ✅
    metadata: {
      declarationScopes: ['scope-1'],     // Only in function scope!
      declarationKinds: ['parameter']
    }
  },
  'toSize': {
    kind: 'function',
    declarations: [{ line: 3, column: 1 }],
    references: [{ line: 5, column: 6 }],
    metadata: {
      declarationScopes: ['scope-0'],     // Global scope
      declarationKinds: ['function']
    }
  }
}
```

## 3. Validate References Against Scopes

```typescript
// modules/scope-validator.ts
private emitAstUndefinedReferenceWarnings(
  context: AstValidationContext,
  identifierPaths: Map<IdentifierNode, NodePath<IdentifierNode>>
): void {
  // For each symbol reference in the AST...
  for (const record of context.symbolTable.values()) {
    for (const reference of record.references) {
      // Check if it's:
      // 1. System-defined (Pine Script built-in)
      // 2. User-defined globally
      // 3. Parameter in correct scope
      
      if (isParameter) {
        const referencePath = identifierPaths.get(node);
        if (!isReferenceInScopes(referencePath, paramScopes, context.scopeGraph)) {
          // ERROR: Parameter used outside its function!
        }
      }
    }
  }
}
```

## 4. Scope Checking Logic

### Example: `s` used outside function

**Code:**
```pine
toSize(s) =>        // s declared in scope-1
    s * 2           // ✅ Reference in scope-1
plot(s)             // ❌ Reference in scope-0 (outside function)
```

**AST Validation:**
```typescript
// Reference to 's' on line 4
reference = { node: IdentifierNode('s'), line: 4, column: 6 }

// Check scope
parameterScopes = ['scope-1']  // s only valid in scope-1
referencePath = getNodePath(reference.node)  // In scope-0

isReferenceInScopes(referencePath, ['scope-1'], scopeGraph)
// → Walks up AST tree
// → Current scope: scope-0
// → Parameter scope: scope-1
// → scope-0 ≠ scope-1
// → Returns false ❌

// Result: ERROR - Undefined variable 's'
```

## Key AST Components Used

### 1. **AST Nodes** (`core/ast/nodes.ts`)
- `ProgramNode` - Root of AST
- `FunctionDeclarationNode` - Functions with parameters
- `ParameterNode` - Function parameters
- `IdentifierNode` - Variable references
- `VariableDeclarationNode` - Variable declarations

### 2. **AST Traversal** (`core/ast/traversal.ts`)
- `visit()` - Walk the AST tree
- `NodePath` - Track parent-child relationships
- Used to find which scope a reference is in

### 3. **Scope Graph** (`core/ast/scope.ts`)
- Hierarchical scope structure
- Each scope has: ID, parent, children, symbols, range
- Built by walking AST and tracking `pushScope()`/`popScope()`

### 4. **Symbol Table** (`core/ast/types.ts`)
- Maps identifier names to:
  - Where declared (line/column)
  - Where referenced (line/column)
  - What scope(s) it's declared in
  - What kind (variable, parameter, function, etc.)

## Why AST is Essential

### ❌ Without AST (Text-Based)
```typescript
// Can't tell if 's' is in function scope or global scope
if (line.includes('s')) {
  // Is this the parameter, or a reference?
  // Is it inside the function or outside?
  // Hard to know!
}
```

### ✅ With AST (Structure-Based)
```typescript
// AST knows EXACTLY:
- 's' is declared as Parameter in FunctionDeclaration (scope-1)
- This reference to 's' is in ExpressionStatement (scope-0)
- scope-0 is NOT inside scope-1
- Therefore: ERROR ❌
```

## Real Example from Your Test

**Your Code:**
```pine
toSize(s) =>
    s == "tiny" ? size.tiny : size.small

atrLen = input.int(s, ...)  // ❌ 's' used here
```

**AST Analysis:**
```
1. Parser creates AST with FunctionDeclaration node
2. buildScopeGraph() creates:
   - scope-1 for function body
   - Adds 's' to symbolTable with declarationScopes: ['scope-1']
3. Validator finds reference to 's' in input.int() call
4. Checks: Is reference in scope-1? NO (it's in scope-0)
5. Result: ERROR - Undefined variable 's'
```

## Summary

| Component | Purpose | File |
|-----------|---------|------|
| **Parser** | Code → AST | `core/ast/parser/` |
| **Scope Builder** | AST → Scope Graph + Symbol Table | `core/ast/scope.ts` |
| **Traversal** | Walk AST tree | `core/ast/traversal.ts` |
| **Validator** | Check references against scopes | `modules/scope-validator.ts` |

**The validator is 100% AST-driven** - it understands the **structure** of your code, not just the text! 🎯

