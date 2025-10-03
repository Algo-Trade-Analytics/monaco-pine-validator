# Parser Indentation Differences from TradingView

## Known Limitations

Our Pine Script parser is **more lenient** than TradingView's official parser in certain edge cases. These differences are **parser-level** issues, not validator issues, meaning the code is already successfully parsed into an AST before validation occurs.

---

## Case 1: Closing Parenthesis at Column 0 (Critical!)

### TradingView Behavior:

**Valid:** Closing `)` on the same line as the last parameter
```pinescript
indicator("Uptrick: Volatility Weighted Cloud",
     shorttitle="VWC",
     overlay=true, max_lines_count=500, max_labels_count=500)  // ✅ ) on same line
```

**Valid:** Closing `)` on a new line with **non-multiple-of-4 indentation**
```pinescript
// ✅ 1 space
indicator("Test",
     shorttitle="VWC",
     overlay=true
 )

// ✅ 5 spaces
indicator("Test",
     shorttitle="VWC",
     overlay=true
     )

// ✅ 9 spaces
indicator("Test",
     shorttitle="VWC",
     overlay=true
         )

// ✅ Any non-multiple-of-4: 1, 2, 3, 5, 6, 7, 9, 10, 11, 13...
```

**Invalid:** Closing `)` at **multiples of 4** (block boundaries)
```pinescript
// ❌ 0 spaces
indicator("Test",
     shorttitle="VWC",
     overlay=true
)

// ❌ 4 spaces
indicator("Test",
     shorttitle="VWC",
     overlay=true
    )

// ❌ 8 spaces
indicator("Test",
     shorttitle="VWC",
     overlay=true
        )

// ❌ 12, 16, 20... (any multiple of 4)
```
**Error:** `Mismatched input "end of line without line continuation" expecting ")"`

### Our Parser Behavior:
✅ **Accepts all cases** - does not enforce the closing `)` column-0 restriction

### Explanation:
TradingView's parser requires that when you have multi-line function calls:
- The closing `)` can be on the same line as the last parameter, OR
- The closing `)` can be on a new line with **any non-multiple-of-4 indentation** (1, 2, 3, 5, 6, 7, 9, 10, 11...)

However, the closing `)` **cannot** be at multiples of 4 (0, 4, 8, 12, 16...), because those are **block boundaries** in Pine Script. A `)` at a block boundary is treated as a new statement at that block level, which is invalid.

### Why We Can't Validate This:
This is a **parser-level** restriction. Our parser accepts the column-0 form and creates a valid AST, so the validator cannot detect this issue.

### Impact:
**MEDIUM** - Developers coming from other languages might naturally put the closing `)` at multiples of 4 (0, 4, 8), which will fail in TradingView.

### The Universal Rule:
This follows Pine Script's **universal indentation principle**:
- **Multiples of 4 = Block boundaries** (for statements at that level)
- **Non-multiples of 4 = Line continuations** (wrapping)

The closing `)` must be a continuation, not a new statement, so it must use non-multiple-of-4 indentation!

---

## Case 2: Line Wrapping Inside Block-Level Statements

### TradingView Behavior:

**Valid:** Wrap continuation at non-multiple-of-4 beyond block level
```pinescript
volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, volLen)
    _mad = ta.sma(math.abs(srcSeries - 
     ta.sma(srcSeries, volLen)), volLen) * 1.4826  // 5 spaces = 4 (block) + 1 (wrap) ✅
    _mad
```

**✅ Valid Examples (ANY non-multiple-of-4):**
```pinescript
volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, volLen)
    _mad   = ta.sma(math.abs(srcSeries - 
 ta.sma(srcSeries, volLen)), volLen) * 1.4826  // 1 space ✅
    _vRaw  = volMethod == "StDev" ? _stdev : _mad

volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, volLen)
    _mad   = ta.sma(math.abs(srcSeries - 
     ta.sma(srcSeries, volLen)), volLen) * 1.4826  // 5 spaces ✅
    _vRaw  = volMethod == "StDev" ? _stdev : _mad
```

**❌ Invalid Examples (multiples of 4):**
```pinescript
volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, volLen)
    _mad   = ta.sma(math.abs(srcSeries - 
ta.sma(srcSeries, volLen)), volLen) * 1.4826  // 0 spaces ❌
    _vRaw  = volMethod == "StDev" ? _stdev : _mad
**Error:** `Syntax error at input "end of line without line continuation"`

volFrom(srcSeries) =>
    _stdev = ta.stdev(srcSeries, volLen)
    _mad   = ta.sma(math.abs(srcSeries - 
    ta.sma(srcSeries, volLen)), volLen) * 1.4826  // 4 spaces ❌
    _vRaw  = volMethod == "StDev" ? _stdev : _mad
**Error:** `Syntax error at input "end of line without line continuation"`
```

### Our Parser Behavior:
❌ **Cannot parse any of these cases** - parser limitation with complex multi-line expressions

### The Universal Pine Script Rule:
- **Block boundaries:** 0, 4, 8, 12... (multiples of 4) - start new statements
- **Wrap continuations:** ANY non-multiple-of-4 (1, 2, 3, 5, 6, 7, 9, 10, 11...) - continue previous line
- **Inside blocks:** Wraps can be LESS than block level (e.g., 1 space inside 4-space block)
- **Key insight:** Wraps don't need to be "beyond" block level - they just need to avoid multiples of 4

### Why We Can't Validate This:
Our parser currently **cannot parse** these multi-line expressions inside function bodies at all, so we cannot validate them.

### Impact:
**MEDIUM** - Our parser needs improvement to handle complex multi-line expressions inside blocks.

---

## Case 3: Function Call Line Wrapping with Non-Standard Indents

### TradingView Behavior (Invalid):
```pinescript
indicator("Uptrick: Volatility Weighted Cloud",
     shorttitle="VWC",                        // 5 spaces
     overlay=true, max_lines_count=500
)
```
**Error:** `Mismatched input "end of line without line continuation" expecting ")"`

### Our Parser Behavior:
✅ **Accepts** this code and parses it successfully

### Explanation:
TradingView's parser appears to have **stricter rules** for function call continuations than our parser. While 5 spaces is technically a valid "wrap" indent (non-multiple-of-4), TradingView rejects it in this context.

### Workarounds:
Use standard indents for function calls:
```pinescript
// Option 1: 2-3 spaces (common wrap indent)
indicator("Uptrick: Volatility Weighted Cloud",
  shorttitle="VWC",
  overlay=true
)

// Option 2: 4 spaces (block-style)
indicator("Uptrick: Volatility Weighted Cloud",
    shorttitle="VWC",
    overlay=true
)
```

### Why We Can't Validate This:
This is a **parser-level** restriction in TradingView. Our parser has already successfully parsed the code into an AST, so the validator has no way to know that TradingView's parser would have rejected it.

To fix this, we would need to modify the **parser itself**, not the validator.

---

## General Pattern

**TradingView's Parser:** Stricter about line wrapping in certain contexts (function calls, possibly others)

**Our Parser:** More lenient, follows the general "non-multiple-of-4 = wrap" rule everywhere

**Impact:** Some code that validates successfully with our tool may still fail in TradingView

**Solution:** If you encounter these cases, use the standard indentation patterns (2-3 spaces for wraps, 4 spaces for blocks) which work everywhere.

---

## Recommendation

When writing Pine Script code that needs to work in TradingView:
1. ✅ Keep closing `)` on the same line as the last parameter, OR at the same indent as continuation lines
2. ✅ Use **2-3 spaces** for line wrapping (universally accepted)
3. ✅ Use **4 spaces** for block-level indentation
4. ❌ **CRITICAL:** Never put closing `)` at column 0 (will fail in TV!)
5. ❌ Avoid **5+ space** wraps in function calls (may fail in TV)
6. ❌ Avoid mixing indentation styles within the same structure

---

## Status

This is a **known limitation** of our parser implementation, not a bug in the validator. The validator is working correctly based on the AST it receives.

To fully match TradingView's behavior, we would need to update the **parser** (ChevrotainAstService) to enforce these stricter rules.

