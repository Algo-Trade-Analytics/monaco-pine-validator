import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pineScriptDocumentation } from '../PineScriptContext/enhanced-structures';
import { NAMESPACE_MEMBERS } from '../core/namespace-members';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all official members
function getAllOfficialMembers(): Set<string> {
  const result = new Set<string>();
  
  function flatten(obj: any, prefix = '') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value && typeof value === 'object') {
        if (value.name) {
          result.add(value.name);
        } else {
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

// Get extra members by namespace
function getExtraMembersByNamespace(): Map<string, string[]> {
  const official = getAllOfficialMembers();
  const extraByNs = new Map<string, string[]>();
  
  for (const [namespace, members] of Object.entries(NAMESPACE_MEMBERS)) {
    const extras: string[] = [];
    
    members.forEach(member => {
      const fullName = namespace === 'global' ? member : `${namespace}.${member}`;
      
      // Skip metadata artifacts - we'll keep these for now
      if (member === 'arguments' || member === 'signatures' || member === 'qualifier') {
        return;
      }
      
      // Skip generic constructor syntax
      if (member.match(/^new<.*>$/)) {
        return;
      }
      
      if (!official.has(fullName)) {
        extras.push(member);
      }
    });
    
    if (extras.length > 0) {
      extraByNs.set(namespace, extras);
    }
  }
  
  return extraByNs;
}

// Find namespaces that shouldn't exist at all
function getFakeNamespaces(): string[] {
  const official = getAllOfficialMembers();
  const officialNamespaces = new Set<string>();
  
  official.forEach(member => {
    if (member.includes('.')) {
      const parts = member.split('.');
      // Add namespace and all parent namespaces
      for (let i = 1; i <= parts.length; i++) {
        officialNamespaces.add(parts.slice(0, i).join('.'));
      }
    }
  });
  
  const fakeNamespaces: string[] = [];
  
  for (const namespace of Object.keys(NAMESPACE_MEMBERS)) {
    // Skip global
    if (namespace === 'global') continue;
    
    // Check if this namespace exists in official docs
    if (!officialNamespaces.has(namespace)) {
      fakeNamespaces.push(namespace);
    }
  }
  
  return fakeNamespaces;
}

function main() {
  console.log('🧹 IDENTIFYING EXTRA MEMBERS FOR REMOVAL\n');
  console.log('═'.repeat(80));
  
  const extraByNs = getExtraMembersByNamespace();
  const fakeNamespaces = getFakeNamespaces();
  
  console.log('\n📦 EXTRA MEMBERS BY NAMESPACE:');
  console.log('─'.repeat(80));
  
  let totalExtras = 0;
  Array.from(extraByNs.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([ns, members]) => {
      console.log(`\n  ${ns} (${members.length} extra):`);
      members.slice(0, 15).forEach(m => console.log(`    - ${m}`));
      if (members.length > 15) {
        console.log(`    ... and ${members.length - 15} more`);
      }
      totalExtras += members.length;
    });
  
  console.log('\n\n🗑️  FAKE NAMESPACES TO REMOVE:');
  console.log('─'.repeat(80));
  console.log(`Total: ${fakeNamespaces.length} namespaces\n`);
  fakeNamespaces.forEach(ns => console.log(`  - ${ns}`));
  
  console.log('\n\n📊 SUMMARY:');
  console.log('─'.repeat(80));
  console.log(`Extra members to remove: ${totalExtras}`);
  console.log(`Fake namespaces to remove: ${fakeNamespaces.length}`);
  console.log(`Total items to clean: ${totalExtras + fakeNamespaces.length}`);
  
  // Generate cleanup data
  const cleanupData = {
    extraMembersByNamespace: Object.fromEntries(extraByNs),
    fakeNamespaces,
    summary: {
      totalExtraMembers: totalExtras,
      totalFakeNamespaces: fakeNamespaces.length,
      totalToRemove: totalExtras + fakeNamespaces.length
    }
  };
  
  const reportPath = path.join(__dirname, '../docs/extra-members-cleanup.json');
  fs.writeFileSync(reportPath, JSON.stringify(cleanupData, null, 2));
  console.log(`\n📄 Detailed cleanup data: docs/extra-members-cleanup.json`);
  
  console.log('\n✅ Analysis Complete!');
  console.log('═'.repeat(80));
}

main();

