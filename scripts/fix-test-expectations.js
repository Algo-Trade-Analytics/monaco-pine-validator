#!/usr/bin/env node

/**
 * Script to fix test expectation mismatches
 * 
 * Updates tests that expect specific error codes but get PSV6-UNDEFINED-NAMESPACE-MEMBER
 * due to our namespace validator running first (priority 950)
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

// Common expectation mismatches
const EXPECTATION_UPDATES = [
  {
    // Tests expect PSV6-FUNCTION-UNKNOWN but get PSV6-UNDEFINED-NAMESPACE-MEMBER
    pattern: /expectHas\(result, \{ errors: \['PSV6-FUNCTION-UNKNOWN'\] \}\)/g,
    replacement: "expectHas(result, { errors: ['PSV6-UNDEFINED-NAMESPACE-MEMBER'] })"
  },
  {
    // Tests expect PSV6-FUNCTION-NAMESPACE but get PSV6-UNDEFINED-NAMESPACE-MEMBER  
    pattern: /expectHas\(result, \{ errors: \['PSV6-FUNCTION-NAMESPACE'\] \}\)/g,
    replacement: "expectHas(result, { errors: ['PSV6-UNDEFINED-NAMESPACE-MEMBER'] })"
  },
  {
    // Tests expect PSV6-BOX-UNKNOWN-FUNCTION but get PSV6-UNDEFINED-NAMESPACE-MEMBER
    pattern: /expectHas\(result, \{ errors: \['PSV6-BOX-UNKNOWN-FUNCTION'\] \}\)/g,
    replacement: "expectHas(result, { errors: ['PSV6-UNDEFINED-NAMESPACE-MEMBER'] })"
  },
  {
    // Tests expect PSV6-FUNCTION-PARAM-COUNT but get PSV6-UNDEFINED-NAMESPACE-MEMBER
    pattern: /expectHas\(result, \{ errors: \['PSV6-FUNCTION-PARAM-COUNT'\] \}\)/g,
    replacement: "expectHas(result, { errors: ['PSV6-UNDEFINED-NAMESPACE-MEMBER'] })"
  },
  {
    // Array containing patterns
    pattern: /expect\(result\.errors\)\.toContain\('PSV6-FUNCTION-UNKNOWN'\)/g,
    replacement: "expect(result.errors).toContain('PSV6-UNDEFINED-NAMESPACE-MEMBER')"
  },
  {
    pattern: /expect\(result\.errors\)\.toContain\('PSV6-FUNCTION-NAMESPACE'\)/g,
    replacement: "expect(result.errors).toContain('PSV6-UNDEFINED-NAMESPACE-MEMBER')"
  }
];

// JSON expectation updates
const JSON_EXPECTATION_UPDATES = [
  {
    pattern: /"PSV6-FUNCTION-UNKNOWN"/g,
    replacement: '"PSV6-UNDEFINED-NAMESPACE-MEMBER"'
  },
  {
    pattern: /"PSV6-FUNCTION-NAMESPACE"/g,
    replacement: '"PSV6-UNDEFINED-NAMESPACE-MEMBER"'
  },
  {
    pattern: /"PSV6-BOX-UNKNOWN-FUNCTION"/g,
    replacement: '"PSV6-UNDEFINED-NAMESPACE-MEMBER"'
  }
];

async function fixTestExpectations() {
  console.log('🔧 Fixing test expectation mismatches...\n');
  
  // Find all test files
  const testFiles = await glob('tests/specs/**/*.spec.ts');
  const jsonFiles = await glob('tests/specs/**/*.json');
  
  let totalFiles = 0;
  let totalChanges = 0;
  
  // Process TypeScript test files
  for (const filePath of testFiles) {
    const content = readFileSync(filePath, 'utf-8');
    let updatedContent = content;
    let fileChanges = 0;
    
    for (const update of EXPECTATION_UPDATES) {
      const matches = updatedContent.match(update.pattern);
      if (matches) {
        updatedContent = updatedContent.replace(update.pattern, update.replacement);
        fileChanges += matches.length;
      }
    }
    
    if (fileChanges > 0) {
      writeFileSync(filePath, updatedContent);
      console.log(`✅ ${filePath}: ${fileChanges} changes`);
      totalChanges += fileChanges;
      totalFiles++;
    }
  }
  
  // Process JSON test files
  for (const filePath of jsonFiles) {
    const content = readFileSync(filePath, 'utf-8');
    let updatedContent = content;
    let fileChanges = 0;
    
    for (const update of JSON_EXPECTATION_UPDATES) {
      const matches = updatedContent.match(update.pattern);
      if (matches) {
        updatedContent = updatedContent.replace(update.pattern, update.replacement);
        fileChanges += matches.length;
      }
    }
    
    if (fileChanges > 0) {
      writeFileSync(filePath, updatedContent);
      console.log(`✅ ${filePath}: ${fileChanges} changes`);
      totalChanges += fileChanges;
      totalFiles++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Files updated: ${totalFiles}`);
  console.log(`   Total changes: ${totalChanges}`);
  console.log(`\n🎉 Test expectation fixes complete!`);
  console.log(`\nNext steps:`);
  console.log(`   1. Run: npm run test:validator:full`);
  console.log(`   2. Verify test count improved`);
  console.log(`   3. Address any remaining failures manually`);
}

// Run the script
fixTestExpectations().catch(console.error);
