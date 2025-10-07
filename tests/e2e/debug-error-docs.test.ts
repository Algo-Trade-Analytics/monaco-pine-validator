import { describe, it, expect } from 'vitest';
import { ErrorDocumentationProvider } from './core/error-documentation-provider';

describe('Debug Error Documentation Enhancement Tests', () => {
  it('should find similar functions for typos', () => {
    // Test the failing case: 'ta.sam' should suggest 'ta.sma'
    const message = ErrorDocumentationProvider.generateUnknownFunctionMessage('ta.sam');
    
    console.log('\n=== ERROR DOCUMENTATION DEBUG ===');
    console.log('Input: ta.sam');
    console.log('Generated message:', message);
    console.log('Contains ta.sma:', message.includes('ta.sma'));
    console.log('Contains "Did you mean":', message.includes('Did you mean'));
    
    expect(message).toContain('ta.sma');
    expect(message).toContain('Did you mean');
  });

  it('should generate fixes for unknown functions', () => {
    // Test the failing case: should suggest 'ta.sma' for 'ta.sam'
    const message = ErrorDocumentationProvider.generateUnknownFunctionMessage('ta.sam');
    
    console.log('\n=== QUICK FIX DEBUG ===');
    console.log('Input: ta.sam');
    console.log('Generated message:', message);
    
    // Check if the message contains ta.sma suggestion
    const hasTaSma = message.includes('ta.sma');
    console.log('Contains ta.sma:', hasTaSma);
    
    expect(hasTaSma).toBe(true);
  });
});
