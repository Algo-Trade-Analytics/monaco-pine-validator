import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

type Scenario = {
  name: string;
  code: string;
  expect: {
    errors?: string[];
    warnings?: string[];
    errorsAnyOf?: string[];
    warningsAnyOf?: string[];
  };
};

const scenariosUrl = new URL('./validator-scenarios.json', import.meta.url);
const scenarios: Scenario[] = JSON.parse(
  fs.readFileSync(scenariosUrl, 'utf8')
);

describe('Validator scenario fixtures', () => {
  const STRICT = process.env.STRICT_SCENARIOS === '1';
  const SNAP = process.env.SNAPSHOT_SCENARIOS === '1';
  const createValidator = () => new EnhancedModularValidator({ strictMode: true });
  const debugSet = new Set(
    (process.env.DUMP_SCENARIOS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );

  const normalize = (items: Array<{
    line: number; column: number; message: string; severity: string; code?: string;
  }>) => {
    const sevRank: Record<string, number> = { error: 0, warning: 1, info: 2 };
    return items
      .map((m) => ({
        severity: m.severity,
        code: m.code || '',
        line: m.line,
        column: m.column,
        // Keep message to catch text drifts; safe because validator messages are deterministic
        message: m.message,
      }))
      .sort((a, b) =>
        sevRank[a.severity] - sevRank[b.severity] ||
        a.code.localeCompare(b.code) ||
        a.line - b.line ||
        a.column - b.column ||
        a.message.localeCompare(b.message)
      );
  };

  for (const s of scenarios) {
    it(s.name, () => {
      const validator = createValidator();
      const res = validator.validate(s.code);
      if (debugSet.size && debugSet.has(s.name)) {
        console.log('DEBUG scenario output', s.name, {
          errors: res.errors.map(e => ({ code: e.code, line: e.line, message: e.message })),
          warnings: res.warnings.map(e => ({ code: e.code, line: e.line, message: e.message })),
          info: res.info.map(e => ({ code: e.code, line: e.line, message: e.message }))
        });
      }
      const errorCodes = Array.from(new Set(res.errors.map(e => e.code).filter(Boolean) as string[]));
      const warningCodes = Array.from(new Set(res.warnings.map(w => w.code).filter(Boolean) as string[]));
      const infoCodes = Array.from(new Set(res.info.map(i => i.code).filter(Boolean) as string[]));

      if (s.expect.errors) {
        for (const c of s.expect.errors) {
          expect(errorCodes).toContain(c);
        }
      }
      if (s.expect.warnings) {
        for (const c of s.expect.warnings) {
          expect(warningCodes).toContain(c);
        }
      }

      if (s.expect.errorsAnyOf && s.expect.errorsAnyOf.length) {
        expect(errorCodes.some(c => s.expect.errorsAnyOf!.includes(c))).toBe(true);
      }
      if (s.expect.warningsAnyOf && s.expect.warningsAnyOf.length) {
        expect(warningCodes.some(c => s.expect.warningsAnyOf!.includes(c))).toBe(true);
      }

      // Strict mode: fail on unexpected extras
      if (STRICT) {
        const allowedErrors = new Set<string>(s.expect.errors || []);
        const allowedWarnings = new Set<string>(s.expect.warnings || []);

        // If anyOf is provided, only the actually seen subset is allowed
        if (s.expect.errorsAnyOf && s.expect.errorsAnyOf.length) {
          for (const c of errorCodes) {
            if (s.expect.errorsAnyOf.includes(c)) allowedErrors.add(c);
          }
        }
        if (s.expect.warningsAnyOf && s.expect.warningsAnyOf.length) {
          for (const c of warningCodes) {
            if (s.expect.warningsAnyOf.includes(c)) allowedWarnings.add(c);
          }
        }

        const unexpectedErrors = errorCodes.filter(c => !allowedErrors.has(c));
        const unexpectedWarnings = warningCodes.filter(c => !allowedWarnings.has(c));
        if (unexpectedErrors.length || unexpectedWarnings.length) {
          console.error('Unexpected validator codes', {
            scenario: s.name,
            unexpectedErrors,
            unexpectedWarnings,
            allErrors: errorCodes,
            allWarnings: warningCodes,
            info: infoCodes
          });
        }
        expect(unexpectedErrors.length).toBe(0);
        expect(unexpectedWarnings.length).toBe(0);
      }

      // Optional snapshot of full, normalized messages to catch any drift
      if (SNAP) {
        const snapshot = normalize([
          ...res.errors,
          ...res.warnings,
          ...res.info,
        ] as any);
        expect(snapshot).toMatchSnapshot();
      }
    });
  }
});
