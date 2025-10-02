# Scope Validation Summary

## Whitelist Approach ✅

The validator now implements a strict **whitelist approach** for variable validation:

### Variables are ONLY accepted if they are:

1. **System-Defined** (Pine Script built-ins)
   - Keywords: `if`, `else`, `for`, `while`, `true`, `false`, `na`, etc.
   - Built-in variables: `close`, `open`, `high`, `low`, `volume`, etc.
   - Namespaces: `ta`, `math`, `str`, `array`, `color`, etc.
   - Namespace members: `ta.sma`, `math.max`, `str.tostring`, etc.
   - Constants: `display.all`, `size.tiny`, `color.red`, etc.

2. **User-Defined** (declared in script) **AND**:
   - **In the correct scope**
   - Global variables are accessible everywhere
   - Function parameters are ONLY accessible within their function

### What Gets Rejected ❌

Any variable that is **neither** system-defined **nor** user-defined (or out of scope):
- Typos: `plot(clsoe)` instead of `plot(close)`
- Undefined variables: `plot(myUndefinedVar)`
- Out-of-scope parameters: Using function parameter outside its function

## Examples

### ✅ Valid - System-Defined
```pine
//@version=6
indicator("Test")
plot(close)  // ✅ Built-in variable
smaValue = ta.sma(close, 20)  // ✅ Namespace member
```

### ✅ Valid - User-Defined (Global)
```pine
//@version=6
indicator("Test")
myVar = 100  // User-defined
plot(myVar)  // ✅ Valid everywhere
```

### ✅ Valid - Parameter (In Scope)
```pine
//@version=6
indicator("Test")
calculate(value) =>
    value * 2  // ✅ Parameter valid inside function
plot(calculate(50))
```

### ❌ Invalid - Parameter (Out of Scope)
```pine
//@version=6
indicator("Test")
calculate(value) =>
    value * 2
plot(value)  // ❌ ERROR: Parameter not valid outside function
```

### ❌ Invalid - Undefined
```pine
//@version=6
indicator("Test")
plot(noneSence)  // ❌ ERROR: Not system OR user-defined
```

## How It Works

1. **Build ignore list** (system-defined + user-defined variables)
   - Pine Script keywords, built-ins, namespaces
   - User-declared global variables
   - User-defined functions

2. **Track scoped declarations** (parameters)
   - Function parameters stored with their scope IDs
   - NOT added to global ignore list

3. **Validate references**
   - If in ignore list → ✅ Valid
   - If in scoped declarations → Check if reference is within that scope
     - In scope → ✅ Valid
     - Out of scope → ❌ Error
   - Otherwise → ❌ Error (undefined)

## Benefits

✅ **Matches TradingView behavior** - Same errors TradingView would show  
✅ **Catches typos immediately** - No false sense of validity  
✅ **Proper scope enforcement** - Function parameters can't leak out  
✅ **Clear error messages** - "Undefined variable 'x'" is unambiguous  

## Testing

Run the comprehensive validation test:
```bash
npx tsx test-whitelist-validation.ts
```

All 7 test cases pass ✅

