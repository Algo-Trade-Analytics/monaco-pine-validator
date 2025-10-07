import { test, expect, type Page } from '@playwright/test';

async function waitForEditor(page: Page) {
  await page.waitForSelector('.monaco-editor', { timeout: 10000 });
  await page.waitForTimeout(1000); // Wait for editor to fully initialize
}

async function setEditorContent(page: Page, content: string) {
  await page.evaluate((code) => {
    const monaco = (window as any).monaco;
    if (!monaco) throw new Error('Monaco not loaded');
    const models = monaco.editor.getModels();
    if (!models || models.length === 0) throw new Error('No editor models found');
    models[0].setValue(code);
  }, content);
  
  // Wait for validation to complete
  await page.waitForTimeout(1500);
}

async function getValidationErrors(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    const monaco = (window as any).monaco;
    if (!monaco) return [];
    const models = monaco.editor.getModels();
    if (!models || models.length === 0) return [];
    
    const markers = monaco.editor.getModelMarkers({ resource: models[0].uri });
    return markers.map((m: any) => ({
      message: m.message,
      severity: m.severity,
      startLineNumber: m.startLineNumber,
      startColumn: m.startColumn,
      code: m.code?.value || m.code
    }));
  });
}

test.describe('Playground Indentation Consistency', () => {
  test('should consistently detect indentation errors', async ({ page }) => {
    await page.goto('/');
    await waitForEditor(page);

    const scriptWithInvalidIndentation = `//@version=6
strategy("Test Indentation", overlay = true)

// === Band Power Settings ===
bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
tooltip="The length of the bands. A higher length smooths the bands more but reacts slower to price changes.")

plot(close)`;

    console.log('\n=== Test 1: Load script with invalid indentation ===');
    await setEditorContent(page, scriptWithInvalidIndentation);
    
    let errors = await getValidationErrors(page);
    let indentErrors = errors.filter(e => 
      e.code && (String(e.code).includes('INDENT') || String(e.code).includes('WRAP'))
    );
    
    console.log(`Errors found: ${errors.length}`);
    console.log(`Indentation errors: ${indentErrors.length}`);
    if (indentErrors.length > 0) {
      indentErrors.forEach(e => console.log(`  - Line ${e.startLineNumber}: ${e.code} - ${e.message}`));
    }
    
    expect(indentErrors.length).toBeGreaterThan(0);
    const firstErrorLine = indentErrors[0].startLineNumber;
    const firstErrorCode = indentErrors[0].code;

    console.log('\n=== Test 2: Modify script (fix indentation) ===');
    const scriptWithValidIndentation = `//@version=6
strategy("Test Indentation", overlay = true)

// === Band Power Settings ===
bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
 tooltip="The length of the bands. A higher length smooths the bands more but reacts slower to price changes.")

plot(close)`;

    await setEditorContent(page, scriptWithValidIndentation);
    
    errors = await getValidationErrors(page);
    indentErrors = errors.filter(e => 
      e.code && (String(e.code).includes('INDENT') || String(e.code).includes('WRAP'))
    );
    
    console.log(`Errors found: ${errors.length}`);
    console.log(`Indentation errors: ${indentErrors.length}`);
    
    expect(indentErrors.length).toBe(0);

    console.log('\n=== Test 3: Revert to invalid indentation ===');
    await setEditorContent(page, scriptWithInvalidIndentation);
    
    errors = await getValidationErrors(page);
    indentErrors = errors.filter(e => 
      e.code && (String(e.code).includes('INDENT') || String(e.code).includes('WRAP'))
    );
    
    console.log(`Errors found: ${errors.length}`);
    console.log(`Indentation errors: ${indentErrors.length}`);
    if (indentErrors.length > 0) {
      indentErrors.forEach(e => console.log(`  - Line ${e.startLineNumber}: ${e.code} - ${e.message}`));
    }
    
    // Should detect the same error again
    expect(indentErrors.length).toBeGreaterThan(0);
    expect(indentErrors[0].startLineNumber).toBe(firstErrorLine);
    expect(indentErrors[0].code).toBe(firstErrorCode);
  });

  test('should detect indentation errors in a long script', async ({ page }) => {
    await page.goto('/');
    await waitForEditor(page);

    const longScript = `//@version=6
strategy("TrendMaster Pro 2.3", overlay = true)

// === MA Settings ===
maType = input.string("SMA", title="MA Type", options=["EMA", "SMA", "SMMA"], group="MA Settings", 
     tooltip="Select the type of Moving Average: EMA, SMA, or SMMA.")
maLength = input.int(20, title="MA Length", minval=1, group="MA Settings")

// === Band Power Settings ===
bandLength = input.int(20, title="Band Length", minval=1, group="Band Power", 
tooltip="The length of the bands. A higher length smooths the bands more but reacts slower to price changes.")

// === Signal Settings ===
signalLength = input.int(14, title="Signal Length", minval=1, group="Signal Settings", 
    tooltip="The length for signal calculation.")

// Calculate MA
ma = maType == "EMA" ? ta.ema(close, maLength) : 
     maType == "SMA" ? ta.sma(close, maLength) : 
     ta.rma(close, maLength)

// Calculate bands
upperBand = ma + ta.stdev(close, bandLength)
lowerBand = ma - ta.stdev(close, bandLength)

// Plot
plot(ma, color=color.blue, linewidth=2, title="MA")
plot(upperBand, color=color.red, title="Upper Band")
plot(lowerBand, color=color.green, title="Lower Band")`;

    console.log('\n=== Test: Long script with multiple indentation errors ===');
    await setEditorContent(page, longScript);
    
    const errors = await getValidationErrors(page);
    const indentErrors = errors.filter(e => 
      e.code && (String(e.code).includes('INDENT') || String(e.code).includes('WRAP'))
    );
    
    console.log(`Total errors found: ${errors.length}`);
    console.log(`Indentation errors: ${indentErrors.length}`);
    if (indentErrors.length > 0) {
      indentErrors.forEach(e => console.log(`  - Line ${e.startLineNumber}: ${e.code}`));
    }
    
    // Should detect at least 2 indentation errors (lines 11 and 15)
    expect(indentErrors.length).toBeGreaterThanOrEqual(2);
    
    // Check specific error lines
    const errorLines = indentErrors.map(e => e.startLineNumber).sort((a, b) => a - b);
    console.log(`Error lines: ${errorLines.join(', ')}`);
    
    expect(errorLines).toContain(11); // bandLength line continuation
    expect(errorLines).toContain(15); // signalLength line continuation
  });

  test('should handle rapid script changes consistently', async ({ page }) => {
    await page.goto('/');
    await waitForEditor(page);

    const scripts = [
      // Script 1: Invalid indentation
      `//@version=6
indicator("Test 1", overlay = true)
value = input.int(10, title="Value", 
tooltip="Test")
plot(close)`,
      
      // Script 2: Valid indentation
      `//@version=6
indicator("Test 2", overlay = true)
value = input.int(10, title="Value", 
 tooltip="Test")
plot(close)`,
      
      // Script 3: Invalid indentation (different line)
      `//@version=6
indicator("Test 3", overlay = true)
length = input.int(20, minval=1, 
tooltip="Length")
plot(close)`,
      
      // Script 4: Valid indentation
      `//@version=6
indicator("Test 4", overlay = true)
length = input.int(20, minval=1, 
 tooltip="Length")
plot(close)`,
    ];

    const expectedIndentErrors = [1, 0, 1, 0]; // Expected number of indent errors for each script

    console.log('\n=== Test: Rapid script changes ===');
    
    for (let i = 0; i < scripts.length; i++) {
      console.log(`\n--- Script ${i + 1} ---`);
      await setEditorContent(page, scripts[i]);
      
      const errors = await getValidationErrors(page);
      const indentErrors = errors.filter(e => 
        e.code && (String(e.code).includes('INDENT') || String(e.code).includes('WRAP'))
      );
      
      console.log(`Indentation errors: ${indentErrors.length} (expected: ${expectedIndentErrors[i]})`);
      
      expect(indentErrors.length).toBe(expectedIndentErrors[i]);
    }
  });
});
