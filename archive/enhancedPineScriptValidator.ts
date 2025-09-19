/**
 * Enhanced Pine Script v6 Validator — Full Featured (TypeScript)
 *
 * Scope: syntax + light structural validation with pragmatic heuristics.
 * Not a full compiler/semantic checker; aims to minimize false positives.
 *
 * Highlights
 * - Safe stripping of `//` comments; Pine has only single-line comments.
 * - Multi-line script declarations (indicator/strategy/library) with positional or named title strings.
 * - Function declarations: name(args) => (single-line or multi-line bodies).
 * - Variable declarations: typed/untyped, var/varip/const, tuple destructuring.
 * - Reassignment (:=) and valid compound assignments (+= -= *= /= %=); warns on ++/--/===/!==/&&/||.
 * - Qualified identifiers (e.g., ta.sma, request.security, label.new) via a tokenizer that keeps dots.
 * - Indentation-based block tracking after if/else/for/while or function decl (=>). No `{}` blocks in Pine.
 * - Cross-line tracking of (), [], {} with warnings for braces usage, errors on imbalance.
 * - Negative history references error; `na` comparisons warn with suggestion to use na(x).
 * - Indicator/Strategy sanity hints (no plot / no strategy.* usage).
 * - Optional extras: completions, hover info, custom rules, strict mode toggles, performance & control-flow analysis.
 */

// ────────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────────

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
  info: ValidationError[];
  typeMap: Map<string, TypeInfo>;
  scriptType: 'indicator' | 'strategy' | 'library' | null;
}

export interface TypeInfo {
  type: 'int' | 'float' | 'bool' | 'string' | 'color' | 'series' | 'line' | 'label' | 'box' | 'table' | 'array' | 'matrix' | 'map' | 'unknown';
  isConst: boolean;
  isSeries: boolean; // heuristic: true when RHS contains series/history or series builtins
  declaredAt: { line: number; column: number };
  usages: Array<{ line: number; column: number }>;
}

export interface CompletionItem {
  label: string;
  kind: 'function' | 'variable' | 'keyword' | 'namespace' | 'type';
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface ValidatorConfig {
  targetVersion: 4 | 5 | 6;
  strictMode: boolean; // enable opinionated hints
  allowDeprecated: boolean; // reduce noise for legacy constructs
  enableTypeChecking: boolean;
  enableControlFlowAnalysis: boolean;
  enablePerformanceAnalysis: boolean;
  customRules: ValidationRule[]; // user-injected simple rules
  ignoredCodes: string[]; // filter out codes by id
}

export interface ValidationRule {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  pattern: RegExp | ((line: string, lineNum: number, ctx: ValidationContext) => boolean);
  suggestion?: string;
}

export interface ValidationContext {
  lines: string[];
  typeMap: Map<string, TypeInfo>;
  usedVars: Set<string>;
  scriptType: 'indicator' | 'strategy' | 'library' | null;
  version: number;
}

// ────────────────────────────────────────────────────────────────────────────────
// Core symbol tables (conservative; keep small to avoid staleness)
// ────────────────────────────────────────────────────────────────────────────────

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/;
const QUALIFIED_IDENT = new RegExp(`${IDENT.source}(?:\\.${IDENT.source})*`, 'g');
const WILDCARD_IDENT = new Set(['_']);

const PSEUDO_VARS = new Set(['time','timenow','bar_index','last_bar_index','open','high','low','close','volume']);

const KEYWORDS = new Set([
  // control
  'if','else','for','while','switch','break','continue','return','to','by',
  // decl
  'var','varip','const','type','method','import','export','as',
  // types
  'int','float','bool','string','color','line','label','box','table','array','matrix','map',
  // literals/logicals
  'true','false','na','and','or','not',
  // builtins/vars from docs
  'ask','bid',
  'barstate.isconfirmed','barstate.isfirst','barstate.ishistory','barstate.islast','barstate.islastconfirmedhistory','barstate.isnew','barstate.isrealtime',
  'box.all',
  'chart.bg_color','chart.fg_color','chart.is_heikinashi','chart.is_renko','chart.is_linebreak','chart.is_kagi','chart.is_pnf','chart.is_range','chart.is_standard','chart.left_visible_bar_time','chart.right_visible_bar_time',
  'dayofmonth','dayofweek',
  'dividends.future_amount','dividends.future_ex_date','dividends.future_pay_date',
  'earnings.future_eps','earnings.future_period_end_time','earnings.future_revenue','earnings.future_time',
  'hl2','hlc3','hlcc4','ohlc4',
  'hour','minute','month','second','last_bar_time','year','weekofyear',
  'label.all',
  'line.all', 'linefill.all',
  'polyline.all',
  'session.isfirstbar','session.isfirstbar_regular','session.islastbar','session.islastbar_regular','session.ismarket','session.ispostmarket','session.ispremarket',
  'strategy.account_currency','strategy.avg_losing_trade','strategy.avg_trade','strategy.avg_winning_trade','strategy.closedtrades','strategy.equity','strategy.eventrades','strategy.grossloss','strategy.grossprofit','strategy.initial_capital','strategy.losstrades','strategy.margin_liquidation_price','strategy.max_contracts_held_all','strategy.max_drawdown','strategy.max_runup','strategy.netprofit','strategy.openprofit','strategy.opentrades','strategy.position_avg_price','strategy.position_size','strategy.wintrades',
  'syminfo.basecurrency',
  // common built-in functions
  'plot','plotshape','plotchar','plotcandle','plotbar','bgcolor','hline','fill','barcolor',
  'alert','alertcondition','log','timestamp',
  // roots
  'indicator','strategy','library'
]);

const NAMESPACES = new Set([
  'ta','math','str','array','matrix','map','color','line','label','box','table',
  'barstate','syminfo','timeframe','session','request','input','strategy','runtime',
  'chart', 'dividends', 'earnings', 'linefill', 'polyline'
]);

const NS_MEMBERS: Record<string, Set<string>> = {
  ta: new Set(['sma','ema','rsi','macd','stoch','atr','bb','highest','lowest','crossover','crossunder','sar','roc','mom','change','correlation','dev','linreg','percentile_linear_interpolation','percentile_nearest_rank','percentrank','pivothigh','pivotlow','range','stdev','variance','wma','alma','vwma','swma','rma','hma','tsi','cci','cmo','mfi','obv','pvt','nvi','pvi','wad']),
  math: new Set(['max','min','abs','round','floor','ceil','pow','sqrt','log','exp','sin','cos','tan','asin','acos','atan','todegrees','toradians','sign','sum','avg','random','round_to_mintick']),
  str: new Set(['tostring','tonumber','length','contains','substring','replace','split','format','startswith','endswith','pos','match','trim','upper','lower']),
  request: new Set(['security','security_lower_tf','dividends','splits','earnings','economic','quandl','financial']),
  input: new Set(['int','float','bool','string','color','source','timeframe','session','symbol','resolution','defval','title','tooltip','inline','group','confirm']),
  line: new Set(['new','set_xy1','set_xy2','set_color','set_width','set_style','delete','set_x1','set_x2','set_y1','set_y2','get_x1','get_x2','get_y1','get_y2','copy','all']),
  label: new Set(['new','set_text','set_color','set_style','delete','set_x','set_y','set_xy','set_textcolor','set_size','set_textalign','get_x','get_y','get_text','copy','all']),
  box: new Set(['new','delete','set_bgcolor','set_border_color','set_border_width','set_border_style','set_left','set_right','set_top','set_bottom','set_lefttop','set_rightbottom','get_left','get_right','get_top','get_bottom','copy','all']),
  table: new Set(['new','cell','cell_set_text','cell_set_bgcolor','cell_set_text_color','cell_set_text_size','delete','clear','set_position','set_bgcolor','set_border_color','set_border_width','set_frame_color','set_frame_width','all'])
};

const PLOT_CALL_RE = /\b(?:plot|bgcolor|hline|fill|barcolor|plotcandle|plotbar|plotchar|plotshape)\s*\(/;
const STRATEGY_ANY_RE = /\bstrategy\./;

// ────────────────────────────────────────────────────────────────────────────────
// Patterns
// ────────────────────────────────────────────────────────────────────────────────

const VERSION_RE = /^\uFEFF?\s*\/\/\s*@version=(\d+)\s*$/; // Pine supports only // comments, BOM-tolerant
const SCRIPT_START_RE = /^\s*(indicator|strategy|library)\s*\(/;
const QUALIFIED_FN_RE = new RegExp(
  `^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(([^)]*)\\)\\s*=>`
);
const METHOD_DECL_RE = new RegExp(
  `^\\s*method\\s+(${IDENT.source})\\s*\\(([^)]*)\\)\\s*=>`
);
const VAR_REASSIGN_RE = new RegExp(`\\b(${IDENT.source})\\s*:=`);
const COMPOUND_ASSIGN_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*([+\-*/%])=\s*(?![=])/;
const ELEM_REASSIGN_RE = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[[^\]]+\]\s*:=/;
const ELEM_COMPOUND_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\[[^\]]+\]\s*([+\-*/%])=\s*(?![=])/;
const SIMPLE_ASSIGN_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^=]/;
const TUPLE_DECL_RE = /^\s*\[\s*([A-Za-z0-9_.,\s]+)\s*\]\s*=/;
const TUPLE_REASSIGN_RE = /^\s*\[\s*([A-Za-z0-9_.,\s]+)\s*\]\s*:=/;
const VAR_DECL_RE = new RegExp(
  `^\\s*(?:(?:var|varip|const)\\s+)?` +
  `(?:(?:int|float|bool|string|color|line|label|box|table|array|matrix|map)\\s+)?` +
  `(${IDENT.source})\\s*=`
);

// ────────────────────────────────────────────────────────────────────────────────
// Validator
// ────────────────────────────────────────────────────────────────────────────

export class EnhancedPineV6Validator {
  protected errors: ValidationError[] = [];
  protected warnings: ValidationError[] = [];
  protected info: ValidationError[] = [];
  protected typeMap = new Map<string, TypeInfo>();
  protected lines: string[] = [];
  private rawLines: string[] = [];
  protected cleanLines: string[] = [];
  protected context: ValidationContext;

  private hasVersion = false;
  private firstVersionLine: number | null = null;
  private scriptType: 'indicator'|'strategy'|'library'|null = null;
  private scriptDeclParsed = false;
  private sawBrace = false;
  private sawTabIndent = false;
  private sawSpaceIndent = false;

  private declared = new Map<string, number>(); // name -> line
  private declIndent = new Map<string, number>(); // name -> indent level
  private declaredSites = new Set<string>(); // key: `${line}:${name}`
  private constNames = new Set<string>();
  private functionNames = new Set<string>();
  private methodNames = new Set<string>();
  private functionParams = new Map<string, string[]>();
  private functionHeaderLine = new Map<string, number>();
  private used = new Set<string>();
  private regexCache = new Map<string, RegExp>();
  private namedArgCache = new Map<string, Set<string>>();
  private seenDupChecks = new Set<string>();
  private paramUsage = new Map<string, Set<string>>();
  private typeFields = new Map<string, Set<string>>(); // type name -> field names

  private scopeStack: { indent: number; params: Set<string>; fnName: string | null; }[] = [];
  private indentStack: number[] = [0];
  private paren = 0; private bracket = 0; private brace = 0;

  constructor(protected config: Partial<ValidatorConfig> = {}) {
    this.config = {
      targetVersion: 6,
      strictMode: false,
      allowDeprecated: true,
      enableTypeChecking: true,
      enableControlFlowAnalysis: true,
      enablePerformanceAnalysis: false,
      customRules: [],
      ignoredCodes: [],
      ...config
    };
    
    this.context = {
      lines: this.lines,
      typeMap: this.typeMap,
      usedVars: this.used,
      scriptType: null,
      version: this.config.targetVersion || 6
    };
  }

  private reset() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.typeMap.clear();
    this.lines = [];
    this.rawLines = [];
    this.cleanLines = [];
    this.hasVersion = false;
    this.firstVersionLine = null;
    this.scriptType = null;
    this.scriptDeclParsed = false;
    this.sawBrace = false;
    this.sawTabIndent = false;
    this.sawSpaceIndent = false;
    this.declared.clear();
    this.declIndent.clear();
    this.declaredSites.clear();
    this.constNames.clear();
    this.functionNames.clear();
    this.methodNames.clear();
    this.functionParams.clear();
    this.functionHeaderLine.clear();
    this.used.clear();
    this.regexCache.clear();
    this.namedArgCache.clear();
    this.seenDupChecks.clear();
    this.paramUsage.clear();
    this.typeFields.clear();
    this.scopeStack = [{ indent: -1, params: new Set(), fnName: null }];
    this.indentStack = [0];
    this.paren = 0;
    this.bracket = 0;
    this.brace = 0;
  }

  validate(code: string): ValidationResult {
    this.reset();

    // strip a UTF-8 BOM if present and normalize newlines
    code = code.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

    this.rawLines = code.split('\n');
    this.lines = this.rawLines.slice();
    this.context.lines = this.lines;
    const stripped = this.stripLineCommentsKeepingStrings(code);
    this.cleanLines = stripped.split('\n');

    //
    // Robust script declaration prepass (multiline, tolerant)
    //
    const scriptDeclPre = stripped.match(/^\s*(indicator|strategy|library)\s*\(/m);
    if (scriptDeclPre) {
      this.scriptType = scriptDeclPre[1] as 'indicator'|'strategy'|'library';
      this.scriptDeclParsed = true; // Prevent redundant parsing
    }

    // Pass 1: Collect all function declarations (multi-line aware) to handle forward references
    this.collectFunctions(this.cleanLines);
    
    for (let i = 0; i < this.cleanLines.length; i++) {
      const line = this.cleanLines[i];
      const n = i + 1;
      this.scanLine(line, n);
    }

    // Post checks
    if (!this.hasVersion) this.addError(1,1,'Missing version directive. Add //@version=6 at the top.','PS012');
    if (!this.scriptType) {
        this.addError(this.hasVersion ? 2 : 1, 1, 'Missing script declaration. Add indicator(), strategy(), or library().', 'PS013');
    } else {
        const firstReal = this.cleanLines.findIndex(l => l.trim() && !VERSION_RE.test(l));
        if (firstReal > -1 && !this.hasScriptDeclStartingAtOrSoon(firstReal)) {
            this.addInfo(firstReal + 1, 1, 'Consider placing the script declaration at the top for clarity.', 'PSI01');
        }
    }

    if (this.sawTabIndent && this.sawSpaceIndent) {
        this.addWarning(1, 1, 'Mixed tabs and spaces for indentation detected.', 'PSI02');
    }

    if (this.brace !== 0) this.addError(this.cleanLines.length,1,'Unmatched curly braces across script.', 'PS011');
    else if (this.sawBrace) this.addWarning(this.cleanLines.length, 1, 'Curly braces are not used for blocks in Pine Script.', 'PSB01');
    
    if (this.paren !== 0) this.addError(this.cleanLines.length,1,'Unmatched parentheses across script.','PS009');
    if (this.bracket !== 0) this.addError(this.cleanLines.length,1,'Unmatched square brackets across script.','PS010');

    // Unused vars
    const IGNORE_UNUSED = new Set(['_']);
    const functionParamSet = new Set([...this.functionParams.values()].flat().map(p=>p.trim().split(/\s+/).pop()!));
    for (const [name, line] of this.declared.entries()) {
      if (IGNORE_UNUSED.has(name)) continue;
      if (!this.used.has(name) && !KEYWORDS.has(name) && !this.functionNames.has(name) && !functionParamSet.has(name)) {
        this.addWarning(line,1,`Variable '${name}' is declared but never used.`,'PSU01');
      }
    }
    
    // Unused parameters (ignore `_`)
    for (const [fn, params] of this.functionParams.entries()) {
        // Skip script declarations (indicator/strategy/library)
        if (/^(indicator|strategy|library)$/.test(fn)) continue;
        
        const headerLine = this.functionHeaderLine.get(fn) ?? 1;
        const usedInFn = this.paramUsage.get(fn) ?? new Set<string>();
        
        // Parse parameter names, handling type annotations like "this<Point>"
        const cleanedParams = params.map(s => {
          const cleaned = s.trim().replace(/<[^>]*>/g, ''); // Remove type annotations
          return cleaned.split(/\s+/).pop()!;
        }).filter(Boolean);
        
        for (const p of cleanedParams) {
          if (p === '_' || (this.methodNames.has(fn) && p === 'this')) continue;
          if (!usedInFn.has(p)) {
            this.addWarning(headerLine, 1, `Parameter '${p}' in '${fn}' is never used.`, 'PSU-PARAM');
          }
        }
    }

    // Indicator/strategy sanity hints (after we know usage set)
    if (this.scriptType === 'indicator' && !this.used.has('__plot__')) {
      this.addWarning(1,1,"This 'indicator' has no plot/bgcolor/hline/fill calls; it may display nothing.",'PS014');
    }
    if (this.scriptType === 'strategy' && !this.used.has('__strategy__')) {
      this.addWarning(1,1,"This 'strategy' does not call strategy.* functions; it may not trade.",'PS015');
    }

    // Control-flow analysis (basic, indentation-aware)
    if (this.config.enableControlFlowAnalysis) this.analyzeControlFlow();

    // Performance hints (optional/opinionated)
    if (this.config.enablePerformanceAnalysis) this.analyzePerformance();

    // Custom rules
    this.applyCustomRules();

    // Filter ignored codes
    this.filterIgnoredCodes();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      typeMap: this.typeMap,
      scriptType: this.scriptType,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Scanning
  // ────────────────────────────────────────────────────────────────────────────

  private scanLine(line: string, lineNum: number) {
    const t = line.trim();
    if (t === '') return;
    
    // Cache the line with strings and comments removed for repeated use
    const strippedNoStrings = this.stripStringsAndLineComment(line);

    // Version
    if (VERSION_RE.test(line)) {
      const m = line.match(VERSION_RE)!;
      const v = parseInt(m[1], 10);

      if (this.firstVersionLine === null) {
        if (this.config.targetVersion && v !== this.config.targetVersion) {
            const sev = v < this.config.targetVersion ? 'error' : 'warning';
            this.addBySeverity(sev as any, lineNum, 1,
              `Script declares //@version=${v} but targetVersion is ${this.config.targetVersion}.`,
              'PS001');
        }
        this.firstVersionLine = lineNum;
        this.hasVersion = true;
        if (lineNum !== 1) this.addWarning(lineNum, 1, 'Version directive should be on the first line.', 'PSW01');
        if (v < 5) this.addWarning(lineNum, 1, `Pine version ${v} is deprecated. Prefer v5 or v6.`, 'PSW02');
      } else if (lineNum !== this.firstVersionLine) {
        this.addError(lineNum, 1, 'Multiple //@version directives. Only one allowed.', 'PS002');
      }
      return;
    }

    // Script declaration (accumulate multi-line until parens close)
    if (SCRIPT_START_RE.test(line)) {
      if(this.scriptDeclParsed) {
        // Already parsed by prepass - check if this is a different declaration
        const currentMatch = line.match(SCRIPT_START_RE);
        if (currentMatch && currentMatch[1] !== this.scriptType) {
          this.addError(lineNum, 1, `Multiple script declarations not allowed (already '${this.scriptType}').`, 'PS004B');
        }
        return;
      }
      this.parseScriptDeclaration(lineNum);
      return;
    }
    
    {
      const mType = /^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(strippedNoStrings);
      if (mType) {
          const name = mType[1];
          this.declared.set(name, lineNum);
          this.declIndent.set(name, this.indentStack[this.indentStack.length - 1]);
          
          // Parse type fields from subsequent lines
          this.parseTypeFields(name, lineNum);
      }
    }

    // indentation blocks
    this.handleIndentation(line, lineNum);

    // bracket depths (outside strings)
    this.updateBracketDepths(strippedNoStrings, lineNum);

    // tuple destructuring
    if (TUPLE_REASSIGN_RE.test(strippedNoStrings)) {
        this.addError(lineNum, 1, 'Tuple destructuring must use "=" (not ":=").', 'PST03');
    }
    const tupleMatch = line.match(TUPLE_DECL_RE);
    if (tupleMatch) {
      const content = tupleMatch[1];
      if (/^\s*,|,\s*,|,\s*$/.test(content)) {
        this.addWarning(lineNum, line.indexOf('[') + 1, 'Empty slot in destructuring tuple.', 'PST02');
      }
      const contentOffset = line.indexOf(content, line.indexOf('['));
      const names = content.split(',');
      for (const nameFragment of names) {
          const trimmedName = nameFragment.trim();
          if (!trimmedName || trimmedName === '_') continue;
          const col = contentOffset + nameFragment.indexOf(trimmedName) + 1;
          if (trimmedName.includes('.')) {
              this.addWarning(lineNum, col, 'Dotted names in tuple destructuring are unusual and may indicate an error.', 'PST01', 'Did you mean to destructure into plain identifiers (e.g., [a, b] = foo())?');
          } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedName)) {
              this.handleNewVar(trimmedName, lineNum, col);
          }
      }
    }

    // function declaration
    const funcMatch = line.match(QUALIFIED_FN_RE);
    const methMatch = line.match(METHOD_DECL_RE);
    if (funcMatch) {
        this.functionHeaderLine.set(funcMatch[1], lineNum);
    } else if (methMatch) {
      const name = methMatch[1];
      this.functionHeaderLine.set(name, lineNum);
      // Parse parameter names, handling type annotations like "this<Point>"
      const namesOnly = methMatch[2].split(',').map(p => {
        const cleaned = p.trim().replace(/<[^>]*>/g, ''); // Remove type annotations
        return cleaned.split(/\s+/).pop()!;
      }).filter(Boolean);
      const thisIdx = namesOnly.indexOf('this');
      if (thisIdx > 0) {
        this.addWarning(lineNum, 1, "In methods, 'this' should be the first parameter.", 'PSM01');
      }
    }

    // Reassignment and Compound Assignment
    if (VAR_REASSIGN_RE.test(line)) {
        const m = line.match(VAR_REASSIGN_RE)!;
        const varName = m[1];
        
        // Check for field access pattern (e.g., this.x)
        const fieldAccessMatch = line.match(/(\w+)\.(\w+)\s*:=/);
        if (fieldAccessMatch) {
          const [, objName, fieldName] = fieldAccessMatch;
          if (objName === 'this' && this.currentScope().params.has('this')) {
            // this.field access in method - this is valid
            this.used.add('this');
            this.used.add(fieldName);
            return; // Skip further validation for this pattern
          }
          // Check if objName is declared and fieldName is a valid field
          if (this.declared.has(objName)) {
            this.used.add(objName);
            this.used.add(fieldName);
            return;
          }
        }
        
        if (this.constNames.has(varName)) this.addError(lineNum, line.indexOf(varName) + 1, `Cannot reassign const '${varName}' with ':='.`, 'PS019');
        if (!this.declared.has(varName) && !this.currentScope().params.has(varName)) this.addError(lineNum, line.indexOf(varName)+1,`Variable '${varName}' not declared before ':='. Use '=' on first assignment.`,'PS016');
        this.used.add(varName);
    }
    const elemReassign = strippedNoStrings.match(ELEM_REASSIGN_RE);
    if (elemReassign) {
        const base = elemReassign[1];
        if (this.constNames.has(base)) this.addError(lineNum, line.indexOf(base) + 1, `Cannot update elements of const '${base}'.`, 'PS019');
        if (!this.declared.has(base) && !this.currentScope().params.has(base)) {
            this.addError(lineNum, line.indexOf(base) + 1, `Variable '${base}' not declared before ':=' on element.`, 'PS016A');
        }
        this.used.add(base);
    }
    const comp = line.match(COMPOUND_ASSIGN_RE);
    if (comp) {
        const name = comp[1];
        if (this.constNames.has(name)) this.addError(lineNum, line.indexOf(name)+1, `Cannot update const '${name}' with '${comp[2]}='.`, 'PS019');
        if (!this.declared.has(name) && !this.currentScope().params.has(name)) this.addError(lineNum, line.indexOf(name)+1,`Variable '${name}' not declared before '${comp[2]}='. Use '=' for first assignment or declare it.`, 'PS017');
        this.used.add(name);
    }
    const elemCompound = strippedNoStrings.match(ELEM_COMPOUND_RE);
    if (elemCompound) {
        const base = elemCompound[1], op = elemCompound[2];
        if (this.constNames.has(base)) this.addError(lineNum, line.indexOf(base) + 1, `Cannot update elements of const '${base}' with '${op}='.`, 'PS019');
        if (!this.declared.has(base) && !this.currentScope().params.has(base)) {
            this.addError(lineNum, line.indexOf(base) + 1, `Variable '${base}' not declared before '${op}=' on element.`, 'PS017A');
        }
        this.used.add(base);
    }


    // for loop variable declaration
    const forLoopMatch = strippedNoStrings.match(/^\s*for\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^=]/);
    if (forLoopMatch) {
      const loopVar = forLoopMatch[1];
      this.handleNewVar(loopVar, lineNum, line.indexOf(loopVar) + 1);
      this.registerTypeHeuristic(loopVar, 'int', lineNum, line.indexOf(loopVar) + 1, false);
    }

    // declaration - improved to catch more variable patterns
    if (/^\s*(?:var|varip)\s+const\b/.test(strippedNoStrings)) {
      this.addError(lineNum, 1, 'Invalid declaration: use either var/varip or const, not both.', 'PSD01');
    }
    if (/^\s*(?:(?:var|varip|const)\s+)?(?:(?:int|float|bool|string|color|line|label|box|table|array|matrix|map)\s+)?[A-Za-z_][A-Za-z0-9_]*\s*:=/.test(strippedNoStrings)) {
        this.addError(lineNum, 1, 'Use "=" (not ":=") in declarations.', 'PSD02');
    }
    const decl = line.match(VAR_DECL_RE);
    if (decl) {
      const name = decl[1];
      this.handleNewVar(name, lineNum, line.indexOf(name) + 1);
      const rhs = line.slice(line.indexOf('=') + 1);
      const isConst = /^\s*const\b/.test(line);
      this.registerTypeHeuristic(name, rhs, lineNum, line.indexOf(name) + 1, isConst);
    } else {
        if (SIMPLE_ASSIGN_RE.test(strippedNoStrings)
            && !/^\s*(if|for|while)\b/.test(strippedNoStrings)
            && this.findNamedArgsCached(line).size === 0) {
            const m = strippedNoStrings.match(SIMPLE_ASSIGN_RE)!;
            const varName = m[1];
            const col = line.indexOf(varName) + 1;
      
            if (this.declared.has(varName) && this.constNames.has(varName)) {
              this.addError(lineNum, col, `Cannot reassign const '${varName}' with '='.`, 'PS019');
              return;
            }
      
            if (!KEYWORDS.has(varName)) {
              this.handleNewVar(varName, lineNum, col);
              const rhs = line.slice(line.indexOf('=') + 1);
              this.registerTypeHeuristic(varName, rhs, lineNum, col, false);
            }
        }
    }

    // operators
    this.checkOperators(line, lineNum, strippedNoStrings);

    // history negative
    const negHist = strippedNoStrings.match(/\[\s*-\d+\s*\]/);
    if (negHist) this.addError(lineNum,(negHist.index??0)+1,'Invalid history reference: negative indexes are not allowed.','PS024');

    // na comparisons (warn for both equality and inequality)
    if (/(\bna\s*[!=]=)|([!=]=\s*na\b)/.test(strippedNoStrings)) {
      this.addWarning(lineNum, 1, "Direct comparison with 'na' is unreliable. Use na(x), e.g., na(myValue).", 'PS023', 'Replace `x == na` with `na(x)` and `x != na` with `not na(x)`.');
    }
    
    // references + indicator/strategy usage hints
    this.scanReferences(line, lineNum, strippedNoStrings);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Type System Helpers
  // ────────────────────────────────────────────────────────────────────────────

  private parseTypeFields(typeName: string, startLine: number) {
    const fields = new Set<string>();
    const typeIndent = this.indentStack[this.indentStack.length - 1];
    
    // Look ahead for field declarations
    for (let i = startLine; i < this.cleanLines.length; i++) {
      const line = this.cleanLines[i];
      const lineIndent = line.length - line.trimStart().length;
      
      // Stop if we've unindented back to type level or beyond
      if (i > startLine && lineIndent <= typeIndent && line.trim() !== '') {
        break;
      }
      
      // Parse field declarations (simple type field pattern)
      const fieldMatch = line.match(/^\s+(float|int|bool|string|color)\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (fieldMatch) {
        const fieldName = fieldMatch[2];
        fields.add(fieldName);
        this.declared.set(fieldName, i + 1);
        this.declIndent.set(fieldName, lineIndent);
      }
    }
    
    this.typeFields.set(typeName, fields);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────
  
  protected stripStringsAndLineComment(line: string): string {
    return this.stripStrings(line).replace(/\/\/.*$/, '');
  }

  private collectFunctions(lines: string[]) {
    const START_QUAL = new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(`);
    const START_METH = new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(`);
    let buf = '';
    let startIdx = -1;
    let name: string | null = null;
    let linesSeen = 0;
    const MAX_HDR_LINES = 12;
  
    const reset = () => { buf = ''; startIdx = -1; name = null; linesSeen = 0; };
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (startIdx < 0) {
        const m = line.match(START_QUAL) || line.match(START_METH);
        if (m) {
          const before = line.slice(0, m.index ?? 0);
          const dotted = before.endsWith('.') || /\.\s*$/.test(before);
          const candidate = m[1];
          
          // Skip script declarations (indicator/strategy/library)
          if (/^(indicator|strategy|library)$/.test(candidate)) {
            continue;
          }
          
          if (!dotted && !/=\s*[^=]/.test(line.substring(0, line.indexOf('(')))) {
            startIdx = i;
            name = candidate;
            buf = line + '\n';
            linesSeen = 1;
            
            
            // Check if this line also contains => (single-line method)
            if (/=>/.test(line)) {
              // Process immediately
              const m =
                buf.match(new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm')) ||
                buf.match(new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm'));
              if (m) {
                  const full = m[1];
                  const isMethod = buf.trim().startsWith('method');
                  if(isMethod) this.methodNames.add(full);
                  const params = m[2].split(',').map(s=>s.trim()).filter(Boolean);
                  this.functionNames.add(full);
                  this.functionParams.set(full, params);
                  this.functionHeaderLine.set(full, startIdx + 1);


                  // Parse parameter names, handling type annotations like "this<Point>"
                  const namesOnly = params.map(p => {
                    const cleaned = p.trim().replace(/<[^>]*>/g, ''); // Remove type annotations
                    return cleaned.split(/\s+/).pop()!;
                  }).filter(Boolean);
                  const seen = new Set<string>();
                  namesOnly.forEach((p) => {
                    if (seen.has(p)) {
                      const msg = (isMethod && p === 'this')
                        ? `Duplicate 'this' parameter in method '${full}'.`
                        : `Duplicate parameter '${p}' in function '${full}'.`;
                      this.addError(startIdx + 1, 1, msg, 'PSDUP01');
                    }
                    seen.add(p);
                  });
              }
              reset();
            }
          }
        }
        continue;
      }
  
      // collecting
      if (line.trim() === '') {
        buf += line + '\n';
        continue; // Allow blank lines without penalty
      }
      if (/^(if|for|while|switch|export\s+\S+\s+as\s+\S+)\b/.test(line.trim())) { reset(); continue; }
      buf += line + '\n';
      linesSeen++;
  
      // Header ended without => (very likely a call or something else)
      if (/\)\s*$/.test(line) && !/=>/.test(buf)) { reset(); continue; }
  
      if (/=>/.test(line)) {
        const m =
          buf.match(new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm')) ||
          buf.match(new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(([\\s\\S]*?)\\)\\s*=>`, 'm'));
        if (m) {
            const full = m[1];
            const isMethod = buf.trim().startsWith('method');
            if(isMethod) this.methodNames.add(full);
            const params = m[2].split(',').map(s=>s.trim()).filter(Boolean);
            this.functionNames.add(full);
            this.functionParams.set(full, params);
            this.functionHeaderLine.set(full, startIdx + 1);


            // Parse parameter names, handling type annotations like "this<Point>"
            const namesOnly = params.map(p => {
              const cleaned = p.trim().replace(/<[^>]*>/g, ''); // Remove type annotations
              return cleaned.split(/\s+/).pop()!;
            }).filter(Boolean);
            const seen = new Set<string>();
            namesOnly.forEach((p) => {
              if (seen.has(p)) {
                const msg = (isMethod && p === 'this')
                  ? `Duplicate 'this' parameter in method '${full}'.`
                  : `Duplicate parameter '${p}' in function '${full}'.`;
                this.addError(startIdx + 1, 1, msg, 'PSDUP01');
              }
              seen.add(p);
            });
        }
        reset();
        continue;
      }
  
      if (linesSeen >= MAX_HDR_LINES) reset(); // safety bail
    }
  }

  private stripLineCommentsKeepingStrings(text: string): string {
    const KEEP_VERSION = /^\uFEFF?\s*\/\/\s*@version=\d+\s*$/;
    let out = ''; let inStr: '"' | "'" | null = null; let esc = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i], nxt = text[i + 1] || '';

      // detect and handle '//' comments
      if (!inStr && ch === '/' && nxt === '/') {
        // get the full current line
        let bol = i; while (bol > 0 && text[bol - 1] !== '\n') bol--;
        let eol = i; while (eol < text.length && text[eol] !== '\n') eol++;
        const line = text.slice(bol, eol);

        if (KEEP_VERSION.test(line)) { out += line; i = eol - 1; continue; }
        // drop comment to EOL
        while (i < text.length && text[i] !== '\n') i++;
        out += '\n'; continue;
      }

      if (inStr) {
        out += ch;
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === inStr) { inStr = null; }
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = ch as '"' | "'"; out += ch; continue; }

      out += ch;
    }
    return out;
  }

  protected stripStrings(line: string): string {
    return line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m)=>' '.repeat(m.length));
  }

  private findNamedArgs(line: string): Set<string> {
    const s = this.stripStringsAndLineComment(line);
    const out = new Set<string>();
    let depth = 0;
    let inFunctionCall = false;
    
    // Check if this is a script declaration line (indicator/strategy/library)
    const isScriptDecl = /^\s*(indicator|strategy|library)\s*\(/.test(s);
    
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '(') {
          depth++;
          // Only consider named args in function calls, not script declarations
          if (!isScriptDecl) inFunctionCall = true;
        }
        else if (ch === ')') {
          depth = Math.max(0, depth - 1);
          if (depth === 0) inFunctionCall = false;
        }
        else if (ch === '=' && depth > 0 && inFunctionCall) {
            const prev = s[i - 1] || '';
            const next = s[i + 1] || '';
            if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === ':' || next === '=') continue;
            const left = /[A-Za-z_][A-Za-z0-9_]*\s*$/.exec(s.slice(0, i));
            if (!left) continue;
            const name = left[0].trim();
            const before = s.slice(0, i - name.length).trimEnd();
            const sentinel = before.slice(-1);
            if (sentinel === '(' || sentinel === ',') out.add(name);
        }
    }
    return out;
  }
  
  private findNamedArgsCached(line: string): Set<string> {
    if (!this.namedArgCache.has(line)) {
      this.namedArgCache.set(line, this.findNamedArgs(line));
    }
    return this.namedArgCache.get(line)!;
  }

  private parseScriptDeclaration(startLine: number) {
    let buf = '';
    let depth = 0;

    // iterate from the start line until we close the first (... )
    for (let i = startLine - 1; i < this.cleanLines.length; i++) {
      const raw = this.cleanLines[i];
      let inStr: '"' | "'" | null = null;
      let esc = false;
      buf += raw + '\n';

      for (let j = 0; j < raw.length; j++) {
        const ch = raw[j];
        if (!inStr && ch === '/' && (raw[j+1]||'') === '/') break;
        if (inStr) { if (esc) { esc = false; continue; } if (ch === '\\') { esc = true; continue; } if (ch === inStr) { inStr = null; continue; } continue; }
        if (ch === '"' || ch === "'") { inStr = ch as '"' | "'"; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }

      if (depth === 0) break;
    }
    
    if (depth !== 0) {
        this.addError(startLine, 1, 'Unclosed script declaration (missing ")").', 'PS004A');
        // Do not set this.scriptType here — header is invalid/incomplete.
        return;
    }

    const m = buf.match(/^\s*(indicator|strategy|library)\s*\(/);
    if (!m) {
      this.addError(startLine, 1, 'Malformed script declaration.', 'PS004');
      return;
    }
    this.scriptType = m[1] as any;
    this.scriptDeclParsed = true;

    const hasTitle = /\btitle\s*=/.test(buf) || /^\s*(indicator|strategy|library)\s*\(\s*["']/.test(buf);
    if (!hasTitle) {
      this.addError(startLine, 1, 'Script declaration should include a title (positional or title=).', 'PS005');
    }
  }

  private handleIndentation(line: string, lineNum: number) {
    const leading = line.match(/^\s*/)?.[0] ?? '';
    if (/\t/.test(leading)) this.sawTabIndent = true;
    if (/^(?: {1,})/.test(leading)) this.sawSpaceIndent = true;

    const indent = line.length - line.trimStart().length;
    const topIndent = this.indentStack[this.indentStack.length - 1];
    const prevLine = this.findPrevNonEmpty(lineNum - 1);
  
    if (indent > 0 && /\binput\.[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(this.stripStringsAndLineComment(line))) {
      this.addWarning(lineNum, 1, 'Inputs should be declared at top level (global scope).', 'PS027');
    }

    if (indent > topIndent) {
      this.indentStack.push(indent);
      
      const endsWithArrow = !!prevLine && /\)\s*=>\s*$/.test(prevLine.trim());
      
      if (prevLine && (QUALIFIED_FN_RE.test(prevLine) || METHOD_DECL_RE.test(prevLine))) { // Single-line header
        const m = prevLine.match(QUALIFIED_FN_RE) || prevLine.match(METHOD_DECL_RE)!;
        const name = m[1];
        const rawParams = (this.functionParams.get(name) || []);
        // Parse parameter names, handling type annotations like "this<Point>"
        const params = rawParams.map(p => {
          const cleaned = p.trim().replace(/<[^>]*>/g, ''); // Remove type annotations
          return cleaned.split(/\s+/).pop()!;
        }).filter(Boolean);
        
        
        this.scopeStack.push({ indent, params: new Set(params), fnName: name });
        if(!this.paramUsage.has(name)) this.paramUsage.set(name, new Set());
      } else if (endsWithArrow) { // Multi-line header
        const MAX_HDR_LOOKBACK = 8;
        let fnName: string | null = null;
        for (let k = 1; k <= MAX_HDR_LOOKBACK && (lineNum - 1 - k) >= 0; k++) {
          const lno = lineNum - 1 - k;
          const L = (this.cleanLines[lno] || '').trim();
          if (/^(if|for|while|switch)\b/.test(L)) break;
          const mStart = L.match(new RegExp(`^\\s*(?:export\\s+)?(${IDENT.source}(?:\\.${IDENT.source})*)\\s*\\(`)) || L.match(new RegExp(`^\\s*method\\s+(${IDENT.source})\\s*\\(`));
          if (mStart) { fnName = mStart[1]; break; }
          if (/\)\s*=>\s*$/.test(L)) break; // Stop at another header
        }
        if (fnName && this.functionParams.has(fnName)) {
          const rawParams = (this.functionParams.get(fnName) || []);
          // Parse parameter names, handling type annotations like "this<Point>"
          const params = rawParams.map(p => {
            const cleaned = p.trim().replace(/<[^>]*>/g, ''); // Remove type annotations
            return cleaned.split(/\s+/).pop()!;
          }).filter(Boolean);
          this.scopeStack.push({ indent, params: new Set(params), fnName });
          if(!this.paramUsage.has(fnName)) this.paramUsage.set(fnName, new Set());
        }
      }
    } else if (indent < topIndent) {
      while (this.indentStack.length > 1 && indent < this.indentStack[this.indentStack.length - 1]) {
        this.indentStack.pop();
      }
      while (this.scopeStack.length > 1 && indent < this.scopeStack[this.scopeStack.length - 1].indent) {
        this.scopeStack.pop();
      }
      if (indent !== this.indentStack[this.indentStack.length - 1]) {
        this.addWarning(lineNum, 1, 'Indentation does not match previous block level.', 'PS018');
      }
    }
  }

  private hasScriptDeclStartingAtOrSoon(idx: number, lookahead = 6): boolean {
    for (let i = idx; i < Math.min(idx + lookahead, this.cleanLines.length); i++) {
      if (SCRIPT_START_RE.test(this.cleanLines[i])) return true;
      // Stop if we hit a non-empty non-header line with code before any header-like token
      if (this.cleanLines[i].trim() && !/^[('"\s,)]/.test(this.cleanLines[i])) break;
    }
    return false;
  }

  private findPrevNonEmpty(lineNum: number): string | null {
    for (let i=lineNum-1;i>=0;i--) { const t=this.cleanLines[i].trim(); if (t!=='') return this.cleanLines[i]; }
    return null;
  }

  private updateBracketDepths(noStrings: string, lineNum: number) {
    for (let i = 0; i < noStrings.length; i++) {
        const ch = noStrings[i];
        const col = i + 1;
        
        if (ch === '{') { this.sawBrace = true; this.brace++; }
        else if (ch === '}') { this.sawBrace = true; this.brace--; if (this.brace < 0) { this.addError(lineNum, col, "Unexpected '}'.", 'PS008'); this.brace = 0; break; } }
        else if (ch === '(') this.paren++;
        else if (ch === ')') { this.paren--; if (this.paren < 0) { this.addError(lineNum, col, 'Unexpected \')\'.', 'PS008'); this.paren = 0; break; } }
        else if (ch === '[') this.bracket++;
        else if (ch === ']') { this.bracket--; if (this.bracket < 0) { this.addError(lineNum, col, 'Unexpected \']\'.', 'PS008'); this.bracket = 0; break; } }
      }
  }

  private handleNewVar(name: string, line: number, col: number) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) { this.addError(line, col, `Invalid identifier '${name}'.`, 'PS006'); return; }
    if (KEYWORDS.has(name) || NAMESPACES.has(name) || PSEUDO_VARS.has(name)) {
      this.addError(line, col, `Identifier '${name}' conflicts with a Pine keyword/builtin.`, 'PS007');
      return;
    }

    const paramsHere = this.currentScope().params;
    if (paramsHere.has(name) && name !== 'this') {
        this.addWarning(line, col, `Identifier '${name}' shadows a function parameter.`, 'PSW05', 'Rename the local or the parameter to avoid confusion.');
    }

    const siteKey = `${line}:${name}`;
    if (this.declaredSites.has(siteKey)) return;
    this.declaredSites.add(siteKey);
    
    const currentIndent = this.indentStack[this.indentStack.length-1];
    const prevIndent = this.declIndent.get(name);
    if(prevIndent !== undefined) {
      if (prevIndent === currentIndent) {
        this.addWarning(line, col, `Identifier '${name}' already declared in this block; use ':=' to reassign.`, 'PSW03');
        return;
      }
      if (prevIndent < currentIndent) {
        this.addWarning(line, col, `Identifier '${name}' shadows an outer declaration.`, 'PSW04');
      }
    }
    
    this.declared.set(name, line);
    this.declIndent.set(name, currentIndent);
  }

  private registerTypeHeuristic(name: string, rhs: string, line: number, col: number, isConst: boolean) {
    if (isConst) this.constNames.add(name);
    const isSeries = /\[[^\]]+\]/.test(rhs) || /(open|high|low|close|volume|time|bar_index|hl2|hlc3|ohlc4|hlcc4)/.test(rhs) || /\bta\./.test(rhs) || /request\.security/.test(rhs) || /request\.security_lower_tf/.test(rhs);
    let ty: TypeInfo['type'] = 'unknown';
    const s = rhs.trim();
    if (/^(true|false)\b/.test(s)) ty = 'bool';
    else if (/^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/.test(s)) ty = 'string';
    else if (/^[+\-]?\d[\d_]*(?:\.\d[\d_]*)?(?:e[+\-]?\d+)?\b/i.test(s)) {
        ty = s.includes('.') || /e[+\-]/i.test(s) ? 'float' : 'int';
    }
    else if (/\bcolor\.(?:\w+)\b|\bcolor\.new\s*\(/.test(s)) ty = 'color';
    else if (/\b(line|label|box|table)\.new\s*\(/.test(s)) ty = s.match(/\b(line|label|box|table)\.new/)![1] as any;
    else if (/\barray\./.test(s)) ty = 'array';
    else if (/\bmatrix\./.test(s)) ty = 'matrix';
    else if (/\bmap\./.test(s)) ty = 'map';
    
    const guessed: TypeInfo = {
      type: ty,
      isConst,
      isSeries,
      declaredAt: { line, column: col },
      usages: []
    };
    this.typeMap.set(name, guessed);
  }

  private checkOperators(line: string, lineNum: number, noStrings: string) {
    if (QUALIFIED_FN_RE.test(line) || METHOD_DECL_RE.test(line)) return;
    
    const warnAll = (hay: string, op: string, messageTemplate: string) => {
        let from = 0;
        while (true) {
          const idx = hay.indexOf(op, from);
          if (idx === -1) break;
          this.addWarning(lineNum, idx + 1, messageTemplate.replace('OP', op), 'PSO01');
          from = idx + op.length;
        }
    };

    for (const op of ['===', '!==', '++', '--', '^', '~']) {
      warnAll(noStrings, op, `Operator 'OP' is not valid in Pine Script.`);
    }

    warnAll(noStrings, '&&', `Operator 'OP' is not valid in Pine Script. Use 'and'/'or' instead.`);
    warnAll(noStrings, '||', `Operator 'OP' is not valid in Pine Script. Use 'and'/'or' instead.`);
    
    const noPairs = noStrings.replace(/&&/g, '  ').replace(/\|\|/g, '  ');
    warnAll(noPairs, '&',  `Operator 'OP' is not valid in Pine Script. Use 'and'/'or' instead.`);
    warnAll(noPairs, '|',  `Operator 'OP' is not valid in Pine Script. Use 'and'/'or' instead.`);

    const bangScan = noStrings.replace(/!=/g, '  ');
    let p = bangScan.indexOf('!');
    while (p !== -1) {
      this.addWarning(lineNum, p + 1, "Operator '!' is not valid in Pine. Use 'not'.", 'PSO01');
      p = bangScan.indexOf('!', p + 1);
    }

    const ifIdx = noStrings.search(/\bif\b/);
    if (ifIdx >= 0) {
        const start = noStrings.indexOf('(', ifIdx);
        if (start >= 0) {
          let depth = 0;
          let end = -1;
          for (let i = start; i < noStrings.length; i++) {
            const ch = noStrings[i];
            if (ch === '(') depth++;
            else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
          }
          const cond = end > start ? noStrings.slice(start, end + 1) : '';
          const namedInCond = this.findNamedArgsCached(cond);
    
          for (let i = 0; i < cond.length; i++) {
            if (cond[i] !== '=') continue;
            const next = cond[i + 1] || '';
            if (next === '=') continue;
            const prev2 = cond[i-1] || '';
            if(prev2 === ':') continue;
            const left = /[A-Za-z_][A-Za-z0-9_]*\s*$/.exec(cond.slice(0, i));
            const name = left?.[0]?.trim();
            if (name && namedInCond.has(name)) continue;
    
            const prev = cond[i - 1] || '';
            if (![':', '=', '!', '<', '>'].includes(prev)) {
              const sev: 'error' | 'warning' = this.config.strictMode ? 'error' : 'warning';
              this.addBySeverity(sev, lineNum, start + i + 1, 'Assignment "=" inside condition; did you mean "=="?', 'PSO02');
            }
          }
        }
    }
    
    const whileIdx = noStrings.search(/\bwhile\b/);
    if (whileIdx >= 0) {
        const start = noStrings.indexOf('(', whileIdx);
        if (start >= 0) {
            let depth = 0, end = -1;
            for (let i = start; i < noStrings.length; i++) {
                const ch = noStrings[i];
                if (ch === '(') depth++;
                else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
            }
            const cond = end > start ? noStrings.slice(start, end + 1) : '';
            const namedInCond = this.findNamedArgsCached(cond);
            for (let i = 0; i < cond.length; i++) {
                if (cond[i] !== '=') continue;
                const next = cond[i + 1] || '';
                if (next === '=') continue; // == or >= etc.
                const left = /[A-Za-z_][A-Za-z0-9_]*\s*$/.exec(cond.slice(0, i));
                const name = left?.[0]?.trim();
                if (name && namedInCond.has(name)) continue;
                const prev = cond[i - 1] || '';
                if (![':', '=', '!', '<', '>'].includes(prev)) {
                    const sev: 'error' | 'warning' = this.config.strictMode ? 'error' : 'warning';
                    this.addBySeverity(sev, lineNum, start + i + 1, 'Assignment "=" inside condition; did you mean "=="?', 'PSO02');
                }
            }
        }
    }
  }

  private getCachedRegex(pattern: string, flags: string = ''): RegExp {
      if (!this.regexCache.has(pattern+flags)) {
          this.regexCache.set(pattern+flags, new RegExp(pattern, flags));
      }
      return this.regexCache.get(pattern+flags)!;
  }
  
  private currentScope() {
      return this.scopeStack[this.scopeStack.length - 1];
  }
  
  private markUsage(name: string, line: number, column: number) {
      this.used.add(name);
      const info = this.typeMap.get(name);
      if (!info) return;
      const last = info.usages[info.usages.length - 1];
      if (last && last.line === line && last.column === column) return;
      info.usages.push({ line, column });
  }

  private scanReferences(line: string, lineNum: number, strippedNoStrings: string) {
    const isFuncHeader = QUALIFIED_FN_RE.test(line) || METHOD_DECL_RE.test(line);
    const isScriptHeader = SCRIPT_START_RE.test(line);
    const inImport = /^\s*import\b/.test(strippedNoStrings);
    const inExportAs = /^\s*export\b/.test(strippedNoStrings) && /\bas\b/.test(strippedNoStrings);
    const namedArgs = (isFuncHeader || isScriptHeader) ? new Set<string>() : this.findNamedArgsCached(line);
    const re = this.getCachedRegex(QUALIFIED_IDENT.source, 'g');
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    const current = this.currentScope();

    // TEMP header scope: covers single-line function/method bodies (no indent push)
    let tempParams: Set<string> | null = null;
    let tempFnName: string | null = null;
    if (isFuncHeader && /=>/.test(strippedNoStrings)) {
      const mm = line.match(QUALIFIED_FN_RE) || line.match(METHOD_DECL_RE);
      if (mm) {
        tempFnName = mm[1];
        const rawParams = mm[2] || '';
        // Parse parameters more carefully, handling type annotations
        const names = rawParams
          .split(',')
          .map(s => {
            // Handle type annotations like "this<Point>" -> "this"
            const cleaned = s.trim().replace(/<[^>]*>/g, '');
            return cleaned.split(/\s+/).pop()!;
          })
          .filter(Boolean);
        tempParams = new Set(names);
        if (!this.paramUsage.has(tempFnName)) this.paramUsage.set(tempFnName, new Set());
      }
    }

    while ((m = re.exec(strippedNoStrings))) {
        const tok = m[0];
        const col = (m.index ?? 0) + 1;
        
        const nextSlice = strippedNoStrings.slice(col - 1 + tok.length);
        const isDottedAccess = /^\s*\./.test(nextSlice);
        if (isDottedAccess) continue;
        
        const isParam = (tempParams?.has(tok) ?? false) || current.params.has(tok);
        if (isParam) {
            this.used.add(tok);
            const fnName = tempFnName ?? current.fnName;
            if (fnName) this.paramUsage.get(fnName)?.add(tok);
            this.markUsage(tok, lineNum, col);
            continue;
        }

        if (WILDCARD_IDENT.has(tok)) { this.used.add(tok); continue; }
        if (KEYWORDS.has(tok) || PSEUDO_VARS.has(tok)) { this.used.add(tok); continue; }
        if (namedArgs.has(tok)) continue;
        if (inImport || inExportAs) continue;

        const parts = tok.split('.');
        if (parts.length > 1) {
            const [lhs, member] = parts;
            if (NAMESPACES.has(lhs)) {
              if (this.config.strictMode && this.config.allowDeprecated === false && member && NS_MEMBERS[lhs] && !NS_MEMBERS[lhs].has(member)) {
                this.addWarning(lineNum, col, `Unknown ${lhs} member '${member}' (list may be outdated).`, 'PSU03');
              }
              this.used.add(tok);
              continue;
            }
            // Handle field access (e.g., this.x, myPoint.y)
            if (this.declared.has(lhs) || this.currentScope().params.has(lhs) || lhs === 'this') {
                this.used.add(lhs);
                this.used.add(member); // Mark the field as used too
                this.markUsage(lhs, lineNum, col);
                continue;
            }
        }

        this.used.add(tok);
        if (this.declared.has(tok)) this.markUsage(tok, lineNum, col);

        if (!this.declared.has(tok)) {
            const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const looksLikeCall = this.getCachedRegex(`\\b${esc}\\s*\\(`).test(strippedNoStrings.slice(col - 1));
            if (looksLikeCall) continue;
            
            const assignGuards = [
                this.getCachedRegex(`\\b${esc}\\s*=\\s*[^=]`),
                this.getCachedRegex(`\\b${esc}\\s*:=`),
                this.getCachedRegex(`\\b${esc}\\s*[+\\-*/%]=`)
              ];
            if (assignGuards.some(rx => rx.test(strippedNoStrings))) continue;
            
            if (!this.functionNames.has(tok)) {
                this.addWarning(lineNum, col, `Potential undefined reference '${tok}'.`, 'PSU02');
            }
        }
    }

    if (PLOT_CALL_RE.test(strippedNoStrings)) {
      if (this.scriptType === 'library') {
        this.addError(lineNum, 1, "Plotting functions aren't allowed in libraries.", 'PS021');
      } else {
        this.used.add('__plot__');
      }
    }
    if (STRATEGY_ANY_RE.test(strippedNoStrings)) {
      if (this.scriptType === 'indicator') {
        this.addError(lineNum, 1, "Calls to 'strategy.*' are not allowed in indicators.", 'PS020');
      } else if (this.scriptType === 'library') {
        this.addError(lineNum, 1, "Strategy API isn't allowed in libraries.", 'PS022');
      } else {
        this.used.add('__strategy__');
      }
    }

    if (this.scriptType === 'library' && /\binput\.[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(strippedNoStrings)) {
        this.addError(lineNum, 1, "Inputs aren't allowed in libraries.", 'PS026');
    }
  }

  private analyzeControlFlow() {
    // Unreachable code after `return` inside the same block (indentation-aware)
    const stack: number[] = [0];
    const returnsAtIndent = new Map<number, number>(); // indent -> line

    for (let i=0;i<this.cleanLines.length;i++) {
      const line = this.cleanLines[i];
      if (line.trim()==='') continue;

      const indent = line.length - line.trimStart().length;
      while (stack.length>1 && indent < stack[stack.length-1]) stack.pop();
      if (indent > stack[stack.length-1]) stack.push(indent);

      // if there was a return at this indent, anything non-empty after is unreachable until unindent
      const retLine = returnsAtIndent.get(stack[stack.length-1]);
      if (retLine && /\S/.test(line)) {
        this.addWarning(i+1,1,`Unreachable code after return at line ${retLine}.`,'PSC001');
      }

      // detect return at this indent
      if (/^\s*return\b/.test(line)) returnsAtIndent.set(stack[stack.length-1], i+1);
    }
  }

  private analyzePerformance() {
    // Opinionated hints; gated behind config flag
    for (let i=0;i<this.cleanLines.length;i++) {
      const line = this.cleanLines[i];
      if (/^\s*(for|while)\b/.test(line)) {
        // scan lines indented more than current for a short window
        const baseIndent = line.length - line.trimStart().length;
        for (let j=i+1;j<Math.min(i+40, this.cleanLines.length);j++) {
          const r2 = this.cleanLines[j];
          const indent2 = r2.length - r2.trimStart().length;
          if (indent2 <= baseIndent) break; // end of block
          if (/request\.security|ta\.(highest|lowest)/.test(r2)) {
            this.addWarning(j+1,1,'Expensive operation inside loop may impact performance.','PSP001');
          }
        }
      }
      // excessive history refs on one line
      const histRefs = line.match(/\[\s*\d+\s*\]/g);
      if (histRefs && histRefs.length > 5) this.addWarning(i+1,1,'Many history references on one line may impact performance.','PSP002');
    }
  }

  private applyCustomRules() {
    const ctx: ValidationContext = {
      lines: this.cleanLines,
      typeMap: this.typeMap,
      usedVars: this.used,
      scriptType: this.scriptType,
      version: this.config.targetVersion || 6
    };

    for (const rule of (this.config.customRules||[])) {
      for (let i=0;i<this.cleanLines.length;i++) {
        const line = this.cleanLines[i];
        const lineNum = i+1;
        let match = false;
        if (rule.pattern instanceof RegExp) match = rule.pattern.test(line);
        else match = rule.pattern(line, lineNum, ctx);
        if (match) this.addBySeverity(rule.severity, lineNum, 1, rule.message, rule.id, rule.suggestion);
      }
    }
  }

  private filterIgnoredCodes() {
    const ignore = new Set(this.config.ignoredCodes||[]);
    this.errors = this.errors.filter(e=>!ignore.has(e.code||''));
    this.warnings = this.warnings.filter(e=>!ignore.has(e.code||''));
    this.info = this.info.filter(e=>!ignore.has(e.code||''));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Completions / Hover (optional helpers)
  // ────────────────────────────────────────────────────────────────────────────

  getCompletions(): CompletionItem[] {
    const uniq = new Map<string, CompletionItem>();
    const put = (c: CompletionItem) => uniq.set(`${c.kind}:${c.label}`, c);
  
    put({ label: 'indicator', kind: 'keyword', detail: 'Script declaration', insertText: 'indicator(title="", shorttitle="", overlay=true)'});
    put({ label: 'strategy',  kind: 'keyword', detail: 'Script declaration', insertText: 'strategy(title="", overlay=true, initial_capital=10000)'});
    put({ label: 'library',   kind: 'keyword', detail: 'Script declaration', insertText: 'library(title="")'});
  
    for (const k of [...KEYWORDS].filter(k => !['indicator','strategy','library'].includes(k))) {
      put({ label: k, kind: 'keyword', detail: 'Pine keyword' });
    }
  
    for (const ns of NAMESPACES) put({ label: ns, kind: 'namespace', detail: 'Pine namespace' });
    for (const [ns, members] of Object.entries(NS_MEMBERS)) {
      for (const m of members) put({ label: `${ns}.${m}`, kind: 'function', detail: `${ns} member`, insertText: `${ns}.${m}(` });
    }

    for (const f of ['plot','bgcolor','hline','fill','barcolor','plotcandle','plotbar','plotchar','plotshape','alert','alertcondition']) {
      put({ label: f, kind: 'function', detail: 'builtin', insertText: `${f}(` });
    }
  
    const allVars = new Set([...this.typeMap.keys(), ...this.declared.keys()]);
    for (const name of allVars) {
      if (!this.functionNames.has(name)) {
        const info = this.typeMap.get(name);
        put({ label: name, kind: 'variable', detail: info ? `${info.type} variable` : 'User-defined variable', insertText: name });
      }
    }
    for (const fn of this.functionNames) {
        const isMethod = this.methodNames.has(fn);
        put({
            label: fn,
            kind: 'function',
            detail: isMethod ? 'User-defined method' : 'User-defined function',
            insertText: `${fn}(`
        });
    }
  
    return [...uniq.values()];
  }

  getHoverInfo(pos: { line: number; column: number }): string | null {
    if (pos.line < 1 || pos.line > this.cleanLines.length) return null;
    const safe = this.stripStringsAndLineComment(this.cleanLines[pos.line-1] ?? '');
    const re = this.getCachedRegex(QUALIFIED_IDENT.source, 'g');
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(safe))) {
      const tok = m[0];
      const start = m.index;
      const end = start + tok.length;
      if (pos.column >= start+1 && pos.column <= end) {
        const info = this.typeMap.get(tok) || this.typeMap.get(tok.split('.')[0]);
        if (info) {
          const baseTok = tok.split('.')[0];
          const kind = this.methodNames.has(tok) || this.methodNames.has(baseTok)
            ? 'method'
            : (this.functionNames.has(tok) || this.functionNames.has(baseTok) ? 'function' : 'variable');
          return `**${tok}** — ${kind}\n\nType: ${info.type}${info.isConst? ' (const)':''}${info.isSeries? ' (series)':''}\nDeclared at line ${info.declaredAt.line}. Used ${info.usages.length} time(s).`;
        }
        if (KEYWORDS.has(tok)) return `**${tok}** — Pine keyword`;
        if (PSEUDO_VARS.has(tok)) return `**${tok}** — built-in series variable`;
        const parts = tok.split('.');
        if (parts.length>1 && NAMESPACES.has(parts[0])) return `**${tok}** — ${parts[0]} member`;
        return `**${tok}**`;
      }
    }
    return null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reporting
  // ────────────────────────────────────────────────────────────────────────────

  protected addError(line:number,column:number,message:string,code?:string,suggestion?:string){ this.errors.push({line,column,message,severity:'error',code,suggestion}); }
  protected addWarning(line:number,column:number,message:string,code?:string,suggestion?:string){ this.warnings.push({line,column,message,severity:'warning',code,suggestion}); }
  protected addInfo(line:number,column:number,message:string,code?:string,suggestion?:string){ this.info.push({line,column,message,severity:'info',code,suggestion}); }
  protected addBySeverity(sev:'error'|'warning'|'info',line:number,col:number,msg:string,code?:string,sugg?:string){
    if (sev==='error') this.addError(line,col,msg,code,sugg); else if (sev==='warning') this.addWarning(line,col,msg,code,sugg); else this.addInfo(line,col,msg,code,sugg);
  }
}

// Factory helper
export function validatePineV6Enhanced(code: string, config?: Partial<ValidatorConfig>): ValidationResult {
  const v = new EnhancedPineV6Validator(config);
  return v.validate(code);
}
