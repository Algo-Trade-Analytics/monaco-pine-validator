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
});

