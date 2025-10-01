# Tests Currently Being Worked On

**Last Updated:** October 01, 2025 - 18:44

---

## ✅ COMPLETED (Don't modify - already fixed)

### Switch/While Syntax Tests (4 tests) - DONE by Claude
**Session Result:** 32 tests fixed (4 direct + 28 cascading)

### Drawing Utility Functions (3 tests) - PARTIAL by Claude  
**Session Result:** 5 tests fixed (3 getters + 2 cascading)

### Type Annotation Suggestions (1 test) - DONE by Codex
**Session Result:** 1 test fixed

### Migration Verification - Methods & Integration (2 tests) - DONE by Codex
**Session Result:** 2 tests fixed (method declarations + complex script)

### Drawing Enum Validation (4 tests) - DONE by Codex
**Session Result:** 4 tests fixed (plot/shape constants, wrong namespace guard, hline styles)

---

## 🚫 CURRENTLY LOCKED (AI actively working)

### 🤖 CODEX: IDLE 🆓
- Ready to pull next task

### 🤖 CLAUDE: 96.4% COVERAGE! 🎯 (LOCKED)
**Progress:** 136 → 52 failed (**84 tests fixed!**)
**Latest Fixes:**
  • plotshape + type compatibility (series accepts bool): 11 tests
  • Matrix functions (stdev, covariance, etc.): 2 tests  
  • chart.point.from_index: 1 test
**Coverage:** 96.4%
**Started:** 18:35

---

## 📋 TASK POOL (Pull ONE task at a time)

### Available Tasks (51 failing tests remaining)

**Task 1:** Enum function parameters (9 tests) 🟡 MEDIUM - **GOOD NEXT PICK**
**Task 2:** Multiline function calls (1 test) ⚠️ INVESTIGATION
**Task 3:** Chart.point integration (1 test) 🟡 MEDIUM - **GOOD NEXT PICK**
**Task 4:** Scenario fixtures (11 tests) 🟡 MEDIUM - test expectation analysis needed
**Task 5:** Ultimate validator integration (1 test) 🔴 HIGH
**Task 6:** Monaco E2E (1 test) 🔴 HIGH
**Task 7:** Parser-dependent (~70 tests) 🔴 VERY HIGH

---

## 📊 Session Statistics

**Progress:**
- **Start:** 136 failed | 1299 passed (90.5%)
- **Current:** 51 failed | 1435 passed (96.6%)
- **Fixed:** 85 tests (136 → 51)

**Breakdown:**
- Claude: 37 tests
- CODEX: 7 tests
- Cascading: 41 tests

---

**Both AIs IDLE - Ready for assignments**
