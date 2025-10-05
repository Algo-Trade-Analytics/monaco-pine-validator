#!/usr/bin/env node

/**
 * CLI Pine Script Validator
 * 
 * Usage:
 *   node cli-validator.js script.pine
 *   node cli-validator.js < script.pine
 *   echo "script content" | node cli-validator.js
 */

import { EnhancedModularValidator } from './EnhancedModularValidator.ts';
import { readFileSync } from 'fs';
import { createReadStream } from 'fs';
import { stdin } from 'process';

async function getScriptContent() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Read from file
    const filename = args[0];
    try {
      return readFileSync(filename, 'utf-8');
    } catch (error) {
      console.error(`Error reading file ${filename}:`, error.message);
      process.exit(1);
    }
  } else {
    // Read from stdin
    return new Promise((resolve, reject) => {
      let content = '';
      const stream = process.stdin.isTTY ? null : createReadStream(0);
      
      if (stream) {
        stream.setEncoding('utf8');
        stream.on('data', (chunk) => {
          content += chunk;
        });
        stream.on('end', () => {
          resolve(content);
        });
        stream.on('error', reject);
      } else {
        console.error('No input provided. Usage:');
        console.error('  node cli-validator.js script.pine');
        console.error('  node cli-validator.js < script.pine');
        console.error('  echo "script content" | node cli-validator.js');
        process.exit(1);
      }
    });
  }
}

function formatErrors(errors) {
  if (!errors || errors.length === 0) {
    return '✅ No errors found!';
  }

  const grouped = errors.reduce((acc, error) => {
    const code = error.code || 'UNKNOWN';
    if (!acc[code]) {
      acc[code] = [];
    }
    acc[code].push(error);
    return acc;
  }, {});

  let output = `❌ Found ${errors.length} error(s):\n\n`;
  
  Object.entries(grouped).forEach(([code, codeErrors]) => {
    output += `📋 ${code} (${codeErrors.length} error${codeErrors.length > 1 ? 's' : ''}):\n`;
    codeErrors.forEach((error, i) => {
      output += `  ${i + 1}. Line ${error.line}, column ${error.column}\n`;
      output += `     ${error.message}\n`;
      if (error.suggestion) {
        output += `     💡 ${error.suggestion}\n`;
      }
      output += '\n';
    });
  });

  return output;
}

function formatSummary(result) {
  const errors = result.errors || [];
  const warnings = errors.filter(e => e.severity === 'warning');
  const infos = errors.filter(e => e.severity === 'info');
  const actualErrors = errors.filter(e => e.severity === 'error');

  return `📊 Summary: ${actualErrors.length} errors · ${warnings.length} warnings · ${infos.length} info\n`;
}

async function main() {
  try {
    console.log('🔍 Pine Script Validator CLI\n');
    
    const scriptContent = await getScriptContent();
    
    if (!scriptContent.trim()) {
      console.error('❌ Empty script provided');
      process.exit(1);
    }

    console.log('📝 Validating script...\n');
    
    const validator = new EnhancedModularValidator();
    const result = validator.validate(scriptContent);
    
    console.log(formatSummary(result));
    console.log(formatErrors(result.errors));
    
    if (result.isValid) {
      console.log('🎉 Script is valid!');
      process.exit(0);
    } else {
      console.log('❌ Script has validation errors');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Validator error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
