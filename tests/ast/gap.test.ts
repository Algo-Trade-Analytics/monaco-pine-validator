import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as Nodes from '../../pynescript/ast/node';

type NodeCtor = typeof Nodes.AST;

type PythonClassMetadata = {
  attributes: string[];
  bases: string[];
  dataclass_fields: string[];
  defaults: Record<string, { kind: string; value?: unknown }>;
  fields: string[];
};

function isNodeConstructor(value: unknown): value is NodeCtor {
  return (
    typeof value === 'function' &&
    (value === Nodes.AST || value.prototype instanceof Nodes.AST)
  );
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const metadataPath = resolve(repoRoot, 'pynescript', 'ast', 'python-metadata.json');

const pythonMetadata: { classes: Record<string, PythonClassMetadata> } = JSON.parse(
  readFileSync(metadataPath, { encoding: 'utf8' })
);

const constructors = new Map<string, NodeCtor>();
for (const [name, value] of Object.entries(Nodes)) {
  if (isNodeConstructor(value)) {
    constructors.set(name, value);
  }
}

describe('Python ↔︎ TypeScript AST parity', () => {
  it('exports the same set of node constructors', () => {
    const tsNames = Array.from(constructors.keys()).sort();
    const pythonNames = Object.keys(pythonMetadata.classes).sort();
    expect(tsNames).toEqual(pythonNames);
  });

  it('matches inheritance, field, and attribute metadata', () => {
    for (const [name, info] of Object.entries(pythonMetadata.classes)) {
      const ctor = constructors.get(name);
      expect(ctor, `TypeScript AST is missing ${name}`).toBeDefined();
      if (!ctor) {
        continue;
      }
      const proto = Object.getPrototypeOf(ctor.prototype);
      const baseCtor = proto?.constructor;
      const baseName =
        baseCtor && baseCtor !== Object ? (baseCtor as { name: string }).name : null;
      const expectedBase = info.bases[0] ?? null;
      expect(baseName ?? null, `${name} base class mismatch`).toBe(expectedBase);

      const fields = Array.from((ctor as typeof Nodes.AST)._fields ?? []);
      expect(fields, `${name} fields mismatch`).toEqual(info.fields);

      const attributes = Array.from((ctor as typeof Nodes.AST)._attributes ?? []);
      expect(attributes, `${name} attributes mismatch`).toEqual(info.attributes);
    }
  });

  it('provides matching dataclass fields and default shapes', () => {
    for (const [name, info] of Object.entries(pythonMetadata.classes)) {
      const ctor = constructors.get(name);
      if (!ctor) {
        continue;
      }
      const instance = new ctor();
      for (const fieldName of info.dataclass_fields) {
        expect(instance).toHaveProperty(fieldName);
        const value = (instance as Record<string, unknown>)[fieldName];
        const defaultInfo = info.defaults[fieldName];
        switch (defaultInfo?.kind) {
          case 'list':
            expect(Array.isArray(value), `${name}.${fieldName} should default to an array`).toBe(true);
            break;
          case 'dict':
            expect(
              value !== null && typeof value === 'object' && value.constructor === Object,
              `${name}.${fieldName} should default to an object`
            ).toBe(true);
            break;
          case 'set':
            expect(value).toBeInstanceOf(Set);
            break;
          case 'null':
            expect(value, `${name}.${fieldName} should default to null`).toBeNull();
            break;
          case 'literal':
            expect(value, `${name}.${fieldName} literal default mismatch`).toEqual(defaultInfo.value);
            break;
          case 'required':
            expect(
              value === null || value === undefined,
              `${name}.${fieldName} should start uninitialised`
            ).toBe(true);
            break;
          default:
            // Factories other than list/dict/set are not currently used upstream.
            expect(defaultInfo?.kind).toBeUndefined();
        }
      }
    }
  });
});
