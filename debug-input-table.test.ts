import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Input Table Test', () => {
  it('should validate input with table display', () => {
    const createValidator = () => new EnhancedModularValidator({
      targetVersion: 6,
      strictMode: true,
      enableWarnings: true
    });

    const code = `
//@version=6
indicator("Table Input", overlay=true)

showTable = input.bool(true, "Show Table")
tablePos = input.string("top_right", "Position", options=["top_left", "top_right", "bottom_left", "bottom_right"])

if showTable
    var table myTable = table.new(position.top_right, 2, 2)
    table.cell(myTable, 0, 0, "High", bgcolor=color.green)
    table.cell(myTable, 1, 0, str.tostring(high))
    table.cell(myTable, 0, 1, "Low", bgcolor=color.red)
    table.cell(myTable, 1, 1, str.tostring(low))
      `;

    const result = createValidator().validate(code);
    
    console.log('\n=== INPUT TABLE TEST DEBUG ===');
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
    
    if (result.info.length > 0) {
      console.log('\nInfo:');
      result.info.forEach((info, i) => {
        console.log(`${i + 1}. ${info.code}: ${info.message}`);
        console.log(`   Line ${info.line}, Column ${info.column}`);
      });
    }
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
