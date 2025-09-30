import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const repoRoot = join(dirname(__filename), '..');
  const referencePath = join(repoRoot, 'PineScriptContext', 'structures', 'functions.json');
  const specPath = join(repoRoot, 'tests', 'specs', 'map-validation.spec.ts');

  const referenceJson = JSON.parse(await readFile(referencePath, 'utf8')) as Record<string, unknown>;
  const referenceNames = new Set(
    Object.keys(referenceJson)
      .filter((key) => key.startsWith('map.'))
      .map((key) => key.replace(/<.*$/, '')),
  );

  const specContent = await readFile(specPath, 'utf8');
  const specMatches = new Set<string>();
  const regex = /\bmap\.([a-zA-Z][\w]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(specContent)) !== null) {
    specMatches.add(`map.${match[1]}`);
  }

  const missing = Array.from(specMatches).filter((name) => !referenceNames.has(name));

  if (missing.length > 0) {
    console.error('⚠️  Map spec references functions missing from PineScriptContext:', missing);
    process.exitCode = 1;
  } else {
    console.log('✅ Map spec functions match PineScriptContext reference.');
  }
}

main().catch((error) => {
  console.error('Failed to compare map spec with reference:', error);
  process.exitCode = 1;
});
