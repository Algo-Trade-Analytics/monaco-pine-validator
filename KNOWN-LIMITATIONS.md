# Known Limitations

## ~~Scope Validation~~ ✅ FIXED

### ~~Out-of-Scope Parameter Usage~~ ✅ NOW DETECTED
**Status**: ✅ **FIXED**  
**Priority**: ~~Medium~~ **RESOLVED**

~~The validator currently does not catch when function parameters are used outside their function scope.~~ **This is now properly detected!**

**Example**:
```pine
//@version=6
indicator("Test")

toSize(s) =>
    s == "tiny" ? size.tiny : size.small

// This IS now caught as an error ✅
atrLen = input.int(s, "ATR Length", minval=1)  // ✅ Error: Undefined variable 's'
```

**What TradingView Does**: Compile error - "Undeclared identifier 's'"

**What Validator Does**: ✅ **Now matches TradingView** - Error: "Undefined variable 's'"

**How Fixed**: 
1. Removed function parameters from global "ignored" list
2. Parameters are now scope-limited and only valid within their declaring function
3. Validator now uses whitelist approach: accepts only system-defined OR user-defined variables in correct scope

---

## What IS Working ✅

1. **Truly undefined variables** - Caught correctly
   ```pine
   plot(noneSence)  // ✅ Error: Undefined variable
   ```

2. **Variables used before declaration** - Caught correctly

3. **Function parameters used within their function** - Works correctly

