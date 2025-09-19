import { AST } from './node';

export type FieldEntry = [string, unknown];

export function* iterFields(node: AST): IterableIterator<FieldEntry> {
  for (const field of node._fields ?? []) {
    if (Object.prototype.hasOwnProperty.call(node, field)) {
      yield [field, (node as any)[field]];
    }
  }
}

export function* iterChildNodes(node: AST): IterableIterator<AST> {
  for (const [, value] of iterFields(node)) {
    if (value instanceof AST) {
      yield value;
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof AST) {
          yield item;
        }
      }
    }
  }
}

const LOCATION_ATTRS = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;

export function copyLocation<T extends AST>(newNode: T, oldNode: AST): T {
  for (const attr of LOCATION_ATTRS) {
    if (oldNode._attributes.includes(attr) && newNode._attributes.includes(attr)) {
      const value = (oldNode as any)[attr];
      if (value !== undefined && value !== null) {
        (newNode as any)[attr] = value;
      } else if (attr.startsWith('end_') && Object.prototype.hasOwnProperty.call(oldNode, attr)) {
        (newNode as any)[attr] = value;
      }
    }
  }
  return newNode;
}

function fixLocations(node: AST, lineno: number, colOffset: number, endLineno: number, endColOffset: number): void {
  for (const attr of LOCATION_ATTRS) {
    if (!node._attributes.includes(attr)) {
      continue;
    }
    if (attr === 'lineno') {
      if ((node as any).lineno == null) {
        (node as any).lineno = lineno;
      } else {
        lineno = (node as any).lineno ?? lineno;
      }
    } else if (attr === 'col_offset') {
      if ((node as any).col_offset == null) {
        (node as any).col_offset = colOffset;
      } else {
        colOffset = (node as any).col_offset ?? colOffset;
      }
    } else if (attr === 'end_lineno') {
      if ((node as any).end_lineno == null) {
        (node as any).end_lineno = endLineno;
      } else {
        endLineno = (node as any).end_lineno ?? endLineno;
      }
    } else if (attr === 'end_col_offset') {
      if ((node as any).end_col_offset == null) {
        (node as any).end_col_offset = endColOffset;
      } else {
        endColOffset = (node as any).end_col_offset ?? endColOffset;
      }
    }
  }

  for (const child of iterChildNodes(node)) {
    fixLocations(child, lineno, colOffset, endLineno, endColOffset);
  }
}

export function fixMissingLocations<T extends AST>(node: T): T {
  fixLocations(node, 1, 0, 1, 0);
  return node;
}

export function incrementLineno<T extends AST>(node: T, n = 1): T {
  for (const child of walk(node)) {
    if (child._attributes.includes('lineno')) {
      const current = (child as any).lineno ?? 0;
      (child as any).lineno = current + n;
    }
    if (child._attributes.includes('end_lineno')) {
      const current = (child as any).end_lineno;
      if (typeof current === 'number') {
        (child as any).end_lineno = current + n;
      }
    }
  }
  return node;
}

const LINE_PATTERN = /(.*?(?:\r\n|\n|\r|$))/g;

function splitLinesNoFF(source: string, maxLines?: number): string[] {
  const lines: string[] = [];
  let match: RegExpExecArray | null;
  let lineno = 0;
  const pattern = new RegExp(LINE_PATTERN.source, 'g');
  while ((match = pattern.exec(source))) {
    lineno += 1;
    if (maxLines !== undefined && lineno > maxLines) {
      break;
    }
    lines.push(match[0]);
    if (!match[0]) {
      break;
    }
  }
  return lines;
}

function padWhitespace(source: string): string {
  return source.replace(/[^\f\t]/g, ' ');
}

export function getSourceSegment(source: string, node: AST, { padded = false }: { padded?: boolean } = {}): string | undefined {
  const startLine = (node as any).lineno;
  const endLine = (node as any).end_lineno ?? startLine;
  const startOffset = (node as any).col_offset ?? 0;
  const endOffset = (node as any).end_col_offset ?? 0;

  if (startLine == null) {
    return undefined;
  }

  const lines = splitLinesNoFF(source, endLine ?? startLine);
  if (lines.length === 0) {
    return undefined;
  }

  const firstIndex = Math.max(0, startLine - 1);
  const lastIndex = Math.min(lines.length - 1, (endLine ?? startLine) - 1);
  let first = lines[firstIndex] ?? '';
  let last = lines[lastIndex] ?? '';
  if (padded) {
    first = padWhitespace(first.slice(0, startOffset)) + first.slice(startOffset);
    last = last.slice(0, endOffset) + padWhitespace(last.slice(endOffset));
  }

  if (firstIndex === lastIndex) {
    return first.slice(startOffset, endOffset || undefined);
  }

  const middle = lines.slice(firstIndex + 1, lastIndex);
  return [first.slice(startOffset), ...middle, last.slice(0, endOffset)].join('');
}

export function* walk(node: AST): IterableIterator<AST> {
  const queue: AST[] = [node];
  while (queue.length > 0) {
    const current = queue.shift()!;
    queue.push(...iterChildNodes(current));
    yield current;
  }
}

export interface DumpOptions {
  annotateFields?: boolean;
  includeAttributes?: boolean;
  indent?: number | string | null;
}

function formatValue(value: unknown, level: number, indent: string | null, annotate: boolean, includeAttrs: boolean): [string, boolean] {
  if (value instanceof AST) {
    return formatNode(value, level, indent, annotate, includeAttrs);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return ['[]', true];
    }
    const formatted = value.map((item) => formatValue(item, level + 1, indent, annotate, includeAttrs)[0]);
    const prefix = indent ? `\n${indent.repeat(level + 1)}` : '';
    const sep = indent ? `,\n${indent.repeat(level + 1)}` : ', ';
    const suffix = indent ? `\n${indent.repeat(level)}` : '';
    return [`[${prefix}${formatted.join(sep)}${suffix}]`, false];
  }
  if (typeof value === 'string') {
    return [`${JSON.stringify(value)}`, true];
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return [String(value), true];
  }
  return [JSON.stringify(value), true];
}

function formatNode(node: AST, level: number, indent: string | null, annotate: boolean, includeAttrs: boolean): [string, boolean] {
  const args: string[] = [];
  const prefix = indent ? `\n${indent.repeat(level + 1)}` : '';
  const sep = indent ? `,\n${indent.repeat(level + 1)}` : ', ';
  let allSimple = true;

  for (const field of node._fields) {
    const value = (node as any)[field];
    const [formatted, simple] = formatValue(value, level + 1, indent, annotate, includeAttrs);
    allSimple &&= simple;
    if (annotate) {
      args.push(`${field}=${formatted}`);
    } else {
      args.push(formatted);
    }
  }

  if (includeAttrs) {
    for (const attr of node._attributes) {
      if (Object.prototype.hasOwnProperty.call(node, attr)) {
        const value = (node as any)[attr];
        const [formatted] = formatValue(value, level + 1, indent, annotate, includeAttrs);
        args.push(`${attr}=${formatted}`);
      }
    }
  }

  if (allSimple && args.length <= 3) {
    return [`${node.constructor.name}(${args.join(', ')})`, args.length === 0];
  }

  return [`${node.constructor.name}(${prefix}${args.join(sep)}${indent ? `\n${indent.repeat(level)}` : ''})`, false];
}

export function dump(node: AST, options: DumpOptions = {}): string {
  if (!(node instanceof AST)) {
    throw new TypeError(`expected AST, got ${String((node as any)?.constructor?.name ?? typeof node)}`);
  }

  let indentString: string | null = null;
  if (options.indent != null) {
    indentString = typeof options.indent === 'string' ? options.indent : ' '.repeat(options.indent);
  }

  return formatNode(node, 0, indentString, options.annotateFields ?? true, options.includeAttributes ?? false)[0];
}

export function unparse(_node: AST): never {
  throw new Error('Node unparser is not implemented in the TypeScript port.');
}
