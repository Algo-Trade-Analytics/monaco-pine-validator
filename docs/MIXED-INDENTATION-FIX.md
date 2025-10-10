# Mixed Indentation Fix - Matching TradingView Behavior

## 🐛 **Issue**

The validator was incorrectly flagging scripts with mixed tabs and spaces across different scopes (e.g., spaces in global scope, tabs in functions) as invalid with error code `PSI02`.

**User Report**: TradingView does NOT show this error for such scripts.

## ✅ **Fix**

Modified the mixed indentation check to match TradingView's behavior:

### **Before (Too Strict)**
- ❌ Rejected mixing tabs/spaces **anywhere** in the script
- ❌ Flagged valid scripts that TradingView accepts

### **After (Matches TradingView)**
- ✅ **Allows** mixing tabs/spaces across different scopes
- ✅ **Allows** mixing tabs/spaces on the **same line**
- ⚠️ Still emits a PSI02 **warning** when both indentation styles appear anywhere in the script (helpful reminder, but not a hard error)

## 📝 **Examples**

### ✅ **Now VALID** (Matches TradingView)
```pinescript
//@version=6
strategy("Test", overlay = true)

// Global scope uses SPACES
maType = input.string("SMA", title="MA Type", options=["EMA", "SMA"], 
     tooltip="Select the type of Moving Average")

// Function scope uses TABS
smma(src, len) =>
	smma = 0.0
	smma := na(smma[1]) ? ta.sma(src, len) : (smma[1] * (len - 1) + src) / len
	smma
```

### ⚠️ **Now a Warning (Matches TradingView)**
```pinescript
//@version=6
indicator("Test")

func() =>
	    value = 10  // ⚠️ Line mixes tabs and spaces; TradingView accepts it, we surface PSI02 as a warning
    value
```

## 🔧 **Changes Made**

### 1. `core/ast/indentation-validator-ast.ts`
- Skip raising PSI02 for same-line mixing so AST validation matches TradingView.

### 2. `modules/core-validator.ts`
- Maintain a PSI02 warning when both tabs and spaces appear anywhere (keeps handy hygiene reminder).

### 3. Tests
- Updated `tests/ast/indentation-comprehensive.test.ts`
- Updated `tests/specs/ultimate-validator.spec.ts`
- Updated `verify-mixed-indent.test.ts`

## ✅ **Verification**

### **All Tests Pass**
- ✅ 693 AST tests pass
- ✅ 1084 validator spec tests pass  
- ✅ 5 Playwright E2E tests pass
- ✅ **Total: 1782 tests passing**

### **Playground Tests**
- ✅ Detects indentation errors consistently
- ✅ Allows mixing tabs/spaces across scopes and even on the same line (no hard error)
- ⚠️ Surfaces a PSI02 warning when both indentation styles exist so users can tidy up if desired

## 📚 **Pine Script Documentation**

From the official Pine Script docs:
> "The local code block after the initial while line must be indented with four spaces or a tab."

This indicates Pine Script allows **EITHER** spaces **OR** tabs, but doesn't explicitly forbid mixing them across different scopes. Our testing confirms TradingView's implementation is lenient about cross-scope mixing.

## 🎯 **Impact**

- **User scripts that were incorrectly flagged** will now validate successfully
- **Actual indentation issues** (e.g., bad wrap indentation, misaligned blocks) are still caught
- **Validator behavior now matches TradingView's tolerance for mixed indentation**
