# Enhanced Error Message Quality - Implementation Plan

## 🎯 Objective
Transform validator error messages from basic notifications into actionable, context-rich guidance that helps developers quickly understand and fix issues.

## 📊 Current State Analysis

### Current Error Structure
```typescript
interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
  relatedLines?: number[];  // ✅ Already exists but underutilized
}
```

### Current Strengths ✅
- Basic error location (line/column)
- Error codes for categorization
- Suggestion field available
- Severity levels
- Deduplication in ValidationHelper

### Current Weaknesses ❌
- Limited context about surrounding code
- No code snippets in error messages
- Suggestions are often generic
- No quick-fix actions
- Missing related error grouping
- No severity explanations
- Limited formatting options

---

## 🚀 Enhancement Strategy

### Phase 1: Rich Context & Code Snippets ⭐⭐⭐
**Impact**: HIGH | **Effort**: MEDIUM | **Priority**: 1

#### Features
1. **Code Snippet Display**
   - Show 2 lines before and after error
   - Highlight the exact error location
   - Add line numbers
   - Show column indicator (^)

2. **Enhanced Context**
   - Function/block context (e.g., "in function 'calculateMA'")
   - Scope information (global, function, block)
   - Variable declaration context

3. **Better Location Info**
   - Character range (start/end positions)
   - Multi-line error support
   - Related code locations

#### Example Output
```
Error: Missing '=' operator (PSV6-SYNTAX-MISSING-EQUALS)
  --> line 5, column 9

  3 | indicator("Test")
  4 | 
  5 | slowEMA ta.ema(close, 35)
    |         ^ Missing '=' operator
  6 | fastEMA = ta.sma(close, 10)
  7 | 

💡 Suggestion: Use 'slowEMA = ta.ema(close, 35)' for variable assignment.

📚 Learn more: https://www.tradingview.com/pine-script-docs/language/Variable_declarations
```

---

### Phase 2: Actionable Quick Fixes ⭐⭐⭐
**Impact**: HIGH | **Effort**: HIGH | **Priority**: 2

#### Features
1. **Auto-Fix Suggestions**
   - Generate exact code replacements
   - Multiple fix options when applicable
   - Confidence scores for fixes

2. **Fix Actions**
   ```typescript
   interface QuickFix {
     title: string;
     description: string;
     edits: CodeEdit[];
     confidence: 'high' | 'medium' | 'low';
   }
   
   interface CodeEdit {
     startLine: number;
     startColumn: number;
     endLine: number;
     endColumn: number;
     newText: string;
   }
   ```

3. **Common Fixes**
   - Add missing operators (=, ,, etc.)
   - Fix operator order (:? → ?:)
   - Add missing parentheses
   - Fix indentation
   - Add missing parameters

#### Example
```
Error: Incorrect conditional operator order (PSV6-SYNTAX-CONDITIONAL-ORDER)
  --> line 4, column 15

  4 | color = close > open : color.green ? color.red
    |                      ^ Incorrect order

🔧 Quick Fixes:
  1. [HIGH CONFIDENCE] Swap operator order
     Change to: close > open ? color.green : color.red
  
  2. [MEDIUM CONFIDENCE] Use if/else statement
     Change to:
     color = if close > open
         color.green
     else
         color.red
```

---

### Phase 3: Error Grouping & Relationships ⭐⭐
**Impact**: MEDIUM | **Effort**: MEDIUM | **Priority**: 3

#### Features
1. **Related Error Detection**
   - Group cascading errors
   - Show root cause first
   - Hide redundant errors

2. **Error Categories**
   ```typescript
   enum ErrorCategory {
     SYNTAX = 'Syntax Error',
     TYPE = 'Type Error',
     SCOPE = 'Scope Error',
     PERFORMANCE = 'Performance Warning',
     STYLE = 'Style Suggestion',
     MIGRATION = 'Migration Guidance'
   }
   ```

3. **Error Hierarchy**
   - Primary errors (root cause)
   - Secondary errors (consequences)
   - Related warnings

#### Example
```
❌ Primary Error: Missing closing parenthesis (PSV6-SYNTAX-MISSING-CLOSING-PAREN)
  --> line 5, column 30
  
  This error is causing 2 additional issues:
  
  ⚠️  Unexpected token on line 6 (consequence of unclosed parenthesis)
  ⚠️  Invalid expression on line 7 (parser recovery failed)
  
💡 Fix the primary error first, and the other issues may resolve automatically.
```

---

### Phase 4: Contextual Help & Documentation ⭐⭐
**Impact**: MEDIUM | **Effort**: LOW | **Priority**: 4

#### Features
1. **Inline Documentation**
   - Link to relevant Pine Script docs
   - Show syntax examples
   - Common patterns

2. **Error Explanations**
   - Why this is an error
   - Common causes
   - How to prevent it

3. **Learning Resources**
   - TradingView documentation links
   - Code examples
   - Best practices

#### Example
```
Error: Function must include a local code block (PSV6-SYNTAX-ERROR)
  --> line 4, column 1

  4 | if condition
  5 | plot(close)

❓ Why is this an error?
   In Pine Script v6, control structures (if, for, while) must have
   an indented code block to define their local scope.

📖 How to fix:
   Indent the code that belongs to the if statement:
   
   if condition
       plot(close)  // Indented with 4 spaces or 1 tab

📚 Documentation: https://www.tradingview.com/pine-script-docs/language/Conditional_structures
```

---

### Phase 5: Advanced Formatting & Presentation ⭐
**Impact**: LOW | **Effort**: MEDIUM | **Priority**: 5

#### Features
1. **Color-Coded Output** (for CLI)
   - Red for errors
   - Yellow for warnings
   - Blue for info
   - Green for suggestions

2. **Severity Indicators**
   - 🔴 Critical (blocks execution)
   - 🟡 Warning (may cause issues)
   - 🔵 Info (best practices)
   - 💡 Suggestion (improvements)

3. **Progress Indicators**
   - Show validation progress
   - Error count summary
   - Fix suggestions count

---

## 🛠️ Implementation Details

### New Types & Interfaces

```typescript
// Enhanced error with rich context
interface EnhancedValidationError extends ValidationError {
  // Code context
  codeSnippet?: CodeSnippet;
  context?: ErrorContext;
  
  // Quick fixes
  quickFixes?: QuickFix[];
  
  // Relationships
  category?: ErrorCategory;
  isPrimary?: boolean;
  relatedErrors?: string[]; // Error IDs
  causedBy?: string; // Parent error ID
  
  // Documentation
  documentation?: DocumentationLink;
  explanation?: string;
  
  // Formatting
  formattedMessage?: string;
}

interface CodeSnippet {
  beforeLines: string[];
  errorLine: string;
  afterLines: string[];
  highlightStart: number;
  highlightEnd: number;
  lineNumbers: number[];
}

interface ErrorContext {
  functionName?: string;
  blockType?: 'global' | 'function' | 'if' | 'for' | 'while';
  scopeLevel: number;
  nearbyDeclarations?: string[];
}

interface QuickFix {
  title: string;
  description: string;
  edits: CodeEdit[];
  confidence: 'high' | 'medium' | 'low';
}

interface CodeEdit {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  newText: string;
}

interface DocumentationLink {
  title: string;
  url: string;
  section?: string;
}
```

### New Utility Classes

```typescript
// Error message formatter
class ErrorMessageFormatter {
  static formatWithSnippet(error: EnhancedValidationError, source: string): string;
  static formatQuickFixes(fixes: QuickFix[]): string;
  static formatRelatedErrors(errors: EnhancedValidationError[]): string;
}

// Code snippet extractor
class CodeSnippetExtractor {
  static extract(source: string, line: number, column: number, context?: number): CodeSnippet;
  static highlight(snippet: CodeSnippet): string;
}

// Quick fix generator
class QuickFixGenerator {
  static generateFixes(error: ValidationError, source: string): QuickFix[];
  static applyFix(source: string, fix: QuickFix): string;
}

// Error relationship analyzer
class ErrorRelationshipAnalyzer {
  static findRelatedErrors(errors: ValidationError[]): Map<string, string[]>;
  static identifyPrimaryErrors(errors: ValidationError[]): ValidationError[];
  static groupCascadingErrors(errors: ValidationError[]): ErrorGroup[];
}
```

---

## 📈 Success Metrics

### Quantitative
- ✅ 90%+ errors include code snippets
- ✅ 80%+ errors have actionable suggestions
- ✅ 70%+ errors have quick-fix options
- ✅ 50%+ reduction in "unclear error" reports
- ✅ 30%+ faster error resolution time

### Qualitative
- ✅ Developers can understand errors without external docs
- ✅ Error messages guide developers to solutions
- ✅ Reduced context switching (IDE → docs → IDE)
- ✅ Improved developer confidence in validator

---

## 🎯 Implementation Roadmap

### Week 1: Foundation (Phase 1)
- [ ] Create EnhancedValidationError type
- [ ] Implement CodeSnippetExtractor
- [ ] Implement ErrorMessageFormatter
- [ ] Add code snippets to syntax errors
- [ ] Test with existing error cases

### Week 2: Quick Fixes (Phase 2)
- [ ] Design QuickFix interface
- [ ] Implement QuickFixGenerator
- [ ] Add fixes for common syntax errors
- [ ] Add fixes for indentation errors
- [ ] Test fix application

### Week 3: Relationships (Phase 3)
- [ ] Implement ErrorRelationshipAnalyzer
- [ ] Add error grouping logic
- [ ] Identify cascading errors
- [ ] Update error display to show relationships
- [ ] Test with complex error scenarios

### Week 4: Documentation (Phase 4)
- [ ] Create documentation link database
- [ ] Add inline explanations
- [ ] Link errors to Pine Script docs
- [ ] Add common pattern examples
- [ ] Test documentation relevance

### Week 5: Polish (Phase 5)
- [ ] Add color-coded output
- [ ] Implement severity indicators
- [ ] Create error summary reports
- [ ] Add progress indicators
- [ ] Final testing and refinement

---

## 🧪 Testing Strategy

### Unit Tests
- Code snippet extraction accuracy
- Quick fix generation correctness
- Error relationship detection
- Message formatting

### Integration Tests
- End-to-end error display
- Multiple error scenarios
- Edge cases and corner cases
- Performance with large scripts

### User Testing
- Developer feedback on clarity
- Time-to-fix measurements
- Satisfaction surveys
- A/B testing with old vs new messages

---

## 📝 Example Transformations

### Before (Current)
```
Error: Missing '=' operator
Line: 5, Column: 9
Code: PSV6-SYNTAX-MISSING-EQUALS
```

### After (Enhanced)
```
❌ Syntax Error: Missing '=' operator (PSV6-SYNTAX-MISSING-EQUALS)
  --> line 5, column 9 in global scope

  3 | indicator("Test")
  4 | 
  5 | slowEMA ta.ema(close, 35)
    |         ^ Missing '=' operator
  6 | fastEMA = ta.sma(close, 10)
  7 | 

💡 Suggestion: Use 'slowEMA = ta.ema(close, 35)' for variable assignment.

🔧 Quick Fix:
   [HIGH CONFIDENCE] Add '=' operator
   Change to: slowEMA = ta.ema(close, 35)

📚 Learn more: Variable Declarations
   https://www.tradingview.com/pine-script-docs/language/Variable_declarations
```

---

## 🎉 Expected Benefits

1. **Faster Development** - Developers spend less time debugging
2. **Better Learning** - Error messages teach Pine Script concepts
3. **Reduced Frustration** - Clear, actionable guidance
4. **Higher Quality Code** - Better understanding leads to better code
5. **Competitive Advantage** - Best-in-class error messages

---

## 🔄 Continuous Improvement

- Collect error message feedback
- Track which errors are most confusing
- Iterate on message quality
- Add new quick fixes based on usage
- Update documentation links as Pine Script evolves
