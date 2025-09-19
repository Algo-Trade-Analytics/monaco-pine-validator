/**
 * Lightweight scanning helpers for validators.
 * Assumes input lines are pre-cleaned (strings/comments stripped) when appropriate.
 */

export type ConstantHit = { constant: string; index: number };
export type FunctionCall = { line: number; column: number; args: string[] };

// Find occurrences of any constant from the set in a line (simple substring search)
export function findConstantsInLine(line: string, constants: Set<string>): ConstantHit[] {
  const hits: ConstantHit[] = [];
  // Iterate constants (small sets expected); for larger sets, a trie could be considered
  for (const c of constants) {
    const idx = line.indexOf(c);
    if (idx !== -1) hits.push({ constant: c, index: idx });
  }
  return hits;
}

/**
 * Find function calls in code lines
 */
export function findFunctionCalls(lines: string[], functionName: string): FunctionCall[] {
  const results: FunctionCall[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const regex = new RegExp(`\\b${functionName.replace('.', '\\.')}\\s*\\(`, 'g');
    let match;
    
    while ((match = regex.exec(line)) !== null) {
      const startPos = match.index;
      const openParen = line.indexOf('(', startPos);
      const closeParen = findMatchingParen(line, openParen);
      
      if (closeParen !== -1) {
        const argsString = line.substring(openParen + 1, closeParen);
        const args = parseArguments(argsString);
        
        results.push({
          line: i + 1,
          column: startPos + 1,
          args
        });
      }
    }
  }
  
  return results;
}

/**
 * Find matching closing parenthesis
 */
function findMatchingParen(line: string, openIndex: number): number {
  let depth = 1;
  for (let i = openIndex + 1; i < line.length; i++) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parse function arguments from string
 */
function parseArguments(argsString: string): string[] {
  if (!argsString.trim()) return [];
  
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar) {
      inString = false;
      current += char;
    } else if (!inString) {
      if (char === '(' || char === '[' || char === '{') {
        depth++;
        current += char;
      } else if (char === ')' || char === ']' || char === '}') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}

