const { EnhancedModularValidator } = require('./EnhancedModularValidator.ts');

const validator = new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enableWarnings: true
});

const code = `
//@version=6
indicator("String Test")

// Wrong parameter types
length = str.length(123)  // Error: should be string
`;

const result = validator.validate(code);
console.log('Error structure:');
console.log(JSON.stringify(result.errors[0], null, 2));
console.log('Error code:', result.errors[0].code);
console.log('Has code property:', 'code' in result.errors[0]);
console.log('Error keys:', Object.keys(result.errors[0]));
