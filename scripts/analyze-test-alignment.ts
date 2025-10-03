import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pineScriptDocumentation } from '../PineScriptContext/enhanced-structures';
import { NAMESPACE_MEMBERS } from '../core/namespace-members';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestIssue {
  file: string;
  line: number;
  issue: string;
  member: string;
  namespace: string;
  severity: 'error' | 'warning' | 'info';
  recommendation: string;
}

// Get official API members
function getOfficialMembers(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  
  // Helper to process nested object
  function processNested(obj: any, prefix = '') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value && typeof value === 'object') {
        if (value.name) {
          // It's a leaf node with metadata
          const parts = fullKey.split('.');
          if (parts.length > 1) {
            const ns = parts[0];
            const member = parts.slice(1).join('.');
            if (!result.has(ns)) result.set(ns, new Set());
            result.get(ns)!.add(member);
          } else {
            if (!result.has('global')) result.set('global', new Set());
            result.get('global')!.add(fullKey);
          }
        } else {
          // It's a nested namespace, recurse
          processNested(value, fullKey);
        }
      }
    }
  }
  
  // Process functions
  processNested(pineScriptDocumentation.functions);
  
  // Process variables
  processNested(pineScriptDocumentation.variables);
  
  // Process constants
  processNested(pineScriptDocumentation.constants);
  
  return result;
}

// Flatten nested objects
function flattenObject(obj: any, prefix = ''): Set<string> {
  const result = new Set<string>();
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value && typeof value === 'object') {
      if (value.name) {
        result.add(fullKey);
      } else {
        const nested = flattenObject(value, fullKey);
        nested.forEach(item => result.add(item));
      }
    }
  }
  
  return result;
}

// Extract Pine Script code patterns from test file
function extractPineScriptPatterns(content: string): {
  namespaceAccess: Array<{line: number, namespace: string, member: string}>,
  functionCalls: Array<{line: number, fullName: string}>
} {
  const namespaceAccess: Array<{line: number, namespace: string, member: string}> = [];
  const functionCalls: Array<{line: number, fullName: string}> = [];
  
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Match namespace.member patterns
    const namespacePattern = /\b([a-z_][a-z0-9_]*)\s*\.\s*([a-z_][a-z0-9_]*)\b/gi;
    let match;
    while ((match = namespacePattern.exec(line)) !== null) {
      const namespace = match[1];
      const member = match[2];
      
      // Skip common non-Pine patterns
      if (['expect', 'result', 'validator', 'console', 'describe', 'it', 'test'].includes(namespace)) {
        continue;
      }
      
      namespaceAccess.push({
        line: index + 1,
        namespace,
        member
      });
    }
    
    // Match function calls (including nested namespaces)
    const funcPattern = /\b([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*)\s*\(/gi;
    while ((match = funcPattern.exec(line)) !== null) {
      const fullName = match[1];
      
      // Skip test framework functions
      if (['expect', 'describe', 'it', 'test', 'beforeEach', 'afterEach'].includes(fullName)) {
        continue;
      }
      
      functionCalls.push({
        line: index + 1,
        fullName
      });
    }
  });
  
  return { namespaceAccess, functionCalls };
}

// Analyze a single test file
function analyzeTestFile(filePath: string, officialMembers: Map<string, Set<string>>): TestIssue[] {
  const issues: TestIssue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  const { namespaceAccess, functionCalls } = extractPineScriptPatterns(content);
  
  // Check namespace accesses
  namespaceAccess.forEach(({ line, namespace, member }) => {
    const officialNsMembers = officialMembers.get(namespace);
    const validatorNsMembers = NAMESPACE_MEMBERS[namespace];
    
    // Check if member exists in official docs
    const inOfficial = officialNsMembers?.has(member) || false;
    const inValidator = validatorNsMembers?.has(member) || false;
    
    if (inValidator && !inOfficial) {
      // Member is in validator but not in official docs - should be removed
      issues.push({
        file: relativePath,
        line,
        issue: 'Testing non-existent member',
        member: `${namespace}.${member}`,
        namespace,
        severity: 'error',
        recommendation: `Remove or update test - ${namespace}.${member} does not exist in official Pine Script v6 docs`
      });
    } else if (inOfficial && !inValidator) {
      // Member is in official docs but not in validator - test should expect failure
      issues.push({
        file: relativePath,
        line,
        issue: 'Testing missing member (good - should fail until implemented)',
        member: `${namespace}.${member}`,
        namespace,
        severity: 'info',
        recommendation: `This test should expect validation error until ${namespace}.${member} is implemented in validator`
      });
    }
  });
  
  // Check for metadata artifacts in tests
  const metadataArtifacts = ['arguments', 'signatures', 'qualifier'];
  namespaceAccess.forEach(({ line, namespace, member }) => {
    if (metadataArtifacts.includes(member)) {
      issues.push({
        file: relativePath,
        line,
        issue: 'Testing metadata artifact',
        member: `${namespace}.${member}`,
        namespace,
        severity: 'warning',
        recommendation: `Remove test for ${namespace}.${member} - this is a metadata artifact, not a Pine Script member`
      });
    }
  });
  
  return issues;
}

// Analyze all test files
function analyzeAllTests(): {
  issues: TestIssue[],
  summary: {
    totalFiles: number,
    filesWithIssues: number,
    errorCount: number,
    warningCount: number,
    infoCount: number
  }
} {
  const officialMembers = getOfficialMembers();
  const issues: TestIssue[] = [];
  const testsDir = path.join(__dirname, '../tests');
  
  let totalFiles = 0;
  const filesWithIssues = new Set<string>();
  
  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts'))) {
        totalFiles++;
        const fileIssues = analyzeTestFile(fullPath, officialMembers);
        if (fileIssues.length > 0) {
          issues.push(...fileIssues);
          filesWithIssues.add(fullPath);
        }
      }
    }
  }
  
  scanDirectory(testsDir);
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  
  return {
    issues,
    summary: {
      totalFiles,
      filesWithIssues: filesWithIssues.size,
      errorCount,
      warningCount,
      infoCount
    }
  };
}

// Generate test cleanup recommendations
function generateRecommendations(issues: TestIssue[]): {
  byNamespace: Map<string, TestIssue[]>,
  bySeverity: Map<string, TestIssue[]>,
  byFile: Map<string, TestIssue[]>
} {
  const byNamespace = new Map<string, TestIssue[]>();
  const bySeverity = new Map<string, TestIssue[]>();
  const byFile = new Map<string, TestIssue[]>();
  
  issues.forEach(issue => {
    // By namespace
    if (!byNamespace.has(issue.namespace)) {
      byNamespace.set(issue.namespace, []);
    }
    byNamespace.get(issue.namespace)!.push(issue);
    
    // By severity
    if (!bySeverity.has(issue.severity)) {
      bySeverity.set(issue.severity, []);
    }
    bySeverity.get(issue.severity)!.push(issue);
    
    // By file
    if (!byFile.has(issue.file)) {
      byFile.set(issue.file, []);
    }
    byFile.get(issue.file)!.push(issue);
  });
  
  return { byNamespace, bySeverity, byFile };
}

function main() {
  console.log('🔍 ANALYZING TEST ALIGNMENT WITH OFFICIAL DOCS\n');
  console.log('═'.repeat(100));
  
  console.log('\n📊 Scanning test files...\n');
  
  const { issues, summary } = analyzeAllTests();
  
  console.log('📈 SUMMARY');
  console.log('─'.repeat(100));
  console.log(`Total test files scanned: ${summary.totalFiles}`);
  console.log(`Files with alignment issues: ${summary.filesWithIssues}`);
  console.log(`\nIssues found:`);
  console.log(`  🔴 Errors (tests for non-existent members): ${summary.errorCount}`);
  console.log(`  🟡 Warnings (metadata artifacts): ${summary.warningCount}`);
  console.log(`  🔵 Info (tests for missing members - should fail): ${summary.infoCount}`);
  
  if (issues.length === 0) {
    console.log('\n✅ All tests are aligned with official Pine Script v6 documentation!\n');
    return;
  }
  
  const { byNamespace, bySeverity, byFile } = generateRecommendations(issues);
  
  // Print errors (tests that need to be removed/fixed)
  const errors = bySeverity.get('error') || [];
  if (errors.length > 0) {
    console.log('\n\n🔴 CRITICAL: Tests for Non-Existent Members (Must Fix)');
    console.log('═'.repeat(100));
    console.log('These tests validate members that DO NOT exist in official Pine Script v6 docs.\n');
    
    // Group by namespace
    const errorsByNs = new Map<string, TestIssue[]>();
    errors.forEach(e => {
      if (!errorsByNs.has(e.namespace)) errorsByNs.set(e.namespace, []);
      errorsByNs.get(e.namespace)!.push(e);
    });
    
    Array.from(errorsByNs.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([ns, nsErrors]) => {
        console.log(`\n  ${ns} namespace (${nsErrors.length} issues):`);
        const uniqueMembers = new Set(nsErrors.map(e => e.member));
        Array.from(uniqueMembers).slice(0, 10).forEach(member => {
          const firstIssue = nsErrors.find(e => e.member === member)!;
          console.log(`    • ${member}`);
          console.log(`      Found in: ${firstIssue.file}:${firstIssue.line}`);
        });
        if (uniqueMembers.size > 10) {
          console.log(`    ... and ${uniqueMembers.size - 10} more`);
        }
      });
  }
  
  // Print warnings (metadata artifacts)
  const warnings = bySeverity.get('warning') || [];
  if (warnings.length > 0) {
    console.log('\n\n🟡 WARNINGS: Metadata Artifact Tests (Should Remove)');
    console.log('═'.repeat(100));
    console.log('These tests validate metadata artifacts (arguments, signatures, qualifier).\n');
    
    const uniqueArtifacts = new Set(warnings.map(w => w.member));
    console.log(`Found ${warnings.length} occurrences of ${uniqueArtifacts.size} unique artifacts:\n`);
    Array.from(uniqueArtifacts).slice(0, 20).forEach(artifact => {
      const count = warnings.filter(w => w.member === artifact).length;
      console.log(`  • ${artifact} (${count} occurrences)`);
    });
  }
  
  // Print info (tests for missing members - these are actually good!)
  const infos = bySeverity.get('info') || [];
  if (infos.length > 0) {
    console.log('\n\n🔵 INFO: Tests for Missing Members (TDD - Good!)');
    console.log('═'.repeat(100));
    console.log('These tests validate members that EXIST in official docs but are MISSING from validator.');
    console.log('These tests should currently FAIL and PASS once the members are implemented.\n');
    
    const infosByNs = new Map<string, TestIssue[]>();
    infos.forEach(i => {
      if (!infosByNs.has(i.namespace)) infosByNs.set(i.namespace, []);
      infosByNs.get(i.namespace)!.push(i);
    });
    
    Array.from(infosByNs.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .forEach(([ns, nsInfos]) => {
        console.log(`\n  ${ns} namespace (${nsInfos.length} missing members tested):`);
        const uniqueMembers = new Set(nsInfos.map(i => i.member));
        Array.from(uniqueMembers).slice(0, 5).forEach(member => {
          console.log(`    • ${member}`);
        });
      });
  }
  
  // Print files with most issues
  console.log('\n\n📁 FILES WITH MOST ISSUES');
  console.log('═'.repeat(100));
  const sortedFiles = Array.from(byFile.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);
  
  sortedFiles.forEach(([file, fileIssues]) => {
    const errors = fileIssues.filter(i => i.severity === 'error').length;
    const warnings = fileIssues.filter(i => i.severity === 'warning').length;
    const infos = fileIssues.filter(i => i.severity === 'info').length;
    
    console.log(`\n  ${file}`);
    console.log(`    🔴 ${errors} errors  🟡 ${warnings} warnings  🔵 ${infos} info`);
  });
  
  // Write detailed report
  const reportData = {
    summary,
    issues: issues.map(i => ({
      file: i.file,
      line: i.line,
      severity: i.severity,
      issue: i.issue,
      member: i.member,
      namespace: i.namespace,
      recommendation: i.recommendation
    })),
    byNamespace: Object.fromEntries(
      Array.from(byNamespace.entries()).map(([ns, issues]) => [
        ns,
        {
          count: issues.length,
          errors: issues.filter(i => i.severity === 'error').length,
          warnings: issues.filter(i => i.severity === 'warning').length,
          infos: issues.filter(i => i.severity === 'info').length,
          members: Array.from(new Set(issues.map(i => i.member)))
        }
      ])
    )
  };
  
  const reportPath = path.join(__dirname, '../docs/test-alignment-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  
  console.log('\n\n📄 Detailed report written to: docs/test-alignment-report.json');
  
  console.log('\n\n📋 RECOMMENDED ACTIONS');
  console.log('═'.repeat(100));
  console.log(`
1. 🔴 FIX ERRORS (${summary.errorCount} tests)
   - Remove tests for non-existent members (${errors.length} occurrences)
   - Update expectations to match official Pine Script v6 API
   
2. 🟡 CLEAN WARNINGS (${summary.warningCount} tests)
   - Remove tests for metadata artifacts (arguments, signatures, qualifier)
   - These are not real Pine Script features
   
3. 🔵 VERIFY INFO (${summary.infoCount} tests)
   - Ensure tests for missing members expect validation errors
   - Update tests to pass once members are implemented
   - These are good TDD tests!

4. 📝 RUN TESTS
   - Run test suite to see current state
   - Fix failing tests that should pass
   - Ensure "info" tests properly fail until features are implemented
  `);
  
  console.log('\n✅ Analysis Complete!');
  console.log('═'.repeat(100));
}

main();

