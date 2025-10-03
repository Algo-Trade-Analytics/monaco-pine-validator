import { pineScriptDocumentation } from '../PineScriptContext/enhanced-structures';

console.log('🚀 Enhanced Pine Script Structures Demo\n');
console.log('═'.repeat(80));

// Demo 1: Accessing variable metadata
console.log('\n📊 VARIABLE METADATA');
console.log('─'.repeat(80));
const askVar = pineScriptDocumentation.variables.ask;
console.log(`Name: ${askVar.name}`);
console.log(`Type: ${askVar.qualifier} ${askVar.type}`);
console.log(`Description: ${askVar.description}`);
console.log(`Remarks: ${askVar.remarks}`);
console.log(`See Also: ${askVar.seeAlso?.map((ref: any) => ref.name).join(', ')}`);

// Demo 2: Accessing nested variable metadata
console.log('\n\n🌳 NESTED VARIABLE (strategy.closedtrades.first_index)');
console.log('─'.repeat(80));
const strategyClosedTrades = pineScriptDocumentation.variables.strategy.closedtrades.first_index;
console.log(`Name: ${strategyClosedTrades.name}`);
console.log(`Type: ${strategyClosedTrades.qualifier} ${strategyClosedTrades.type}`);
console.log(`Description: ${strategyClosedTrades.description}`);

// Demo 3: Accessing function metadata
console.log('\n\n🔧 FUNCTION METADATA (alert)');
console.log('─'.repeat(80));
const alertFunc = pineScriptDocumentation.functions.alert;
console.log(`Name: ${alertFunc.name}`);
console.log(`Syntax: ${alertFunc.syntax}`);
console.log(`Description: ${alertFunc.description}`);
console.log(`Parameters:`);
alertFunc.parameters?.forEach((param: any, i: number) => {
  console.log(`  ${i + 1}. ${param.text}`);
});
console.log(`Remarks: ${alertFunc.remarks}`);

// Demo 4: Accessing nested function metadata
console.log('\n\n🔧 NESTED FUNCTION (array.avg)');
console.log('─'.repeat(80));
const arrayAvg = pineScriptDocumentation.functions.array.avg;
console.log(`Name: ${arrayAvg.name}`);
console.log(`Syntax: ${arrayAvg.syntax}`);
console.log(`Description: ${arrayAvg.description}`);
console.log(`Returns: ${arrayAvg.returns}`);
if (arrayAvg.example) {
  console.log(`\nExample (first 200 chars):`);
  console.log(arrayAvg.example.substring(0, 200) + '...');
}

// Demo 5: Accessing constant metadata
console.log('\n\n🎨 CONSTANT METADATA (color.red)');
console.log('─'.repeat(80));
const colorRed = pineScriptDocumentation.constants.color.red;
console.log(`Name: ${colorRed.name}`);
console.log(`Type: ${colorRed.qualifier} ${colorRed.type}`);
console.log(`Description: ${colorRed.description}`);

// Demo 6: List all available namespaces
console.log('\n\n📦 AVAILABLE NAMESPACES');
console.log('─'.repeat(80));

console.log('\nVariable Namespaces:');
const varNamespaces = Object.keys(pineScriptDocumentation.variables).filter(key => {
  const val = (pineScriptDocumentation.variables as any)[key];
  return typeof val === 'object' && !val.name;
});
console.log(`  ${varNamespaces.join(', ')}`);

console.log('\nFunction Namespaces:');
const funcNamespaces = Object.keys(pineScriptDocumentation.functions).filter(key => {
  const val = (pineScriptDocumentation.functions as any)[key];
  return typeof val === 'object' && !val.name;
});
console.log(`  ${funcNamespaces.join(', ')}`);

console.log('\nConstant Namespaces:');
const constNamespaces = Object.keys(pineScriptDocumentation.constants).filter(key => {
  const val = (pineScriptDocumentation.constants as any)[key];
  return typeof val === 'object' && !val.name;
});
console.log(`  ${constNamespaces.join(', ')}`);

// Demo 7: Keywords and Operators
console.log('\n\n🔑 KEYWORDS');
console.log('─'.repeat(80));
const keywordNames = Object.keys(pineScriptDocumentation.keywords);
console.log(`Available keywords (${keywordNames.length}): ${keywordNames.join(', ')}`);

console.log('\n\n➕ OPERATORS');
console.log('─'.repeat(80));
const operatorNames = Object.keys(pineScriptDocumentation.operators);
console.log(`Available operators (${operatorNames.length}): ${operatorNames.join(', ')}`);

// Demo 8: Types
console.log('\n\n📦 TYPES');
console.log('─'.repeat(80));
const typeNames = Object.keys(pineScriptDocumentation.types);
console.log(`Available types (${typeNames.length}): ${typeNames.join(', ')}`);

// Demo 9: Annotations
console.log('\n\n📝 ANNOTATIONS');
console.log('─'.repeat(80));
const annotationNames = Object.keys(pineScriptDocumentation.annotations);
console.log(`Available annotations (${annotationNames.length}): ${annotationNames.join(', ')}`);

// Demo 10: Search for input functions
console.log('\n\n🔍 INPUT FUNCTIONS (Complete list)');
console.log('─'.repeat(80));
const inputFuncs = pineScriptDocumentation.functions.input;
if (inputFuncs) {
  const inputFuncNames = Object.keys(inputFuncs);
  inputFuncNames.forEach(funcName => {
    const func = (inputFuncs as any)[funcName];
    console.log(`  • input.${funcName}()`);
    console.log(`    ${func.description.substring(0, 80)}...`);
  });
}

console.log('\n\n✅ Demo Complete!');
console.log('═'.repeat(80));

