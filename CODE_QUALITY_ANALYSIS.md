# Code Quality Analysis Report

**Generated**: October 6, 2025

## Executive Summary

This comprehensive code quality analysis identifies key areas for improvement across the Pine Script validator codebase:

- **46 modules** with duplicated error handling code (126 instances)
- **Hundreds of magic string literals** instead of using the `Codes` enum
- **7 modules** with duplicated `isClearlyInvalid` logic
- **5 modules** with duplicated deduplication tracking (errorKeys, warningKeys, infoKeys Sets)
- Type system improvements needed for better type safety
- Namespace-specific solutions that should be centralized

---

## 1. CODE DUPLICATION ISSUES

### 1.1 Duplicated Error Handling Methods

**Impact**: High | **Effort**: Medium | **Priority**: P0

**Problem**: 46 modules implement their own `addError`, `addWarning`, and `addInfo` methods with nearly identical logic.

**Files Affected**: All validator modules in `/modules/`

**Example Duplication**:
```typescript
// Pattern repeated in 46 files:
private addError(line: number, column: number, message: string, code?: string, suggestion?: string): void {
  const key = `${line}:${column}:${code ?? 'error'}:${message}`;
  if (this.errorKeys.has(key)) {
    return;
  }
  this.errorKeys.add(key);
  this.errors.push({ line, column, message, severity: 'error', code, suggestion });
}
```

**Solution**: Create a shared `ValidationHelper` utility class with common error handling.

---

### 1.2 Duplicated `isClearlyInvalid` Logic

**Impact**: Medium | **Effort**: Low | **Priority**: P1

**Problem**: 7 modules implement their own `isClearlyInvalid` method with module-specific but structurally identical logic.

**Files Affected**:
- `ta-functions-validator.ts` (2 instances)
- `string-functions-validator.ts` (2 instances)
- `strategy-functions-validator.ts` (2 instances)
- `math-functions-validator.ts` (2 instances)
- `map-validator.ts` (2 instances)
- `drawing-functions-validator.ts` (2 instances)
- `input-functions-validator.ts` (2 instances)

**Example**:
```typescript
// Repeated pattern:
private isClearlyInvalid(message: string, code?: string): boolean {
  if (code === 'PSV6-TA-FUNCTION-PARAM') return true;
  if (code === 'PSV6-FUNCTION-PARAM-TYPE') return true;
  if (code === 'PSV6-FUNCTION-PARAM-COUNT') return true;
  // ... module-specific codes
  return false;
}
```

**Solution**: Create a centralized error severity classification system based on code categories.

---

### 1.3 Duplicated Deduplication Logic

**Impact**: Medium | **Effort**: Low | **Priority**: P1

**Problem**: 5 modules maintain their own `errorKeys`, `warningKeys`, and `infoKeys` Sets for deduplication.

**Files Affected**:
- `function-validator.ts`
- `final-constants-validator.ts`
- `udt-validator.ts`
- `map-validator.ts`
- `time-date-functions-validator.ts`

**Solution**: Centralize deduplication logic in the shared helper.

---

## 2. MAGIC STRINGS AND CONSTANTS

### 2.1 Magic String Error Codes

**Impact**: High | **Effort**: Low | **Priority**: P0

**Problem**: Hundreds of hardcoded error code strings like `'PSV6-TA-FUNCTION-PARAM'` instead of using the `Codes` enum.

**Current State**:
- `Codes` enum exists in `/core/codes.ts` with ~50 codes
- Only 3 modules import and use `Codes`: `strategy-functions-validator.ts`, `final-constants-validator.ts`, `builtin-variables-validator.ts`
- 43+ modules use hardcoded string literals

**Examples of Magic Strings**:
```typescript
// Should use Codes.TA_FUNCTION_PARAM
this.addError(line, col, msg, 'PSV6-TA-FUNCTION-PARAM');

// Should use Codes.FUNCTION_PARAM_TYPE  
this.addError(line, col, msg, 'PSV6-FUNCTION-PARAM-TYPE');

// Should use Codes.FUNCTION_PARAM_COUNT
this.addError(line, col, msg, 'PSV6-FUNCTION-PARAM-COUNT');
```

**Missing Codes** (need to be added to `Codes` enum):
- `PSV6-TA-FUNCTION-PARAM`
- `PSV6-TA-FUNCTION-UNKNOWN`
- `PSV6-TA-INVALID`
- `PSV6-TA-PERF-NESTED`
- `PSV6-TA-PERF-MANY`
- `PSV6-TA-PERF-LOOP`
- `PSV6-TA-CACHE-SUGGESTION`
- `PSV6-TA-PARAM-SUGGESTION`
- `PSV6-TA-COMBINATION-SUGGESTION`
- `PSV6-STR-UNKNOWN-FUNCTION`
- `PSV6-STR-FORMAT-INVALID`
- `PSV6-STR-CONVERSION-INVALID`
- `PSV6-FUNCTION-PARAM-TYPE`
- `PSV6-FUNCTION-PARAM-COUNT`
- `PSV6-FUNCTION-RETURN-TYPE`
- `PSV6-MAP-DECLARATION`
- `PSV6-MAP-OPERATION-NON-MAP`
- `PSV6-MAP-METHOD-PARAMS`
- `PSV6-MAP-TYPE-MISMATCH`
- `PSV6-MAP-VALUE-TYPE-MISMATCH`
- `PSV6-SYMINFO-USAGE`
- `PSV6-SYMINFO-COMPANY`
- `PSV6-SYMINFO-RECOMMENDATIONS`
- `PSV6-SYMINFO-TARGET-PRICE`
- `PSV6-FINANCIAL-DATA-USAGE`
- `PSV6-CONSTANTS-USAGE`
- And ~50+ more...

**Solution**: 
1. Extend `Codes` enum with all missing codes
2. Create migration script to replace all magic strings
3. Add linting rule to prevent future magic strings

---

### 2.2 Magic Numbers

**Impact**: Low | **Effort**: Low | **Priority**: P2

**Problem**: Some hardcoded numeric values that should be named constants.

**Examples**:
```typescript
// base-validator.ts:36
const DEFAULT_AST_FILENAME = 'input.pine';  // Good

// Various modules
if (params.length !== 3) { ... }  // Could be MIN_PARAMS constant
```

**Solution**: Extract significant magic numbers to named constants.

---

## 3. TYPE SYSTEM IMPROVEMENTS

### 3.1 Optional Parameters Inconsistency

**Impact**: Medium | **Effort**: Medium | **Priority**: P1

**Problem**: Inconsistent handling of optional parameters in error handling methods.

**Examples**:
```typescript
// Some modules:
private addError(line: number, column: number, message: string, code?: string, suggestion?: string)

// Some modules:
private addError(line: number, column: number, message: string, code: string) // code required

// Some modules:
private addError(line: number, column: number, code: string, message: string) // parameter order different
```

**Solution**: Standardize method signature with consistent optional parameters.

---

### 3.2 Missing Type Exports

**Impact**: Low | **Effort**: Low | **Priority**: P2

**Problem**: Some internal types that could be useful are not exported.

**Solution**: Review and export reusable internal types.

---

### 3.3 Loose Type Definitions

**Impact**: Medium | **Effort**: Medium | **Priority**: P1

**Problem**: Some type definitions use `any` or are too permissive.

**Examples**:
```typescript
// Should be more specific
private astContext: AstValidationContext | null = null;  // Good

// Could be improved with discriminated unions
type ValidationError  // Add discriminated union by code type
```

**Solution**: Strengthen type definitions with literal types and discriminated unions.

---

## 4. REDUNDANT CODE

### 4.1 Redundant Module Result Building

**Impact**: Low | **Effort**: Low | **Priority**: P2

**Problem**: Every module manually builds the result object with identical structure.

**Example**:
```typescript
// Repeated in every module:
return {
  isValid: this.errors.length === 0,
  errors: this.errors,
  warnings: this.warnings,
  info: this.info,
  typeMap: context.typeMap,
  scriptType: context.scriptType,
};
```

**Solution**: Create `buildModuleResult()` helper method.

---

### 4.2 Redundant AST Context Checks

**Impact**: Low | **Effort**: Low | **Priority**: P2

**Problem**: Similar AST context checking code repeated across modules.

**Example**:
```typescript
// Repeated pattern:
private getAstContext(config: ValidatorConfig): AstValidationContext | null {
  if (!config.ast || config.ast.mode === 'disabled') {
    return null;
  }
  return this.context as AstValidationContext;
}
```

**Solution**: This already exists as `ensureAstContext()` in `core/ast/context-utils.ts` - promote its usage.

---

## 5. CONSOLIDATION OPPORTUNITIES

### 5.1 Function Parameter Validation

**Impact**: High | **Effort**: High | **Priority**: P1

**Problem**: Parameter validation logic is scattered across multiple modules with similar patterns.

**Affected Areas**:
- TA functions (ta-functions-validator.ts)
- String functions (string-functions-validator.ts)
- Math functions (math-functions-validator.ts)
- Drawing functions (drawing-functions-validator.ts)
- Input functions (input-functions-validator.ts)

**Pattern**:
```typescript
// Repeated pattern for parameter validation:
1. Check parameter count
2. Check parameter types
3. Check parameter value ranges
4. Generate appropriate error codes
```

**Solution**: Create a shared `FunctionParameterValidator` utility that can be configured per function.

---

### 5.2 AST Traversal Patterns

**Impact**: Medium | **Effort**: Medium | **Priority**: P1

**Problem**: Similar AST traversal patterns repeated with minor variations.

**Common Patterns**:
- Finding call expressions
- Extracting identifiers
- Finding parent declarations
- Type annotation extraction

**Solution**: Create reusable traversal helper functions in `core/ast/traversal.ts`.

---

### 5.3 Constant Set Definitions

**Impact**: Low | **Effort**: Low | **Priority**: P2

**Problem**: Similar constant set definitions scattered across modules.

**Examples**:
```typescript
// array-validator.ts
const VALID_ARRAY_ELEMENT_TYPES = new Set([...]);

// matrix-validator.ts  
const VALID_MATRIX_ELEMENT_TYPES = new Set([...]);

// map-validator.ts
const VALID_MAP_KEY_TYPES = new Set([...]);
```

**Solution**: Consolidate type validation constants in a shared location.

---

## 6. NAMESPACE-SPECIFIC VS GLOBAL SOLUTIONS

### 6.1 Namespace Member Validation

**Impact**: High | **Effort**: High | **Priority**: P0

**Problem**: Some validators handle namespace validation locally instead of using the global `namespace-members.ts` registry.

**Examples**:
- Array methods defined locally in `array-validator.ts`
- Matrix methods defined locally in `matrix-validator.ts`
- Map methods defined locally in `map-validator.ts`

**Ideal State**: All namespace members should be registered in `/core/namespace-members.ts` for centralized validation.

**Solution**: 
1. Audit all namespace definitions
2. Move local definitions to `namespace-members.ts`
3. Update validators to use central registry

---

### 6.2 Type Checking Logic

**Impact**: Medium | **Effort**: Medium | **Priority**: P1

**Problem**: Some modules implement their own type checking instead of using the global type system.

**Example**: Custom type inference in specific validators that could use `core/ast/type-inference.ts`.

**Solution**: Consolidate type checking to use the centralized type inference system.

---

## 7. ARCHITECTURAL IMPROVEMENTS

### 7.1 Create Shared Validation Helper

**Priority**: P0

Create `/core/validation-helper.ts`:

```typescript
export class ValidationHelper {
  private errorKeys = new Set<string>();
  private warningKeys = new Set<string>();
  private infoKeys = new Set<string>();
  
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];

  addError(line: number, column: number, message: string, code: Code, suggestion?: string): void {
    // Centralized implementation
  }

  addWarning(line: number, column: number, message: string, code: Code, suggestion?: string): void {
    // Centralized implementation
  }

  addInfo(line: number, column: number, message: string, code: Code, suggestion?: string): void {
    // Centralized implementation
  }

  buildResult(context: ValidationContext): ValidationResult {
    // Centralized result building
  }

  reset(): void {
    // Centralized reset
  }
}
```

---

### 7.2 Create Error Severity Classifier

**Priority**: P1

Create `/core/error-classifier.ts`:

```typescript
export class ErrorSeverityClassifier {
  static isCriticalError(code: Code): boolean {
    // Centralized logic for determining error severity
  }
  
  static shouldCascadeError(code: Code): boolean {
    // Determine if error should stop further validation
  }
}
```

---

### 7.3 Extend Codes Enum

**Priority**: P0

Extend `/core/codes.ts` with all missing error codes and organize by category:

```typescript
export const Codes = {
  // ... existing codes ...
  
  // TA Function codes
  TA_FUNCTION_PARAM: 'PSV6-TA-FUNCTION-PARAM',
  TA_FUNCTION_UNKNOWN: 'PSV6-TA-FUNCTION-UNKNOWN',
  TA_INVALID: 'PSV6-TA-INVALID',
  TA_PERF_NESTED: 'PSV6-TA-PERF-NESTED',
  TA_PERF_MANY: 'PSV6-TA-PERF-MANY',
  TA_PERF_LOOP: 'PSV6-TA-PERF-LOOP',
  
  // String function codes
  STR_UNKNOWN_FUNCTION: 'PSV6-STR-UNKNOWN-FUNCTION',
  STR_FORMAT_INVALID: 'PSV6-STR-FORMAT-INVALID',
  STR_CONVERSION_INVALID: 'PSV6-STR-CONVERSION-INVALID',
  
  // Generic function codes
  FUNCTION_PARAM_TYPE: 'PSV6-FUNCTION-PARAM-TYPE',
  FUNCTION_PARAM_COUNT: 'PSV6-FUNCTION-PARAM-COUNT',
  FUNCTION_RETURN_TYPE: 'PSV6-FUNCTION-RETURN-TYPE',
  
  // Map codes
  MAP_DECLARATION: 'PSV6-MAP-DECLARATION',
  MAP_OPERATION_NON_MAP: 'PSV6-MAP-OPERATION-NON-MAP',
  MAP_METHOD_PARAMS: 'PSV6-MAP-METHOD-PARAMS',
  MAP_TYPE_MISMATCH: 'PSV6-MAP-TYPE-MISMATCH',
  MAP_VALUE_TYPE_MISMATCH: 'PSV6-MAP-VALUE-TYPE-MISMATCH',
  
  // ... and all other missing codes
} as const;
```

---

## 8. IMPLEMENTATION PLAN

### Phase 1: Foundation (P0 - Critical)
1. ✅ Create comprehensive analysis document (this file)
2. Extend `Codes` enum with all error codes
3. Create `ValidationHelper` utility class
4. Create migration script for magic strings

### Phase 2: Module Updates (P0 - Critical)
1. Update all modules to use `Codes` enum
2. Update all modules to use `ValidationHelper`
3. Run full test suite to ensure no regression

### Phase 3: Consolidation (P1 - High Priority)
1. Consolidate namespace definitions
2. Create `FunctionParameterValidator` utility
3. Standardize type definitions
4. Create `ErrorSeverityClassifier`

### Phase 4: Cleanup (P2 - Nice to Have)
1. Remove redundant code
2. Extract magic numbers
3. Add documentation
4. Add linting rules to prevent regression

---

## 9. TESTING STRATEGY

### Regression Prevention
- Run full test suite after each phase
- Monitor for:
  - Changed error counts
  - Missing error codes
  - Changed error messages
  - Type errors

### Test Coverage
- Ensure all refactored code maintains existing test coverage
- Add new tests for shared utilities
- Add integration tests for end-to-end validation

---

## 10. METRICS

### Before Refactoring
- **46 modules** with duplicated error handling (126 instances)
- **43+ modules** using magic strings
- **7 modules** with duplicated `isClearlyInvalid`
- **5 modules** with duplicated deduplication logic
- **~100+ unique error codes** (estimated)

### After Refactoring (Target)
- **1 shared** `ValidationHelper` class
- **0 magic strings** (all use `Codes` enum)
- **1 centralized** error severity classifier
- **1 centralized** deduplication system
- **100% test coverage** maintained

### Expected Benefits
- **Reduced code duplication**: ~80% reduction in error handling code
- **Improved maintainability**: Single source of truth for error codes
- **Better type safety**: Compile-time checking of error codes
- **Easier debugging**: Centralized error handling logic
- **Faster development**: Reusable utilities for new validators

---

## 11. RISK ASSESSMENT

### Low Risk
- Adding new codes to `Codes` enum (non-breaking)
- Creating new utility classes (additive)
- Extracting constants (refactoring)

### Medium Risk
- Changing module implementations (requires testing)
- Updating error handling logic (may affect error messages)

### High Risk
- None identified (incremental approach minimizes risk)

### Mitigation
- Incremental rollout by phase
- Comprehensive test suite after each change
- Code review for each phase
- Backup strategy: feature flags for new utilities

---

## CONCLUSION

This codebase is well-structured overall but has significant opportunities for improvement through:

1. **Eliminating duplication** of error handling code
2. **Replacing magic strings** with the `Codes` enum
3. **Centralizing** common validation logic
4. **Strengthening** type safety
5. **Consolidating** namespace-specific solutions

The proposed refactoring will improve maintainability, reduce bugs, and make the codebase easier to extend while maintaining 100% test coverage and ensuring no regressions.

**Estimated Effort**: 
- Phase 1-2: 2-3 days
- Phase 3-4: 1-2 days
- **Total: 3-5 days**

**Expected Impact**: High - significant improvement in code quality and maintainability
