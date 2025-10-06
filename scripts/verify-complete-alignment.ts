import { pineScriptDocumentation } from '../PineScriptContext/enhanced-structures';
import { NAMESPACE_MEMBERS } from '../core/constants';

console.log('🔍 VERIFYING COMPLETE ALIGNMENT WITH ENHANCED STRUCTURES\n');
console.log('═'.repeat(80));

// Flatten enhanced structures to full member names
function getAllOfficialMembers(): Set<string> {
  const result = new Set<string>();
  
  function flatten(obj: any, prefix = '') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value && typeof value === 'object') {
        if (value.name) {
          // It's a leaf node with metadata
          result.add(value.name);
        } else {
          // Recurse
          flatten(value, fullKey);
        }
      }
    }
  }
  
  flatten(pineScriptDocumentation.variables);
  flatten(pineScriptDocumentation.functions);
  flatten(pineScriptDocumentation.constants);
  
  return result;
}

// Get all validator members
function getAllValidatorMembers(): Set<string> {
  const result = new Set<string>();
  
  for (const [namespace, members] of Object.entries(NAMESPACE_MEMBERS)) {
    members.forEach(member => {
      if (namespace === 'global') {
        result.add(member);
      } else {
        result.add(`${namespace}.${member}`);
      }
    });
  }
  
  return result;
}

const official = getAllOfficialMembers();
const validator = getAllValidatorMembers();

// Find mismatches
const missingFromValidator: string[] = [];
const extraInValidator: string[] = [];

official.forEach(member => {
  if (!validator.has(member)) {
    missingFromValidator.push(member);
  }
});

validator.forEach(member => {
  // Skip metadata artifacts
  if (member.endsWith('.arguments') || member.endsWith('.signatures') || member.endsWith('.qualifier')) {
    return;
  }
  // Skip generic constructors (these are special syntax)
  if (member.match(/\.(new|new<.*>)$/)) {
    return;
  }
  
  if (!official.has(member)) {
    extraInValidator.push(member);
  }
});

console.log('\n📊 ALIGNMENT STATUS');
console.log('─'.repeat(80));
console.log(`Official API Members:     ${official.size}`);
console.log(`Validator Members:        ${validator.size}`);
console.log(`Matched:                  ${official.size - missingFromValidator.length}`);
console.log(`Missing from Validator:   ${missingFromValidator.length}`);
console.log(`Extra in Validator:       ${extraInValidator.length} (excluding metadata artifacts)`);

const coverage = ((official.size - missingFromValidator.length) / official.size * 100).toFixed(1);
console.log(`\n✅ Coverage: ${coverage}%`);

if (missingFromValidator.length > 0) {
  console.log('\n\n❌ STILL MISSING FROM VALIDATOR:');
  console.log('─'.repeat(80));
  
  // Group by namespace
  const byNamespace = new Map<string, string[]>();
  missingFromValidator.forEach(member => {
    const parts = member.split('.');
    const ns = parts[0];
    if (!byNamespace.has(ns)) byNamespace.set(ns, []);
    byNamespace.get(ns)!.push(member);
  });
  
  Array.from(byNamespace.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .forEach(([ns, members]) => {
      console.log(`\n  ${ns} namespace (${members.length} missing):`);
      members.slice(0, 10).forEach(m => console.log(`    • ${m}`));
      if (members.length > 10) {
        console.log(`    ... and ${members.length - 10} more`);
      }
    });
}

if (extraInValidator.length > 0) {
  console.log('\n\n⚠️  EXTRA IN VALIDATOR (not in official docs):');
  console.log('─'.repeat(80));
  console.log(`Total: ${extraInValidator.length} members`);
  console.log('\nSample (first 20):');
  extraInValidator.slice(0, 20).forEach(m => console.log(`  • ${m}`));
  if (extraInValidator.length > 20) {
    console.log(`  ... and ${extraInValidator.length - 20} more`);
  }
}

if (missingFromValidator.length === 0) {
  console.log('\n\n🎊 PERFECT ALIGNMENT!');
  console.log('═'.repeat(80));
  console.log('All official Pine Script v6 members are recognized by the validator!');
  console.log(`\n✅ ${official.size} members matched`);
  console.log(`⚠️  ${extraInValidator.length} extra members in validator (may be valid or cleanup needed)`);
} else {
  console.log('\n\n📋 SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Coverage: ${coverage}% - Very good but not complete`);
  console.log(`Remaining work: Add ${missingFromValidator.length} missing members to validator`);
}

console.log('\n✅ Verification Complete!');
console.log('═'.repeat(80));

