/**
 * Lightweight argument parsing helpers for single-line function calls.
 * Safe for validators that need to validate named/positional parameters.
 */

export function extractArgs(line: string, callIdent: string): string {
  const start = line.indexOf(callIdent);
  if (start === -1) return '';
  const open = line.indexOf('(', start);
  if (open === -1) return '';
  let depth = 0;
  let end = -1;
  for (let i = open; i < line.length; i++) {
    const ch = line[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return '';
  return line.substring(open + 1, end);
}

export function parseArgs(args: string): { positional: string[]; named: Map<string,string> } {
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (ch === '"') { inStr = !inStr; cur += ch; continue; }
    if (!inStr) {
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    }
    cur += ch;
  }
  if (cur.trim().length) parts.push(cur.trim());

  const positional: string[] = [];
  const named = new Map<string,string>();
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq > 0) {
      const name = p.substring(0, eq).trim();
      const value = p.substring(eq + 1).trim();
      named.set(name, value);
    } else {
      positional.push(p);
    }
  }
  return { positional, named };
}

