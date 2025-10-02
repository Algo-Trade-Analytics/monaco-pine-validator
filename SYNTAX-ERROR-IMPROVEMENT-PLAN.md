# Syntax Error Improvement Plan

## ✅ STATUS: IMPLEMENTATION COMPLETE

**Completed:** October 2, 2025

All three components have been successfully implemented and integrated:
- ✅ Error Translation Layer (`core/ast/error-translator.ts`)
- ✅ Syntax Error Processor (`core/ast/syntax-error-processor.ts`)
- ✅ Syntax Error Validator Module (`modules/syntax-error-validator.ts`)
- ✅ Integration with `EnhancedModularValidator` (priority 999, early exit on syntax errors)

**Test Results:** All tests passing. Empty parameter detection working correctly with clear, user-friendly error messages and no cascading errors.

---

## The Problem (SOLVED)

**Current Behavior:**
```pine
volSmooth = input.int(, "Vol Smoothing EMA", minval=1)
                      ^ Empty parameter
```

**What You Get:**
```
❌ ERROR: Function 'basisFrom' has inconsistent return types (line 40)
❌ ERROR: Function 'volFrom' has inconsistent return types (line 44)
```

**What You Should Get:**
```
✅ ERROR: Missing required 'defval' parameter in input.int() (line 33)
   💡 input.int() requires a default value as the first parameter.
   Example: input.int(5, "Vol Smoothing EMA", minval=1)
```

## TradingView's Message

TradingView shows:
```
Mismatched input "," expecting ")"
```

This is **technically correct** but **not user-friendly**.

## The Solution (3 Components)

### 1. Error Translation Layer ✅ CREATED

**File:** `core/ast/error-translator.ts`

Translates cryptic parser messages to user-friendly ones:

| Parser Message | User-Friendly Message |
|----------------|----------------------|
| `Mismatched input "," expecting ")"` | `Missing function parameter before comma` |
| `Cannot read properties of undefined` | `Syntax error: Unexpected structure in code` |
| `Expecting ")"` | `Missing closing parenthesis` |

**With Context Enhancement:**
```typescript
// Detects: input.int(, ...)
// Enhances to: Missing required 'defval' parameter in input.int()
```

### 2. Syntax Error Validator Module ✅ CREATED

**File:** `modules/syntax-error-validator.ts`

- **Priority: 1** (runs FIRST)
- Processes parser errors before other validators
- Converts them to user-friendly errors
- Can signal to stop further validation

### 3. Integration (TODO)

**Needed Changes:**

#### A. Add to Module List
**File:** `EnhancedModularValidator.ts` or `modules/index.ts`

```typescript
import { SyntaxErrorValidator } from './modules/syntax-error-validator';

// In constructor or module initialization:
this.modules = [
  new SyntaxErrorValidator(),  // Add FIRST (priority: 1)
  new CoreValidator(),
  // ... rest of modules
];
```

#### B. Early Exit on Syntax Errors
**File:** `EnhancedModularValidator.ts`

```typescript
validate(code: string): ValidationResult {
  // ... parse code ...
  
  const syntaxValidator = new SyntaxErrorValidator();
  const syntaxResult = syntaxValidator.validate(context, config);
  
  // If there are syntax errors, return early
  if (!syntaxResult.isValid) {
    return {
      isValid: false,
      errors: syntaxResult.errors,
      warnings: [],
      info: [],
      typeMap: new Map(),
      scriptType: null
    };
  }
  
  // Continue with other validators...
}
```

#### C. Fix Parser Error Reporting
**File:** `core/ast/parser/parse.ts`

Currently, when the parser encounters `,` without a preceding expression:
- It tries to recover and continue
- Creates a malformed AST
- The error is captured but vague

**Needed:** Better error recovery or detection of empty expressions:

```typescript
// In argument parsing
if (nextToken === COMMA && previousToken === LEFT_PAREN) {
  // Empty parameter detected!
  throw new MismatchedTokenError(
    "Missing parameter before comma",
    token,
    { expected: "expression", found: "," }
  );
}
```

## Implementation Steps

### Step 1: Test Current Infrastructure
```bash
npm run test -- syntax-error
```

### Step 2: Add SyntaxErrorValidator to Module List

Find where modules are registered and add:
```typescript
new SyntaxErrorValidator()  // Priority 1 - runs first
```

### Step 3: Implement Early Exit Logic

When syntax errors are detected, prevent cascading errors:
```typescript
if (hasCriticalSyntaxErrors(context.astDiagnostics)) {
  // Return syntax errors only, skip other validators
  return convertSyntaxErrorsToResult(context);
}
```

### Step 4: Export Error Translator

Make it available for Monaco integration:
```typescript
// core/ast/index.ts
export { processParserError, translateParserError } from './error-translator';
```

## Expected Results

### Before
```
Valid: false
Errors:
  [PSV6-FUNCTION-RETURN-TYPE] Line 40: Function 'basisFrom' has inconsistent return types
  [PSV6-FUNCTION-RETURN-TYPE] Line 44: Function 'volFrom' has inconsistent return types
```

### After
```
Valid: false
Errors:
  [PSV6-SYNTAX-MISSING-PARAM] Line 33: Missing required 'defval' parameter in input.int()
  💡 input.int() requires a default value as the first parameter.
  Example: input.int(5, "Vol Smoothing EMA", minval=1)
```

## Testing

Create test cases for common syntax errors:

```typescript
// tests/specs/syntax-error-translation.spec.ts
describe('Syntax Error Translation', () => {
  it('detects empty parameter in input function', () => {
    const code = 'volSmooth = input.int(, "Label", minval=1)';
    const result = validator.validate(code);
    
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('PSV6-SYNTAX-MISSING-PARAM');
    expect(result.errors[0].message).toContain('Missing required');
    expect(result.errors[0].message).toContain('defval');
  });
  
  it('detects missing closing parenthesis', () => {
    const code = 'result = ta.sma(close, 20';
    // ... test
  });
});
```

## Benefits

✅ **Clear error messages** - Users know exactly what's wrong  
✅ **No cascading errors** - Only show the real problem  
✅ **Actionable suggestions** - Tell users how to fix it  
✅ **Better than TradingView** - More helpful than "Mismatched input"  
✅ **Faster debugging** - Fix syntax errors first, before type checking  

## Files Created

- ✅ `core/ast/error-translator.ts` - Translation logic
- ✅ `core/ast/syntax-error-processor.ts` - Diagnostic processor
- ✅ `modules/syntax-error-validator.ts` - Validator module
- ✅ `core/base-validator.ts` - Changed parser errors from warnings to errors

## Next Steps

1. **Integrate SyntaxErrorValidator** into module chain
2. **Add early exit logic** for syntax errors
3. **Test with real scripts** containing syntax errors
4. **Document** for users in README

