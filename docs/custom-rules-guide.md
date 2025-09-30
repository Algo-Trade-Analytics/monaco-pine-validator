# Custom Rule Guide

The validator supports two kinds of custom rules:

- **Raw rules** scan the original source text with a regular expression or callback.
- **AST rules** traverse the Chevrotain AST and can emit diagnostics with full structural awareness.

## Raw rules

Raw rules are unchanged from previous releases. Provide a `pattern` (RegExp or callback) and the validator will iterate over `context.cleanLines` unless you disable it with `enableCustomRuleRawScan: false` in the config.

```ts
const rawRule = {
  id: 'NO-TABS',
  severity: 'warning',
  message: 'Use spaces instead of tabs.',
  pattern: /\t/,
};
```

## AST rules

AST-aware rules define a `visitAst` function. The validator now aggregates the returned matches and reports them with the supplied severity/message. You can build visitors manually with `visit` from `core/ast/traversal`, or use the helper below.

```ts
import { createAstVisitorRule } from '../core/custom-rules';

const rule = createAstVisitorRule({
  id: 'FUNC-NAMING',
  message: 'Function names should be camelCase.',
  severity: 'warning',
  visitor: ({ report }) => ({
    FunctionDeclaration: {
      enter: (path) => {
        const name = path.node.identifier?.name ?? '';
        if (/^[A-Z]/.test(name)) {
          report({
            line: path.node.loc.start.line,
            column: path.node.loc.start.column,
            message: `Rename '${name}' to camelCase.`,
          });
        }
      },
    },
  }),
});
```

The helper returns a fully-formed `ValidationRule` with `mode: 'ast'`. Each `report` call may override severity, message, suggestion, or code. If you need more control, implement `visitAst(program, context)` directly and return an array of matches.

## Configuration

Add rules through the existing `customRules` array on the validator config. To turn off raw scanning and rely solely on AST hooks:

```ts
validator.validate(code, { enableCustomRuleRawScan: false, customRules: [rule] });
```

Raw and AST hooks can coexist; set `mode: 'both'` on a rule to use both pathways simultaneously.
