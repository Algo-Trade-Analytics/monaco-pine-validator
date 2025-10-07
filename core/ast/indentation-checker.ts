/**
 * Indentation Checker for Pine Script
 * 
 * Pine Script uses significant whitespace (like Python)
 * - Function bodies must be consistently indented
 * - Block statements must maintain consistent indentation
 * - Mixed tabs/spaces are not allowed
 */

import type { ValidationError } from '../types';

interface IndentationIssue {
  line: number;
  column: number;
  message: string;
  suggestion: string;
  code: string;
}

/**
 * Check for indentation issues in Pine Script code
 */
export function checkIndentation(sourceCode: string): ValidationError[] {
  const lines = sourceCode.split('\n');
  const errors: ValidationError[] = [];
  
  // Pre-identify lines that are part of multi-line function calls
  const multiLineCallLines = identifyMultiLineCallLines(lines);
  
  // Track indentation state
  let inBlock = false; // Tracks if we're in any indented block (function, if, for, while)
  let blockIndent = 0;
  let expectedIndent = 0;
  let firstBodyLine = false;
  let usesSpaces = false;
  let usesTabs = false;
  
  // Global ternary tracking (works for both top-level and inside blocks)
  let ternaryIndents: number[] = []; // Track all ternary line indents to find the mode
  let ternaryLineNumbers: number[] = []; // Track actual line numbers
  let inTernaryChain = false;
  
  let functionCallIndents: number[] = []; // Track multi-line function call parameter indents
  let functionCallLineNumbers: number[] = []; // Track line numbers
  let inFunctionCall = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('//')) {
      continue;
    }
    
    // Check for mixed tabs and spaces ON THE SAME LINE (definitely invalid)
    // Note: TradingView allows mixing tabs/spaces across different scopes
    const leadingWhitespace = line.match(/^[\t ]+/)?.[0] || '';
    const hasBothTabsAndSpaces = leadingWhitespace.includes('\t') && leadingWhitespace.includes(' ');
    
    if (hasBothTabsAndSpaces) {
      errors.push({
        line: lineNum,
        column: 1,
        message: 'Mixed tabs and spaces in indentation on the same line',
        severity: 'error',
        code: 'PSV6-INDENT-MIXED',
        suggestion: 'Use either tabs or spaces consistently, not both. Pine Script convention is 4 spaces.'
      });
      continue;
    }
    
    // Get indentation level
    const indent = getIndentationLength(line);
    const trimmed = line.trim();
    
    // Check for ternary operator lines (works for both top-level and inside blocks)
    // Single-line ternary: has both ? and : on the same line - don't track these
    const isSingleLineTernary = trimmed.includes('?') && trimmed.includes(':');
    const isMultiLineTernaryStart = trimmed.endsWith('?');
    const isTernaryContinuation = trimmed.startsWith('?') || 
                                 (trimmed.includes(':') && !trimmed.includes('=') && inTernaryChain);
    
    // Track ternary chain globally (only for multi-line ternaries)
    if (isMultiLineTernaryStart || isTernaryContinuation) {
      if (!inTernaryChain) {
        inTernaryChain = true;
        ternaryIndents = [];
        ternaryLineNumbers = [];
      }
      ternaryIndents.push(indent);
      ternaryLineNumbers.push(lineNum);
    } else if (inTernaryChain && !isSingleLineTernary) {
      // End of ternary chain - validate consistency
      validateTernaryChain(ternaryIndents, ternaryLineNumbers, errors);
      ternaryIndents = [];
      ternaryLineNumbers = [];
      inTernaryChain = false;
    }
    
    // Detect block start (function, if, for, while)
    const isBlockStart = trimmed.includes('=>') || 
                         trimmed.startsWith('if ') ||
                         trimmed.startsWith('for ') ||
                         trimmed.startsWith('while ');
    
    if (isBlockStart) {
      // Before starting new block, validate any pending ternary chain
      if (inTernaryChain && ternaryIndents.length > 1) {
        validateTernaryChain(ternaryIndents, ternaryLineNumbers, errors);
      }
      
      inBlock = true;
      blockIndent = indent;
      firstBodyLine = true;
      expectedIndent = 0; // Will be set by first body line
      usesSpaces = false;
      usesTabs = false;
      ternaryIndents = []; // Reset ternary tracking
      ternaryLineNumbers = [];
      inTernaryChain = false;
      functionCallIndents = [];
      functionCallLineNumbers = [];
      inFunctionCall = false;
      continue;
    }
    
    // Check block body indentation
    if (inBlock) {
      // If we're back to or less than block indent, block ended
      if (indent <= blockIndent && trimmed !== '') {
        // Before ending block, check if we were in a ternary chain
        if (inTernaryChain && ternaryIndents.length > 1) {
          validateTernaryChain(ternaryIndents, ternaryLineNumbers, errors);
        }
        inBlock = false;
        ternaryIndents = [];
        ternaryLineNumbers = [];
        inTernaryChain = false;
        continue;
      }
      
      // First line of block body sets the expected indentation
      if (firstBodyLine) {
        expectedIndent = indent;
        firstBodyLine = false;
        
        // Track whether this block uses tabs or spaces
        const lineStart = line.substring(0, indent);
        usesSpaces = lineStart.includes(' ');
        usesTabs = lineStart.includes('\t');
        
        // Verify it's properly indented (should be > block indent)
        if (indent <= blockIndent) {
          errors.push({
            line: lineNum,
            column: 1,
            message: 'Block body must be indented more than block declaration',
            severity: 'error',
            code: 'PSV6-INDENT-FUNCTION-BODY',
            suggestion: `Indent this line with ${blockIndent + 4} spaces (block has ${blockIndent} spaces, body needs ${blockIndent + 4}).`
          });
        }
        continue;
      }
      
      // Check for mixed tabs/spaces within block body
      const lineStart = line.substring(0, Math.max(indent, 1));
      const lineHasSpaces = lineStart.includes(' ');
      const lineHasTabs = lineStart.includes('\t');
      
      if ((usesSpaces && lineHasTabs) || (usesTabs && lineHasSpaces)) {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'Mixed tabs and spaces in block body indentation',
          severity: 'error',
          code: 'PSV6-INDENT-MIXED',
          suggestion: usesSpaces 
            ? 'Use spaces consistently for indentation (block body started with spaces).'
            : 'Use tabs consistently for indentation (block body started with tabs).'
        });
        continue;
      }
      
      // Subsequent lines should match the expected indentation
      // (unless they're part of a multi-line expression or nested block)
      if (indent <= blockIndent && trimmed !== '') {
        // Back to block level or less - block ended
        inBlock = false;
        continue;
      }
      
      // Check for multi-line function calls FIRST (lines ending with comma or closing paren)
      const endsWithComma = trimmed.endsWith(',');
      const hasOpenParen = trimmed.includes('(');
      const endsWithCloseParen = trimmed.endsWith(')');
      
      // Start tracking if we see a line with ( and ending with ,
      if (hasOpenParen && endsWithComma && !inFunctionCall) {
        inFunctionCall = true;
        functionCallIndents = [indent];
        functionCallLineNumbers = [lineNum];
        continue; // Don't check other rules for this line
      } else if (inFunctionCall) {
        functionCallIndents.push(indent);
        functionCallLineNumbers.push(lineNum);
        
        // If we hit a closing paren, validate the chain
        if (endsWithCloseParen) {
          // Only validate parameter lines (skip the first line with the function name)
          if (functionCallIndents.length > 1) {
            const paramIndents = functionCallIndents.slice(1); // Skip first line
            const paramLineNumbers = functionCallLineNumbers.slice(1);
            validateMultiLineCall(paramIndents, paramLineNumbers, errors);
          }
          functionCallIndents = [];
          functionCallLineNumbers = [];
          inFunctionCall = false;
        }
        continue; // Don't check other rules while in function call
      }
      
      // For non-ternary, non-function-call lines, check against expected indent
      // Skip lines that are part of multi-line function calls (they have their own validation)
      const isPartOfMultiLineCall = multiLineCallLines.has(lineNum);
      
      if (!isSingleLineTernary && !isMultiLineTernaryStart && !inTernaryChain && !isPartOfMultiLineCall && indent !== expectedIndent) {
        const diff = Math.abs(indent - expectedIndent);
        errors.push({
          line: lineNum,
          column: indent + 1,
          message: `Inconsistent indentation in function body (expected ${expectedIndent} spaces, got ${indent} spaces)`,
          severity: 'error',
          code: 'PSV6-INDENT-INCONSISTENT',
          suggestion: indent > expectedIndent
            ? `Remove ${diff} space${diff > 1 ? 's' : ''} from the beginning of this line to match the function body indentation.`
            : `Add ${diff} space${diff > 1 ? 's' : ''} to the beginning of this line to match the function body indentation.`
        });
      }
    }
  }
  
  // Check if we ended while still in a ternary chain
  if (inTernaryChain && ternaryIndents.length > 1) {
    validateTernaryChain(ternaryIndents, ternaryLineNumbers, errors);
  }
  
  // Post-process: Check for multi-line function calls with inconsistent parameter indentation
  checkMultiLineFunctionCalls(lines, errors);
  
  return errors;
}

/**
 * Identify which lines are part of multi-line function calls
 * Returns a Set of line numbers (1-based)
 */
function identifyMultiLineCallLines(lines: string[]): Set<number> {
  const callLines = new Set<number>();
  let inCall = false;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('//')) continue;
    
    const hasOpenParen = trimmed.includes('(');
    const endsWithComma = trimmed.endsWith(',');
    const endsWithCloseParen = trimmed.endsWith(')');
    
    // Start of multi-line call
    if (hasOpenParen && endsWithComma && !inCall) {
      inCall = true;
      // Don't include the first line (with function name)
      continue;
    }
    
    // Inside call - mark these lines
    if (inCall) {
      callLines.add(i + 1); // 1-based line number
      
      if (endsWithCloseParen) {
        inCall = false;
      }
    }
  }
  
  return callLines;
}

/**
 * Post-processing check for multi-line function calls
 * Pattern: function(arg1, arg2,
 *              param=value,
 *              param2=value)
 * All parameter lines (after the first line) should have consistent indentation
 */
function checkMultiLineFunctionCalls(lines: string[], errors: ValidationError[]): void {
  let callStartLine = -1;
  let callIndents: number[] = [];
  let callLineNumbers: number[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('//')) continue;
    
    const hasOpenParen = trimmed.includes('(');
    const endsWithComma = trimmed.endsWith(',');
    const endsWithCloseParen = trimmed.endsWith(')');
    const indent = getIndentationLength(line);
    
    // Start of multi-line call: has ( and ends with ,
    if (hasOpenParen && endsWithComma && callStartLine === -1) {
      callStartLine = i + 1;
      callIndents = [];
      callLineNumbers = [];
      continue; // Don't include the function name line
    }
    
    // Inside a multi-line call
    if (callStartLine !== -1) {
      callIndents.push(indent);
      callLineNumbers.push(i + 1);
      
      // End of call: ends with )
      if (endsWithCloseParen) {
        // Validate consistency of all parameter lines
        if (callIndents.length > 1) {
          validateMultiLineCall(callIndents, callLineNumbers, errors);
        }
        callStartLine = -1;
        callIndents.length = 0;
        callLineNumbers.length = 0;
      }
    }
  }
}

/**
 * Get the indentation length of a line (number of leading spaces/tabs)
 */
function getIndentationLength(line: string): number {
  const match = line.match(/^[\t ]*/);
  if (!match) return 0;
  
  const whitespace = match[0];
  // Convert tabs to spaces (1 tab = 4 spaces for counting purposes)
  return whitespace.replace(/\t/g, '    ').length;
}

/**
 * Validate ternary chain indentation according to Pine Script rules:
 * - Wrapped/continuation lines must be indented (> first line)
 * - Wrapped lines must NOT be indented with multiples of 4 (4, 8, 12, 16, etc.)
 * - Any other indentation (1, 2, 3, 5, 6, 7, 9, 10, 11, etc.) is valid
 * - Consistency is NOT required - different lines can have different indentation
 */
function validateTernaryChain(
  ternaryIndents: number[],
  lineNumbers: number[],
  errors: ValidationError[]
): void {
  if (ternaryIndents.length <= 1) return;
  
  // Get the base indent (first line of ternary expression we detected)
  const baseIndent = ternaryIndents[0];
  
  // If the first detected line has indentation that's NOT a multiple of 4,
  // it's likely a continuation line itself (the actual base line came before).
  // In this case, all lines in the chain are continuation lines at the same level,
  // so we only check that none use multiples of 4.
  const firstLineIsContinuation = baseIndent > 0 && baseIndent % 4 !== 0;
  
  if (firstLineIsContinuation) {
    // All lines are continuation lines - just check they don't use multiples of 4
    for (let j = 0; j < ternaryIndents.length; j++) {
      const indent = ternaryIndents[j];
      const lineNum = lineNumbers[j];
      
      if (indent % 4 === 0 && indent > 0) {
        errors.push({
          line: lineNum,
          column: indent + 1,
          message: `Line wrapping: continuation line indentation cannot be a multiple of 4 (got ${indent} spaces)`,
          severity: 'error',
          code: 'PSV6-INDENT-INCONSISTENT',
          suggestion: `Change indentation to ${indent + 1} or ${indent - 1} spaces (must not be multiple of 4).`
        });
      }
    }
  } else {
    // First line is the base - validate continuation lines relative to it
    for (let j = 1; j < ternaryIndents.length; j++) {
      const indent = ternaryIndents[j];
      const lineNum = lineNumbers[j];
      
      // Rule 1: Continuation line must be indented MORE than the base line
      if (indent <= baseIndent) {
        errors.push({
          line: lineNum,
          column: indent + 1,
          message: `Line wrapping: continuation line must be indented more than the first line (expected > ${baseIndent} spaces, got ${indent} spaces)`,
          severity: 'error',
          code: 'PSV6-INDENT-INCONSISTENT',
          suggestion: `Add at least ${baseIndent + 1 - indent} space${baseIndent + 1 - indent > 1 ? 's' : ''} to indent this continuation line.`
        });
      }
      // Rule 2: Continuation line indentation must NOT be a multiple of 4
      // (only check if it passes Rule 1)
      else if (indent % 4 === 0) {
        errors.push({
          line: lineNum,
          column: indent + 1,
          message: `Line wrapping: continuation line indentation cannot be a multiple of 4 (got ${indent} spaces)`,
          severity: 'error',
          code: 'PSV6-INDENT-INCONSISTENT',
          suggestion: `Change indentation to ${indent + 1} or ${indent - 1} spaces (must not be multiple of 4).`
        });
      }
    }
  }
}

/**
 * Validate that all parameter lines in a multi-line function call have consistent indentation
 */
function validateMultiLineCall(
  paramIndents: number[],
  lineNumbers: number[],
  errors: ValidationError[]
): void {
  if (paramIndents.length <= 1) return;
  
  const mode = getModeIndent(paramIndents);
  
  // Check if any parameter line deviates from the mode
  for (let j = 0; j < paramIndents.length; j++) {
    if (paramIndents[j] !== mode) {
      const lineNum = lineNumbers[j];
      const diff = Math.abs(paramIndents[j] - mode);
      errors.push({
        line: lineNum,
        column: paramIndents[j] + 1,
        message: `Inconsistent indentation in multi-line function call (expected ${mode} spaces, got ${paramIndents[j]} spaces)`,
        severity: 'error',
        code: 'PSV6-INDENT-INCONSISTENT',
        suggestion: paramIndents[j] > mode
          ? `Remove ${diff} space${diff > 1 ? 's' : ''} to match other parameter lines.`
          : `Add ${diff} space${diff > 1 ? 's' : ''} to match other parameter lines.`
      });
    }
  }
}

/**
 * Find the most common (mode) indentation value in an array
 */
function getModeIndent(indents: number[]): number {
  const counts = new Map<number, number>();
  for (const indent of indents) {
    counts.set(indent, (counts.get(indent) || 0) + 1);
  }
  
  let mode = indents[0];
  let maxCount = 0;
  for (const [indent, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mode = indent;
    }
  }
  
  return mode;
}

/**
 * Detect if a line is a continuation of a previous line
 */
function isContinuationLine(line: string): boolean {
  const trimmed = line.trim();
  // Ternary operator continuation
  if (trimmed.startsWith('?') || trimmed.startsWith(':')) {
    return true;
  }
  // Operator continuation
  if (/^[+\-*/%=<>!&|]/.test(trimmed)) {
    return true;
  }
  return false;
}

