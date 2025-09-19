import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { createEnhancedModularValidator } from '../../EnhancedModularValidator';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptPath = path.resolve(__dirname, 'fixtures', 'luxalgo-volume-bubbles.pine');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');

describe('LuxAlgo Volume Bubbles script', () => {
  it('captures current validator output', () => {
    const validator = createEnhancedModularValidator({ strictMode: true });
    const result = validator.validate(scriptSource);

    const summarize = (items: typeof result.errors) =>
      items.map(({ code, line, column, message }) => ({ code, line, column, message }));

    expect({
      errors: summarize(result.errors),
      warnings: summarize(result.warnings),
    }).toMatchSnapshot();
  });
});
