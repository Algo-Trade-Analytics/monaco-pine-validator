# Issue Summary: Array Literals in Indented Function Bodies

## TL;DR

**Problem:** Array literals like `[ux, uy, uz]` fail to parse when used as the return value of a function with an indented body.

**Status:** Pre-existing limitation (not introduced by recent changes)

**Workaround:** Use inline syntax `f() => [1, 2, 3]` instead of indented body.

## Quick Example

### ❌ Fails (Indented)
```pine
f_basis(float yawOff, float pitchOff) =>
    float phi = (yawDeg + yawOff) * math.pi / 180
    [ux, uy, uz, vx, vy, vz]
```
**Error:** `PSV6-SYNTAX-PARSE-FAILED`

### ✅ Works (Inline)
```pine
f_basis(float yawOff, float pitchOff) => [ux, uy, uz, vx, vy, vz]
```

### ✅ Works (Variable Assignment)
```pine
f_basis(float yawOff, float pitchOff) =>
    float phi = (yawDeg + yawOff) * math.pi / 180
    result = [ux, uy, uz, vx, vy, vz]
    result
```

## Investigation Results

### What We Found

1. **Issue exists in original code** - Not introduced by recent parser changes
2. **All 530 tests pass** - This specific pattern wasn't covered in tests
3. **Root cause identified** - `parseIndentedBlock` expects statements, doesn't properly handle array literal expressions

### What We Tried

- ✅ Confirmed inline syntax works
- ✅ Confirmed variable declarations work  
- ✅ Confirmed tuple destructuring works
- ❌ Refactoring `bracketExpression` rule (broke tuple parsing)
- ✅ Reverted all changes (confirmed pre-existing issue)

## Recommended Action

**For Users:**
- Use inline syntax for simple functions
- Use intermediate variable for complex functions
- This is valid Pine Script in TradingView, limitation is validator-only

**For Developers:**
- See `docs/ARRAY-LITERAL-LIMITATION.md` for detailed analysis
- Recommended fix: Improve expression statement recognition in `statement` rule
- Test case needed: Add failing test for this pattern before implementing fix

## Files Involved

- `core/ast/parser/rules/declarations.ts` - Function declaration parsing
- `core/ast/parser/rules/statements.ts` - Statement rule (where fix needed)
- `core/ast/parser/rules/expressions.ts` - Array literal parsing (works correctly)
- `core/ast/parser/helpers.ts` - Indented block parsing

## Test Status

- ✅ **530/530 tests passing** (no regressions)
- ❌ **Missing test case** for indented array literal returns
- ✅ **All related patterns work** (tuples, matrices, inline arrays)

---

See `ARRAY-LITERAL-LIMITATION.md` for complete technical analysis and proposed solutions.

