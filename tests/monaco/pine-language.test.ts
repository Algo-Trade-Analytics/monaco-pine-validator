import { describe, expect, it, vi } from 'vitest';
import type { languages } from 'monaco-editor';
import { registerPineLanguage } from '../../core/monaco/pine-language';

const createMonacoStub = () => {
  const registered: Array<{ id: string }> = [];
  const configs: Record<string, languages.LanguageConfiguration> = {};
  const tokens: Record<string, unknown> = {};
  const hoverProviders: Array<{
    languageId: string;
    provider: languages.HoverProvider;
  }> = [];

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
      registerHoverProvider: vi.fn(
        (languageId: string, provider: languages.HoverProvider) => {
          hoverProviders.push({ languageId, provider });
          return { dispose: vi.fn() };
        },
      ),
    },
  } as unknown as typeof import('monaco-editor');

  return { monaco, registered, configs, tokens, hoverProviders };
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

  // Additional tokenizer behaviour is verified indirectly via Monaco runtime tests.

  it('exposes rules that highlight type and enum declarations', () => {
    const { monaco, tokens } = createMonacoStub();

    registerPineLanguage(monaco);

    const definition = tokens.pinescript as {
      tokenizer: { root: unknown[] };
    };

    const rootRules = definition.tokenizer.root as unknown[];

    const findRule = (pattern: RegExp) =>
      rootRules.find(
        (rule): rule is [RegExp, string[]] =>
          Array.isArray(rule) &&
          rule.length === 2 &&
          rule[0] instanceof RegExp &&
          rule[0].source === pattern.source &&
          Array.isArray(rule[1]),
      );

    const typeDeclarationRule = findRule(/\b(type)(\s+)([A-Za-z_][\w]*)/);
    expect(typeDeclarationRule).toBeDefined();
    const [typeRegex, typeAction] = typeDeclarationRule!;
    expect(typeRegex.test('type pivotGraphic')).toBe(true);
    expect(typeAction[0]).toBe('keyword');
    expect(typeAction[2]).toBe('type.identifier');

    const enumDeclarationRule = findRule(/\b(enum)(\s+)([A-Za-z_][\w]*)/);
    expect(enumDeclarationRule).toBeDefined();
    const [enumRegex, enumAction] = enumDeclarationRule!;
    expect(enumRegex.test('enum SLOption')).toBe(true);
    expect(enumAction[0]).toBe('keyword');
    expect(enumAction[2]).toBe('type.identifier');
  });

  it('registers a hover provider that surfaces Pine Script documentation', () => {
    const { monaco, hoverProviders } = createMonacoStub();

    registerPineLanguage(monaco);

    expect(hoverProviders).toHaveLength(1);
    const provider = hoverProviders[0]?.provider;
    expect(provider).toBeDefined();

    const model = {
      getLineContent: () => 'plot(close)',
    } as unknown as import('monaco-editor').editor.ITextModel;

    const hover = provider?.provideHover(
      model,
      { lineNumber: 1, column: 3 } as unknown as import('monaco-editor').Position,
      {} as import('monaco-editor').CancellationToken,
    );

    expect(hover).not.toBeNull();
    if (hover && 'contents' in hover) {
      const value = hover.contents[0]?.value ?? '';
      expect(value).toContain('plot (built-in function)');
      expect(value).toContain('**Syntax**');
      expect(value).toContain('```pinescript');
      expect(value).not.toContain('See also');
      expect(value).not.toContain('⌘ + click');
      expect(value).toContain('[TradingView reference](https://www.tradingview.com/pine-script-reference/v6/#fun_plot)');
    }
  });
});
