# Parser Error Cascade Analysis

## The Problem

When you write:
```pine
volSmooth = input.int(, "Vol Smoothing EMA", minval=1, group=grpVol)
                      ^ Missing required parameter
```

### What SHOULD Happen ✅
```
ERROR: Missing required parameter 'defval' in input.int() call on line 33
```

### What ACTUALLY Happens ❌
```
ERROR: Function 'basisFrom' has inconsistent return types: string, int (line 40)
ERROR: Function 'volFrom' has inconsistent return types: float, string, int (line 44)
```

## Root Cause: Parser Failure

### Step 1: Parser Encounters Empty Parameter
```typescript
input.int(, "Vol Smoothing EMA", ...)
          ^ Parser tries to read expression here
          ^ Finds nothing (empty)
          ^ Creates malformed AST node
```

### Step 2: Malformed AST Propagates
The parser doesn't fail completely - it tries to recover and keep parsing, but:
- The `input.int()` call has a broken argument structure
- Subsequent code might be mis-parsed
- The AST is structurally invalid but "complete"

### Step 3: Type Inference Gets Confused
```typescript
// Type inference tries to analyze functions
basisFrom(srcSeries) =>
    _raw = basisType == "ALMA" ? ta.alma(...) : ta.ema(...)
    // But volSmooth is now undefined or has wrong type
    basisSmooth > 1 ? ta.ema(_raw, basisSmooth) : _raw
    //                               ^ Depends on volSmooth indirectly
```

The broken `volSmooth` definition causes:
- Type checker can't determine proper types
- Cascading type errors in functions that use values derived from inputs
- Bizarre "inconsistent return types" errors

## Why the Misleading Errors?

The validators run in order:
1. ✅ **Parser** - Creates AST (but with errors)
2. ✅ **Input Validator** - Should catch empty parameter, but...
   - The AST is so malformed it doesn't even recognize it as an input call
   - Or the parameter extraction fails silently
3. ❌ **Type Validator** - Tries to infer types from broken AST
   - Gets confused by undefined/wrong types
   - Reports "inconsistent return types" as symptoms of deeper problem
4. ❌ **Function Validator** - Analyzes return types
   - Also confused by broken type information
   - Reports false errors about `basisFrom` and `volFrom`

## The Fix Needed

### Priority 1: Better Parser Error Reporting
The parser should immediately detect and report:
```
ERROR: Expected expression but found ',' in function call
Line 33, Column 29: input.int(, "Vol Smoothing EMA", ...)
                             ^
```

### Priority 2: Early Validation Stop
If parser has critical errors, **stop subsequent validation**:
```typescript
if (astContext.astDiagnostics.some(d => d.severity === 'error')) {
  return {
    isValid: false,
    errors: parseDiagnosticsAsErrors(astContext.astDiagnostics),
    warnings: [],
    info: []
  };
}
```

### Priority 3: Input Validator Enhancement
Even if parser succeeds, validate argument count:
```typescript
private validateInputInt(args: string[], parameters: Map<string, string>, line: number, col: number): void {
  // Check for empty first argument
  if (args.length === 0 || args[0].trim() === '') {
    this.addError(line, col, 
      'Missing required parameter \'defval\' in input.int()', 
      'PSV6-INPUT-MISSING-PARAM');
    return;
  }
  // ... rest of validation
}
```

## TradingView Behavior

In TradingView, this code produces:
```
line 33: Syntax error at input ':='
         Cannot parse expression
```

TradingView's parser **immediately stops** and doesn't try to continue parsing or validating.

## Recommendation

**Implement early error detection:**

1. Parser should report empty parameter as syntax error
2. If syntax errors exist, stop all subsequent validation
3. Return only the parser/syntax errors to user
4. Don't run type inference or other validators on broken AST

This prevents:
- ❌ Cascading false errors
- ❌ Confusing error messages pointing to wrong lines
- ❌ User debugging code that's actually fine

And provides:
- ✅ Clear error at actual problem location
- ✅ Single, actionable error message
- ✅ Faster feedback (no wasted validation on broken code)

