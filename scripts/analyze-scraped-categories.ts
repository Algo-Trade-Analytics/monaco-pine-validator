import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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
}

function main() {
  const jsonlPath = path.join(__dirname, '../PineScriptContext/pinescript_reference.jsonl');
  const content = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  const entries: ScrapedEntry[] = lines.map(line => JSON.parse(line));
  
  // Group by category
  const byCategory = new Map<string, ScrapedEntry[]>();
  entries.forEach(entry => {
    const cat = entry.category || 'Uncategorized';
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(entry);
  });
  
  // Group by type
  const byType = new Map<string, ScrapedEntry[]>();
  entries.forEach(entry => {
    const type = entry.type || 'unknown';
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(entry);
  });
  
  // Analyze namespaces
  const namespaces = new Map<string, { variables: number; functions: number; constants: number }>();
  entries.forEach(entry => {
    const parts = entry.name.replace(/\(\)$/, '').split('.');
    if (parts.length > 1) {
      const ns = parts[0];
      if (!namespaces.has(ns)) {
        namespaces.set(ns, { variables: 0, functions: 0, constants: 0 });
      }
      const stats = namespaces.get(ns)!;
      if (entry.type === 'variable') stats.variables++;
      else if (entry.type === 'function') stats.functions++;
      else if (entry.type === 'constant') stats.constants++;
    }
  });
  
  console.log('📊 SCRAPED DOCUMENTATION ANALYSIS');
  console.log('═'.repeat(80));
  console.log();
  
  console.log('📑 BY CATEGORY:');
  console.log('─'.repeat(80));
  const sortedCategories = Array.from(byCategory.entries()).sort((a, b) => b[1].length - a[1].length);
  sortedCategories.forEach(([category, items]) => {
    const types = items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`  ${category}: ${items.length} entries`);
    console.log(`    - Variables: ${types.variable || 0}`);
    console.log(`    - Functions: ${types.function || 0}`);
    console.log(`    - Constants: ${types.constant || 0}`);
    console.log(`    - Types: ${types.type || 0}`);
    console.log();
  });
  
  console.log('🔤 BY TYPE:');
  console.log('─'.repeat(80));
  Array.from(byType.entries()).sort((a, b) => b[1].length - a[1].length).forEach(([type, items]) => {
    console.log(`  ${type}: ${items.length} entries`);
  });
  console.log();
  
  console.log('🗂️  BY NAMESPACE:');
  console.log('─'.repeat(80));
  const sortedNamespaces = Array.from(namespaces.entries()).sort((a, b) => {
    const totalA = a[1].variables + a[1].functions + a[1].constants;
    const totalB = b[1].variables + b[1].functions + b[1].constants;
    return totalB - totalA;
  });
  sortedNamespaces.forEach(([ns, stats]) => {
    const total = stats.variables + stats.functions + stats.constants;
    console.log(`  ${ns}: ${total} entries (${stats.variables}v, ${stats.functions}f, ${stats.constants}c)`);
  });
  console.log();
  
  // Find missing namespaces/functions patterns
  console.log('🔍 SAMPLE ENTRIES BY NAMESPACE:');
  console.log('─'.repeat(80));
  
  const sampleNamespaces = ['box', 'label', 'line', 'input', 'strategy'];
  sampleNamespaces.forEach(ns => {
    const nsEntries = entries.filter(e => e.name.replace(/\(\)$/, '').startsWith(ns + '.'));
    if (nsEntries.length > 0) {
      console.log(`\n  ${ns} namespace (${nsEntries.length} entries):`);
      nsEntries.slice(0, 10).forEach(e => {
        const displayName = e.name.replace(/\(\)$/, '');
        console.log(`    - ${displayName} [${e.type}] ${e.type_info}`);
      });
      if (nsEntries.length > 10) {
        console.log(`    ... and ${nsEntries.length - 10} more`);
      }
    }
  });
  
  // Look for types
  console.log('\n\n📦 TYPES:');
  console.log('─'.repeat(80));
  const typeEntries = entries.filter(e => e.type === 'type');
  if (typeEntries.length > 0) {
    typeEntries.forEach(e => {
      console.log(`  - ${e.name}: ${e.description.substring(0, 80)}...`);
    });
  } else {
    console.log('  No type entries found');
  }
  
  // Write full report
  const reportData = {
    totalEntries: entries.length,
    byType: Object.fromEntries(
      Array.from(byType.entries()).map(([k, v]) => [k, v.length])
    ),
    byCategory: Object.fromEntries(
      Array.from(byCategory.entries()).map(([k, v]) => [k, v.length])
    ),
    namespaces: Object.fromEntries(namespaces),
    samples: {
      variables: entries.filter(e => e.type === 'variable').slice(0, 5).map(e => ({ name: e.name, type_info: e.type_info })),
      functions: entries.filter(e => e.type === 'function').slice(0, 5).map(e => ({ name: e.name, type_info: e.type_info })),
      constants: entries.filter(e => e.type === 'constant').slice(0, 5).map(e => ({ name: e.name, type_info: e.type_info })),
    }
  };
  
  const reportPath = path.join(__dirname, '../docs/scraped-docs-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n\n📄 Full analysis written to: ${reportPath}`);
}

main();

