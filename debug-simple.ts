// Simple test to debug the string format issue
const code = `
//@version=6
indicator("Format")

name = "Bitcoin"
price = close
formatted = str.format("{0}: ${1}", name, price)
label.new(bar_index, high, formatted)
`;

console.log('Testing str.format with $ character...');
console.log('Code:', code);

// Let's manually test the format string parsing
const formatString = '"{0}: ${1}"';
console.log('Format string:', formatString);

// Test placeholder counting
const cleanString = formatString.replace(/^"|"$|^'|'$/g, '');
console.log('Clean string:', cleanString);
const matches = cleanString.match(/\{\d+\}/g);
const placeholderCount = matches ? matches.length : 0;
console.log('Placeholder count:', placeholderCount);
console.log('Matches:', matches);
