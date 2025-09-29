import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnhancedModularValidator } from '../EnhancedModularValidator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const validator = new EnhancedModularValidator({
    targetVersion: 6,
    strictMode: true,
    enableTypeChecking: true,
    enableControlFlowAnalysis: true,
    enablePerformanceAnalysis: true,
    enableWarnings: true,
    enableInfo: true,
  });

  const scriptPath = resolve(__dirname, '../tests/popular-pine-scripts/Uptrick-Volatility.pine');
  const source = readFileSync(scriptPath, 'utf8');
  const result = validator.validate(source);

  const fnModule = (validator as any).modules?.find((module: any) => module?.name === 'FunctionValidator');
  if (fnModule) {
    const names = fnModule.functionCalls?.map((call: any) => call.name) ?? [];
    console.log('Function call names:', Array.from(new Set(names)).sort());
    const stray = names
      .map((name: string, index: number) => ({ name, index }))
      .filter(({ name }) => name === 'new');
    if (stray.length > 0) {
      console.log('Found raw new() calls count:', stray.length);
      console.log('Details:', stray.map(({ index }) => fnModule.functionCalls[index]));
    }
    console.log('First 20 calls:', fnModule.functionCalls?.slice(0, 20) ?? []);
  }

  console.log('Errors:', result.errors.length);
  for (const issue of result.errors) {
    console.log(`[${issue.code}] ${issue.line}:${issue.column} – ${issue.message}`);
  }
  console.log('Warnings:', result.warnings.length);
  for (const warning of result.warnings) {
    console.log(`[${warning.code}] ${warning.line}:${warning.column} – ${warning.message}`);
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exitCode = 1;
});
