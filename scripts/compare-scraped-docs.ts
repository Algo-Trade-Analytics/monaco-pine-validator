import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { variables } from '../PineScriptContext/structures/variables';
import { functions } from '../PineScriptContext/structures/functions';
import { constants } from '../PineScriptContext/structures/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScrapedEntry {
  id: string;
  name: string;
  description: string;
  type_info: string;
  category: string;
  type: 'variable' | 'function' | 'constant' | 'type' | 'annotation';
  source_url: string;
  scraped_at: string;
  remarks?: string;
  see_also?: Array<{ name: string; reference: string }>;
  example?: string;
  returns?: string;
}

interface ComparisonResult {
  missingVariables: string[];
  missingFunctions: string[];
  missingConstants: string[];
  extraVariables: string[];
  extraFunctions: string[];
  extraConstants: string[];
  typeMismatches: Array<{ name: string; scraped: string; current: string }>;
  stats: {
    scrapedVariables: number;
    scrapedFunctions: number;
    scrapedConstants: number;
    currentVariables: number;
    currentFunctions: number;
    currentConstants: number;
  };
}

// Helper function to flatten nested objects into dot notation
function flattenObject(obj: any, prefix = ''): Set<string> {
  const result = new Set<string>();
  
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Check if it's a structure entry (has qualifier, signatures, etc) or nested namespace
      if ('qualifier' in obj[key] || 'signatures' in obj[key] || 'arguments' in obj[key]) {
        result.add(prefix ? `${prefix}.${key}` : key);
      } else {
        // It's a nested namespace
        const nested = flattenObject(obj[key], prefix ? `${prefix}.${key}` : key);
        nested.forEach(item => result.add(item));
      }
    }
  }
  
  return result;
}

function parseTypeInfo(typeInfo: string): { qualifier: string | null; type: string } {
  // Examples: "series float", "simple bool", "int", "array<box>"
  const parts = typeInfo.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return { qualifier: null, type: parts[0] };
  }
  
  const qualifier = parts[0];
  const type = parts.slice(1).join(' ');
  
  return { qualifier, type };
}

function compareStructures(): ComparisonResult {
  const jsonlPath = path.join(__dirname, '../PineScriptContext/pinescript_reference.jsonl');
  const content = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  const scrapedEntries: ScrapedEntry[] = lines.map(line => JSON.parse(line));
  
  // Categorize scraped entries
  const scrapedVariables = new Map<string, ScrapedEntry>();
  const scrapedFunctions = new Map<string, ScrapedEntry>();
  const scrapedConstants = new Map<string, ScrapedEntry>();
  
  scrapedEntries.forEach(entry => {
    // Remove () from function names for consistent comparison
    let name = entry.name;
    if (entry.type === 'function' && name.endsWith('()')) {
      name = name.slice(0, -2);
    }
    
    if (entry.type === 'variable') {
      scrapedVariables.set(name, entry);
    } else if (entry.type === 'function') {
      scrapedFunctions.set(name, entry);
    } else if (entry.type === 'constant') {
      scrapedConstants.set(name, entry);
    }
  });
  
  // Get current structures
  const currentVariables = flattenObject(variables);
  const currentFunctions = flattenObject(functions);
  const currentConstants = flattenObject(constants);
  
  // Find missing and extra entries
  const missingVariables: string[] = [];
  const missingFunctions: string[] = [];
  const missingConstants: string[] = [];
  const extraVariables: string[] = [];
  const extraFunctions: string[] = [];
  const extraConstants: string[] = [];
  const typeMismatches: Array<{ name: string; scraped: string; current: string }> = [];
  
  // Check for missing variables
  scrapedVariables.forEach((entry, name) => {
    if (!currentVariables.has(name)) {
      missingVariables.push(name);
    }
  });
  
  // Check for extra variables
  currentVariables.forEach(name => {
    if (!scrapedVariables.has(name)) {
      extraVariables.push(name);
    }
  });
  
  // Check for missing functions
  scrapedFunctions.forEach((entry, name) => {
    if (!currentFunctions.has(name)) {
      missingFunctions.push(name);
    }
  });
  
  // Check for extra functions
  currentFunctions.forEach(name => {
    if (!scrapedFunctions.has(name)) {
      extraFunctions.push(name);
    }
  });
  
  // Check for missing constants
  scrapedConstants.forEach((entry, name) => {
    if (!currentConstants.has(name)) {
      missingConstants.push(name);
    }
  });
  
  // Check for extra constants
  currentConstants.forEach(name => {
    if (!scrapedConstants.has(name)) {
      extraConstants.push(name);
    }
  });
  
  return {
    missingVariables: missingVariables.sort(),
    missingFunctions: missingFunctions.sort(),
    missingConstants: missingConstants.sort(),
    extraVariables: extraVariables.sort(),
    extraFunctions: extraFunctions.sort(),
    extraConstants: extraConstants.sort(),
    typeMismatches,
    stats: {
      scrapedVariables: scrapedVariables.size,
      scrapedFunctions: scrapedFunctions.size,
      scrapedConstants: scrapedConstants.size,
      currentVariables: currentVariables.size,
      currentFunctions: currentFunctions.size,
      currentConstants: currentConstants.size,
    },
  };
}

function main() {
  console.log('🔍 Comparing scraped Pine Script documentation with current structures...\n');
  
  const result = compareStructures();
  
  // Print statistics
  console.log('📊 STATISTICS');
  console.log('─'.repeat(80));
  console.log(`Variables: ${result.stats.currentVariables} current / ${result.stats.scrapedVariables} scraped`);
  console.log(`Functions: ${result.stats.currentFunctions} current / ${result.stats.scrapedFunctions} scraped`);
  console.log(`Constants: ${result.stats.currentConstants} current / ${result.stats.scrapedConstants} scraped`);
  console.log();
  
  // Print missing entries
  if (result.missingVariables.length > 0) {
    console.log(`❌ MISSING VARIABLES (${result.missingVariables.length})`);
    console.log('─'.repeat(80));
    result.missingVariables.slice(0, 20).forEach(name => console.log(`  - ${name}`));
    if (result.missingVariables.length > 20) {
      console.log(`  ... and ${result.missingVariables.length - 20} more`);
    }
    console.log();
  }
  
  if (result.missingFunctions.length > 0) {
    console.log(`❌ MISSING FUNCTIONS (${result.missingFunctions.length})`);
    console.log('─'.repeat(80));
    result.missingFunctions.slice(0, 20).forEach(name => console.log(`  - ${name}`));
    if (result.missingFunctions.length > 20) {
      console.log(`  ... and ${result.missingFunctions.length - 20} more`);
    }
    console.log();
  }
  
  if (result.missingConstants.length > 0) {
    console.log(`❌ MISSING CONSTANTS (${result.missingConstants.length})`);
    console.log('─'.repeat(80));
    result.missingConstants.slice(0, 20).forEach(name => console.log(`  - ${name}`));
    if (result.missingConstants.length > 20) {
      console.log(`  ... and ${result.missingConstants.length - 20} more`);
    }
    console.log();
  }
  
  // Print extra entries (in current but not in scraped)
  if (result.extraVariables.length > 0) {
    console.log(`➕ EXTRA VARIABLES (${result.extraVariables.length})`);
    console.log('─'.repeat(80));
    result.extraVariables.slice(0, 20).forEach(name => console.log(`  - ${name}`));
    if (result.extraVariables.length > 20) {
      console.log(`  ... and ${result.extraVariables.length - 20} more`);
    }
    console.log();
  }
  
  if (result.extraFunctions.length > 0) {
    console.log(`➕ EXTRA FUNCTIONS (${result.extraFunctions.length})`);
    console.log('─'.repeat(80));
    result.extraFunctions.slice(0, 20).forEach(name => console.log(`  - ${name}`));
    if (result.extraFunctions.length > 20) {
      console.log(`  ... and ${result.extraFunctions.length - 20} more`);
    }
    console.log();
  }
  
  if (result.extraConstants.length > 0) {
    console.log(`➕ EXTRA CONSTANTS (${result.extraConstants.length})`);
    console.log('─'.repeat(80));
    result.extraConstants.slice(0, 20).forEach(name => console.log(`  - ${name}`));
    if (result.extraConstants.length > 20) {
      console.log(`  ... and ${result.extraConstants.length - 20} more`);
    }
    console.log();
  }
  
  // Summary
  console.log('📝 SUMMARY');
  console.log('─'.repeat(80));
  const totalMissing = result.missingVariables.length + result.missingFunctions.length + result.missingConstants.length;
  const totalExtra = result.extraVariables.length + result.extraFunctions.length + result.extraConstants.length;
  
  if (totalMissing === 0 && totalExtra === 0) {
    console.log('✅ All entries match! Your structures are up to date.');
  } else {
    console.log(`Missing from current structures: ${totalMissing}`);
    console.log(`Extra in current structures: ${totalExtra}`);
    console.log('\n💡 Consider updating your structures to match the scraped documentation.');
  }
  
  // Write detailed report to file
  const reportPath = path.join(__dirname, '../docs/scraped-docs-comparison.json');
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`\n📄 Detailed report written to: ${reportPath}`);
}

main();

