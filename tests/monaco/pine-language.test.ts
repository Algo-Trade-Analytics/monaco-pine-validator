import { describe, expect, it, vi } from 'vitest';
import type { languages } from 'monaco-editor';
import { registerPineLanguage } from '../../core/monaco/pine-language';

const createMonacoStub = () => {
  const registered: Array<{ id: string }> = [];
  const configs: Record<string, languages.LanguageConfiguration> = {};
  const tokens: Record<string, unknown> = {};

  const monaco = {
    languages: {
      getLanguages: () => registered,
      register: vi.fn((config: { id: string }) => {
        registered.push(config);
      }),
      setLanguageConfiguration: vi.fn(
        (id: string, config: languages.LanguageConfiguration) => {
          configs[id] = config;
        },
      ),
      setMonarchTokensProvider: vi.fn((id: string, definition: unknown) => {
        tokens[id] = definition;
      }),
    },
  } as unknown as typeof import('monaco-editor');

  return { monaco, registered, configs, tokens };
};

describe('registerPineLanguage', () => {
  it('registers the Pine Script language exactly once', () => {
    const { monaco, registered, configs, tokens } = createMonacoStub();

    registerPineLanguage(monaco);
    expect(registered).toHaveLength(1);
    expect(Object.keys(configs)).toContain('pinescript');
    expect(Object.keys(tokens)).toContain('pinescript');

    registerPineLanguage(monaco);
    expect(registered).toHaveLength(1);
  });

  it('registers a tokenizer rule that highlights user-defined functions', () => {
    const { monaco, tokens } = createMonacoStub();

    registerPineLanguage(monaco);

    const definition = tokens.pinescript as {
      tokenizer: { root: unknown[] };
    };
    expect(definition).toBeDefined();

    const rootRules = definition.tokenizer.root as unknown[];
    const supportFunctionRules = rootRules.filter(
      (rule) => Array.isArray(rule) && rule.length >= 2 && rule[1] === 'support.function',
    ) as Array<[RegExp, string]>;

    expect(supportFunctionRules.length).toBeGreaterThan(0);

    const functionRule = supportFunctionRules[supportFunctionRules.length - 1];

    expect(functionRule).toBeDefined();
    expect(functionRule?.[0]).toBeInstanceOf(RegExp);

    const regex = functionRule![0];
    expect(regex.test('pivotTimeframeChangeCounter(')).toBe(true);
    expect(regex.test('indicator(')).toBe(true);
    expect(regex.test('if(')).toBe(false);
  });
});
