import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

type SharedPattern = {
  label: string;
  regex: RegExp;
};

const SHARED_CONSTANT_PATTERNS: SharedPattern[] = [
  { label: 'extend.* constants', regex: /new Set(?:<[^>]+>)?\(\s*\[[^\]]*['"]extend\./ },
  { label: 'format.* constants', regex: /new Set(?:<[^>]+>)?\(\s*\[[^\]]*['"]format\./ },
  { label: 'scale.* constants', regex: /new Set(?:<[^>]+>)?\(\s*\[[^\]]*['"]scale\./ },
  { label: 'adjustment.* constants', regex: /new Set(?:<[^>]+>)?\(\s*\[[^\]]*['"]adjustment\./ },
  { label: 'backadjustment.* constants', regex: /new Set(?:<[^>]+>)?\(\s*\[[^\]]*['"]backadjustment\./ },
  { label: 'settlement_as_close.* constants', regex: /new Set(?:<[^>]+>)?\(\s*\[[^\]]*['"]settlement_as_close\./ },
  { label: 'font family constants', regex: /new Set(?:<[^>]+>)?\(\s*\[[^\]]*['"]font\.family_/ },
  { label: 'text wrap constants', regex: /new Set(?:<[^>]+>)?\(\s*\[[^\]]*['"]text\.wrap_/ },
];

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('constants registry', () => {
  it('keeps shared constant groups centralized', () => {
    const modulesDir = join(process.cwd(), 'modules');
    const moduleFiles = listTsFiles(modulesDir);
    const offenders: string[] = [];

    for (const file of moduleFiles) {
      const contents = readFileSync(file, 'utf8');
      for (const { regex, label } of SHARED_CONSTANT_PATTERNS) {
        if (regex.test(contents)) {
          offenders.push(`${relative(process.cwd(), file)} (${label})`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
