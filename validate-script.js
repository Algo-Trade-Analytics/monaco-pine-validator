#!/usr/bin/env node

/**
 * Simple Pine Script Validator CLI
 * 
 * Usage:
 *   node validate-script.js script.pine
 *   node validate-script.js < script.pine
 */

import { EnhancedModularValidator } from './EnhancedModularValidator.ts';
import { readFileSync } from 'fs';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node validate-script.js <script.pine>');
    process.exit(1);
  }

  const filename = args[0];
  let script;
  
  try {
    script = readFileSync(filename, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filename}:`, error.message);
    process.exit(1);
  }

  console.log(`🔍 Validating: ${filename}\n`);
  
  const validator = new EnhancedModularValidator();
  const result = validator.validate(script);
  
  const errors = result.errors || [];
  const indentationErrors = errors.filter(e => e.code.includes('INDENT'));
  const otherErrors = errors.filter(e => !e.code.includes('INDENT'));
  
  console.log(`📊 Summary: ${errors.length} total errors`);
  console.log(`   • ${indentationErrors.length} indentation errors`);
  console.log(`   • ${otherErrors.length} other errors\n`);
  
  if (indentationErrors.length > 0) {
    console.log('🔧 Indentation Errors:');
    indentationErrors.forEach((error, i) => {
      console.log(`  ${i + 1}. Line ${error.line}, column ${error.column}`);
      console.log(`     ${error.message}`);
    });
    console.log('');
  }
  
  if (otherErrors.length > 0) {
    console.log('⚠️  Other Errors:');
    otherErrors.forEach((error, i) => {
      console.log(`  ${i + 1}. Line ${error.line}, column ${error.column}`);
      console.log(`     ${error.message}`);
    });
    console.log('');
  }
  
  if (errors.length === 0) {
    console.log('✅ No errors found!');
    process.exit(0);
  } else {
    console.log(`❌ Found ${errors.length} error(s)`);
    process.exit(1);
  }
}

main();
