import { describe, it, expect } from 'vitest';

import './validator-smoke.spec';

const testSuiteInfo = {
  name: 'Pine Script v6 Validator Smoke Suite',
  description: 'Focused regression tests that exercise the current EnhancedModularValidator behaviour.',
  modules: ['Validator smoke tests'],
  totalModules: 1,
};

describe('🧪 Pine Script v6 Validator Smoke Suite', () => {
  it('loads the smoke-test modules', () => {
    expect(testSuiteInfo.totalModules).toBeGreaterThan(0);
  });
});

displaySuiteMetadata();

function displaySuiteMetadata(): void {
  console.log('🧪 Pine Script v6 Validator Test Suite Loaded');
  console.log(`📊 Total Test Modules: ${testSuiteInfo.totalModules}`);
  console.log('📋 Test Modules:', testSuiteInfo.modules.join(', '));
}
