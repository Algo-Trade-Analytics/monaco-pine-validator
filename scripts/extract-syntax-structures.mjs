import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const formattedManualPath = resolve(repoRoot, 'PineScriptContext', 'pine-script-refrence.txt');
const minifiedManualPath = resolve(repoRoot, 'PineScriptContext', 'ref-pine.txt');

const QUALIFIERS = new Set(['series', 'simple', 'input', 'const']);
const FUNCTION_STOP_WORDS = new Set([
  'ARGUMENTS', 'REMARKS', 'EXAMPLE', 'EXAMPLES', 'SEE ALSO', 'RETURNS',
  'DEFAULT', 'OPTIONS', 'NOTE', 'NOTES', 'WARNING', 'USAGE', 'EXCEPTIONS'
]);
const VARIABLE_STOP_WORDS = new Set([
  'TYPE', 'REMARKS', 'SEE ALSO', 'EXAMPLE', 'EXAMPLES', 'NOTE', 'NOTES', 'WARNING',
  'USAGE', 'DEFAULT', 'RETURNS'
]);
const OPERATOR_STOP_WORDS = new Set([
  'SYNTAX', 'ARGUMENTS', 'REMARKS', 'EXAMPLE', 'EXAMPLES', 'RETURNS', 'SEE ALSO', 'DEFAULT', 'NOTE', 'NOTES', 'WARNING'
]);
const KEYWORD_STOP_WORDS = new Set([
  'SYNTAX', 'ARGUMENTS', 'REMARKS', 'EXAMPLE', 'EXAMPLES', 'RETURNS', 'SEE ALSO', 'DEFAULT', 'NOTE', 'NOTES', 'WARNING',
  'FIELDS', 'TYPE'
]);
const TYPE_STOP_WORDS = new Set([
  'SYNTAX', 'FIELDS', 'REMARKS', 'EXAMPLE', 'EXAMPLES', 'SEE ALSO', 'DEFAULT', 'NOTE', 'NOTES', 'WARNING', 'USAGE'
]);
const ANNOTATION_STOP_WORDS = new Set([
  'SYNTAX', 'REMARKS', 'EXAMPLE', 'EXAMPLES', 'SEE ALSO', 'DEFAULT', 'NOTE', 'NOTES', 'WARNING'
]);
const OPERATOR_NAME_PATTERN = /^[\[\]\-\+\*/%<>=!&|^?:]+$|^(and|or|not)$/;

function parseType(value) {
  const tokens = value.trim().split(/\s+/);
  if (tokens.length === 0) {
    return { qualifier: null, type: null };
  }
  if (tokens.length === 1) {
    return { qualifier: null, type: tokens[0] };
  }
  if (QUALIFIERS.has(tokens[0])) {
    return { qualifier: tokens[0], type: tokens.slice(1).join(' ') };
  }
  return { qualifier: null, type: value.trim() };
}

function parseFunctionSignature(signature) {
  const trimmed = signature.trim();
  const arrowIndex = trimmed.indexOf('→');
  const left = arrowIndex >= 0 ? trimmed.slice(0, arrowIndex).trim() : trimmed;
  const right = arrowIndex >= 0 ? trimmed.slice(arrowIndex + 1).trim() : null;

  const openParen = left.indexOf('(');
  const closeParen = openParen >= 0 ? left.indexOf(')', openParen + 1) : -1;
  if (openParen === -1 || closeParen === -1) {
    return null;
  }

  const name = left.slice(0, openParen).trim();
  const paramsText = left.slice(openParen + 1, closeParen).trim();
  const params = paramsText ? paramsText.split(',').map(p => p.trim()).filter(Boolean) : [];

  return { name, params, returnType: right, text: trimmed };
}

function parseArgumentLine(line) {
  const cleaned = line.replace(/\u00a0/g, ' ').trim();
  const match = cleaned.match(/^([A-Za-z_][\w]*)\s*\(([^)]+)\)\s*(.*)$/);
  if (!match) {
    return null;
  }
  const name = match[1];
  const typeSpec = match[2].trim();
  const description = match[3] ?? '';

  const tokens = typeSpec.split(/\s+/);
  let qualifier = null;
  let type = typeSpec;
  if (tokens.length > 1 && QUALIFIERS.has(tokens[0])) {
    qualifier = tokens[0];
    type = tokens.slice(1).join(' ');
  }

  const optional = /optional/i.test(description);
  const defaultMatch = description.match(/default(?:\s+is|:)?\s+([^.;]+)/i);
  const defaultValue = defaultMatch ? defaultMatch[1].trim() : null;

  return {
    name,
    qualifier: qualifier ?? null,
    type,
    required: !optional,
    default: defaultValue,
  };
}

function parseFieldLine(line) {
  const cleaned = line.replace(/\u00a0/g, ' ').trim();
  const match = cleaned.match(/^([A-Za-z_][\w]*)\s*(?:\(([^)]+)\))?\s*(.*)$/);
  if (!match) {
    return null;
  }

  const name = match[1];
  const typeSpec = match[2] ? match[2].trim() : null;
  const description = match[3] ? match[3].trim() : '';

  let qualifier = null;
  let type = typeSpec;
  if (typeSpec) {
    const tokens = typeSpec.split(/\s+/);
    if (tokens.length > 1 && QUALIFIERS.has(tokens[0])) {
      qualifier = tokens[0];
      type = tokens.slice(1).join(' ');
    }
  }

  return {
    name,
    qualifier: qualifier ?? null,
    type: type ?? null,
    description: description || null,
  };
}

function filterSyntaxLines(lines) {
  return lines
    .map(line => line.trim())
    .filter(line => {
      if (!line) {
        return false;
      }
      if (line === '...') {
        return true;
      }
      const firstChar = line[0];
      if (/[A-Z]/.test(firstChar) && !/^[\[<(@]/.test(line)) {
        return false;
      }
      return true;
    });
}

function parseFormattedManual(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map(line => line.replace(/\u00a0/g, ' '));

  const functions = {};
  const variables = {};
  const constants = {};
  const operators = {};
  const keywords = {};
  const types = {};
  const annotations = {};

  const sectionMap = new Map([
    ['Variables', 'variables'],
    ['Functions', 'functions'],
    ['Constants', 'constants'],
    ['Operators', 'operators'],
    ['Keywords', 'keywords'],
    ['Types', 'types'],
    ['Annotations', 'annotations'],
  ]);

  let currentSection = null;
  let currentFunction = null;
  let currentVariable = null;
  let currentConstant = null;
  let currentOperator = null;
  let currentKeyword = null;
  let currentType = null;
  let currentAnnotation = null;

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (sectionMap.has(line)) {
      currentSection = sectionMap.get(line);
      currentFunction = null;
      currentVariable = null;
      currentConstant = null;
      currentOperator = null;
      currentKeyword = null;
      currentType = null;
      currentAnnotation = null;
      i += 1;
      continue;
    }

    switch (currentSection) {
      case 'variables': {
        if (line === 'TYPE') {
          i += 1;
          while (i < lines.length && !lines[i].trim()) {
            i += 1;
          }
          if (i < lines.length && currentVariable) {
            const typeLine = lines[i].trim();
            variables[currentVariable] = parseType(typeLine);
          }
          continue;
        }
        if (VARIABLE_STOP_WORDS.has(line)) {
          i += 1;
          continue;
        }
        if (/^[a-z_][\w.]*$/.test(line)) {
          currentVariable = line;
        }
        i += 1;
        continue;
      }
      case 'constants': {
        if (line === 'TYPE') {
          i += 1;
          while (i < lines.length && !lines[i].trim()) {
            i += 1;
          }
          if (i < lines.length && currentConstant) {
            const typeLine = lines[i].trim();
            constants[currentConstant] = parseType(typeLine);
          }
          continue;
        }
        if (VARIABLE_STOP_WORDS.has(line)) {
          i += 1;
          continue;
        }
        if (/^[a-z_][\w.]*$/i.test(line) && !line.includes(' ')) {
          currentConstant = line;
        }
        i += 1;
        continue;
      }
      case 'functions': {
        if (line === 'SYNTAX' || line === 'SYNTAX & OVERLOADS') {
          const signatures = [];
          i += 1;
          while (i < lines.length) {
            const nextLine = lines[i].trim();
            if (!nextLine) {
              i += 1;
              continue;
            }
            if (FUNCTION_STOP_WORDS.has(nextLine)) {
              break;
            }
            const parsed = parseFunctionSignature(nextLine);
            if (parsed) {
              if (!functions[parsed.name]) {
                functions[parsed.name] = { signatures: [], arguments: [] };
              }
              functions[parsed.name].signatures.push({
                params: parsed.params,
                returnType: parsed.returnType,
                text: parsed.text,
              });
              currentFunction = parsed.name;
            }
            i += 1;
          }
          continue;
        }
        if (line === 'ARGUMENTS') {
          const args = [];
          i += 1;
          while (i < lines.length) {
            const nextLine = lines[i];
            const trimmed = nextLine.trim();
            if (!trimmed) {
              i += 1;
              continue;
            }
            if (FUNCTION_STOP_WORDS.has(trimmed)) {
              break;
            }
            const arg = parseArgumentLine(trimmed);
            if (arg) {
              args.push(arg);
            }
            i += 1;
          }
          if (currentFunction && args.length > 0) {
            if (!functions[currentFunction]) {
              functions[currentFunction] = { signatures: [], arguments: [] };
            }
            functions[currentFunction].arguments = args;
          }
          continue;
        }
        if (FUNCTION_STOP_WORDS.has(line)) {
          i += 1;
          continue;
        }
        if (/^[A-Za-z_][\w.]*?(?:<[^>]+>)?\s*\(.*\)$/.test(line)) {
          const nameMatch = line.match(/^([A-Za-z_][\w.]*?(?:<[^>]+>)?)\s*\(/);
          if (nameMatch) {
            currentFunction = nameMatch[1];
            if (!functions[currentFunction]) {
              functions[currentFunction] = { signatures: [], arguments: [] };
            }
          }
        }
        i += 1;
        continue;
      }
      case 'operators': {
        if (line === 'SYNTAX') {
          i += 1;
          const syntaxLines = [];
          while (i < lines.length) {
            const nextLine = lines[i].trim();
            if (!nextLine) {
              i += 1;
              continue;
            }
            if (OPERATOR_STOP_WORDS.has(nextLine)) {
              break;
            }
            if (/(expr|\[|<)/.test(nextLine)) {
              syntaxLines.push(nextLine);
            }
            i += 1;
          }
          if (currentOperator && syntaxLines.length > 0) {
            if (!operators[currentOperator]) {
              operators[currentOperator] = [];
            }
            operators[currentOperator].push(...syntaxLines);
          }
          continue;
        }
        if (OPERATOR_STOP_WORDS.has(line)) {
          i += 1;
          continue;
        }
        if (OPERATOR_NAME_PATTERN.test(line)) {
          currentOperator = line;
          if (!operators[currentOperator]) {
            operators[currentOperator] = [];
          }
        }
        i += 1;
        continue;
      }
      case 'keywords': {
        if (line === 'SYNTAX') {
          i += 1;
          const syntaxLines = [];
          while (i < lines.length) {
            const nextLine = lines[i].trim();
            if (!nextLine) {
              i += 1;
              continue;
            }
            if (KEYWORD_STOP_WORDS.has(nextLine)) {
              break;
            }
            syntaxLines.push(nextLine);
            i += 1;
          }
          const filtered = filterSyntaxLines(syntaxLines);
          if (currentKeyword && filtered.length > 0) {
            if (!keywords[currentKeyword]) {
              keywords[currentKeyword] = { syntax: [] };
            }
            keywords[currentKeyword].syntax.push(...filtered);
          }
          continue;
        }
        if (KEYWORD_STOP_WORDS.has(line) || line.startsWith('//')) {
          i += 1;
          continue;
        }
        if (/^[A-Za-z][A-Za-z.]*$/.test(line)) {
          const nextLine = lines[i + 1] ?? '';
          if (nextLine.trim()) {
            i += 1;
            continue;
          }
          currentKeyword = line;
          if (!keywords[currentKeyword]) {
            keywords[currentKeyword] = { syntax: [] };
          }
        }
        i += 1;
        continue;
      }
      case 'types': {
        if (line === 'SYNTAX') {
          i += 1;
          const syntaxLines = [];
          while (i < lines.length) {
            const nextLine = lines[i].trim();
            if (!nextLine) {
              i += 1;
              continue;
            }
            if (TYPE_STOP_WORDS.has(nextLine)) {
              break;
            }
            syntaxLines.push(nextLine);
            i += 1;
          }
          const filtered = filterSyntaxLines(syntaxLines);
          if (currentType && filtered.length > 0) {
            if (!types[currentType]) {
              types[currentType] = { syntax: [], fields: [] };
            }
            types[currentType].syntax.push(...filtered);
          }
          continue;
        }
        if (line === 'FIELDS') {
          i += 1;
          const fields = [];
          while (i < lines.length) {
            const fieldLine = lines[i];
            const trimmedField = fieldLine.trim();
            if (!trimmedField) {
              i += 1;
              continue;
            }
            if (TYPE_STOP_WORDS.has(trimmedField) || trimmedField === 'SYNTAX') {
              break;
            }
            const parsedField = parseFieldLine(trimmedField);
            if (parsedField) {
              fields.push(parsedField);
            } else if (fields.length > 0) {
              const lastField = fields[fields.length - 1];
              lastField.description = [lastField.description, trimmedField]
                .filter(Boolean)
                .join(' ');
            }
            i += 1;
          }
          if (currentType && fields.length > 0) {
            if (!types[currentType]) {
              types[currentType] = { syntax: [], fields: [] };
            }
            types[currentType].fields.push(...fields);
          }
          continue;
        }
        if (TYPE_STOP_WORDS.has(line) || line.startsWith('//')) {
          i += 1;
          continue;
        }
        if (/^[A-Za-z][\w.]*$/.test(line)) {
          const nextLine = lines[i + 1] ?? '';
          if (nextLine.trim()) {
            i += 1;
            continue;
          }
          currentType = line;
          if (!types[currentType]) {
            types[currentType] = { syntax: [], fields: [] };
          }
        }
        i += 1;
        continue;
      }
      case 'annotations': {
        if (line === 'SYNTAX') {
          i += 1;
          const syntaxLines = [];
          while (i < lines.length) {
            const nextLine = lines[i].trim();
            if (!nextLine) {
              i += 1;
              continue;
            }
            if (ANNOTATION_STOP_WORDS.has(nextLine)) {
              break;
            }
            syntaxLines.push(nextLine);
            i += 1;
          }
          const filtered = filterSyntaxLines(syntaxLines);
          if (currentAnnotation && filtered.length > 0) {
            if (!annotations[currentAnnotation]) {
              annotations[currentAnnotation] = { syntax: [] };
            }
            annotations[currentAnnotation].syntax.push(...filtered);
          }
          continue;
        }
        if (ANNOTATION_STOP_WORDS.has(line) || line.startsWith('//@') || line.startsWith('//')) {
          i += 1;
          continue;
        }
        if (line.startsWith('@')) {
          const parts = line.split(/\s+/);
          const name = parts[0];
          if (name.includes('=')) {
            i += 1;
            continue;
          }
          currentAnnotation = name;
          if (!annotations[currentAnnotation]) {
            annotations[currentAnnotation] = { syntax: [] };
          }
        }
        i += 1;
        continue;
      }
      default: {
        i += 1;
        continue;
      }
    }
  }

  return { functions, variables, constants, operators, keywords, types, annotations };
}

function parseMinifiedManual(text) {
  const signaturePattern = /SYNTAX\s+([A-Za-z_][\w.]*?(?:<[^>]+>)?)\s*\(([^)]*)\)\s*→\s*([^\s]+)/g;
  const functions = {};
  let match;
  while ((match = signaturePattern.exec(text)) !== null) {
    const name = match[1];
    const params = match[2]
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    const returnType = match[3];
    if (!functions[name]) {
      functions[name] = { signatures: [], arguments: [] };
    }
    functions[name].signatures.push({ params, returnType, text: `${name}(${match[2]}) → ${returnType}` });
  }
  return { functions, variables: {}, constants: {}, operators: {}, keywords: {}, types: {}, annotations: {} };
}

function writeJsonFile(path, data) {
  const json = JSON.stringify(data, null, 2);
  writeFileSync(path, `${json}\n`, 'utf8');
}

function main() {
  let structures;
  if (existsSync(formattedManualPath)) {
    const rawText = readFileSync(formattedManualPath, 'utf8');
    structures = parseFormattedManual(rawText);
  } else if (existsSync(minifiedManualPath)) {
    const rawText = readFileSync(minifiedManualPath, 'utf8');
    structures = parseMinifiedManual(rawText);
  } else {
    throw new Error('No Pine Script manual found. Expected pine-script-refrence.txt or ref-pine.txt.');
  }

  const outputDir = resolve(repoRoot, 'PineScriptContext', 'structures');
  mkdirSync(outputDir, { recursive: true });

  writeJsonFile(resolve(outputDir, 'functions.json'), structures.functions);
  writeJsonFile(resolve(outputDir, 'variables.json'), structures.variables);
  writeJsonFile(resolve(outputDir, 'constants.json'), structures.constants);
  writeJsonFile(resolve(outputDir, 'operators.json'), structures.operators);
  writeJsonFile(resolve(outputDir, 'keywords.json'), structures.keywords);
  writeJsonFile(resolve(outputDir, 'types.json'), structures.types);
  writeJsonFile(resolve(outputDir, 'annotations.json'), structures.annotations);

  const counts = [
    `${Object.keys(structures.functions).length} functions`,
    `${Object.keys(structures.variables).length} variables`,
    `${Object.keys(structures.constants).length} constants`,
    `${Object.keys(structures.operators).length} operators`,
    `${Object.keys(structures.keywords).length} keywords`,
    `${Object.keys(structures.types).length} types`,
    `${Object.keys(structures.annotations).length} annotations`
  ].join(', ');
  console.log(`Extracted ${counts}.`);
}

main();
