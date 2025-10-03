import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generic constructors that need to be replaced
const GENERIC_CONSTRUCTORS = {
  'array.new': ['array.new_float', 'array.new_int', 'array.new_bool', 'array.new_string', 'array.new_color'],
  'matrix.new': ['matrix.new_float', 'matrix.new_int'],
  'map.new': ['map.new<string, float>', 'map.new<int, string>'],
};

interface ConstructorUsage {
  file: string;
  lines: number[];
  constructor: string;
  count: number;
}

// Find all usages of generic constructors
function findGenericConstructors(testsDir: string): Map<string, ConstructorUsage[]> {
  const results = new Map<string, ConstructorUsage[]>();
  
  function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);
    
    for (const [constructor, _] of Object.entries(GENERIC_CONSTRUCTORS)) {
      const pattern = new RegExp(`\\b${constructor.replace('.', '\\.')}\\s*\\(`, 'g');
      const foundLines: number[] = [];
      
      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//')) return;
        
        if (pattern.test(line)) {
          foundLines.push(index + 1);
        }
      });
      
      if (foundLines.length > 0) {
        if (!results.has(constructor)) {
          results.set(constructor, []);
        }
        results.get(constructor)!.push({
          file: relativePath,
          lines: foundLines,
          constructor,
          count: foundLines.length
        });
      }
    }
  }
  
  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts'))) {
        scanFile(fullPath);
      }
    }
  }
  
  scanDirectory(testsDir);
  return results;
}

function main() {
  console.log('🔍 PHASE 2: Finding Generic Constructor Usages\n');
  console.log('═'.repeat(80));
  
  const testsDir = path.join(__dirname, '../tests');
  const results = findGenericConstructors(testsDir);
  
  let totalUsages = 0;
  let totalFiles = 0;
  const fileSet = new Set<string>();
  
  for (const [constructor, usages] of results.entries()) {
    const count = usages.reduce((sum, u) => sum + u.count, 0);
    totalUsages += count;
    usages.forEach(u => fileSet.add(u.file));
    
    console.log(`\n📦 ${constructor}`);
    console.log('─'.repeat(80));
    console.log(`Found ${count} usages in ${usages.length} files\n`);
    console.log(`Recommended replacements:`);
    GENERIC_CONSTRUCTORS[constructor as keyof typeof GENERIC_CONSTRUCTORS].forEach((replacement, i) => {
      console.log(`  ${i + 1}. ${replacement}`);
    });
    
    console.log(`\nFiles to update:`);
    usages.slice(0, 10).forEach(usage => {
      console.log(`  • ${usage.file}`);
      console.log(`    Lines: ${usage.lines.slice(0, 5).join(', ')}${usage.lines.length > 5 ? ` ... (${usage.lines.length} total)` : ''}`);
    });
    
    if (usages.length > 10) {
      console.log(`  ... and ${usages.length - 10} more files`);
    }
  }
  
  totalFiles = fileSet.size;
  
  console.log('\n\n📊 SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total generic constructor usages: ${totalUsages}`);
  console.log(`Files affected: ${totalFiles}`);
  console.log();
  
  console.log('📋 RECOMMENDED ACTIONS:');
  console.log('─'.repeat(80));
  console.log(`
1. array.new → Update to specific constructors
   • Use array.new_float() for float arrays
   • Use array.new_int() for int arrays
   • Use array.new_bool() for boolean arrays
   • Use array.new_string() for string arrays
   • Use array.new_color() for color arrays

2. matrix.new → Update to specific constructors
   • Use matrix.new_float() for float matrices
   • Use matrix.new_int() for int matrices

3. map.new → Update to generic syntax
   • Use map.new<string, float>() for string→float maps
   • Use map.new<int, string>() for int→string maps
   • Specify appropriate key and value types

⚠️  NOTE: These changes ensure tests match official Pine Script v6 API.
   Generic constructors don't exist - only type-specific ones do.
  `);
  
  // Write detailed report
  const reportData: any = {};
  for (const [constructor, usages] of results.entries()) {
    reportData[constructor] = {
      totalUsages: usages.reduce((sum, u) => sum + u.count, 0),
      files: usages.map(u => ({
        file: u.file,
        lines: u.lines,
        count: u.count
      })),
      replacements: GENERIC_CONSTRUCTORS[constructor as keyof typeof GENERIC_CONSTRUCTORS]
    };
  }
  
  const reportPath = path.join(__dirname, '../docs/generic-constructors-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Detailed report: docs/generic-constructors-report.json`);
  
  console.log('\n✅ Analysis Complete!');
  console.log('═'.repeat(80));
}

main();

