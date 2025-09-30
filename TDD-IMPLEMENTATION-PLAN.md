# TDD Implementation Plan - API Coverage Gaps

## TDD Approach

Following Test-Driven Development:
1. ✍️ **Write Tests First** (RED) - Tests that fail
2. ✅ **Implement Validators** (GREEN) - Make tests pass
3. ♻️ **Refactor** (REFACTOR) - Clean up code

## Priority Order

### Phase 1: Critical Gaps (HIGH PRIORITY)
1. **Matrix Functions** (41 functions, 84% gap)
2. **Strategy Properties** (37 properties, 79% gap)

### Phase 2: Important Features (MEDIUM PRIORITY)
3. **Chart Functions** (4 functions, 100% gap)
4. **Array Utilities** (29 functions, 53% gap)
5. **Constants Validation** (112 constants, 49% gap)

### Phase 3: Polish (LOW PRIORITY)
6. **Drawing Functions** (39 functions across box/line/label)
7. **Remaining TA Functions** (12 functions)
8. **Remaining Input Functions** (3 functions)

## Implementation Structure

Each module will follow this structure:
```
tests/specs/
  └── [feature]-validation.spec.ts    ← TDD tests (write first)

modules/
  └── [feature]-validator.ts          ← Implementation (write second)
```

## Test Coverage Tracking

We'll track progress using:
- Test file line counts
- Function coverage percentages
- Validator module completeness
- API alignment verification

## Phase 1 - Sprint 1: Matrix Functions

### Step 1.1: Create Matrix Test Suite ✍️ (TDD RED)
**File**: `tests/specs/matrix-functions-validation.spec.ts`

Test categories to cover:
1. Matrix Creation & Basic Operations (10 functions)
   - `matrix.new`, `matrix.copy`, `matrix.fill`
   - `matrix.columns`, `matrix.rows`, `matrix.elements_count`
   - `matrix.add_row`, `matrix.add_col`, `matrix.remove_row`, `matrix.remove_col`

2. Matrix Math Operations (12 functions)
   - `matrix.add`, `matrix.sub`, `matrix.mult`, `matrix.div`
   - `matrix.pow`, `matrix.sqrt`, `matrix.abs`
   - `matrix.sum`, `matrix.avg`, `matrix.median`
   - `matrix.min`, `matrix.max`

3. Matrix Statistics (8 functions)
   - `matrix.variance`, `matrix.stdev`, `matrix.covariance`
   - `matrix.mode`, `matrix.percentile_linear_interpolation`
   - `matrix.percentile_nearest_rank`

4. Matrix Linear Algebra (8 functions)
   - `matrix.det`, `matrix.inv`, `matrix.rank`
   - `matrix.eigenvalues`, `matrix.eigenvectors`
   - `matrix.transpose`, `matrix.pinv`

5. Matrix Transformations (3 functions)
   - `matrix.reshape`, `matrix.reverse`, `matrix.concat`

### Step 1.2: Implement Matrix Validator ✅ (TDD GREEN)
**File**: `modules/enhanced-matrix-validator.ts` (extend existing)

Implementation tasks:
- Add parameter validation for all 41 matrix functions
- Type checking for matrix operations
- Dimension validation (rows/columns)
- Return type validation
- Integration with type inference

### Step 1.3: Verify & Refactor ♻️
- Run tests: `npm test -- matrix-functions-validation.spec.ts`
- Ensure all tests pass
- Refactor for clarity and maintainability
- Update coverage metrics

## Phase 1 - Sprint 2: Strategy Properties

### Step 2.1: Create Strategy Properties Test Suite ✍️ (TDD RED)
**File**: `tests/specs/strategy-properties-validation.spec.ts`

Test categories:
1. Closed Trades Properties (24 properties)
   - Entry data: `entry_price`, `entry_time`, `entry_bar_index`, `entry_id`, `entry_comment`
   - Exit data: `exit_price`, `exit_time`, `exit_bar_index`, `exit_id`, `exit_comment`
   - Trade metrics: `profit`, `profit_percent`, `commission`, `size`, `direction`
   - Drawdown: `max_drawdown`, `max_runup`
   - And more...

2. Open Trades Properties (11 properties)
   - Current position: `entry_price`, `entry_time`, `entry_bar_index`
   - P&L: `profit`, `profit_percent`
   - Trade details: `entry_id`, `entry_comment`, `size`, `direction`

3. Strategy Metrics (2 properties)
   - `strategy.closedtrades.size()` - Count
   - `strategy.opentrades.size()` - Count

### Step 2.2: Extend Strategy Validator ✅ (TDD GREEN)
**File**: `modules/enhanced-strategy-validator.ts` (extend existing)

Implementation tasks:
- Add validation for strategy.closedtrades.* namespace
- Add validation for strategy.opentrades.* namespace
- Property access validation
- Type inference for strategy properties
- Error messages for misuse

### Step 2.3: Verify & Refactor ♻️
- Run tests: `npm test -- strategy-properties-validation.spec.ts`
- Ensure all tests pass
- Update existing strategy tests
- Update coverage metrics

## Phase 2 - Sprint 3: Chart Functions

### Step 3.1: Create Chart Functions Test Suite ✍️
**File**: `tests/specs/chart-functions-validation.spec.ts`

Test all 4 chart.point functions:
- `chart.point.new(time, price, ...)`
- `chart.point.now(price)`
- `chart.point.from_time(time)`
- `chart.point.from_index(bar_index)`

### Step 3.2: Create Chart Validator ✅
**File**: `modules/chart-validator.ts` (new module)

### Step 3.3: Verify & Refactor ♻️

## Phase 2 - Sprint 4: Array Utilities

### Step 4.1: Create Array Utilities Test Suite ✍️
**File**: `tests/specs/array-utilities-validation.spec.ts`

Test 29 missing functions across categories:
- Statistics: avg, variance, stdev, covariance, median, mode
- Search: binary_search, includes, indexof
- Manipulation: insert, remove, reverse, sort_indices
- Logic: every, some
- String: join
- Math: abs, min, max, sum

### Step 4.2: Extend Array Validator ✅
**File**: `modules/array-validator.ts` (extend existing)

### Step 4.3: Verify & Refactor ♻️

## Phase 2 - Sprint 5: Constants Validation

### Step 5.1: Create Constants Validation Test Suite ✍️
**File**: `tests/specs/constants-validation.spec.ts`

Focus on high-impact constants:
- currency.* (52 constants) - Currency codes
- shape.* (12 constants) - Label/marker shapes
- text.* (10 constants) - Text alignment

### Step 5.2: Create Constants Validator ✅
**File**: `modules/constants-validator.ts` (new module)

### Step 5.3: Verify & Refactor ♻️

## Progress Tracking

### Coverage Goals

| Phase | Functions | Variables | Constants | Overall |
|-------|-----------|-----------|-----------|---------|
| Current | 55.7% | 59.4% | 51.9% | 55.4% |
| After Phase 1 | 73% | 65% | 55% | 70% |
| After Phase 2 | 85% | 75% | 75% | 82% |
| Target | 90%+ | 80%+ | 80%+ | 88%+ |

### Implementation Checklist

#### Phase 1: Critical Gaps
- [ ] Matrix Functions Tests (41 tests)
- [ ] Matrix Validator Implementation
- [ ] Matrix Tests Passing
- [ ] Strategy Properties Tests (37 tests)
- [ ] Strategy Validator Extension
- [ ] Strategy Tests Passing

#### Phase 2: Important Features
- [ ] Chart Functions Tests (4 tests)
- [ ] Chart Validator Implementation
- [ ] Array Utilities Tests (29 tests)
- [ ] Array Validator Extension
- [ ] Constants Tests (74 tests)
- [ ] Constants Validator Implementation

#### Phase 3: Polish
- [ ] Drawing Functions Tests (39 tests)
- [ ] Drawing Validators Extension
- [ ] Remaining Functions Tests (15 tests)
- [ ] Remaining Validators Extension

## Success Criteria

Each sprint is considered complete when:
1. ✅ All tests written and initially failing (RED)
2. ✅ Validator implementation complete (GREEN)
3. ✅ All tests passing
4. ✅ Code refactored and clean
5. ✅ Documentation updated
6. ✅ Coverage metrics improved

## Next Steps

1. **Start with Matrix Functions** - Highest impact
2. Follow TDD strictly: Write tests → Implement → Refactor
3. Run full test suite after each module
4. Track coverage improvement
5. Document any API ambiguities or edge cases

---

**Ready to begin**: Start with Matrix Functions test suite creation

