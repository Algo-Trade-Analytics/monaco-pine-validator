# Pine Script Validator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

A comprehensive Pine Script v6 validator designed for IDE integration, initially built against the Monaco Editor—the foundation of Visual Studio Code and many other modern code editors.

> **Note:** This project is under active development and is not yet complete. Contributors are welcome to help improve and extend its capabilities.

## Overview

Pine Script is TradingView's proprietary programming language for creating custom technical analysis indicators and trading strategies. While TradingView provides an online editor with built-in validation, there's a growing need for Pine Script tooling in standalone IDEs and code editors.

This project aims to build a robust, extensible validator that can be integrated into various development environments, starting with Monaco Editor-based IDEs (VS Code, Cursor, Monaco-based web editors, etc.) and potentially expanding to other editors in the future.

## Key Features

### Validation Engine

- **47+ Validation Modules** covering all aspects of Pine Script v6:
  - Core syntax validation
  - Type system and type inference
  - Scope management
  - User-defined types (UDTs) and enums
  - Strategy and indicator validation
  - Function parameter validation
  - Performance analysis
  - Style and quality checks
  - And much more...

- **Modular Architecture**: Choose between:
  - `ModularUltimateValidator` - Lightweight validation with core modules
  - `EnhancedModularValidator` - Comprehensive validation with all 47+ modules

### Parser

- **Chevrotain-based Parser**: Full Pine Script v6 syntax support including:
  - Complex nested expressions and loops
  - Multi-variable declarations
  - Enum declarations and `input.enum`
  - Scientific notation
  - Generic types (`array<chart.point>`)
  - Method declarations
  - All v6-specific features

### Monaco Editor Integration

- **Syntax Highlighting**: Full token-based highlighting for Pine Script
- **Real-time Validation**: Web Worker-based validation for non-blocking UI
- **Error Markers**: Inline error and warning markers in the editor
- **Hover Tooltips**: Context-aware hover information
- **Theme Support**: Light and dark themes optimized for Pine Script

### Interactive Playground

A browser-based playground for testing Pine Script code with:
- Real-time validation feedback
- AST Explorer (using the official `pynescript` parser)
- Sample script snippets
- Theme switching

## Project Structure

```
pine-validator/
├── core/                    # Core validation infrastructure
│   ├── ast/                 # AST parsing and analysis
│   │   ├── parser/          # Chevrotain parser implementation
│   │   ├── nodes.ts         # AST node definitions
│   │   ├── scope.ts         # Scope graph building
│   │   ├── type-inference.ts # Type inference engine
│   │   └── control-flow.ts  # Control flow analysis
│   ├── monaco/              # Monaco Editor integration
│   │   ├── pine-language.ts # Language registration
│   │   ├── worker.ts        # Validation web worker
│   │   └── client.ts        # Worker client
│   ├── base-validator.ts    # Base validator class
│   ├── types.ts             # TypeScript type definitions
│   └── constants.ts         # Pine Script constants
├── modules/                 # Validation modules (47+)
│   ├── core-validator.ts
│   ├── type-validator.ts
│   ├── scope-validator.ts
│   ├── syntax-validator.ts
│   ├── enum-validator.ts
│   ├── udt-validator.ts
│   ├── ta-functions-validator.ts
│   ├── strategy-functions-validator.ts
│   └── ... (and many more)
├── playground/              # Interactive web playground
│   ├── src/
│   │   ├── App.tsx          # Main React application
│   │   └── pine-worker.ts   # Validation worker
│   └── package.json
├── tests/                   # Test suites
│   ├── ast/                 # AST parsing tests
│   ├── e2e/                 # End-to-end tests
│   └── specs/               # Validation specification tests
├── docs/                    # Documentation
└── scripts/                 # Utility scripts
```

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/pine-validator.git
cd pine-validator

# Install dependencies
npm install

# Install playground dependencies
cd playground
npm install
cd ..
```

## Usage

### As a Library

```typescript
import { 
  validatePineScriptV6,
  validatePineScriptV6Enhanced,
  createModularUltimateValidator,
  createEnhancedModularValidator 
} from 'monaco-pine-validator';

// Simple validation
const result = validatePineScriptV6(pineScriptCode);

// Enhanced validation with all modules
const enhancedResult = validatePineScriptV6Enhanced(pineScriptCode);

// Custom configuration
const validator = createEnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enableTypeChecking: true,
  enablePerformanceAnalysis: true,
});
const customResult = validator.validate(pineScriptCode);
```

### Monaco Editor Integration

```typescript
import { registerPineLanguage } from 'monaco-pine-validator';
import * as monaco from 'monaco-editor';

// Register Pine Script language support
registerPineLanguage(monaco);

// Create editor with Pine Script language
const editor = monaco.editor.create(container, {
  language: 'pinescript',
  value: yourPineScriptCode,
});
```

### Running the Playground

```bash
# From the project root
cd playground
npm run dev
```

Open `http://localhost:5173` in your browser.

## Running Tests

```bash
# Run all tests
npm test

# Run AST tests only
npm run test:ast

# Run validator tests
npm run test:validator

# Run E2E tests
npm run test:e2e

# Run Playwright tests
npm run test:playwright
```

## Current Status

### What's Working

| Component | Status | Notes |
|-----------|--------|-------|
| Parser | Fully Working | All Pine Script v6 syntax supported |
| Enum Validation | Working | Requires EnumValidator + UDTValidator |
| Scope Validation | Working | Recognizes enums, UDTs, variables |
| Namespace Validation | Working | Supports nested namespaces |
| Monaco Integration | Working | Syntax highlighting, markers, themes |
| Playground | Working | Real-time validation + AST explorer |

### Known Issues / In Progress

| Component | Status | Notes |
|-----------|--------|-------|
| Function Validation | Has False Positives | Some function signatures need updates |
| Type Inference | Overly Strict | Series inference too conservative |
| Method Scope | Minor Issues | Some variables not recognized in methods |

**Test Results**: 527/530 tests passing (3 pre-existing indentation test failures)

## Contributing

We welcome contributions! This project is in active development and there are many areas where help is needed:

### Areas for Contribution

1. **Validation Module Improvements**
   - Fix false positives in existing validators
   - Add missing function signatures
   - Improve type inference accuracy

2. **Parser Enhancements**
   - Better error recovery
   - More detailed AST information
   - Performance optimizations

3. **IDE Integration**
   - Autocomplete/IntelliSense implementation
   - Go-to-definition support
   - Symbol renaming
   - Code formatting

4. **Documentation**
   - API documentation
   - Usage guides
   - Contribution guidelines

5. **Testing**
   - Additional test cases
   - Edge case coverage
   - Performance benchmarks

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes
6. Push to your fork
7. Create a Pull Request

## Technical Details

### Technology Stack

- **TypeScript**: Primary development language
- **Chevrotain**: Parser generator for the Pine Script lexer and parser
- **Monaco Editor**: Code editor component (VS Code's editor)
- **React**: Playground UI framework
- **Vite**: Build tool for the playground
- **Vitest**: Unit and integration testing
- **Playwright**: End-to-end browser testing

### Architecture Principles

1. **Modularity**: Each validation concern is isolated in its own module
2. **Extensibility**: Easy to add new validation rules and modules
3. **Performance**: Web Worker-based validation for non-blocking UI
4. **Accuracy**: Aims to match TradingView's official validation behavior

### Monaco Editor Context

This validator is built against Monaco Editor because:

- **Wide Adoption**: Monaco is the editor component behind VS Code, the most popular code editor
- **Rich API**: Provides comprehensive APIs for language integration
- **Web-Native**: Works in both desktop (Electron) and web environments
- **Ecosystem**: Integrates with VS Code extensions ecosystem

Monaco-based editors that could benefit from this project:
- Visual Studio Code
- Cursor
- Monaco Editor (web)
- Eclipse Theia
- Gitpod
- GitHub Codespaces
- And many more...

## Roadmap

### Phase 1: Core Validation (Current)
- [x] Pine Script v6 parser
- [x] Core validation modules
- [x] Monaco integration basics
- [x] Web playground

### Phase 2: Enhanced IDE Features
- [ ] Autocomplete/IntelliSense
- [ ] Go-to-definition
- [ ] Find references
- [ ] Symbol outline

### Phase 3: Additional IDE Support
- [ ] VS Code extension
- [ ] Language Server Protocol (LSP) implementation
- [ ] Neovim/Vim support
- [ ] JetBrains IDE support

### Phase 4: Advanced Features
- [ ] Code formatting
- [ ] Refactoring tools
- [ ] Debugging support
- [ ] Pine Script compiler/transpiler

## Related Projects

- [TradingView Pine Script Reference](https://www.tradingview.com/pine-script-reference/)
- [pynescript](https://github.com/pynescript/pynescript) - Python Pine Script parser (used in AST Explorer)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

This means you are free to:
- Use this code commercially
- Modify and distribute it
- Use it privately
- Sublicense it

The only requirement is to include the original copyright notice and license in any copy of the software.

## Acknowledgments

- TradingView for creating Pine Script
- The Monaco Editor team at Microsoft
- The Chevrotain parser library maintainers
- All contributors to this project

---

**Disclaimer**: This is an independent community project and is not affiliated with, endorsed by, or connected to TradingView in any way. Pine Script is a trademark of TradingView.
