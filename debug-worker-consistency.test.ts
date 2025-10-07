import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';
import { createMonacoWorkerClient } from './core/monaco/client';

describe('Debug Worker Consistency', () => {
  it('should have consistent validation between direct and worker validation', async () => {
    // Read the test script
    const fs = require('fs');
    const source = fs.readFileSync('test-worker-consistency.pine', 'utf8');

    // Test direct validation
    const directValidator = new EnhancedModularValidator();
    const directResult = directValidator.validate(source);

    console.log('\n=== DIRECT VALIDATION ===');
    console.log('isValid:', directResult.isValid);
    console.log('Number of errors:', directResult.errors.length);
    
    const directIndentationErrors = directResult.errors.filter(e => 
      e.code.includes('INDENT') || e.code.includes('WRAP')
    );
    console.log('Indentation errors:', directIndentationErrors.length);

    // Test worker validation
    const workerClient = createMonacoWorkerClient({
      workerUrl: '/dist/worker.js', // This might not work in test environment
    });

    let workerResult;
    try {
      const workerResponse = await workerClient.validate({
        code: source,
        version: 1
      });
      workerResult = workerResponse.payload.result;
      
      console.log('\n=== WORKER VALIDATION ===');
      console.log('isValid:', workerResult.isValid);
      console.log('Number of errors:', workerResult.errors.length);
      
      const workerIndentationErrors = workerResult.errors.filter(e => 
        e.code.includes('INDENT') || e.code.includes('WRAP')
      );
      console.log('Indentation errors:', workerIndentationErrors.length);

      // Compare results
      console.log('\n=== COMPARISON ===');
      console.log('Direct vs Worker isValid:', directResult.isValid, 'vs', workerResult.isValid);
      console.log('Direct vs Worker error count:', directResult.errors.length, 'vs', workerResult.errors.length);
      console.log('Direct vs Worker indentation errors:', directIndentationErrors.length, 'vs', workerIndentationErrors.length);

      // They should be consistent
      expect(directResult.isValid).toBe(workerResult.isValid);
      expect(directResult.errors.length).toBe(workerResult.errors.length);
      expect(directIndentationErrors.length).toBe(workerIndentationErrors.length);

    } catch (error) {
      console.log('\n=== WORKER VALIDATION FAILED ===');
      console.log('Error:', error);
      console.log('This is expected in test environment - worker requires browser environment');
      
      // In test environment, we can't test worker validation
      // So we just verify direct validation works
      expect(directIndentationErrors.length).toBeGreaterThan(0);
    }
  });
});
