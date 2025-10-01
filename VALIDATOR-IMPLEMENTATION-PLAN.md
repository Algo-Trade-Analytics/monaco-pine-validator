# Validator Implementation Plan for New Tests

**Date**: September 30, 2025  
**Status**: Analysis Complete - Implementation Needed

## Test Suite Status

### Overall Results
- **Total Tests**: 1,435
- **Passed**: 1,280 (89%)  
- **Failed**: 155 (11%)
- **Status**: 🟡 Good baseline, needs implementation

---

## What Already Works ✅

### 1. Plot Functions (plot-functions-validation.spec.ts)
**Status**: Likely **PASSING** - most plot() calls are basic function validation  
**Reason**: `FunctionValidator` and `DrawingFunctionsValidator` handle these

### 2. Box Functions (box-utility-functions-validation.spec.ts)
**Status**: Likely **PASSING** - box.* functions validated by `DrawingFunctionsValidator`  
**Reason**: Drawing module covers box creation and manipulation

### 3. Line Functions (line-utility-functions-validation.spec.ts)
**Status**: Likely **PASSING** - line.* functions validated by `DrawingFunctionsValidator`  
**Reason**: Drawing module covers line operations

### 4. Label Functions (label-utility-functions-validation.spec.ts)
**Status**: Likely **PASSING** - label.* functions validated by `DrawingFunctionsValidator`  
**Reason**: Drawing module covers label operations

---

## What Needs Implementation ❌

### 1. Built-in Variables Validator - Specialized Constants Info Messages

**Problem**: Tests expect INFO messages for specialized constant usage  
**File**: `modules/builtin-variables-validator.ts`  
**Tests Affected**: ~20-30 tests in `builtin-variables-validation.spec.ts`

**Expected Info Codes**:
- `PSV6-TIMEFRAME-CONSTANT` - When timeframe.* constants detected
- `PSV6-DISPLAY-CONSTANT` - When display.* constants detected
- `PSV6-EXTEND-CONSTANT` - When extend.* constants detected
- `PSV6-FORMAT-CONSTANT` - When format.* constants detected
- `PSV6-CURRENCY-CONSTANT` - When currency.* constants detected
- `PSV6-CURRENCY-USAGE` - When currency used in strategy()
- `PSV6-SCALE-CONSTANT` - When scale.* constants detected
- `PSV6-SCALE-USAGE` - When scale used in indicator()
- `PSV6-ADJUSTMENT-CONSTANT` - When adjustment.* constants detected
- `PSV6-ADJUSTMENT-USAGE` - When adjustment used in ticker.new()
- `PSV6-BACKADJUSTMENT-CONSTANT` - When backadjustment.* constants detected
- `PSV6-DISPLAY-USAGE` - When display used in plot functions
- `PSV6-BUILTIN-VARS-INFO` - Summary info for scripts using specialized constants

**Current Status**: 
- ✅ Validator exists (`BuiltinVariablesValidator`)
- ✅ Constants defined (TIMEFRAME_CONSTANTS, DISPLAY_CONSTANTS, etc.)
- ❌ **Missing**: Info message emission logic
- ❌ **Missing**: Usage tracking and reporting

**Implementation Needed**:
```typescript
// In BuiltinVariablesValidator.validate()
// After detecting constants, emit info messages like:

if (this.timeframeConstantUsage.size > 0) {
  this.addInfo(
    1, 0,
    `Detected ${this.timeframeConstantUsage.size} timeframe constant(s)`,
    'PSV6-TIMEFRAME-CONSTANT'
  );
}

if (this.displayConstantUsage.size > 0) {
  this.addInfo(
    1, 0,
    `Detected ${this.displayConstantUsage.size} display constant(s)`,
    'PSV6-DISPLAY-CONSTANT'
  );
}

// ... similar for other constant types
```

---

### 2. Constants & Enums Validator - Position/Location Constants

**Problem**: Tests expect validation of position.* and location.* constants  
**File**: `modules/final-constants-validator.ts` or new module  
**Tests Affected**: ~10-20 tests in `constants-enums-validation.spec.ts`

**Missing Validation**:
- `position.top_left`, `position.top_right`, etc.
- `location.absolute`, `location.abovebar`, etc.
- `xloc.bar_index`, `xloc.bar_time`
- Invalid constant errors

**Implementation Status**: Unknown - need to check if `FinalConstantsValidator` handles these

---

### 3. Matrix/Input/Other Validators - Integration Tests

**Problem**: Complex integration tests failing  
**Files**: Various validators  
**Tests Affected**: ~10-20 tests

**Examples**:
- Matrix complex workflows
- Input comprehensive configuration
- Type inference with matrices

**Likely Cause**: Edge cases or complex scenarios not covered

---

## Implementation Priority

### HIGH PRIORITY (Immediate)

#### Task 1: Fix BuiltinVariablesValidator Info Messages
**Estimated Time**: 1-2 hours  
**Impact**: Fixes ~20-30 tests  
**Complexity**: Low

**Steps**:
1. Review `modules/builtin-variables-validator.ts` line 100-200
2. Add info message emission after constant detection
3. Ensure proper usage tracking
4. Test with `builtin-variables-validation.spec.ts`

---

### MEDIUM PRIORITY (Next)

#### Task 2: Review Constants Validator
**Estimated Time**: 1 hour  
**Impact**: Fixes ~10-20 tests  
**Complexity**: Low

**Steps**:
1. Check `modules/final-constants-validator.ts`
2. Verify position.*, location.*, xloc.* constants
3. Add any missing validations
4. Test with `constants-enums-validation.spec.ts`

---

### LOW PRIORITY (Polish)

#### Task 3: Fix Integration Test Edge Cases
**Estimated Time**: 2-3 hours  
**Impact**: Fixes ~10-20 tests  
**Complexity**: Medium

**Steps**:
1. Run specific failing integration tests
2. Debug root cause
3. Fix edge cases
4. Verify no regressions

---

## Quick Win Strategy

**Goal**: Get to 95%+ pass rate quickly

1. **Immediate**: Fix `BuiltinVariablesValidator` info messages (30 tests)
2. **Next**: Review constants validation (20 tests)
3. **Polish**: Fix remaining edge cases (10 tests)

**Expected Final Pass Rate**: ~95-97% (1360-1390 / 1435 tests)

---

## Command to Test Specific Suites

```bash
# Test only built-in variables
npm run test:validator:full -- --grep "Built-in Variables"

# Test only constants
npm run test:validator:full -- --grep "Constants & Enums"

# Test specific failing tests
npm run test:validator:full -- --grep "PSV6-TIMEFRAME-CONSTANT"
```

---

## Next Steps

1. ✅ Analyze test failures (complete)
2. ⏭️ Implement BuiltinVariablesValidator info messages
3. ⏭️ Review constants validator
4. ⏭️ Run full test suite
5. ⏭️ Fix remaining edge cases

---

**Status**: Ready to implement  
**Recommendation**: Start with BuiltinVariablesValidator (quick win, high impact)

