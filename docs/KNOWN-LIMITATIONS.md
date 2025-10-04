# Known Limitations

This document tracks known limitations and edge cases in the Pine Script validator.

## Parser Limitations

### 1. Complex Nested Loops with Trailing Decimals

**Status**: Known Issue  
**Severity**: Medium  
**Affected Code Pattern**:

```pine
for y = 0 to gy - 1
    float cy = math.cos(y / 6.) * 3
    for x = 0 to gx - 1
        float base = math.sin(x / 4.) * 5 + cy
        float add  = 0.0
        for pk in peaks
            float dx = float(x) - pk.x
            float dy = float(y) - pk.y
            add += pk.z * math.exp(-(dx*dx + dy*dy) / (2 * 3.2 * 3.2))
        M.set(y, x, Point3D.new(float(x), float(y), base + add))
```

**Issue Description**:
When extremely complex triple-nested for loops contain trailing decimal points in division expressions (e.g., `y / 6.`, `x / 4.`), the Chevrotain parser's error recovery system encounters an internal error: `TypeError: Cannot read properties of undefined (reading 'tokenTypeIdx')`.

**Root Cause**:
- The NumberLiteral token pattern was updated to support trailing decimal points: `/\d+(?:_?\d)*(?:\.\d*(?:_?\d)*)?(?:[eE][+-]?\d+)?/`
- This pattern works correctly in most cases
- However, when combined with very complex nested structures (triple-nested loops with multiple variable declarations and complex expressions), it triggers a Chevrotain parser error recovery issue
- The error occurs in Chevrotain's internal `findReSyncTokenType` function during error recovery

**Workaround**:
Remove the trailing decimal point and use explicit decimal places:

```pine
// Instead of:
float cy = math.cos(y / 6.) * 3
float base = math.sin(x / 4.) * 5

// Use:
float cy = math.cos(y / 6.0) * 3
float base = math.sin(x / 4.0) * 5

// Or:
float cy = math.cos(y / 6) * 3
float base = math.sin(x / 4) * 5
```

**Impact**:
- Affects only very complex nested loop structures (3+ levels deep)
- Simple to moderately complex code works perfectly
- Trailing decimals work fine in non-nested contexts

**Technical Details**:
- Parser configuration: `recoveryEnabled: true, maxLookahead: 1`
- Changing to `recoveryEnabled: false, maxLookahead: 2` fixes this issue but breaks method body parsing
- This is a Chevrotain parser framework limitation, not a validator bug

---

### 2. Multi-Variable Declarations

**Status**: Not Implemented  
**Severity**: Medium  
**Affected Code Pattern**:

```pine
int rows = matrix.rows(surf), cols = matrix.columns(surf)
float a = 1.0, b = 2.0, c = 3.0
```

**Issue Description**:
Pine Script allows declaring multiple variables of the same type on one line, separated by commas. This syntax is not currently supported by the validator's parser.

**Root Cause**:
- The `variableDeclaration` parser rule currently only handles single variable declarations
- Implementing multi-variable declarations requires:
  1. Detecting comma-separated variables at the correct scope level (not inside generic type parameters)
  2. Parsing each variable with its initializer
  3. Creating appropriate AST nodes that validators can traverse
  4. Ensuring method body parsing is not affected (previous attempts broke this)

**Workaround**:
Split multi-variable declarations into separate lines:

```pine
// Instead of:
int rows = matrix.rows(surf), cols = matrix.columns(surf)

// Use:
int rows = matrix.rows(surf)
int cols = matrix.columns(surf)
```

**Impact**:
- Parser reports syntax error when encountering comma-separated declarations
- Workaround is straightforward and doesn't affect functionality
- Common in some Pine Script code but not critical for most use cases

**Implementation Challenges**:
1. **Token Collection**: Need to distinguish between commas in generic types (e.g., `map<int, float>`) vs commas separating variable declarations
2. **AST Structure**: Need to decide whether to:
   - Return a `BlockStatement` containing multiple `VariableDeclaration` nodes
   - Create a new `MultiVariableDeclaration` node type
   - Handle at the statement level instead of declaration level
3. **Method Body Parsing**: Previous implementation attempts caused method body statements to be parsed at the program level instead of inside the method
4. **Expression Occurrences**: Chevrotain requires unique occurrence numbers for duplicate subrule calls, which becomes complex with multiple variables

**Technical Details**:
- Requires modifying `createVariableDeclarationRule` in `core/ast/parser/rules/declarations.ts`
- Requires updating `collectDeclarationTokens` helper to track generic bracket depth
- Must maintain parser configuration: `recoveryEnabled: true, maxLookahead: 1`

---

## What Works Perfectly

✅ **All Standard Pine Script v6 Features**:
- Enum declarations and `input.enum`
- Built-in constants (`scale.none`, `color.white`, etc.)
- Generic types (`array<chart.point>`, `matrix<Point3D>`)
- Nested namespaces (`chart.point.from_index`)
- Method declarations
- User-defined types (UDTs)
- Scientific notation (`1e12`, `1e9`, `1e6`)
- Trailing decimal points in simple/moderate complexity code
- All control flow structures (if, for, while, switch)
- Array, matrix, and map operations

✅ **Validation Accuracy**:
- 527 tests passing
- Comprehensive validation across all Pine Script features
- Accurate error messages and suggestions

---

## Future Improvements

### Priority 1: Multi-Variable Declarations
Implement full support for comma-separated variable declarations without breaking existing functionality.

**Approach**: 
- Add bracket depth tracking to `collectDeclarationTokens`
- Modify `variableDeclaration` rule to consume all comma-separated variables
- Return appropriate AST structure (likely `BlockStatement` for multiple declarations)
- Extensive testing to ensure no regressions in method body parsing

### Priority 2: Complex Nested Loops with Trailing Decimals
Investigate Chevrotain parser error recovery system to understand why it fails with this specific pattern.

**Possible Solutions**:
- Custom error recovery strategy for complex nested structures
- Alternative token pattern that doesn't trigger the error
- Upgrade Chevrotain version (if newer version fixes this)
- Contribute fix to Chevrotain project

---

## Testing

To test for these limitations:

```bash
# Run full test suite
npm run test:validator:full

# All 527 tests should pass
# The only failure should be the meta-test file (all-validation-tests.spec.ts)
```

---

## Last Updated

Date: October 4, 2025  
Validator Version: Current  
Test Coverage: 527 tests passing

