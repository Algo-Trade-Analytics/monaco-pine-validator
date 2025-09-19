/**
 * Pine Script v6 Syntax Validator (TypeScript)
 * Focus: syntactic & light structural checks (no type-checking/semantic eval).
 *
 * What it handles well:
 * - Safe comment stripping (keeps strings intact, removes only //)
 * - Multi-line script declarations (indicator/strategy/library)
 * - Positional title string in script declaration
 * - Function declarations: name(args) => (single or multi-line)
 * - Variable declarations: typed/untyped, var/varip/const, tuple destructuring
 * - Reassignment (:=) and valid compound assignments (+= -= *= /= %=)
 * - Qualified identifiers (ta.sma, request.security, label.new, etc.)
 * - Indentation-based blocks (if/else/for/while and =>)
 * - Unmatched (), [], {} (warn on {} usage)
 * - Invalid tokens (++/--/===/!==), negative history refs, na comparisons
 *
 * Extend by adding more namespaces/members or extra rules in RULES section.
 */

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
  relatedLines?: number[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info?: ValidationError[];
}

// -------------------------- CONFIG / TABLES --------------------------

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/;
const QUALIFIED_IDENT = new RegExp(`${IDENT.source}(?:\\.${IDENT.source})*`, 'g');

const KEYWORDS = new Set([
  // control
  'if', 'else', 'for', 'while', 'switch', 'break', 'continue', 'return',
  // decl
  'var', 'varip', 'const',
  // types
  'int', 'float', 'bool', 'string', 'color', 'line', 'label', 'box', 'table', 'array', 'matrix', 'map',
  // roots
  'indicator', 'strategy', 'library', 'import', 'export',
  // literals / logicals
  'true', 'false', 'na', 'and', 'or', 'not',
  // common series built-ins (treated specially elsewhere)
  'open','high','low','close','volume','time','bar_index','last_bar_index',
  'hl2','hlc3','hlcc4','ohlc4','syminfo','timeframe','barstate',
  'ask','bid','dayofmonth','dayofweek','hour','last_bar_time','minute','month','second'
]);

// Recognized namespaces (keep modest to avoid high maintenance)
const NAMESPACES = new Set([
  'ta','math','str','array','matrix','map','color','line','label','box','table',
  'barstate','syminfo','timeframe','session','request','input','strategy','runtime'
  // NOTE: We intentionally do NOT treat 'dividends','earnings','linefill','polyline' as root namespaces
]);

// Minimal member allow-lists (small starter set; extend as needed)
const NS_MEMBERS: Record<string, Set<string>> = {
  ta: new Set(['sma','ema','rsi','macd','stoch','atr','bb','crossover','crossunder','highest','lowest']),
  math: new Set(['max','min','abs','round','floor','ceil']),
  str: new Set(['tostring','tonumber','length','contains']),
  request: new Set(['security','dividends','splits','earnings']),
  input: new Set(['int','float','bool','string','color','source','timeframe','session','symbol']),
  line: new Set(['new','set_xy1','set_xy2','delete','set_color','set_width','set_style']),
  label: new Set(['new','delete','set_text','set_color','set_style']),
  box: new Set(['new','delete']),
  table: new Set(['new','cell','cell_set_text'])
};

// Plot/strategy usage detection
const PLOT_PREFIXES = [/^plot/, /^bgcolor$/, /^hline$/, /^fill$/];
const STRATEGY_PREFIX = /^strategy\./;

// -------------------------- REGEX PATTERNS --------------------------

const VERSION_RE = /^\s*\/\/\s*@version=(\d+)\s*$/;
const SCRIPT_START_RE = /^\s*(indicator|strategy|library)\s*\(/;
const FUNC_DECL_RE = new RegExp(`^\\s*(${IDENT.source})\\s*\\(([^)]*)\\)\\s*=>\\s*?$`);
const VAR_REASSIGN_RE = new RegExp(`\\b(${IDENT.source})\\s*:=`);
const TUPLE_DECL_RE = /^\s*\[\s*([A-Za-z0-9_,\s]+)\s*\]\s*=/;
// typed/untyped var decl: [var|varip|const] [type]? name =
const VAR_DECL_RE = new RegExp(
  `^\\s*(?:(?:var|varip|const)\\s+)?` +
  `(?:(?:int|float|bool|string|color|line|label|box|table|array|matrix|map)\\s+)?` +
  `(${IDENT.source})\\s*=`
);

// -------------------------- VALIDATOR --------------------------

class PineV6Validator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private rawLines: string[] = [];
  private cleanLines: string[] = [];

  private hasVersion = false;
  private scriptType: 'indicator'|'strategy'|'library'|null = null;
  private scriptDeclSpan: {start: number, end: number} | null = null;

  private declared = new Map<string, number>(); // name -> line
  private used = new Set<string>();

  // structure/blocks
  private indentStack: number[] = [0];

  // running bracket depth (across lines)
  private paren = 0;
  private bracket = 0;
  private brace = 0;

  validate(code: string): ValidationResult {
    this.reset();
    this.rawLines = code.split('\n');

    // 1) Strip only '//' comments safely (respect strings)
    const stripped = this.stripLineCommentsKeepingStrings(code);
    this.cleanLines = stripped.split('\n');

    // 2) Scan lines (track brackets across lines)
    for (let i = 0; i < this.cleanLines.length; i++) {
      const line = this.cleanLines[i];
      const n = i + 1;
      this.scanLine(line, n);
    }

    // 3) Post checks
    this.checkOverall();
    // unmatched after EOF
    if (this.paren !== 0) this.addError(this.cleanLines.length, 1, 'Unmatched parentheses across script.', 'PS009');
    if (this.bracket !== 0) this.addError(this.cleanLines.length, 1, 'Unmatched square brackets across script.', 'PS010');
    if (this.brace !== 0) this.addWarning(this.cleanLines.length, 1, 'Curly braces are not used for blocks in Pine Script.', 'PS011');

    // 4) Unused vars
    for (const [name, line] of this.declared.entries()) {
      if (!this.used.has(name) && !KEYWORDS.has(name)) {
        this.addWarning(line, 1, `Variable '${name}' is declared but never used.`, 'PSU01');
      }
    }

    return { isValid: this.errors.length === 0, errors: this.errors, warnings: this.warnings, info: [] };
  }

  private reset() {
    this.errors = [];
    this.warnings = [];
    this.rawLines = [];
    this.cleanLines = [];
    this.hasVersion = false;
    this.scriptType = null;
    this.scriptDeclSpan = null;
    this.declared.clear();
    this.used.clear();
    this.indentStack = [0];
    this.paren = this.bracket = this.brace = 0;
  }

  // ---- Core per-line pass
  private scanLine(line: string, lineNum: number) {
    const t = line.trim();
    if (t === '') return;

    // version
    if (VERSION_RE.test(line)) {
      const m = line.match(VERSION_RE)!;
      if (this.hasVersion) {
        this.addError(lineNum, 1, 'Multiple //@version directives. Only one allowed.', 'PS002');
      }
      const v = parseInt(m[1], 10);
      if (lineNum !== 1) this.addWarning(lineNum, 1, 'Version directive should be on the first line.', 'PSW01');
      if (v < 5) this.addWarning(lineNum, 1, `Pine version ${v} is deprecated. Prefer v5 or v6.`, 'PSW02');
      this.hasVersion = true;
      return;
    }

    // script declaration (may be multiline)
    if (!this.scriptType && SCRIPT_START_RE.test(line)) {
      this.parseScriptDeclaration(lineNum);
      return;
    }

    // indentation / block starts (no colons in Pine)
    this.handleIndentation(line, lineNum);

    // brackets depth update (safe: comments already stripped, strings preserved)
    this.updateBracketDepths(line);

    // tuple declaration
    if (TUPLE_DECL_RE.test(line)) {
      const m = line.match(TUPLE_DECL_RE)!;
      const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
      for (const name of names) this.handleNewVar(name, lineNum, line.indexOf(name)+1);
    }

    // function declaration: name(args) => (single line tail or multi-line body)
    if (FUNC_DECL_RE.test(line)) {
      const m = line.match(FUNC_DECL_RE)!;
      const name = m[1];
      this.handleNewVar(name, lineNum, line.indexOf(name)+1); // track symbol to avoid "undefined"
      // body may be on next lines; no extra syntax checks here
    }

    // variable reassignment (:=)
    const reas = line.match(VAR_REASSIGN_RE);
    if (reas) {
      const name = reas[1];
      if (!this.declared.has(name)) {
        this.addError(lineNum, line.indexOf(name)+1, `Variable '${name}' not declared before ':='. Use '=' on first assignment.`, 'PS016');
      }
      this.used.add(name);
    }

    // variable declaration: typed/untyped, var/varip/const optional
    const decl = line.match(VAR_DECL_RE);
    if (decl) {
      const name = decl[1];
      this.handleNewVar(name, lineNum, line.indexOf(name)+1);
    }

    // operator rules
    this.checkOperators(line, lineNum);

    // history refs: negative indexes
    const negHist = line.match(/\[\s*-\d+\s*\]/);
    if (negHist) {
      this.addError(lineNum, (negHist.index ?? 0)+1, 'Invalid history reference: negative indexes are not allowed.', 'PS024');
    }

    // na comparisons
    const naCmp = line.match(/(\bna\s*==)|(\bna\s*!=)|(==\s*na\b)|(!=\s*na\b)/);
    if (naCmp) {
      this.addError(lineNum, (naCmp.index ?? 0)+1,
        "Comparison with 'na' doesn’t work as expected. Use na(value) to test for not-a-number.", 'PS023');
    }

    // curly braces present (not for blocks)
    if (/[{}]/.test(line)) {
      this.addWarning(lineNum, 1, 'Curly braces are not used for code blocks in Pine Script.', 'PSB01');
    }

    // collect identifiers for undefined/use checks + indicator/strategy usage hints
    this.scanReferences(line, lineNum);
  }

  // ---- Utilities

  private stripLineCommentsKeepingStrings(text: string): string {
    let out = '';
    let inStr: '"' | "'" | null = null;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = i + 1 < text.length ? text[i+1] : '';

      if (inStr) {
        out += ch;
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === inStr) {
          inStr = null;
        }
        continue;
      }

      // start of string?
      if (ch === '"' || ch === "'") {
        inStr = ch as '"' | "'";
        out += ch;
        continue;
      }

      // start of line comment?
      if (ch === '/' && next === '/') {
        // skip until end of line
        while (i < text.length && text[i] !== '\n') i++;
        out += '\n';
        continue;
      }

      // keep other chars
      out += ch;
    }
    return out;
  }

  private parseScriptDeclaration(startLine: number) {
    // Accumulate until paren depth returns to zero
    let depth = 0;
    let buf = '';
    let endLine = startLine;
    for (let i = startLine - 1; i < this.cleanLines.length; i++) {
      const line = this.cleanLines[i];
      for (const c of line) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
      }
      buf += line + '\n';
      endLine = i + 1;
      if (depth === 0) break;
    }

    // detect type
    const m = buf.match(/^\s*(indicator|strategy|library)\s*\(/);
    if (m) {
      this.scriptType = m[1] as any;
      this.scriptDeclSpan = { start: startLine, end: endLine };

      // must contain a string literal argument (positional or named)
      if (!/["']/.test(buf)) {
        this.addError(startLine, 1, 'Script declaration must include a title string argument.', 'PS005');
      }
    } else {
      this.addError(startLine, 1, 'Malformed script declaration.', 'PS004');
    }
  }

  private handleIndentation(line: string, lineNum: number) {
    const indent = line.length - line.trimStart().length;
    const top = this.indentStack[this.indentStack.length - 1];

    if (indent > top) {
      // allow indent only if previous non-empty line was a block starter
      const prev = this.findPrevNonEmpty(lineNum - 1);
      if (prev && this.isBlockStart(prev)) {
        this.indentStack.push(indent);
      } else {
        this.addError(lineNum, 1, 'Unexpected indentation. Blocks begin after if/else/for/while or a function declaration (=>).', 'PS019');
      }
    } else if (indent < top) {
      while (this.indentStack.length > 1 && indent < this.indentStack[this.indentStack.length - 1]) {
        this.indentStack.pop();
      }
      if (indent !== this.indentStack[this.indentStack.length - 1]) {
        this.addError(lineNum, 1, 'Invalid unindent; does not match any open block.', 'PS018');
      }
    }
  }

  private findPrevNonEmpty(lineNum: number): string | null {
    for (let i = lineNum - 1; i >= 0; i--) {
      const t = this.cleanLines[i].trim();
      if (t !== '') return this.cleanLines[i];
    }
    return null;
  }

  private isBlockStart(line: string): boolean {
    const t = line.trim();
    return /^if\b/.test(t) || /^else\b/.test(t) || /^for\b/.test(t) || /^while\b/.test(t) || /\)\s*=>\s*$/.test(t);
  }

  private updateBracketDepths(line: string) {
    // strings are kept; but we only want to count brackets outside strings
    let inStr: '"' | "'" | null = null;
    let escape = false;
    for (const ch of line) {
      if (inStr) {
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === inStr) { inStr = null; continue; }
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = ch as any; continue; }

      if (ch === '(') this.paren++;
      else if (ch === ')') this.paren--;
      else if (ch === '[') this.bracket++;
      else if (ch === ']') this.bracket--;
      else if (ch === '{') this.brace++;
      else if (ch === '}') this.brace--;
    }
  }

  private handleNewVar(name: string, line: number, col: number) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      this.addError(line, col, `Invalid identifier '${name}'.`, 'PS006');
      return;
    }
    if (KEYWORDS.has(name)) {
      this.addError(line, col, `Identifier '${name}' conflicts with a Pine keyword/builtin.`, 'PS007');
      return;
    }
    if (this.declared.has(name)) {
      this.addWarning(line, col, `Identifier '${name}' already declared; use ':=' to reassign.`, 'PSW03');
    } else {
      this.declared.set(name, line);
    }
  }

  private checkOperators(line: string, lineNum: number) {
    // invalid ones
    for (const op of ['===','!==','++','--']) {
      const idx = line.indexOf(op);
      if (idx >= 0) this.addWarning(lineNum, idx+1, `Operator '${op}' is not valid in Pine Script.`, 'PSO01');
    }
    // if-line accidental assignment
    if (/^\s*if\b/.test(line)) {
      // look for a standalone '=' that is not part of '==', '>=', '<=', '!='
      const bad = /(^|\s)[^=!<>]=([^=])/;
      const m = line.match(bad);
      if (m) {
        const col = (m.index ?? line.indexOf('=')) + 1;
        this.addWarning(lineNum, col, 'Assignment "=" inside condition; did you mean "==" for comparison?', 'PSO02');
      }
    }
  }

  private scanReferences(line: string, lineNum: number) {
    const toks = line.match(QUALIFIED_IDENT) ?? [];
    for (const tok of toks) {
      if (KEYWORDS.has(tok)) continue;

      // namespace.member
      const parts = tok.split('.');
      if (parts.length > 1 && NAMESPACES.has(parts[0])) {
        // optionally check member existence (best-effort)
        const ns = parts[0];
        const member = parts.slice(1).join('.');
        if (NS_MEMBERS[ns] && parts.length === 2 && !NS_MEMBERS[ns].has(parts[1])) {
          // soft hint only; Pine adds members over time
          // this.addInfo(lineNum, line.indexOf(tok)+1, `Unknown ${ns} member '${parts[1]}' (validator list may be outdated).`);
        }
        this.used.add(tok);
        continue;
      }

      // bare identifier use
      this.used.add(tok);
      if (!this.declared.has(tok) && !KEYWORDS.has(tok)) {
        // likely a reference before declaration — only warn if it looks variable-like context
        // (heuristic: around equals or parentheses)
        const idx = line.indexOf(tok);
        const ctx = line.slice(Math.max(0, idx-2), idx+tok.length+2);
        if (/[=\s(,)]/.test(ctx)) {
          this.addWarning(lineNum, idx+1, `Potential undefined reference '${tok}'.`, 'PSU02');
        }
      }
    }

    // plot/strategy usage for hints
    const tt = line.trim();
    if (PLOT_PREFIXES.some(rx => rx.test(tt))) this.used.add('__plot__');
    if (STRATEGY_PREFIX.test(tt)) this.used.add('__strategy__');
  }

  private checkOverall() {
    if (!this.hasVersion) {
      this.addError(1, 1, 'Missing version directive. Add //@version=6 at the top.', 'PS012');
    }
    if (!this.scriptType) {
      this.addError(this.hasVersion ? 2 : 1, 1, 'Missing script declaration. Add indicator(), strategy(), or library().', 'PS013');
    } else {
      // usage hints
      if (this.scriptType === 'indicator' && !this.used.has('__plot__')) {
        this.addWarning(1, 1, "This 'indicator' has no plot/bgcolor/hline/fill calls; it may display nothing.", 'PS014');
      }
      if (this.scriptType === 'strategy' && !this.used.has('__strategy__')) {
        this.addWarning(1, 1, "This 'strategy' does not call strategy.* functions; it may not trade.", 'PS015');
      }
    }
  }

  // ---- reporting
  private addError(line: number, column: number, message: string, code?: string) {
    this.errors.push({ line, column, message, severity: 'error', code });
  }
  private addWarning(line: number, column: number, message: string, code?: string) {
    this.warnings.push({ line, column, message, severity: 'warning', code });
  }
}

const pineScriptValidator = new PineV6Validator();

export function validatePineScript(code: string): ValidationResult {
  return pineScriptValidator.validate(code);
}

export function validatePineV6(code: string): ValidationResult {
  return pineScriptValidator.validate(code);
}

// Re-export enhanced validator for advanced features
export { 
  EnhancedPineV6Validator, 
  validatePineV6Enhanced,
  type ValidatorConfig,
  type CompletionItem,
  type TypeInfo
} from './enhancedPineScriptValidator';
