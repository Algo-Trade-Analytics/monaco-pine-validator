# Module Refactoring Migration Guide

This guide shows how to refactor validator modules to use the new shared `ValidationHelper` and `Codes` enum, eliminating code duplication and magic strings.

## Overview of Changes

1. **Use `Codes` enum** instead of magic strings for error codes
2. **Use `ValidationHelper`** instead of duplicated error handling methods
3. **Remove duplicated** `isClearlyInvalid` logic (use `ErrorSeverityClassifier` if needed)
4. **Remove duplicated** deduplication Sets (`errorKeys`, `warningKeys`, `infoKeys`)

## Step-by-Step Migration

### Step 1: Add Imports

**Before:**
```typescript
import {
  type ValidationModule,
  type ValidationContext,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
```

**After:**
```typescript
import {
  type ValidationModule,
  type ValidationContext,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper, ErrorSeverityClassifier } from '../core/validation-helper';
```

---

### Step 2: Replace Private Fields

**Before:**
```typescript
export class MyValidator implements ValidationModule {
  name = 'MyValidator';
  
  private errors: Array<{ line: number; column: number; message: string; code: string }> = [];
  private warnings: Array<{ line: number; column: number; message: string; code: string }> = [];
  private info: Array<{ line: number; column: number; message: string; code: string }> = [];
  private errorKeys = new Set<string>();
  private warningKeys = new Set<string>();
  private infoKeys = new Set<string>();
  // ... other fields
}
```

**After:**
```typescript
export class MyValidator implements ValidationModule {
  name = 'MyValidator';
  
  private helper = new ValidationHelper();
  // ... other fields (no more error arrays or key sets!)
}
```

---

### Step 3: Replace `addError/addWarning/addInfo` Methods

**Before:**
```typescript
private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
  const key = `${line}:${column}:${code ?? 'error'}:${message}`;
  if (this.errorKeys.has(key)) {
    return;
  }
  this.errorKeys.add(key);
  this.errors.push({ line, column, message, severity: 'error', code, suggestion });
}

private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
  const key = `${line}:${column}:${code ?? 'warning'}:${message}`;
  if (this.warningKeys.has(key)) {
    return;
  }
  this.warningKeys.add(key);
  this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
}

private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
  const key = `${line}:${column}:${code ?? 'info'}:${message}`;
  if (this.infoKeys.has(key)) {
    return;
  }
  this.infoKeys.add(key);
  this.info.push({ line, column, message, severity: 'info', code, suggestion });
}
```

**After:**
```typescript
// DELETE these methods entirely! Use this.helper instead
```

---

### Step 4: Replace Method Calls

**Before:**
```typescript
this.addError(line, column, 'Unknown function', 'PSV6-FUNCTION-UNKNOWN');
this.addWarning(line, column, 'Performance issue', 'PSV6-PERF-WARNING');
this.addInfo(line, column, 'Usage info', 'PSV6-INFO');
```

**After:**
```typescript
this.helper.addError(line, column, 'Unknown function', Codes.FUNCTION_UNKNOWN);
this.helper.addWarning(line, column, 'Performance issue', Codes.PERF_WARNING);
this.helper.addInfo(line, column, 'Usage info', Codes.INFO);
```

---

### Step 5: Replace `isClearlyInvalid` Logic

**Before:**
```typescript
private isClearlyInvalid(message: string, code?: string): boolean {
  if (code === 'PSV6-FUNCTION-PARAM-TYPE') return true;
  if (code === 'PSV6-FUNCTION-PARAM-COUNT') return true;
  if (code === 'PSV6-FUNCTION-UNKNOWN') return true;
  return false;
}

// Usage:
if (this.isClearlyInvalid(message, code)) {
  this.addError(line, column, message, code);
} else {
  this.addWarning(line, column, message, code);
}
```

**After:**
```typescript
// Option 1: Use the helper's addByCode method with ErrorSeverityClassifier
this.helper.addByCode(
  line, 
  column, 
  message, 
  code, 
  suggestion, 
  ErrorSeverityClassifier.isCriticalError
);

// Option 2: Check severity explicitly
if (ErrorSeverityClassifier.isCriticalError(code)) {
  this.helper.addError(line, column, message, code);
} else {
  this.helper.addWarning(line, column, message, code);
}
```

---

### Step 6: Replace `reset` Method

**Before:**
```typescript
private reset(): void {
  this.errors = [];
  this.warnings = [];
  this.info = [];
  this.errorKeys.clear();
  this.warningKeys.clear();
  this.infoKeys.clear();
  // ... reset other fields
}
```

**After:**
```typescript
private reset(): void {
  this.helper.reset();
  // ... reset other fields
}
```

---

### Step 7: Replace `buildResult` Method

**Before:**
```typescript
private buildModuleResult(scriptType: ValidationContext['scriptType']): ValidationResult {
  const typeMap = new Map(this.context.typeMap);
  return {
    isValid: this.errors.length === 0,
    errors: this.errors,
    warnings: this.warnings,
    info: this.info,
    typeMap,
    scriptType,
  };
}
```

**After:**
```typescript
private buildModuleResult(scriptType: ValidationContext['scriptType']): ValidationResult {
  // Simply use the helper
  return this.helper.buildResult(this.context);
}
```

---

### Step 8: Replace Magic String Error Codes

Find and replace all magic string codes with `Codes` enum values:

**Before:**
```typescript
this.addError(line, col, msg, 'PSV6-TA-FUNCTION-PARAM');
this.addError(line, col, msg, 'PSV6-FUNCTION-PARAM-TYPE');
this.addWarning(line, col, msg, 'PSV6-TA-PERF-NESTED');
```

**After:**
```typescript
this.helper.addError(line, col, msg, Codes.TA_FUNCTION_PARAM);
this.helper.addError(line, col, msg, Codes.FUNCTION_PARAM_TYPE);
this.helper.addWarning(line, col, msg, Codes.TA_PERF_NESTED);
```

---

## Complete Example

### Before (Old Pattern)

```typescript
import {
  type ValidationModule,
  type ValidationContext,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';

export class ExampleValidator implements ValidationModule {
  name = 'ExampleValidator';
  
  private errors: Array<{ line: number; column: number; message: string; code: string }> = [];
  private warnings: Array<{ line: number; column: number; message: string; code: string }> = [];
  private info: Array<{ line: number; column: number; message: string; code: string }> = [];
  private errorKeys = new Set<string>();
  private warningKeys = new Set<string>();
  private infoKeys = new Set<string>();
  private context!: ValidationContext;

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    
    // Validation logic...
    this.addError(1, 1, 'Unknown function', 'PSV6-FUNCTION-UNKNOWN');
    this.addWarning(2, 1, 'Performance issue', 'PSV6-PERF-WARNING');
    
    return this.buildResult();
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.errorKeys.clear();
    this.warningKeys.clear();
    this.infoKeys.clear();
  }

  private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    const key = `${line}:${column}:${code ?? 'error'}:${message}`;
    if (this.errorKeys.has(key)) return;
    this.errorKeys.add(key);
    this.errors.push({ line, column, message, severity: 'error', code, suggestion });
  }

  private addWarning(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    const key = `${line}:${column}:${code ?? 'warning'}:${message}`;
    if (this.warningKeys.has(key)) return;
    this.warningKeys.add(key);
    this.warnings.push({ line, column, message, severity: 'warning', code, suggestion });
  }

  private addInfo(line: number, column: number, message: string, code?: string, suggestion?: string): void {
    const key = `${line}:${column}:${code ?? 'info'}:${message}`;
    if (this.infoKeys.has(key)) return;
    this.infoKeys.add(key);
    this.info.push({ line, column, message, severity: 'info', code, suggestion });
  }

  private buildResult(): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: this.context.typeMap,
      scriptType: this.context.scriptType,
    };
  }

  private isClearlyInvalid(message: string, code?: string): boolean {
    if (code === 'PSV6-FUNCTION-PARAM-TYPE') return true;
    if (code === 'PSV6-FUNCTION-UNKNOWN') return true;
    return false;
  }
}
```

### After (New Pattern)

```typescript
import {
  type ValidationModule,
  type ValidationContext,
  type ValidationResult,
  type ValidatorConfig,
} from '../core/types';
import { Codes } from '../core/codes';
import { ValidationHelper, ErrorSeverityClassifier } from '../core/validation-helper';

export class ExampleValidator implements ValidationModule {
  name = 'ExampleValidator';
  
  private helper = new ValidationHelper();
  private context!: ValidationContext;

  getDependencies(): string[] {
    return [];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.helper.reset();
    this.context = context;
    
    // Validation logic...
    this.helper.addError(1, 1, 'Unknown function', Codes.FUNCTION_UNKNOWN);
    this.helper.addWarning(2, 1, 'Performance issue', Codes.PERF_WARNING);
    
    return this.helper.buildResult(context);
  }
}
```

**Code reduction**: From ~80 lines to ~25 lines (~70% reduction!)

---

## Checklist for Migration

For each module, verify:

- [ ] Added `import { Codes } from '../core/codes'`
- [ ] Added `import { ValidationHelper, ErrorSeverityClassifier } from '../core/validation-helper'`
- [ ] Replaced error/warning/info arrays with `private helper = new ValidationHelper()`
- [ ] Removed `errorKeys`, `warningKeys`, `infoKeys` Sets
- [ ] Removed `addError`, `addWarning`, `addInfo` methods
- [ ] Removed `isClearlyInvalid` method
- [ ] Simplified `reset` method
- [ ] Simplified `buildResult` method
- [ ] Replaced all `'PSV6-*'` magic strings with `Codes.*`
- [ ] Updated all `this.addError` calls to `this.helper.addError`
- [ ] Updated all `this.addWarning` calls to `this.helper.addWarning`
- [ ] Updated all `this.addInfo` calls to `this.helper.addInfo`
- [ ] Verified tests still pass

---

## Testing After Migration

After migrating each module, run:

```bash
# Run module-specific tests
npm test -- <module-name>.test.ts

# Run all tests
npm test

# Run validator tests
npm test -- vitest.validator.config.ts
```

Ensure:
- All tests pass
- Error counts match previous implementation
- Error messages are identical
- No regressions in coverage

---

## Benefits of Migration

1. **~70% code reduction** in error handling boilerplate
2. **Type safety** for error codes (compile-time checking)
3. **Consistency** across all modules
4. **Easier maintenance** - single source of truth
5. **Prevents bugs** - no typos in error codes
6. **Better IDE support** - autocomplete for error codes
7. **Easier testing** - consistent error handling

---

## Common Pitfalls

### Pitfall 1: Forgetting to Reset Helper

**Wrong:**
```typescript
validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
  // Missing: this.helper.reset();
  this.context = context;
  // ...
}
```

**Correct:**
```typescript
validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
  this.helper.reset(); // Always reset first!
  this.context = context;
  // ...
}
```

### Pitfall 2: Using Magic Strings

**Wrong:**
```typescript
this.helper.addError(line, col, msg, 'PSV6-FUNCTION-UNKNOWN');
```

**Correct:**
```typescript
this.helper.addError(line, col, msg, Codes.FUNCTION_UNKNOWN);
```

### Pitfall 3: Direct Array Access

**Wrong:**
```typescript
if (this.errors.length > 0) { ... } // this.errors doesn't exist anymore!
```

**Correct:**
```typescript
if (this.helper.hasErrors()) { ... }
// or
if (this.helper.getErrorCount() > 0) { ... }
```

---

## Migration Order (Recommended)

Migrate modules in this order to minimize risk:

1. **Small utility validators** (easy, low risk)
   - `style-validator.ts`
   - `varip-validator.ts`
   - `enum-validator.ts`

2. **Medium complexity validators** (moderate risk)
   - `string-functions-validator.ts`
   - `math-functions-validator.ts`
   - `time-date-functions-validator.ts`

3. **Complex validators** (higher risk, test thoroughly)
   - `ta-functions-validator.ts`
   - `strategy-functions-validator.ts`
   - `dynamic-data-validator.ts`

4. **Core validators** (highest risk, extensive testing needed)
   - `core-validator.ts`
   - `type-validator.ts`
   - `function-validator.ts`

---

## Automated Migration Script

For bulk migration, use this regex find/replace pattern in your editor:

### Find:
```regex
this\.add(Error|Warning|Info)\((.*?),\s*'(PSV6-[A-Z-]+)'
```

### Replace:
```
this.helper.add$1($2, Codes.$3
```

Note: This is a starting point - manual review is required for each replacement!

---

## Questions?

If you encounter issues during migration:
1. Check this guide for common patterns
2. Look at already-migrated modules as examples
3. Verify the error code exists in `Codes` enum
4. Run tests frequently to catch issues early
