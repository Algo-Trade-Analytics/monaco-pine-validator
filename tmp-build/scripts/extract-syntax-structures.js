import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function findRepoRoot(startDir) {
    let current = startDir;
    while (!existsSync(resolve(current, 'package.json'))) {
        const parent = resolve(current, '..');
        if (parent === current) {
            throw new Error(`Failed to locate repository root from ${startDir}`);
        }
        current = parent;
    }
    return current;
}
const repoRoot = findRepoRoot(__dirname);
const formattedManualPath = resolve(repoRoot, 'PineScriptContext', 'pine-script-refrence.txt');
const minifiedManualPath = resolve(repoRoot, 'PineScriptContext', 'ref-pine.txt');
const QUALIFIERS = new Set(['series', 'simple', 'input', 'const']);
const FUNCTION_STOP_WORDS = new Set([
    'ARGUMENTS',
    'REMARKS',
    'EXAMPLE',
    'EXAMPLES',
    'SEE ALSO',
    'RETURNS',
    'DEFAULT',
    'OPTIONS',
    'NOTE',
    'NOTES',
    'WARNING',
    'USAGE',
    'EXCEPTIONS',
]);
const VARIABLE_STOP_WORDS = new Set([
    'TYPE',
    'REMARKS',
    'SEE ALSO',
    'EXAMPLE',
    'EXAMPLES',
    'NOTE',
    'NOTES',
    'WARNING',
    'USAGE',
    'DEFAULT',
    'RETURNS',
]);
const OPERATOR_STOP_WORDS = new Set([
    'SYNTAX',
    'ARGUMENTS',
    'REMARKS',
    'EXAMPLE',
    'EXAMPLES',
    'RETURNS',
    'SEE ALSO',
    'DEFAULT',
    'NOTE',
    'NOTES',
    'WARNING',
]);
const KEYWORD_STOP_WORDS = new Set([
    'SYNTAX',
    'ARGUMENTS',
    'REMARKS',
    'EXAMPLE',
    'EXAMPLES',
    'RETURNS',
    'SEE ALSO',
    'DEFAULT',
    'NOTE',
    'NOTES',
    'WARNING',
    'FIELDS',
    'TYPE',
]);
const TYPE_STOP_WORDS = new Set([
    'SYNTAX',
    'FIELDS',
    'REMARKS',
    'EXAMPLE',
    'EXAMPLES',
    'SEE ALSO',
    'DEFAULT',
    'NOTE',
    'NOTES',
    'WARNING',
    'USAGE',
]);
const ANNOTATION_STOP_WORDS = new Set([
    'SYNTAX',
    'REMARKS',
    'EXAMPLE',
    'EXAMPLES',
    'SEE ALSO',
    'DEFAULT',
    'NOTE',
    'NOTES',
    'WARNING',
]);
const OPERATOR_NAME_PATTERN = /^(?:[\[\]\-\+\*/%<>=!&|^?:]+|and|or|not)$/;
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
        qualifier,
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
        qualifier,
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
            currentSection = sectionMap.get(line) ?? null;
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
                        }
                        else if (fields.length > 0) {
                            const lastField = fields[fields.length - 1];
                            const parts = [lastField.description ?? undefined, trimmedField].filter(Boolean);
                            lastField.description = parts.join(' ');
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
                if (TYPE_STOP_WORDS.has(line)) {
                    i += 1;
                    continue;
                }
                if (/^[A-Za-z_][\w.<>]*$/.test(line)) {
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
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function ensureNestedMap(value) {
    if (isPlainObject(value)) {
        return value;
    }
    const map = {};
    if (typeof value !== 'undefined') {
        map.__self = value;
    }
    return map;
}
function nestRecords(records) {
    const root = {};
    const entries = Object.entries(records).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [flatKey, value] of entries) {
        const rawParts = flatKey.split('.');
        const parts = rawParts.filter(part => part.length > 0);
        if (parts.length === 0) {
            parts.push(flatKey);
        }
        let node = root;
        parts.forEach((part, index) => {
            const isLeaf = index === parts.length - 1;
            const existing = node[part];
            if (isLeaf) {
                if (isPlainObject(existing)) {
                    existing.__self = value;
                }
                else if (typeof existing === 'undefined') {
                    node[part] = value;
                }
                else {
                    const map = ensureNestedMap(existing);
                    map.__self = value;
                    node[part] = map;
                }
            }
            else {
                const map = ensureNestedMap(existing);
                node[part] = map;
                node = map;
            }
        });
    }
    return root;
}
function toPascalCase(value) {
    if (!value) {
        return value;
    }
    return value[0].toUpperCase() + value.slice(1);
}
const MODULE_TYPE_NAMES = {
    functions: 'FunctionMap',
    variables: 'VariableMap',
    constants: 'ConstantMap',
    operators: 'OperatorMap',
    keywords: 'KeywordMap',
    types: 'TypeMap',
    annotations: 'AnnotationMap',
};
function indent(depth) {
    return '  '.repeat(depth);
}
function formatStringArray(values, depth) {
    const lines = [];
    const baseIndent = indent(depth);
    if (values.length === 0) {
        lines.push(`${baseIndent}[]`);
        return lines;
    }
    lines.push(`${baseIndent}[`);
    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        const suffix = index === values.length - 1 ? '' : ',';
        lines.push(`${baseIndent}  ${JSON.stringify(value)}${suffix}`);
    }
    lines.push(`${baseIndent}]`);
    return lines;
}
function isTypeSpec(value) {
    return (isPlainObject(value) &&
        typeof value.qualifier !== 'undefined' &&
        Object.prototype.hasOwnProperty.call(value, 'type'));
}
function serializeFunctionSignature(signature, depth) {
    const lines = [];
    const baseIndent = indent(depth);
    lines.push(`${baseIndent}defineFunctionSignature({`);
    if (signature.params.length === 0) {
        lines.push(`${baseIndent}  params: [],`);
    }
    else {
        lines.push(`${baseIndent}  params: [`);
        for (let index = 0; index < signature.params.length; index += 1) {
            const param = signature.params[index];
            const suffix = index === signature.params.length - 1 ? '' : ',';
            lines.push(`${baseIndent}    ${JSON.stringify(param)}${suffix}`);
        }
        lines.push(`${baseIndent}  ],`);
    }
    lines.push(`${baseIndent}  returnType: ${signature.returnType === null ? 'null' : JSON.stringify(signature.returnType)},`);
    lines.push(`${baseIndent}  text: ${JSON.stringify(signature.text)}`);
    lines.push(`${baseIndent}})`);
    return lines;
}
function serializeFunctionArgument(argument, depth) {
    const lines = [];
    const baseIndent = indent(depth);
    lines.push(`${baseIndent}defineFunctionArgument({` +
        `name: ${JSON.stringify(argument.name)}, ` +
        `qualifier: ${argument.qualifier === null ? 'null' : JSON.stringify(argument.qualifier)}, ` +
        `type: ${argument.type === null ? 'null' : JSON.stringify(argument.type)}, ` +
        `required: ${argument.required}, ` +
        `default: ${argument.default === null ? 'null' : JSON.stringify(argument.default)}})`);
    return lines;
}
function serializeTypeField(field, depth) {
    const baseIndent = indent(depth);
    return [
        `${baseIndent}defineTypeField({` +
            `name: ${JSON.stringify(field.name)}, ` +
            `qualifier: ${field.qualifier === null ? 'null' : JSON.stringify(field.qualifier)}, ` +
            `type: ${field.type === null ? 'null' : JSON.stringify(field.type)}, ` +
            `description: ${field.description === null ? 'null' : JSON.stringify(field.description)}})`,
    ];
}
function serializeOperatorEntry(entry, depth) {
    const baseIndent = indent(depth);
    const lines = [];
    if (entry.length === 0) {
        lines.push(`${baseIndent}[]`);
        return lines;
    }
    lines.push(`${baseIndent}[`);
    for (let index = 0; index < entry.length; index += 1) {
        const suffix = index === entry.length - 1 ? '' : ',';
        lines.push(`${baseIndent}  ${JSON.stringify(entry[index])}${suffix}`);
    }
    lines.push(`${baseIndent}]`);
    return lines;
}
function serializeValue(kind, value, depth, helpers, key) {
    const baseIndent = indent(depth);
    if (Array.isArray(value)) {
        if (kind === 'functions' && key === 'signatures') {
            helpers.add('defineFunctionSignature');
            const lines = [`${baseIndent}[`];
            const signatures = value;
            for (let index = 0; index < signatures.length; index += 1) {
                const signatureLines = serializeFunctionSignature(signatures[index], depth + 1);
                signatureLines[signatureLines.length - 1] += index === signatures.length - 1 ? '' : ',';
                lines.push(...signatureLines);
            }
            lines.push(`${baseIndent}]`);
            return lines;
        }
        if (kind === 'functions' && key === 'arguments') {
            helpers.add('defineFunctionArgument');
            const lines = [`${baseIndent}[`];
            const args = value;
            for (let index = 0; index < args.length; index += 1) {
                const argumentLines = serializeFunctionArgument(args[index], depth + 1);
                argumentLines[argumentLines.length - 1] += index === args.length - 1 ? '' : ',';
                lines.push(...argumentLines);
            }
            lines.push(`${baseIndent}]`);
            return lines;
        }
        if (kind === 'types' && key === 'fields') {
            helpers.add('defineTypeField');
            const lines = [`${baseIndent}[`];
            const fields = value;
            for (let index = 0; index < fields.length; index += 1) {
                const fieldLines = serializeTypeField(fields[index], depth + 1);
                fieldLines[fieldLines.length - 1] += index === fields.length - 1 ? '' : ',';
                lines.push(...fieldLines);
            }
            lines.push(`${baseIndent}]`);
            return lines;
        }
        if (kind === 'operators') {
            return serializeOperatorEntry(value, depth);
        }
        return formatStringArray(value, depth);
    }
    if ((kind === 'variables' || kind === 'constants') && isTypeSpec(value)) {
        if (kind === 'variables') {
            helpers.add('defineVariable');
            return [
                `${baseIndent}defineVariable({` +
                    `qualifier: ${value.qualifier === null ? 'null' : JSON.stringify(value.qualifier)}, ` +
                    `type: ${value.type === null ? 'null' : JSON.stringify(value.type)}})`,
            ];
        }
        helpers.add('defineConstant');
        return [
            `${baseIndent}defineConstant({` +
                `qualifier: ${value.qualifier === null ? 'null' : JSON.stringify(value.qualifier)}, ` +
                `type: ${value.type === null ? 'null' : JSON.stringify(value.type)}})`,
        ];
    }
    if (isPlainObject(value)) {
        return serializeObject(kind, value, depth, helpers);
    }
    return [`${baseIndent}${value === null ? 'null' : JSON.stringify(value)}`];
}
function serializeObject(kind, value, depth, helpers) {
    const baseIndent = indent(depth);
    const entries = Object.entries(value).sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) {
        return [`${baseIndent}{}`];
    }
    const lines = [`${baseIndent}{`];
    for (let index = 0; index < entries.length; index += 1) {
        const [key, entry] = entries[index];
        const childLines = serializeValue(kind, entry, depth + 1, helpers, key);
        const childIndent = indent(depth + 1);
        const suffix = index === entries.length - 1 ? '' : ',';
        if (childLines.length === 1) {
            const [line] = childLines;
            lines.push(`${childIndent}${JSON.stringify(key)}: ${line.trimStart()}${suffix}`);
        }
        else {
            const [first, ...rest] = childLines;
            lines.push(`${childIndent}${JSON.stringify(key)}: ${first.trimStart()}`);
            if (rest.length === 0) {
                lines[lines.length - 1] += suffix;
            }
            else {
                for (let lineIndex = 0; lineIndex < rest.length; lineIndex += 1) {
                    if (lineIndex === rest.length - 1) {
                        lines.push(`${rest[lineIndex]}${suffix}`);
                    }
                    else {
                        lines.push(rest[lineIndex]);
                    }
                }
            }
        }
    }
    lines.push(`${baseIndent}}`);
    return lines;
}
function serializeModule(kind, value) {
    const helpers = new Set();
    const lines = serializeObject(kind, value, 0, helpers);
    return { lines, helpers };
}
function writeSchemaModule(directory) {
    const lines = [
        '// This file is automatically generated by scripts/extract-syntax-structures.ts.',
        '// Do not edit this file directly.',
        '',
        'export type PineTypeName = string | null;',
        "export type PineQualifier = 'series' | 'simple' | 'input' | 'const' | null;",
        '',
        'export type PineTypeTagged<Name extends PineTypeName> = {',
        '  readonly __pineType?: Name;',
        '};',
        '',
        'export type PineFunctionSignature<Name extends PineTypeName> = PineTypeTagged<Name> & {',
        '  readonly params: readonly string[];',
        '  readonly returnType: Name;',
        '  readonly text: string;',
        '};',
        '',
        'export type PineFunctionArgument<',
        '  Name extends string,',
        '  Qualifier extends PineQualifier,',
        '  TypeName extends PineTypeName',
        '> = PineTypeTagged<TypeName> & {',
        '  readonly name: Name;',
        '  readonly qualifier: Qualifier;',
        '  readonly required: boolean;',
        '  readonly default: string | null;',
        '};',
        '',
        'export type PineFunctionEntry = {',
        '  readonly signatures: readonly PineFunctionSignature<PineTypeName>[];',
        '  readonly arguments: readonly PineFunctionArgument<string, PineQualifier, PineTypeName>[];',
        '};',
        '',
        'export type PineVariableEntry = PineTypeTagged<PineTypeName> & {',
        '  readonly qualifier: PineQualifier;',
        '};',
        '',
        'export type PineConstantEntry = PineTypeTagged<PineTypeName> & {',
        '  readonly qualifier: PineQualifier;',
        '};',
        '',
        'export type PineOperatorEntry = readonly string[];',
        '',
        'export type PineKeywordEntry = {',
        '  readonly syntax: readonly string[];',
        '};',
        '',
        'export type PineTypeField = PineTypeTagged<PineTypeName> & {',
        '  readonly name: string;',
        '  readonly qualifier: PineQualifier;',
        '  readonly description: string | null;',
        '};',
        '',
        'export type PineTypeEntry = {',
        '  readonly syntax: readonly string[];',
        '  readonly fields: readonly PineTypeField[];',
        '};',
        '',
        'export type PineAnnotationEntry = {',
        '  readonly syntax: readonly string[];',
        '};',
        '',
        'export type NestedRecord<T> = {',
        '  readonly [key: string]: T | NestedRecord<T>;',
        '};',
        '',
        'type FunctionSignatureInit<Name extends PineTypeName> = {',
        '  readonly params: readonly string[];',
        '  readonly returnType: Name;',
        '  readonly text: string;',
        '};',
        '',
        'type FunctionArgumentInit<',
        '  Name extends string,',
        '  Qualifier extends PineQualifier,',
        '  TypeName extends PineTypeName',
        '> = {',
        '  readonly name: Name;',
        '  readonly qualifier: Qualifier;',
        '  readonly type: TypeName;',
        '  readonly required: boolean;',
        '  readonly default: string | null;',
        '};',
        '',
        'type VariableInit<TypeName extends PineTypeName> = {',
        '  readonly qualifier: PineQualifier;',
        '  readonly type: TypeName;',
        '};',
        '',
        'type ConstantInit<TypeName extends PineTypeName> = {',
        '  readonly qualifier: PineQualifier;',
        '  readonly type: TypeName;',
        '};',
        '',
        'type TypeFieldInit<',
        '  Name extends string,',
        '  Qualifier extends PineQualifier,',
        '  TypeName extends PineTypeName',
        '> = {',
        '  readonly name: Name;',
        '  readonly qualifier: Qualifier;',
        '  readonly type: TypeName;',
        '  readonly description: string | null;',
        '};',
        '',
        'export const defineFunctionSignature = <Name extends PineTypeName>(',
        '  signature: FunctionSignatureInit<Name>,',
        '): PineFunctionSignature<Name> => signature as PineFunctionSignature<Name>;',
        '',
        'export const defineFunctionArgument = <',
        '  Name extends string,',
        '  Qualifier extends PineQualifier,',
        '  TypeName extends PineTypeName',
        '>({',
        '  name,',
        '  qualifier,',
        '  type,',
        '  required,',
        '  default: defaultValue,',
        '}: FunctionArgumentInit<Name, Qualifier, TypeName>): PineFunctionArgument<Name, Qualifier, TypeName> => {',
        '  void type;',
        '  return {',
        '    name,',
        '    qualifier,',
        '    required,',
        '    default: defaultValue,',
        '  } as PineFunctionArgument<Name, Qualifier, TypeName>;',
        '};',
        '',
        'export const defineVariable = <TypeName extends PineTypeName>({',
        '  qualifier,',
        '  type,',
        '}: VariableInit<TypeName>): PineVariableEntry => {',
        '  void type;',
        '  return {',
        '    qualifier,',
        '  } as PineVariableEntry;',
        '};',
        '',
        'export const defineConstant = <TypeName extends PineTypeName>({',
        '  qualifier,',
        '  type,',
        '}: ConstantInit<TypeName>): PineConstantEntry => {',
        '  void type;',
        '  return {',
        '    qualifier,',
        '  } as PineConstantEntry;',
        '};',
        '',
        'export const defineTypeField = <',
        '  Name extends string,',
        '  Qualifier extends PineQualifier,',
        '  TypeName extends PineTypeName',
        '>({ name, qualifier, type, description }: TypeFieldInit<Name, Qualifier, TypeName>): PineTypeField => {',
        '  void type;',
        '  return {',
        '    name,',
        '    qualifier,',
        '    description,',
        '  } as PineTypeField;',
        '};',
        '',
        'export type FunctionMap = NestedRecord<PineFunctionEntry>;',
        'export type VariableMap = NestedRecord<PineVariableEntry>;',
        'export type ConstantMap = NestedRecord<PineConstantEntry>;',
        'export type OperatorMap = NestedRecord<PineOperatorEntry>;',
        'export type KeywordMap = NestedRecord<PineKeywordEntry>;',
        'export type TypeMap = NestedRecord<PineTypeEntry>;',
        'export type AnnotationMap = NestedRecord<PineAnnotationEntry>;',
        '',
    ];
    const schemaPath = resolve(directory, 'schema.ts');
    writeFileSync(schemaPath, `${lines.join('\n')}\n`, 'utf8');
}
function writeManualStructuresModules(directory, structures) {
    if (existsSync(directory)) {
        rmSync(directory, { recursive: true });
    }
    mkdirSync(directory, { recursive: true });
    writeSchemaModule(directory);
    const entries = [
        ['functions', structures.functions],
        ['variables', structures.variables],
        ['constants', structures.constants],
        ['operators', structures.operators],
        ['keywords', structures.keywords],
        ['types', structures.types],
        ['annotations', structures.annotations],
    ];
    const header = [
        '// This file is automatically generated by scripts/extract-syntax-structures.ts.',
        '// Do not edit this file directly.',
        '',
    ];
    const indexValueImports = [];
    const indexTypeImports = [];
    const indexReExports = [];
    for (const [name, value] of entries) {
        const pascalName = toPascalCase(name);
        const { lines: moduleLines, helpers } = serializeModule(name, value);
        const helperList = Array.from(helpers).sort();
        const moduleType = MODULE_TYPE_NAMES[name];
        const importLines = [];
        if (helperList.length > 0) {
            importLines.push(`import { ${helperList.join(', ')} } from './schema';`);
        }
        importLines.push(`import type { ${moduleType} } from './schema';`);
        const lines = [...header];
        lines.push(...importLines);
        lines.push('');
        lines.push(`export const ${name} = ${moduleLines.join('\n')} satisfies ${moduleType};`);
        lines.push(`export type ${pascalName} = typeof ${name};`);
        lines.push('');
        const filePath = resolve(directory, `${name}.ts`);
        writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
        indexValueImports.push(`import { ${name} } from './${name}';`);
        indexTypeImports.push(`import type { ${pascalName} } from './${name}';`);
        indexReExports.push(`export { ${name} } from './${name}';`);
        indexReExports.push(`export type { ${pascalName} } from './${name}';`);
    }
    const indexLines = [...header];
    indexLines.push(...indexValueImports);
    indexLines.push(...indexTypeImports);
    if (indexReExports.length > 0) {
        indexLines.push('');
        indexLines.push(...indexReExports);
    }
    indexLines.push('');
    indexLines.push('export type {');
    indexLines.push('  PineTypeName,');
    indexLines.push('  PineQualifier,');
    indexLines.push('  PineTypeTagged,');
    indexLines.push('  PineFunctionSignature,');
    indexLines.push('  PineFunctionArgument,');
    indexLines.push('  PineFunctionEntry,');
    indexLines.push('  PineVariableEntry,');
    indexLines.push('  PineConstantEntry,');
    indexLines.push('  PineOperatorEntry,');
    indexLines.push('  PineKeywordEntry,');
    indexLines.push('  PineTypeField,');
    indexLines.push('  PineTypeEntry,');
    indexLines.push('  PineAnnotationEntry,');
    indexLines.push('  NestedRecord,');
    indexLines.push('  FunctionMap,');
    indexLines.push('  VariableMap,');
    indexLines.push('  ConstantMap,');
    indexLines.push('  OperatorMap,');
    indexLines.push('  KeywordMap,');
    indexLines.push('  TypeMap,');
    indexLines.push('  AnnotationMap');
    indexLines.push("} from './schema';");
    indexLines.push('');
    indexLines.push('export const pineManualStructures = {');
    for (let index = 0; index < entries.length; index += 1) {
        const [name] = entries[index];
        const suffix = index === entries.length - 1 ? '' : ',';
        indexLines.push(`  ${name}${suffix}`);
    }
    indexLines.push('} as const;');
    indexLines.push('export type PineManualStructures = typeof pineManualStructures;');
    indexLines.push('');
    const indexPath = resolve(directory, 'index.ts');
    writeFileSync(indexPath, `${indexLines.join('\n')}\n`, 'utf8');
}
function main() {
    let structures;
    if (existsSync(formattedManualPath)) {
        const rawText = readFileSync(formattedManualPath, 'utf8');
        structures = parseFormattedManual(rawText);
    }
    else if (existsSync(minifiedManualPath)) {
        const rawText = readFileSync(minifiedManualPath, 'utf8');
        structures = parseMinifiedManual(rawText);
    }
    else {
        throw new Error('No Pine Script manual found. Expected pine-script-refrence.txt or ref-pine.txt.');
    }
    const nestedStructures = {
        functions: nestRecords(structures.functions),
        variables: nestRecords(structures.variables),
        constants: nestRecords(structures.constants),
        operators: nestRecords(structures.operators),
        keywords: nestRecords(structures.keywords),
        types: nestRecords(structures.types),
        annotations: nestRecords(structures.annotations),
    };
    const outputDir = resolve(repoRoot, 'PineScriptContext', 'structures');
    writeManualStructuresModules(outputDir, nestedStructures);
    const counts = [
        `${Object.keys(structures.functions).length} functions`,
        `${Object.keys(structures.variables).length} variables`,
        `${Object.keys(structures.constants).length} constants`,
        `${Object.keys(structures.operators).length} operators`,
        `${Object.keys(structures.keywords).length} keywords`,
        `${Object.keys(structures.types).length} types`,
        `${Object.keys(structures.annotations).length} annotations`,
    ].join(', ');
    console.log(`Extracted ${counts}.`);
}
main();
