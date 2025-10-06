import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pineScriptDocumentation } from '../PineScriptContext/enhanced-structures';
import { NAMESPACE_MEMBERS } from '../core/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ComparisonResult {
  namespace: string;
  inDocsButNotValidator: string[];
  inValidatorButNotDocs: string[];
  matched: string[];
}

// Helper to flatten nested objects to dot notation
function flattenToSet(obj: any, prefix = ''): Set<string> {
  const result = new Set<string>();
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value && typeof value === 'object') {
      // Check if it's a metadata object (has 'name' property) or a nested namespace
      if (value.name) {
        result.add(fullKey);
      } else {
        // It's a nested namespace, recurse
        const nested = flattenToSet(value, fullKey);
        nested.forEach(item => result.add(item));
      }
    }
  }
  
  return result;
}

// Extract all functions from enhanced structures
function getEnhancedFunctions(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  
  // Get all functions
  const allFuncs = flattenToSet(pineScriptDocumentation.functions);
  
  // Group by namespace
  allFuncs.forEach(funcName => {
    if (funcName.includes('.')) {
      const parts = funcName.split('.');
      const namespace = parts[0];
      const member = parts.slice(1).join('.');
      
      if (!result.has(namespace)) {
        result.set(namespace, new Set());
      }
      result.get(namespace)!.add(member);
    } else {
      // Global function
      if (!result.has('global')) {
        result.set('global', new Set());
      }
      result.get('global')!.add(funcName);
    }
  });
  
  return result;
}

// Extract all variables from enhanced structures
function getEnhancedVariables(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  
  // Get all variables
  const allVars = flattenToSet(pineScriptDocumentation.variables);
  
  // Group by namespace
  allVars.forEach(varName => {
    if (varName.includes('.')) {
      const parts = varName.split('.');
      const namespace = parts[0];
      const member = parts.slice(1).join('.');
      
      if (!result.has(namespace)) {
        result.set(namespace, new Set());
      }
      result.get(namespace)!.add(member);
    } else {
      // Global variable
      if (!result.has('global')) {
        result.set('global', new Set());
      }
      result.get('global')!.add(varName);
    }
  });
  
  return result;
}

// Extract all constants from enhanced structures
function getEnhancedConstants(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  
  // Get all constants
  const allConsts = flattenToSet(pineScriptDocumentation.constants);
  
  // Group by namespace
  allConsts.forEach(constName => {
    if (constName.includes('.')) {
      const parts = constName.split('.');
      const namespace = parts[0];
      const member = parts.slice(1).join('.');
      
      if (!result.has(namespace)) {
        result.set(namespace, new Set());
      }
      result.get(namespace)!.add(member);
    } else {
      // Global constant
      if (!result.has('global')) {
        result.set('global', new Set());
      }
      result.get('global')!.add(constName);
    }
  });
  
  return result;
}

// Compare a specific namespace
function compareNamespace(
  namespace: string,
  validatorMembers: Set<string>,
  enhancedFuncs: Set<string>,
  enhancedVars: Set<string>,
  enhancedConsts: Set<string>
): ComparisonResult {
  // Combine all enhanced members for this namespace
  const allEnhanced = new Set([
    ...enhancedFuncs,
    ...enhancedVars,
    ...enhancedConsts
  ]);
  
  const inDocsButNotValidator: string[] = [];
  const inValidatorButNotDocs: string[] = [];
  const matched: string[] = [];
  
  // Find what's in docs but not validator
  allEnhanced.forEach(member => {
    if (!validatorMembers.has(member)) {
      inDocsButNotValidator.push(member);
    } else {
      matched.push(member);
    }
  });
  
  // Find what's in validator but not docs
  validatorMembers.forEach(member => {
    if (!allEnhanced.has(member)) {
      inValidatorButNotDocs.push(member);
    }
  });
  
  return {
    namespace,
    inDocsButNotValidator: inDocsButNotValidator.sort(),
    inValidatorButNotDocs: inValidatorButNotDocs.sort(),
    matched: matched.sort()
  };
}

function main() {
  console.log('🔍 VALIDATOR vs OFFICIAL DOCS COMPARISON\n');
  console.log('═'.repeat(100));
  
  // Get enhanced structures data
  const enhancedFuncs = getEnhancedFunctions();
  const enhancedVars = getEnhancedVariables();
  const enhancedConsts = getEnhancedConstants();
  
  console.log('\n📊 DATA EXTRACTION');
  console.log('─'.repeat(100));
  console.log('Enhanced Structures (from scraped docs):');
  console.log(`  Functions: ${Array.from(enhancedFuncs.values()).reduce((sum, set) => sum + set.size, 0)} entries across ${enhancedFuncs.size} namespaces`);
  console.log(`  Variables: ${Array.from(enhancedVars.values()).reduce((sum, set) => sum + set.size, 0)} entries across ${enhancedVars.size} namespaces`);
  console.log(`  Constants: ${Array.from(enhancedConsts.values()).reduce((sum, set) => sum + set.size, 0)} entries across ${enhancedConsts.size} namespaces`);
  
  console.log('\nValidator (from namespace-members.ts):');
  console.log(`  Namespaces defined: ${Object.keys(NAMESPACE_MEMBERS).length}`);
  let totalValidatorMembers = 0;
  Object.entries(NAMESPACE_MEMBERS).forEach(([ns, members]) => {
    totalValidatorMembers += members.size;
  });
  console.log(`  Total members: ${totalValidatorMembers}`);
  
  // Get all unique namespaces
  const allNamespaces = new Set([
    ...Object.keys(NAMESPACE_MEMBERS),
    ...enhancedFuncs.keys(),
    ...enhancedVars.keys(),
    ...enhancedConsts.keys()
  ]);
  
  const results: ComparisonResult[] = [];
  
  // Compare each namespace
  allNamespaces.forEach(namespace => {
    const validatorMembers = NAMESPACE_MEMBERS[namespace] || new Set();
    const funcs = enhancedFuncs.get(namespace) || new Set();
    const vars = enhancedVars.get(namespace) || new Set();
    const consts = enhancedConsts.get(namespace) || new Set();
    
    const result = compareNamespace(namespace, validatorMembers, funcs, vars, consts);
    results.push(result);
  });
  
  // Sort results by number of missing items (descending)
  results.sort((a, b) => b.inDocsButNotValidator.length - a.inDocsButNotValidator.length);
  
  // Print results
  console.log('\n\n🔍 DETAILED COMPARISON BY NAMESPACE');
  console.log('═'.repeat(100));
  
  let totalMissing = 0;
  let totalExtra = 0;
  let totalMatched = 0;
  
  results.forEach(result => {
    const hasMissing = result.inDocsButNotValidator.length > 0;
    const hasExtra = result.inValidatorButNotDocs.length > 0;
    
    if (!hasMissing && !hasExtra) {
      return; // Skip perfect matches in detailed output
    }
    
    console.log(`\n\n📦 ${result.namespace.toUpperCase()} Namespace`);
    console.log('─'.repeat(100));
    console.log(`Matched: ${result.matched.length} | Missing in Validator: ${result.inDocsButNotValidator.length} | Extra in Validator: ${result.inValidatorButNotDocs.length}`);
    
    if (hasMissing) {
      console.log(`\n  ❌ MISSING IN VALIDATOR (${result.inDocsButNotValidator.length}):`);
      const displayCount = Math.min(result.inDocsButNotValidator.length, 20);
      result.inDocsButNotValidator.slice(0, displayCount).forEach(member => {
        // Determine if it's a function, variable, or constant
        const fullName = result.namespace === 'global' ? member : `${result.namespace}.${member}`;
        const funcs = enhancedFuncs.get(result.namespace) || new Set();
        const vars = enhancedVars.get(result.namespace) || new Set();
        const consts = enhancedConsts.get(result.namespace) || new Set();
        
        let type = '';
        if (funcs.has(member)) type = '[function]';
        else if (vars.has(member)) type = '[variable]';
        else if (consts.has(member)) type = '[constant]';
        
        console.log(`     • ${member} ${type}`);
      });
      if (result.inDocsButNotValidator.length > displayCount) {
        console.log(`     ... and ${result.inDocsButNotValidator.length - displayCount} more`);
      }
    }
    
    if (hasExtra) {
      console.log(`\n  ➕ EXTRA IN VALIDATOR (not in official docs) (${result.inValidatorButNotDocs.length}):`);
      result.inValidatorButNotDocs.slice(0, 15).forEach(member => {
        console.log(`     • ${member}`);
      });
      if (result.inValidatorButNotDocs.length > 15) {
        console.log(`     ... and ${result.inValidatorButNotDocs.length - 15} more`);
      }
    }
    
    totalMissing += result.inDocsButNotValidator.length;
    totalExtra += result.inValidatorButNotDocs.length;
    totalMatched += result.matched.length;
  });
  
  // Summary
  console.log('\n\n📊 OVERALL SUMMARY');
  console.log('═'.repeat(100));
  console.log(`
✅ Matched: ${totalMatched} members
❌ Missing in Validator: ${totalMissing} members (exist in official docs but not in validator)
➕ Extra in Validator: ${totalExtra} members (in validator but not in official docs)

Coverage: ${((totalMatched / (totalMatched + totalMissing)) * 100).toFixed(1)}%
  `);
  
  // Print namespaces with perfect match
  console.log('\n✨ NAMESPACES WITH PERFECT MATCH:');
  console.log('─'.repeat(100));
  const perfectMatches = results.filter(r => 
    r.inDocsButNotValidator.length === 0 && 
    r.inValidatorButNotDocs.length === 0 &&
    r.matched.length > 0
  );
  if (perfectMatches.length > 0) {
    perfectMatches.forEach(r => {
      console.log(`  ✓ ${r.namespace} (${r.matched.length} members)`);
    });
  } else {
    console.log('  None - all namespaces have discrepancies');
  }
  
  // Print top priority gaps
  console.log('\n\n🎯 TOP PRIORITY GAPS (Most Missing Members)');
  console.log('═'.repeat(100));
  const topGaps = results
    .filter(r => r.inDocsButNotValidator.length > 0)
    .sort((a, b) => b.inDocsButNotValidator.length - a.inDocsButNotValidator.length)
    .slice(0, 10);
  
  topGaps.forEach((r, i) => {
    console.log(`${i + 1}. ${r.namespace}: ${r.inDocsButNotValidator.length} missing members`);
  });
  
  // Write detailed report
  const reportData = {
    summary: {
      totalMatched,
      totalMissing,
      totalExtra,
      coverage: ((totalMatched / (totalMatched + totalMissing)) * 100).toFixed(1) + '%'
    },
    byNamespace: results.map(r => ({
      namespace: r.namespace,
      matched: r.matched.length,
      missing: r.inDocsButNotValidator.length,
      extra: r.inValidatorButNotDocs.length,
      missingMembers: r.inDocsButNotValidator,
      extraMembers: r.inValidatorButNotDocs
    }))
  };
  
  const reportPath = path.join(__dirname, '../docs/validator-vs-docs-comparison.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n\n📄 Detailed report written to: ${reportPath}`);
  
  console.log('\n✅ Comparison Complete!');
  console.log('═'.repeat(100));
}

main();

