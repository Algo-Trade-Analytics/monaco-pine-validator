import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync, hasMagic } from 'glob';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const configPath = join(__dirname, 'reference-namespaces.json');
async function loadReference(category) {
    const referenceFile = join(repoRoot, 'PineScriptContext', 'structures', `${category}.json`);
    return JSON.parse(await readFile(referenceFile, 'utf8'));
}
function extractNamespaceKeys(reference, namespace) {
    return new Set(Object.keys(reference)
        .filter((key) => key.startsWith(`${namespace}.`))
        .map((key) => key.replace(/<.*$/, '')));
}
async function extractSpecCalls(files, namespace) {
    const matches = new Set();
    const regex = new RegExp(`\\b${namespace}\\.([a-zA-Z][\\w]*)`, 'g');
    for (const file of files) {
        const content = await readFile(join(repoRoot, file), 'utf8');
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.add(`${namespace}.${match[1]}`);
        }
    }
    return matches;
}
async function main() {
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    let hasDifferences = false;
    for (const [name, entry] of Object.entries(config)) {
        const reference = await loadReference(entry.category);
        const referenceNames = extractNamespaceKeys(reference, entry.namespace);
        const expandedSpecs = entry.specs.flatMap((pattern) => hasMagic(pattern) ? globSync(pattern, { cwd: repoRoot, nodir: true }) : [pattern]);
        const specNames = await extractSpecCalls(expandedSpecs, entry.namespace);
        const missingInReference = Array.from(specNames).filter((specName) => !referenceNames.has(specName));
        if (missingInReference.length > 0) {
            hasDifferences = true;
            console.error(`⚠️  ${name}: spec references missing from reference: ${missingInReference.join(', ')}`);
        }
        const untested = Array.from(referenceNames).filter((refName) => !specNames.has(refName));
        if (untested.length > 0) {
            console.warn(`ℹ️  ${name}: reference entries not covered by spec: ${untested.join(', ')}`);
        }
    }
    if (hasDifferences) {
        process.exitCode = 1;
    }
    else {
        console.log('✅ All referenced namespaces align with PineScript context.');
    }
}
main().catch((error) => {
    console.error('Failed to cross-check namespace references:', error);
    process.exitCode = 1;
});
