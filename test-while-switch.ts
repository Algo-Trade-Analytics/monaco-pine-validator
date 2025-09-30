import { EnhancedModularValidator } from './EnhancedModularValidator.js';

const tests = [
  {
    name: "Invalid switch (missing expression)",
    code: `//@version=6
indicator("Invalid Switch")

switch  // Missing expression
    "1" => "1 minute"
    "5" => "5 minutes"
    => "default"

plot(close)`
  },
  {
    name: "Empty while condition",
    code: `//@version=6
indicator("Empty While Test")

while
    plot(close)

plot(close)`
  },
  {
    name: "While missing end",
    code: `//@version=6
indicator("Missing End Test")

i = 0
while i < 10
    i := i + 1

plot(close)`
  }
];

const validator = new EnhancedModularValidator();

for (const test of tests) {
  console.log(`\n${test.name}:`);
  const result = validator.validate(test.code);
  console.log('  Errors:', result.errors.map(e => e.code));
  console.log('  Warnings:', result.warnings.map(e => e.code));
}

