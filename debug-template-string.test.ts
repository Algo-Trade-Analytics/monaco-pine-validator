import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Template String Test', () => {
  it('should validate template string building', () => {
    const createValidator = () => new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enableWarnings: true
    });

    const code = `
//@version=6
indicator("Template Builder")

// Build HTML-like template
title = "Market Analysis"
symbol = syminfo.ticker
price = str.tostring(close, "#.##")
change = str.tostring(ta.change(close), "#.##")
volume = str.tostring(volume, "#,###")

template = str.format(
     "<div>\\n  <h1>{0}</h1>\\n  <p>Symbol: {1}</p>\\n  <p>Price: \${2}</p>\\n  <p>Change: \${3}</p>\\n  <p>Volume: {4}</p>\\n</div>",
     title, symbol, price, change, volume)

var table t = table.new(position.top_right, 1, 1)
table.cell(t, 0, 0, template, text_halign=text.align_left)
      `;

    const result = createValidator().validate(code);
    
    console.log('\n=== TEMPLATE STRING DEBUG ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    console.log('Number of warnings:', result.warnings.length);
    console.log('Number of info:', result.info.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning.code}: ${warning.message}`);
        console.log(`   Line ${warning.line}, Column ${warning.column}`);
      });
    }
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
