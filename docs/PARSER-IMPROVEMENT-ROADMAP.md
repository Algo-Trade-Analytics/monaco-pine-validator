# Parser Improvement - Visual Roadmap

## 🗺️ **10-Week Journey to World-Class Parser**

```
Week 1-2: Phase 1 (Error Recovery Hints)
├─ Week 1: Core Syntax Errors
│  ├─ Day 1: Missing = operator        [TDD: 8 tests]
│  ├─ Day 2: Missing commas            [TDD: 6 tests]
│  ├─ Day 3-4: Conditional operators   [TDD: 5 tests]
│  └─ Day 5: Binary operators          [TDD: 4 tests]
│  
└─ Week 2: Function Errors
   ├─ Day 6-7: Function parentheses    [TDD: 6 tests]
   ├─ Day 8-9: Empty params/trailing   [TDD: 8 tests]
   └─ Day 10: Integration testing      [Run all 1084 tests]

📊 Milestone 1: 70% error recovery ✅
📉 Pre-checker: 10 → 5 functions
✅ Single validation pipeline (parser recovery drives syntax errors)
✅ Tests: 1069 → 1084 passing


Week 3-5: Phase 2 (Virtual Token System)
├─ Week 3: Infrastructure
│  ├─ Virtual token types
│  ├─ AST node metadata
│  └─ Validator updates
│  
├─ Week 4: Formalize Recovery
│  ├─ All error types → virtual tokens
│  ├─ Error context enrichment
│  └─ Multi-error handling
│  
└─ Week 5: Polish & Test
   ├─ Edge cases
   ├─ Performance optimization
   └─ Documentation

📊 Milestone 2: 90% error recovery ✅
📉 Pre-checker: 5 → 0 functions
🎯 Always have usable AST


Week 6+: Phase 3 (Advanced Features)
├─ Tolerant parsing mode
├─ Error node types
├─ Suggestion generation
├─ Multi-pass recovery
└─ Pre-checker elimination ✅

📊 Milestone 3: 95%+ recovery ✅
📉 Pre-checker: 0 functions
🏆 World-class validator
```

---

## 📅 **Week 1 Detailed Schedule**

### **Monday (Day 1): Missing = Operator**

**Morning (3 hours)**
```
08:00 - Create git branch
08:15 - Create test file: tests/ast/parser-recovery.test.ts
08:30 - Write 8 RED tests for missing = operator
09:30 - Run tests (expect: 8 failures)
10:00 - Review test output
10:30 - Plan implementation approach
```

**Afternoon (4 hours)**
```
13:00 - Implement recovery in createVariableDeclarationRule
14:30 - Run tests (expect: 4-5 passing)
15:00 - Debug failures
16:00 - Refine implementation
16:45 - Run tests (expect: 8 passing)
17:00 - Commit: "feat: parser recovers from missing = operator"
```

**Evening (optional)**
```
- Run full test suite
- Note any regressions
- Document learnings
```

---

### **Tuesday (Day 2): Missing Commas**

**Morning**
```
08:00 - Write 6 RED tests for missing commas
09:00 - Run tests (expect: 6 failures)
09:30 - Implement recovery in createArgumentListRule
11:30 - Run tests (expect: 6 passing)
```

**Afternoon**
```
13:00 - Test edge cases (multiple missing commas)
14:00 - Refine error messages
15:00 - Update validators to handle recovered AST
16:00 - Run full test suite
16:30 - Fix regressions
17:00 - Commit: "feat: parser recovers from missing commas"
```

---

### **Wednesday-Thursday (Day 3-4): Conditional Operators**

**Day 3 Morning**
```
08:00 - Write 5 RED tests for conditional operators
09:00 - Analyze incorrect patterns
10:00 - Design recovery strategy
11:00 - Start implementation
```

**Day 3 Afternoon + Day 4**
```
13:00 - Implement conditional operator detection
14:00 - Handle nested ternaries correctly
15:00 - Add recovery logic
Day 4: Testing, edge cases, refinement
17:00 - Commit: "feat: parser detects incorrect conditional operator order"
```

---

### **Friday (Day 5): Binary Operators & Integration**

**Morning**
```
08:00 - Write 4 RED tests for binary operators
09:00 - Implement recovery
10:30 - All Phase 1 Week 1 tests passing ✅
```

**Afternoon - CRITICAL**
```
13:00 - Run FULL test suite (npm run test:validator:full)
14:00 - Analyze failures
15:00 - Fix regressions
16:00 - Re-run tests
16:30 - Document progress
17:00 - Week 1 retrospective
```

**Success Criteria**
```
✅ 23 new recovery tests passing
✅ Original 1069 tests still passing
✅ 5-10 previously failing tests now passing
✅ Parser recovery rate: 50-60%
```

---

## 🎯 **Daily TDD Workflow**

```
┌─────────────────────────────────────────────────────────────┐
│  Morning: Write Tests (RED)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Create test cases for ONE error type            │   │
│  │ 2. Cover: happy path, edge cases, multiple errors  │   │
│  │ 3. Run tests → Expect ALL to fail                  │   │
│  │ 4. Review failure output for clarity               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Afternoon: Implement Recovery (GREEN)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Implement parser recovery logic                 │   │
│  │ 2. Run tests → Fix until all GREEN                 │   │
│  │ 3. Run full test suite → Check regressions         │   │
│  │ 4. Commit with descriptive message                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Evening: Review & Document (REFACTOR)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Code review (self)                               │   │
│  │ 2. Refactor for clarity                             │   │
│  │ 3. Update documentation                             │   │
│  │ 4. Plan next day                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **Success Metrics Dashboard**

### **Track These Daily**

```
┌─────────────────────────────────────────────────────────────┐
│  Parser Recovery Rate                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Day 0:  ▓░░░░░░░░░░░░░░░░░░░░░░  0% (baseline)            │
│  Day 1:  ▓▓▓░░░░░░░░░░░░░░░░░░░░ 10% (missing =)           │
│  Day 2:  ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░ 25% (+ commas)            │
│  Day 3:  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░ 35% (+ conditional)       │
│  Day 4:  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░ 40% (refined)             │
│  Day 5:  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░ 50% (+ binary ops)        │
│  Week 2: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ 70% (Phase 1 complete)    │
│  Week 5: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 90% (Phase 2 complete)    │
│  Week 8: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  95% (Phase 3 complete)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Test Suite Health                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Passing Tests:     1069 → 1084 (target)                    │
│  New Tests:            0 →   50 (parser recovery)           │
│  Regressions:          0 (must stay 0!)                      │
│  Coverage:          98.6% → 100%                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Pre-Checker Reduction                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Functions:        10 → 5 → 2 → 0 (target)                  │
│  Lines of Code:   500 → 250 → 100 → 0                       │
│  Maintenance:    High → Medium → Low → None                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 **Quick Start: Day 1 Commands**

```bash
# 1. Create feature branch
git checkout -b feat/parser-error-recovery
git push -u origin feat/parser-error-recovery

# 2. Create test file
touch tests/ast/parser-recovery.test.ts

# 3. Copy Day 1 tests from PARSER-IMPROVEMENT-TDD-PLAN.md
# (The "RED" tests for missing = operator)

# 4. Run tests (expect failures)
npm test parser-recovery.test.ts

# 5. Implement recovery in:
#    core/ast/parser/rules/declarations.ts

# 6. Run tests again (expect passing)
npm test parser-recovery.test.ts

# 7. Run full suite
npm run test:validator:full

# 8. Commit
git add .
git commit -m "feat(parser): add recovery for missing = operator

- Parser now produces AST even with missing = 
- Added 8 tests for missing = recovery
- All tests passing
- Ready for Day 2"

git push
```

---

## 📚 **Resources**

### **Key Files to Modify**
```
core/ast/parser/rules/declarations.ts    ← Variable declarations
core/ast/parser/rules/expressions.ts     ← Expressions, operators
core/ast/parser/rules/statements.ts      ← Statements
core/ast/nodes.ts                        ← AST node types
core/ast/virtual-tokens.ts               ← NEW: Virtual tokens
tests/ast/parser-recovery.test.ts        ← NEW: Recovery tests
```

### **Documentation**
```
docs/PARSER-IMPROVEMENT-TDD-PLAN.md      ← Detailed plan (this file)
docs/PARSER-IMPROVEMENT-ANALYSIS.md      ← Technical analysis
docs/PARSER-IMPROVEMENT-ROADMAP.md       ← Visual roadmap
docs/WHY-KEEP-PRE-CHECKER.md             ← Context
```

### **Chevrotain Resources**
- [Chevrotain Docs](https://chevrotain.io/docs/)
- [Error Recovery Guide](https://chevrotain.io/docs/guide/error_recovery.html)
- [Custom Errors](https://chevrotain.io/docs/guide/custom_errors.html)

---

## ✅ **Pre-Flight Checklist**

Before starting Day 1:

- [ ] Read PARSER-IMPROVEMENT-TDD-PLAN.md (detailed plan)
- [ ] Review current parser code (core/ast/parser/)
- [ ] Understand TDD workflow (RED → GREEN → REFACTOR)
- [ ] Create feature branch
- [ ] Have test runner ready
- [ ] Clear calendar for focused work
- [ ] **Get excited!** This is a game-changer 🚀

---

## 🎯 **When You're Ready**

Reply with:
- **"Start Day 1"** - I'll create the test file and initial implementation
- **"Questions first"** - We'll review anything unclear
- **"Different approach"** - We'll adjust the plan

**Let's build something amazing!** 💪
