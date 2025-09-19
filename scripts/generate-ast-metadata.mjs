import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const sourcePath = resolve(repoRoot, 'pynescript', 'ast', 'node.ts');
const source = readFileSync(sourcePath, 'utf8');

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: 'node.ts',
});

const sandbox = {
  exports: {},
  module: { exports: {} },
  require: (specifier) => {
    throw new Error(`Dynamic require not supported: ${specifier}`);
  },
  console,
  Uint8Array,
  Set,
  Symbol,
  Object,
  Array,
  Number,
  Boolean,
  String,
};

vm.runInNewContext(transpiled.outputText, sandbox, {
  filename: 'node.js',
  displayErrors: true,
});

const moduleExports = sandbox.module.exports;
const hasModuleExports = moduleExports && Object.keys(moduleExports).length > 0;
const Nodes = hasModuleExports ? moduleExports : sandbox.exports;

function isNodeConstructor(value) {
  return (
    typeof value === 'function' &&
    (value === Nodes.AST || (value?.prototype instanceof Nodes.AST))
  );
}

function unique(array) {
  return Array.from(new Set(array));
}

function describeDefault(value) {
  if (Array.isArray(value)) {
    return { kind: 'list' };
  }
  if (value instanceof Set) {
    return { kind: 'set' };
  }
  if (value && typeof value === 'object') {
    if (value.constructor === Object) {
      return { kind: 'dict' };
    }
  }
  if (value === null) {
    return { kind: 'null' };
  }
  if (value === undefined) {
    return { kind: 'required' };
  }
  return { kind: 'literal', value };
}

function collectMetadata() {
  const classes = {};
  for (const [name, value] of Object.entries(Nodes)) {
    if (!isNodeConstructor(value)) {
      continue;
    }
    const ctor = value;
    const fields = Array.from(ctor._fields ?? []);
    const attributes = Array.from(ctor._attributes ?? []);
    const instance = new ctor();
    const dataclassFields = unique([
      ...fields,
      ...attributes,
      ...Object.keys(instance),
    ]);

    const defaults = {};
    for (const fieldName of dataclassFields) {
      defaults[fieldName] = describeDefault(instance[fieldName]);
    }

    const bases = [];
    const proto = Object.getPrototypeOf(ctor.prototype);
    if (proto && proto.constructor && proto.constructor.name !== 'Object') {
      bases.push(proto.constructor.name);
    }

    classes[name] = {
      fields,
      attributes,
      dataclass_fields: dataclassFields,
      defaults,
      bases,
    };
  }

  return { classes };
}

const metadata = collectMetadata();
const outputPath = resolve(repoRoot, 'pynescript', 'ast', 'python-metadata.json');
writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Wrote metadata for ${Object.keys(metadata.classes).length} classes to ${outputPath}`);
