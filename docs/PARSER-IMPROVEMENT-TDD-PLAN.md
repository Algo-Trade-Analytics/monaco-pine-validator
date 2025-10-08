# Parser Improvement - Detailed TDD Action Plan

## 🎯 **Mission**
Improve the Chevrotain parser to handle syntax errors gracefully, always produce a usable AST, and eliminate the need for a pre-checker.

---

## 📋 **Project Overview**

### **Goals**
1. ✅ Parser always produces an AST (even with syntax errors)
2. ✅ AST contains error markers for invalid syntax
3. ✅ All AST validators can run on partial AST
4. ✅ Better error messages with full context
5. ✅ Eliminate pre-checker entirely

### **Timeline**
- **Phase 1 (Weeks 1-2)**: Error Recovery Hints → 70% coverage
- **Phase 2 (Weeks 3-5)**: Virtual Token System → 90% coverage
- **Phase 3 (Weeks 6+)**: Advanced Recovery → 100% coverage

### **Success Metrics**
- All 1084 tests pass
- Parser recovery rate > 95%
- Pre-checker reduced to 0-2 checks
- Error message quality improved (user feedback)

---

## 🧪 **TDD Approach**

### **Our Testing Strategy**

```
┌─────────────────────────────────────────────────────────────┐
│  1. Write Failing Test (RED)                                │
│     ↓                                                        │
│  2. Implement Parser Recovery (GREEN)                       │
│     ↓                                                        │
│  3. Verify AST Validators Work (GREEN)                      │
│     ↓                                                        │
│  4. Refactor & Improve (REFACTOR)                           │
│     ↓                                                        │
│  5. Repeat for Next Error Type                              │
└─────────────────────────────────────────────────────────────┘
```

### **Test Categories**
1. **Parser Recovery Tests** - Does parser produce AST?
2. **AST Validation Tests** - Can validators analyze recovered AST?
3. **Error Quality Tests** - Are error messages helpful?
4. **Regression Tests** - Did we break existing functionality?

---

## 📊 **Phase 1: Error Recovery Hints (Weeks 1-2)**

### **Goal**: Add recovery strategies to parser for top error types

### **Week 1: Missing = Operator** 

#### **Day 1: Setup & Infrastructure**

##### **Task 1.1: Create Test Suite**
```typescript
// File: tests/ast/parser-recovery.test.ts

import { describe, it, expect } from 'vitest';
import { parseWithChevrotain } from './core/ast/parser/parse';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Parser Error Recovery - Missing = Operator', () => {
  describe('RED: Parser should recover from missing =', () => {
    it('should produce AST for missing = in variable declaration', () => {
      const code = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)
plot(slowEMA)`;

      const result = parseWithChevrotain(code, { allowErrors: true });
      
      // RED: This will FAIL initially
      expect(result.ast).toBeTruthy();
      expect(result.ast?.body.length).toBeGreaterThan(0);
      expect(result.diagnostics.errors.length).toBeGreaterThan(0);
      
      // Verify AST structure
      const varDecl = result.ast?.body[0];
      expect(varDecl?.kind).toBe('VariableDeclaration');
    });

    it('should mark recovered = as virtual token', () => {
      const code = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)`;

      const result = parseWithChevrotain(code, { allowErrors: true });
      
      // RED: Will fail - no virtual token system yet
      const varDecl = result.ast?.body[0];
      expect(varDecl?.missingOperator).toBe(true);
      expect(varDecl?.errors).toContainEqual({
        type: 'MISSING_EQUALS',
        message: expect.stringContaining("Missing '='")
      });
    });

    it('should allow AST validators to run', () => {
      const code = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)
plot(slowEMA)`;

      const validator = new EnhancedModularValidator();
      const result = validator.validate(code);
      
      // RED: Will fail - validators might crash on partial AST
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-SYNTAX-MISSING-EQUALS')).toBe(true);
      
      // Verify scope validator ran
      expect(result.errors.every(e => e.code !== 'MODULE_ERROR')).toBe(true);
    });
  });

  describe('GREEN: Implementation', () => {
    // These tests guide our implementation
    
    it('should detect missing = at correct position', () => {
      const code = `slowEMA ta.ema(close, 35)`;
      const result = parseWithChevrotain(code, { allowErrors: true });
      
      const error = result.diagnostics.errors[0];
      expect(error.lineno).toBe(1);
      expect(error.offset).toBeGreaterThan(0);
    });

    it('should continue parsing after recovery', () => {
      const code = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)
plot(slowEMA)  // This should still parse`;

      const result = parseWithChevrotain(code, { allowErrors: true });
      
      // Verify both statements parsed
      expect(result.ast?.body.length).toBe(3); // indicator, slowEMA, plot
    });

    it('should handle multiple missing = in same file', () => {
      const code = `//@version=6
indicator("Test")
slowEMA ta.ema(close, 35)
fastEMA ta.ema(close, 10)
plot(slowEMA)`;

      const result = parseWithChevrotain(code, { allowErrors: true });
      
      expect(result.diagnostics.errors.length).toBe(2);
      expect(result.ast?.body.length).toBe(4);
    });
  });
});
```

**Expected Outcome**: ❌ All tests RED (failing)

---

##### **Task 1.2: Implement Parser Recovery for Missing =**

```typescript
// File: core/ast/parser/rules/declarations.ts

export function createVariableDeclarationRule(parser: PineParser) {
  return parser.RULE('variableDeclaration', () => {
    const identifier = parser.CONSUME(Identifier);
    
    // NEW: Check if = is present, recover if missing
    let hasEquals = false;
    let operatorToken: IToken | null = null;
    
    if (parser.LA(1).tokenType === Equals) {
      hasEquals = true;
      operatorToken = parser.CONSUME(Equals);
    } else {
      // RECOVERY STRATEGY: Missing = operator
      // Check if next token looks like it could be the RHS of assignment
      const nextToken = parser.LA(1);
      const looksLikeRHS = (
        nextToken.tokenType === Identifier ||
        nextToken.tokenType === NumberLiteral ||
        nextToken.tokenType === StringLiteral ||
        nextToken.tokenType === LParen ||
        nextToken.tokenType === LBracket
      );
      
      if (looksLikeRHS) {
        // Create error marker
        parser.ACTION(() => {
          const error = {
            message: `Missing '=' after variable '${identifier.image}'`,
            token: identifier,
            resyncedTokens: [],
            context: {
              type: 'MISSING_EQUALS',
              suggestion: `Use '${identifier.image} = ...'`,
              severity: 'error',
              code: 'PSV6-SYNTAX-MISSING-EQUALS'
            }
          };
          parser.errors.push(error);
        });
        
        // Create virtual = token for AST
        operatorToken = {
          image: '=',
          startOffset: identifier.endOffset ?? identifier.startOffset,
          startLine: identifier.startLine,
          startColumn: identifier.startColumn + identifier.image.length,
          endOffset: identifier.endOffset ?? identifier.startOffset,
          endLine: identifier.endLine,
          endColumn: identifier.endColumn,
          tokenType: Equals,
          tokenTypeIdx: Equals.tokenTypeIdx,
          isVirtual: true,  // Mark as virtual
        } as IToken & { isVirtual: boolean };
      }
    }
    
    // Continue parsing the value expression
    const value = parser.SUBRULE(parser.expression);
    
    // Build AST node with error markers
    return createVariableDeclaration(
      identifier,
      operatorToken,
      value,
      {
        missingOperator: !hasEquals,
        errors: !hasEquals ? [{
          type: 'MISSING_EQUALS',
          message: `Missing '=' after variable '${identifier.image}'`,
          location: {
            line: identifier.startLine,
            column: identifier.startColumn + identifier.image.length
          }
        }] : []
      }
    );
  });
}
```

**Expected Outcome**: ✅ Tests turn GREEN

---

##### **Task 1.3: Update AST Node Types**

```typescript
// File: core/ast/nodes.ts

export interface VariableDeclarationNode extends Node {
  kind: 'VariableDeclaration';
  name: IdentifierNode;
  operator: IToken | null;  // Can be null or virtual
  value: ExpressionNode;
  
  // NEW: Error recovery metadata
  missingOperator?: boolean;
  virtualTokens?: IToken[];
  errors?: ParseError[];
}

export interface ParseError {
  type: string;
  message: string;
  location: {
    line: number;
    column: number;
  };
  suggestion?: string;
}

// Extend IToken to support virtual tokens
declare module 'chevrotain' {
  interface IToken {
    isVirtual?: boolean;
    recoveryContext?: string;
  }
}
```

---

##### **Task 1.4: Update AST Validators to Handle Virtual Tokens**

```typescript
// File: modules/syntax-validator.ts

export class SyntaxValidator implements ValidationModule {
  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!context.ast) {
      return { errors, warnings: [], info: [] };
    }
    
    // Traverse AST and check for parse errors
    visit(context.ast, {
      VariableDeclaration: (path) => {
        const node = path.node as VariableDeclarationNode;
        
        // Check if this node has recovery errors
        if (node.missingOperator) {
          errors.push({
            line: node.loc.start.line,
            column: node.loc.start.column,
            message: `Missing '=' operator after variable '${node.name.name}'`,
            severity: 'error',
            code: 'PSV6-SYNTAX-MISSING-EQUALS',
            suggestion: `Use '${node.name.name} = ${getExpressionPreview(node.value)}'`
          });
        }
        
        // Don't double-report if parser already flagged it
        if (node.errors && node.errors.length > 0) {
          // Parser already reported this error, skip
          return;
        }
      }
    });
    
    return { errors, warnings: [], info: [] };
  }
}

function getExpressionPreview(expr: ExpressionNode): string {
  // Generate preview of expression for error message
  if (expr.kind === 'CallExpression') {
    return `${getExpressionPreview(expr.callee)}(...)`;
  }
  if (expr.kind === 'MemberExpression') {
    return `${getExpressionPreview(expr.object)}.${expr.property.name}`;
  }
  if (expr.kind === 'Identifier') {
    return expr.name;
  }
  return '...';
}
```

---

##### **Task 1.5: Run Tests & Iterate**

```bash
# Run parser recovery tests
npm test parser-recovery.test.ts

# Expected: All tests GREEN ✅

# Run full validator tests
npm run test:validator:full

# Expected: 15 failing tests should now pass
# (because parser provides AST even with missing =)
```

---

#### **Day 2: Missing Commas in Function Calls**

##### **Task 2.1: Write Tests**

```typescript
// File: tests/ast/parser-recovery.test.ts

describe('Parser Error Recovery - Missing Commas', () => {
  it('should recover from missing comma in function call', () => {
    const code = `//@version=6
indicator("Test")
plot(close high)`;

    const result = parseWithChevrotain(code, { allowErrors: true });
    
    expect(result.ast).toBeTruthy();
    expect(result.diagnostics.errors.length).toBeGreaterThan(0);
    
    // Verify function call parsed
    const callExpr = findCallExpression(result.ast, 'plot');
    expect(callExpr).toBeTruthy();
    expect(callExpr.args.length).toBe(2);
  });

  it('should mark missing comma location', () => {
    const code = `plot(close high)`;
    const result = parseWithChevrotain(code, { allowErrors: true });
    
    const error = result.diagnostics.errors[0];
    expect(error.message).toContain('comma');
    expect(error.offset).toBeGreaterThan(5); // After "close"
  });

  it('should handle multiple missing commas', () => {
    const code = `plot(close high low)`;
    const result = parseWithChevrotain(code, { allowErrors: true });
    
    expect(result.diagnostics.errors.length).toBe(2);
    expect(result.ast).toBeTruthy();
  });
});
```

##### **Task 2.2: Implement Recovery**

```typescript
// File: core/ast/parser/rules/expressions.ts

export function createArgumentListRule(parser: PineParser) {
  return parser.RULE('argumentList', () => {
    const args: ArgumentNode[] = [];
    
    args.push(parser.SUBRULE(parser.argument));
    
    parser.MANY(() => {
      // Check for comma
      if (parser.LA(1).tokenType === Comma) {
        parser.CONSUME(Comma);
      } else {
        // RECOVERY: Missing comma between arguments
        const nextToken = parser.LA(1);
        
        // If next token looks like an argument, insert virtual comma
        if (isArgumentStart(nextToken.tokenType)) {
          parser.ACTION(() => {
            parser.errors.push({
              message: 'Missing comma between arguments',
              token: parser.LA(0), // Previous token
              context: {
                type: 'MISSING_COMMA',
                code: 'PSV6-SYNTAX-MISSING-COMMA'
              }
            });
          });
          
          // Continue parsing next argument (comma is virtual)
        } else {
          // Can't recover, stop parsing arguments
          return;
        }
      }
      
      args.push(parser.SUBRULE2(parser.argument));
    });
    
    return args;
  });
}

function isArgumentStart(tokenType: TokenType): boolean {
  return (
    tokenType === Identifier ||
    tokenType === NumberLiteral ||
    tokenType === StringLiteral ||
    tokenType === LParen ||
    tokenType === LBracket ||
    tokenType === True ||
    tokenType === False
  );
}
```

---

#### **Day 3-4: Conditional Operator Order**

##### **Task 3.1: Tests**

```typescript
describe('Parser Error Recovery - Conditional Operator Order', () => {
  it('should detect incorrect ternary operator order', () => {
    const code = `color = close > open : color.green ? color.red`;
    const result = parseWithChevrotain(code, { allowErrors: true });
    
    expect(result.ast).toBeTruthy();
    expect(result.diagnostics.errors.some(e => 
      e.message.includes('conditional')
    )).toBe(true);
  });

  it('should not flag valid nested ternaries', () => {
    const code = `value = cond1 ? val1 : cond2 ? val2 : val3`;
    const result = parseWithChevrotain(code, { allowErrors: true });
    
    expect(result.diagnostics.errors.filter(e => 
      e.message.includes('conditional')
    )).toHaveLength(0);
  });
});
```

##### **Task 3.2: Implementation**

```typescript
// File: core/ast/parser/rules/expressions.ts

export function createConditionalExpressionRule(parser: PineParser) {
  return parser.RULE('conditionalExpression', () => {
    let condition = parser.SUBRULE(parser.logicalOrExpression);
    
    parser.OPTION(() => {
      // Check for correct order: condition ? consequent : alternate
      const questionToken = parser.LA(1);
      const colonToken = parser.LA(2);
      
      // Detect incorrect order: condition : alternate ? consequent
      if (questionToken.tokenType === Colon && 
          colonToken.tokenType !== Question) {
        // Look ahead for ? after :
        let foundQuestion = false;
        for (let i = 2; i < 10; i++) {
          if (parser.LA(i).tokenType === Question) {
            foundQuestion = true;
            break;
          }
        }
        
        if (foundQuestion) {
          // RECOVERY: Wrong operator order
          parser.ACTION(() => {
            parser.errors.push({
              message: "Incorrect conditional operator order. Use 'condition ? value_if_true : value_if_false'",
              token: questionToken,
              context: {
                type: 'CONDITIONAL_ORDER',
                code: 'PSV6-SYNTAX-CONDITIONAL-ORDER'
              }
            });
          });
        }
      }
      
      parser.CONSUME(Question);
      const consequent = parser.SUBRULE2(parser.logicalOrExpression);
      parser.CONSUME2(Colon);
      const alternate = parser.SUBRULE3(parser.conditionalExpression);
      
      condition = createConditionalExpression(condition, consequent, alternate);
    });
    
    return condition;
  });
}
```

---

#### **Day 5: Binary Operators & Testing**

##### **Task 4.1: Implement Binary Operator Recovery**
##### **Task 4.2: Run Full Test Suite**
##### **Task 4.3: Fix Regressions**
##### **Task 4.4: Update Documentation**

- ✅ Implemented recovery for missing binary operands and introduced the `PSV6-SYNTAX-MISSING-BINARY-OPERAND` diagnostic.
- ✅ `npm run test:validator:full` (1084 specs) now passes alongside `npx vitest run`.

```bash
# Expected results after Week 1:
✅ Parser recovers from 5 error types
✅ ~10 failing tests now pass
✅ Better error messages
✅ Pre-checker usage reduced by 50%
```

---

### **Week 2: Function Declaration Errors**

#### **Day 6-7: Missing Function Parentheses**
#### **Day 8-9: Empty Parameters & Trailing Commas**
#### **Day 10: Integration & Testing**

```bash
# Expected results after Week 2:
✅ Parser recovers from 8-10 error types
✅ All 15 failing tests pass
✅ 70% of pre-checker functionality moved to parser
✅ Phase 1 COMPLETE
```

---

## 📊 **Phase 2: Virtual Token System (Weeks 3-5)**

### **Goal**: Formalize virtual tokens and improve AST quality

### **Week 3: Virtual Token Infrastructure**

#### **Task: Create VirtualToken Type System**

```typescript
// File: core/ast/virtual-tokens.ts

export interface VirtualToken extends IToken {
  isVirtual: true;
  expectedType: TokenType;
  reason: VirtualTokenReason;
  insertedAt: {
    line: number;
    column: number;
  };
}

export enum VirtualTokenReason {
  MISSING_EQUALS = 'MISSING_EQUALS',
  MISSING_COMMA = 'MISSING_COMMA',
  MISSING_SEMICOLON = 'MISSING_SEMICOLON',
  MISSING_PAREN = 'MISSING_PAREN',
  MISSING_BRACKET = 'MISSING_BRACKET',
  MISSING_BRACE = 'MISSING_BRACE',
}

export function createVirtualToken(
  tokenType: TokenType,
  insertAfter: IToken,
  reason: VirtualTokenReason
): VirtualToken {
  return {
    image: tokenType.name,
    startOffset: insertAfter.endOffset ?? insertAfter.startOffset,
    startLine: insertAfter.endLine ?? insertAfter.startLine,
    startColumn: (insertAfter.endColumn ?? insertAfter.startColumn) + 1,
    endOffset: insertAfter.endOffset ?? insertAfter.startOffset,
    endLine: insertAfter.endLine ?? insertAfter.startLine,
    endColumn: (insertAfter.endColumn ?? insertAfter.startColumn) + 1,
    tokenType,
    tokenTypeIdx: tokenType.tokenTypeIdx,
    isVirtual: true,
    expectedType: tokenType,
    reason,
    insertedAt: {
      line: insertAfter.endLine ?? insertAfter.startLine,
      column: (insertAfter.endColumn ?? insertAfter.startColumn) + 1
    }
  };
}
```

---

### **Week 4-5: Improve Recovery for All Error Types**

Systematically add virtual token support to all parser rules.

---

## 📊 **Phase 3: Advanced Recovery (Weeks 6+)**

### **Goal**: 95%+ recovery rate, eliminate pre-checker

### **Features**:
1. Tolerant parsing mode
2. Error node types in AST
3. Multi-error recovery
4. Suggestion generation

---

## ✅ **Progress Tracking**

### **Setup Checklist**
- [x] Merge textual syntax pre-check into main validator pipeline

### **Week 1 Checklist**
- [x] Day 1: Missing = operator recovery + tests
- [x] Day 2: Missing comma recovery + tests
- [x] Day 3-4: Conditional operator recovery + tests
- [x] Day 5: Binary operators + full test run
- [x] Week 1 Review: 5 error types recovered

### **Week 2 Checklist**
- [ ] Day 6-7: Function parentheses recovery
- [ ] Day 8-9: Empty params & trailing commas
- [ ] Day 10: Integration testing
- [ ] Week 2 Review: 10 error types recovered

### **Success Metrics**
```
Week 1:  5/10 error types → 50% complete
Week 2: 10/10 error types → 100% Phase 1
Week 3-5: Virtual tokens   → Phase 2
Week 6+: Advanced features → Phase 3
```

---

## 📦 **PHASE 2: Virtual Tokens (Weeks 3-5)**

### **What Are Virtual Tokens?**

**Virtual tokens** are "fake" tokens that the parser inserts into the AST when syntax elements are missing. They act as scaffolding that allows:
- **Parser to continue** despite missing syntax
- **AST to remain valid** for validators to process
- **Better error messages** by catching multiple errors in one pass

### **How Virtual Tokens Work**

**Example: Missing `=` operator**

**❌ User writes (INVALID):**
```pine
//@version=6
indicator("Test")
myVar ta.sma(close, 14)  // Missing = operator!
```

**🔧 Parser with Virtual Token:**
```typescript
// 1. Detect missing =
if (!parser.OPTION(() => parser.CONSUME(Equals))) {
  // 2. Record error
  parser.errors.push({
    message: "Missing '=' after variable 'myVar'",
    code: 'PSV6-SYNTAX-MISSING-EQUALS'
  });
  
  // 3. Insert virtual = token
  operatorToken = {
    image: '=',
    isVirtual: true,  // 🎯 Not actually in source!
    startLine: identifier.startLine,
    startColumn: identifier.endColumn + 1
  };
}
```

**✅ Result:**
- AST built as if code was: `myVar = ta.sma(close, 14)`
- Parser continues and finds `ta.sma` needs 2 params
- User gets **both** errors in one validation run

### **Phase 2 Goals (Weeks 3-5)**

#### **Week 3: Missing Delimiters**
- Day 11-12: Missing commas in function calls
- Day 13-14: Missing commas in array/tuple literals
- Day 15: Integration testing

#### **Week 4: Unmatched Brackets**
- Day 16-17: Missing closing `)` in function calls
- Day 18-19: Missing closing `]` in array access
- Day 20: Missing closing `}` in if/for/while blocks

#### **Week 5: Missing Expressions**
- Day 21-22: Missing condition in `if` statements
- Day 23-24: Missing value in variable assignments
- Day 25: Integration testing

### **Virtual Token Implementation Pattern**

```typescript
// File: core/ast/parser/rules/declarations.ts

parser.RULE('variableDeclaration', () => {
  const identifier = parser.CONSUME(Identifier);
  let operatorToken: IToken | null = null;
  
  // Try to consume =, create virtual if missing
  const hasEquals = parser.OPTION(() => {
    operatorToken = parser.CONSUME(Equals);
    return true;
  });
  
  if (!hasEquals) {
    // Create virtual token
    operatorToken = {
      image: '=',
      isVirtual: true,
      startOffset: identifier.endOffset,
      startLine: identifier.startLine,
      startColumn: identifier.endColumn + 1,
      tokenType: Equals
    } as IToken & { isVirtual: boolean };
    
    // Record error
    parser.errors.push({
      message: `Missing '=' after '${identifier.image}'`,
      token: identifier,
      code: 'PSV6-SYNTAX-MISSING-EQUALS'
    });
  }
  
  // Continue parsing with real or virtual token
  const value = parser.SUBRULE(parser.expression);
  
  return createVariableDeclaration(
    identifier,
    operatorToken,
    value,
    { missingOperator: !hasEquals }
  );
});
```

### **AST Node Updates for Virtual Tokens**

```typescript
// File: core/ast/nodes.ts

export interface VariableDeclarationNode extends Node {
  kind: 'VariableDeclaration';
  name: IdentifierNode;
  operator: IToken | null;  // Can be virtual
  value: ExpressionNode;
  
  // Recovery metadata
  missingOperator?: boolean;
  virtualTokens?: IToken[];
  errors?: ParseError[];
}

// Extend IToken to support virtual tokens
declare module 'chevrotain' {
  interface IToken {
    isVirtual?: boolean;
    recoveryContext?: string;
  }
}
```

### **Validator Updates for Virtual Tokens**

```typescript
// File: modules/syntax-validator.ts

visitVariableDeclaration(node: VariableDeclarationNode): void {
  // Skip validation if operator is virtual (error already recorded)
  if (node.operator?.isVirtual) {
    return; // Parser already reported the error
  }
  
  // Normal validation for real tokens
  this.validateOperator(node.operator);
}
```

### **Phase 2 Success Metrics**
```
Week 3:  3 delimiter types → Virtual commas
Week 4:  3 bracket types   → Virtual ), ], }
Week 5:  3 expression types → Virtual placeholders
Total: 9 new virtual token types
```

---

## 🚀 **PHASE 3: Advanced Features (Weeks 6+)**

### **What Are Advanced Features?**

Phase 3 builds on Phases 1 & 2 to handle complex recovery scenarios:
- **Multi-line error recovery** - Errors spanning multiple lines
- **Contextual recovery** - Different recovery based on context
- **Error cascades** - Preventing one error from causing many false positives
- **Ambiguity resolution** - Choosing best recovery strategy

### **Phase 3 Goals (Weeks 6-10)**

#### **Week 6: Multi-Line Recovery**
- Day 26-27: Line continuation errors (missing operators)
- Day 28-29: Block structure errors (missing indentation)
- Day 30: Integration testing

**Example: Line Continuation**
```pine
// Error: Line ends with operator but no continuation
value = close +
plot(value)  // Should be indented!

// Recovery: Insert virtual newline escape or flag indentation
```

#### **Week 7: Contextual Recovery**
- Day 31-32: Function context (params vs body)
- Day 33-34: Expression context (ternary vs function call)
- Day 35: Integration testing

**Example: Context Matters**
```pine
// In function call context
plot(close  // Missing closing )
     color = color.blue)  // Parser knows we're in call params

// In expression context
value = close > open ? color.green  // Missing : and else value
```

#### **Week 8: Error Cascade Prevention**
- Day 36-37: Error deduplication logic
- Day 38-39: False positive filtering
- Day 40: Integration testing

**Example: Cascade Prevention**
```pine
// Single error causes cascade
myVar ta.sma(close, 14)  // Missing =

// Without cascade prevention:
// ❌ Missing = operator
// ❌ Unexpected identifier 'ta'
// ❌ Invalid statement
// ❌ Unreachable code

// With cascade prevention:
// ✅ Missing = operator (root cause only)
```

#### **Week 9: Ambiguity Resolution**
- Day 41-42: Choose best recovery strategy
- Day 43-44: User intent detection
- Day 45: Integration testing

**Example: Ambiguous Recovery**
```pine
// Ambiguous: What's missing?
value = ta.sma close, 14)
         //    ^ Missing ( or extra ) ?

// Strategy 1: Insert ( before close
value = ta.sma(close, 14)  // More likely!

// Strategy 2: Remove ) after 14
value = ta.sma close, 14  // Less likely

// Choose based on:
// - Token patterns
// - Function signatures
// - Common mistakes
```

#### **Week 10: Polish & Optimize**
- Day 46-47: Performance optimization
- Day 48-49: Error message quality
- Day 50: Full regression testing

### **Advanced Recovery Patterns**

#### **1. Error Buffering**
```typescript
// Collect multiple related errors before reporting
class ErrorBuffer {
  private errors: ParseError[] = [];
  
  add(error: ParseError): void {
    // Check if error is cascade from previous
    if (this.isCascade(error)) {
      return; // Skip cascade errors
    }
    this.errors.push(error);
  }
  
  private isCascade(error: ParseError): boolean {
    // Check if caused by previous error
    return this.errors.some(prev => 
      prev.line === error.line - 1 &&
      prev.code.startsWith('PSV6-SYNTAX-MISSING')
    );
  }
}
```

#### **2. Context-Aware Recovery**
```typescript
// Different recovery based on parsing context
parser.RULE('expression', () => {
  const context = parser.getContext(); // function | assignment | condition
  
  try {
    return parser.SUBRULE(parser.primaryExpression);
  } catch (error) {
    // Recover based on context
    switch (context) {
      case 'function':
        return parser.recoverInFunctionContext(error);
      case 'assignment':
        return parser.recoverInAssignmentContext(error);
      case 'condition':
        return parser.recoverInConditionContext(error);
    }
  }
});
```

#### **3. Heuristic-Based Recovery**
```typescript
// Use patterns to guess user intent
function chooseBestRecovery(
  token: IToken,
  context: ParseContext
): RecoveryStrategy {
  // Pattern: Missing opening bracket
  if (context.inFunctionCall && token.image === ')') {
    return { type: 'INSERT_TOKEN', token: '(' };
  }
  
  // Pattern: Missing comma in list
  if (context.inArrayLiteral && isIdentifier(token)) {
    return { type: 'INSERT_TOKEN', token: ',' };
  }
  
  // Pattern: Missing operator in expression
  if (context.inExpression && isIdentifier(token)) {
    return { type: 'INSERT_TOKEN', token: '=' };
  }
  
  return { type: 'SKIP_TOKEN' };
}
```

### **Phase 3 Success Metrics**
```
Week  6: Multi-line recovery     → 95% of line continuation errors
Week  7: Contextual recovery     → Smart recovery in 8+ contexts
Week  8: Cascade prevention      → 80% reduction in false positives
Week  9: Ambiguity resolution    → Correct choice 90% of time
Week 10: Polish                  → Parser matches TradingView quality
```

### **Final Outcome (After Phase 3)**

**Parser Capabilities:**
- ✅ Recovers from 30+ syntax error types
- ✅ Provides context-aware error messages
- ✅ Prevents error cascades
- ✅ Builds valid AST even with multiple errors
- ✅ Performance: <100ms for 1000-line scripts

**User Experience:**
- ✅ See all errors at once (not one-by-one)
- ✅ Get smart suggestions based on context
- ✅ Faster development (fix multiple errors per cycle)
- ✅ Matches TradingView editor quality

---

## 🎯 **Next Steps**

1. **Review this plan** - Ensure it's feasible
2. **Set up git branch** - `feat/parser-error-recovery`
3. **Start Day 1** - Create test file, run RED tests
4. **Implement recovery** - Make tests GREEN
5. **Iterate daily** - Small, testable improvements

**Ready to start?** Let me create the initial test file and begin Day 1! 🚀
