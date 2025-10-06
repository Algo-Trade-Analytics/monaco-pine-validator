#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { NAMESPACE_MEMBERS } from '../core/constants';
import { functions } from '../PineScriptContext/structures/functions';
import { constants } from '../PineScriptContext/structures/constants';
import { variables } from '../PineScriptContext/structures/variables';

interface GapAnalysis {
  namespace: string;
  missing: string[];
  extra: string[];
  total: number;
  coverage: number;
}

function analyzeNamespace(namespace: string, ourMembers: Set<string>, contextMembers: Set<string>): GapAnalysis {
  const missing = [...contextMembers].filter(member => !ourMembers.has(member));
  const extra = [...ourMembers].filter(member => !contextMembers.has(member));
  const total = contextMembers.size;
  const coverage = total > 0 ? ((total - missing.length) / total) * 100 : 100;
  
  return {
    namespace,
    missing,
    extra,
    total,
    coverage
  };
}

function extractFunctionsFromContext(): Map<string, Set<string>> {
  const functionMap = new Map<string, Set<string>>();
  
  // Extract functions from the functions context
  // Functions are organized as nested objects: { "array": { "binary_search": {...} } }
  Object.keys(functions).forEach(namespace => {
    const namespaceFunctions = functions[namespace as keyof typeof functions];
    
    if (typeof namespaceFunctions === 'object' && namespaceFunctions !== null) {
      if (!functionMap.has(namespace)) {
        functionMap.set(namespace, new Set());
      }
      
      Object.keys(namespaceFunctions).forEach(member => {
        functionMap.get(namespace)!.add(member);
      });
    }
  });
  
  return functionMap;
}

function extractConstantsFromContext(): Map<string, Set<string>> {
  const constantMap = new Map<string, Set<string>>();
  
  // Extract constants from the constants context
  // Constants are organized as nested objects: { "color": { "red": {...} } }
  Object.keys(constants).forEach(namespace => {
    const namespaceConstants = constants[namespace as keyof typeof constants];
    
    if (typeof namespaceConstants === 'object' && namespaceConstants !== null) {
      if (!constantMap.has(namespace)) {
        constantMap.set(namespace, new Set());
      }
      
      Object.keys(namespaceConstants).forEach(member => {
        constantMap.get(namespace)!.add(member);
      });
    }
  });
  
  return constantMap;
}

function extractVariablesFromContext(): Map<string, Set<string>> {
  const variableMap = new Map<string, Set<string>>();
  
  // Extract variables from the variables context
  // Variables are organized as nested objects: { "syminfo": { "tickerid": {...} } }
  Object.keys(variables).forEach(namespace => {
    const namespaceVariables = variables[namespace as keyof typeof variables];
    
    if (typeof namespaceVariables === 'object' && namespaceVariables !== null) {
      if (!variableMap.has(namespace)) {
        variableMap.set(namespace, new Set());
      }
      
      Object.keys(namespaceVariables).forEach(member => {
        variableMap.get(namespace)!.add(member);
      });
    }
  });
  
  return variableMap;
}

function main() {
  console.log('🔍 Pine Script v6 Comprehensive Gap Analysis');
  console.log('==========================================\n');
  
  // Extract all members from context files
  const contextFunctions = extractFunctionsFromContext();
  const contextConstants = extractConstantsFromContext();
  const contextVariables = extractVariablesFromContext();
  
  // Combine all context members
  const contextMembers = new Map<string, Set<string>>();
  
  // Merge functions, constants, and variables
  [contextFunctions, contextConstants, contextVariables].forEach(map => {
    map.forEach((members, namespace) => {
      if (!contextMembers.has(namespace)) {
        contextMembers.set(namespace, new Set());
      }
      members.forEach(member => {
        contextMembers.get(namespace)!.add(member);
      });
    });
  });
  
  console.log('📊 Context Analysis:');
  console.log(`Total namespaces in context: ${contextMembers.size}`);
  console.log(`Total members in context: ${Array.from(contextMembers.values()).reduce((sum, set) => sum + set.size, 0)}`);
  console.log();
  
  // Analyze each namespace
  const analyses: GapAnalysis[] = [];
  
  // Analyze our defined namespaces
  Object.keys(NAMESPACE_MEMBERS).forEach(namespace => {
    const ourMembers = NAMESPACE_MEMBERS[namespace as keyof typeof NAMESPACE_MEMBERS];
    const contextNamespaceMembers = contextMembers.get(namespace) || new Set();
    
    const analysis = analyzeNamespace(namespace, ourMembers, contextNamespaceMembers);
    analyses.push(analysis);
  });
  
  // Check for namespaces in context that we don't have
  contextMembers.forEach((members, namespace) => {
    if (!NAMESPACE_MEMBERS[namespace as keyof typeof NAMESPACE_MEMBERS]) {
      analyses.push({
        namespace: `${namespace} (MISSING)`,
        missing: [...members],
        extra: [],
        total: members.size,
        coverage: 0
      });
    }
  });
  
  // Sort by coverage (worst first)
  analyses.sort((a, b) => a.coverage - b.coverage);
  
  console.log('📋 Gap Analysis Results:');
  console.log('========================\n');
  
  let totalMissing = 0;
  let totalExtra = 0;
  let totalContext = 0;
  
  analyses.forEach(analysis => {
    console.log(`🔸 ${analysis.namespace}`);
    console.log(`   Coverage: ${analysis.coverage.toFixed(1)}% (${analysis.total - analysis.missing.length}/${analysis.total})`);
    
    if (analysis.missing.length > 0) {
      console.log(`   ❌ Missing (${analysis.missing.length}): ${analysis.missing.slice(0, 10).join(', ')}${analysis.missing.length > 10 ? '...' : ''}`);
      totalMissing += analysis.missing.length;
    }
    
    if (analysis.extra.length > 0) {
      console.log(`   ⚠️  Extra (${analysis.extra.length}): ${analysis.extra.slice(0, 10).join(', ')}${analysis.extra.length > 10 ? '...' : ''}`);
      totalExtra += analysis.extra.length;
    }
    
    totalContext += analysis.total;
    console.log();
  });
  
  console.log('📈 Summary:');
  console.log('===========');
  console.log(`Total context members: ${totalContext}`);
  console.log(`Total missing: ${totalMissing}`);
  console.log(`Total extra: ${totalExtra}`);
  console.log(`Overall coverage: ${((totalContext - totalMissing) / totalContext * 100).toFixed(1)}%`);
  
  // Identify critical gaps
  console.log('\n🚨 Critical Gaps (High Priority):');
  console.log('==================================');
  
  const criticalGaps = analyses.filter(a => a.coverage < 80 && a.total > 5);
  criticalGaps.forEach(analysis => {
    console.log(`❌ ${analysis.namespace}: ${analysis.coverage.toFixed(1)}% coverage (${analysis.missing.length} missing)`);
  });
  
  if (criticalGaps.length === 0) {
    console.log('✅ No critical gaps found!');
  }
  
  // Generate recommendations
  console.log('\n💡 Recommendations:');
  console.log('===================');
  
  if (totalMissing > 0) {
    console.log(`1. Add ${totalMissing} missing members to namespace-members.ts`);
  }
  
  if (totalExtra > 0) {
    console.log(`2. Review ${totalExtra} extra members - may be outdated or incorrect`);
  }
  
  const missingNamespaces = analyses.filter(a => a.namespace.includes('(MISSING)'));
  if (missingNamespaces.length > 0) {
    console.log(`3. Add ${missingNamespaces.length} missing namespaces: ${missingNamespaces.map(a => a.namespace.replace(' (MISSING)', '')).join(', ')}`);
  }
  
  console.log('\n🎯 Next Steps:');
  console.log('==============');
  console.log('1. Review critical gaps and prioritize implementation');
  console.log('2. Add missing members to namespace-members.ts');
  console.log('3. Remove or verify extra members');
  console.log('4. Add missing namespaces');
  console.log('5. Run tests to ensure no regressions');
}

main();
