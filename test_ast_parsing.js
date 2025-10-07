const fs = require('fs');

// Simple test to see what happens with the problematic code
const code = `//@version=6
indicator("Validator Playground", overlay = true)

length = input.int(20, minval = 1, tooltip = "Period length")
ma = ta.sma(close, length)
plot(ma, color = color.new(color.blue, 0))

if ta.crossover(close, ma)`;

console.log('Code to parse:');
console.log(code);
console.log('\n--- End of code ---');
