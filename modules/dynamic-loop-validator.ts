/**
 * Dynamic For-Loop validation module for Pine Script v6
 * Detects dynamic loop boundaries and modifications to loop index/bounds
 */

import { ValidationModule, ValidationContext, ValidationError, ValidationResult, ValidatorConfig } from '../core/types';

export class DynamicLoopValidator implements ValidationModule {
  name = 'DynamicLoopValidator';
  priority = 76; // run near other control-flow validators

  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private info: ValidationError[] = [];
  private context!: ValidationContext;
  private config!: ValidatorConfig;

  getDependencies(): string[] {
    return ['CoreValidator', 'SyntaxValidator'];
  }

  validate(context: ValidationContext, config: ValidatorConfig): ValidationResult {
    this.reset();
    this.context = context;
    this.config = config;

    this.validateDynamicForLoops();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: new Map(),
      scriptType: null,
    };
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  private addWarning(line: number, column: number, message: string, code: string): void {
    this.warnings.push({ line, column, message, code, severity: 'warning' });
  }

  private addInfo(line: number, column: number, message: string, code: string): void {
    this.info.push({ line, column, message, code, severity: 'info' });
  }

  private validateDynamicForLoops(): void {
    interface ForFrame {
      startLine: number;
      indexVar: string;
      startExpr: string;
      endExpr: string;
      stepExpr: string | null;
      boundVars: Set<string>; // identifiers referenced by start/end/step
    }

    const loopStack: ForFrame[] = [];

    for (let i = 0; i < this.context.cleanLines.length; i++) {
      const raw = this.context.cleanLines[i];
      const line = raw;
      const lineNum = i + 1;

      // for i = <start> to <end> [by <step>]
      const forMatch = line.match(/^\s*for\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s+to\s+(.+?)(?:\s+by\s+(.+?))?\s*$/);
      if (forMatch) {
        const [, indexVar, startExpr, endExpr, stepExprRaw] = forMatch;
        const stepExpr = stepExprRaw ?? null;

        // Heuristic checks for dynamic expressions
        const isStaticNumber = (expr: string) => /^\s*[+\-]?\d+(?:\.\d+)?\s*$/.test(expr);
        const isStaticArith = (expr: string) => /^\s*[+\-]?\d+(?:\.\d+)?(?:\s*[-+*\/]\s*[+\-]?\d+(?:\.\d+)?)*\s*$/.test(expr);
        const isDynamic = (expr: string) => !(isStaticNumber(expr) || isStaticArith(expr));

        if (isDynamic(startExpr)) {
          this.addWarning(lineNum, 1, 'For-loop start bound is dynamic; verify correctness and performance.', 'PSV6-FOR-DYNAMIC-START');
        }
        if (isDynamic(endExpr)) {
          this.addWarning(lineNum, 1, 'For-loop end bound is dynamic; verify correctness and performance.', 'PSV6-FOR-DYNAMIC-END');
        }
        if (stepExpr && isDynamic(stepExpr)) {
          this.addWarning(lineNum, 1, 'For-loop step is dynamic; verify correctness and performance.', 'PSV6-FOR-DYNAMIC-STEP');
        }

        // Collect identifiers referenced in bounds/step to detect modifications later
        const identsIn = (expr: string): string[] => {
          const ids = expr.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) || [];
          const banned = new Set(['to', 'by', 'and', 'or', 'true', 'false', 'na']);
          return ids.filter((id) => !banned.has(id));
        };

        const boundVars = new Set<string>([
          ...identsIn(startExpr),
          ...identsIn(endExpr),
          ...(stepExpr ? identsIn(stepExpr) : []),
        ]);

        loopStack.push({
          startLine: lineNum,
          indexVar,
          startExpr,
          endExpr,
          stepExpr,
          boundVars,
        });
        continue;
      }

      // end of a block
      if (/^\s*end\s*$/.test(line) && loopStack.length > 0) {
        loopStack.pop();
        continue;
      }

      // Inside for-loop: detect modifications
      if (loopStack.length > 0) {
        const current = loopStack[loopStack.length - 1];

        // Reassignment patterns (both = and :=)
        const assignMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(:=|=)\s*/);
        if (assignMatch) {
          const target = assignMatch[1];

          // Index variable modified
          if (target === current.indexVar) {
            this.addWarning(lineNum, 1, `Loop index '${current.indexVar}' modified inside for-loop.`, 'PSV6-FOR-INDEX-MODIFIED');
          }

          // Bound variable modified
          if (current.boundVars.has(target)) {
            this.addWarning(lineNum, 1, `Variable '${target}' used in for-loop bounds modified inside loop.`, 'PSV6-FOR-BOUND-MODIFIED');
          }
        }
      }
    }
  }
}

