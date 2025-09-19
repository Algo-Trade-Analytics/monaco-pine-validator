/**
 * Map Validation Tests (TDD)
 * 
 * Comprehensive tests for Pine Script v6 Map functions validation.
 * Following TDD principles: Write tests first, then implement the validator.
 * 
 * Priority 1.1: CRITICAL GAPS - Map Functions (0% Coverage)
 */

import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../..';

describe('Map Validation (TDD)', () => {
  const createValidator = () => new EnhancedModularValidator({
    version: '6',
    scriptType: 'indicator',
    strictMode: true,
    enableWarnings: true
  });

  describe('PSV6-MAP-DECLARATION: Map Declaration Syntax Validation', () => {
    it('should validate correct map declaration syntax', () => {
      const code = `
//@version=6
indicator("Map Test")

// Correct map declarations
myMap = map.new<string>()
intMap = map.new<int>()
floatMap = map.new<float>()
boolMap = map.new<bool>()
colorMap = map.new<color>()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid map declaration syntax', () => {
      const code = `
//@version=6
indicator("Map Test")

// Invalid map declarations
invalidMap = map.new<string, int>()  // Multiple type parameters
badMap = map.new()                   // Missing type parameter
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MAP-DECLARATION')).toBe(true);
    });

    it('should validate map type annotations', () => {
      const code = `
//@version=6
indicator("Map Test")

// Type-annotated map declarations
stringMap: map<string> = map.new<string>()
intMap: map<int> = map.new<int>()
floatMap: map<float> = map.new<float>()
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on map type mismatch', () => {
      const code = `
//@version=6
indicator("Map Test")

// Type mismatch
stringMap: map<int> = map.new<string>()  // Wrong type
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MAP-TYPE-MISMATCH')).toBe(true);
    });
  });

  describe('PSV6-MAP-OPERATIONS: Map Operations Validation', () => {
    it('should validate correct map operations', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<string>()
map.put(myMap, "key1", "value1")
map.put(myMap, "key2", "value2")
value1 = map.get(myMap, "key1")
hasKey = map.contains(myMap, "key1")
mapSize = map.size(myMap)
map.remove(myMap, "key1")
map.clear(myMap)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on map operations on non-map variables', () => {
      const code = `
//@version=6
indicator("Map Test")

notMap = "string"
map.put(notMap, "key", "value")  // Error: not a map
map.get(notMap, "key")           // Error: not a map
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MAP-OPERATION-NON-MAP')).toBe(true);
    });

    it('should validate map key and value types', () => {
      const code = `
//@version=6
indicator("Map Test")

stringMap = map.new<string>()
intMap = map.new<int>()

// Correct usage
map.put(stringMap, "key", "value")
map.put(intMap, "key", 123)

// Type mismatches
map.put(stringMap, "key", 123)    // Error: int value in string map
map.put(intMap, "key", "value")   // Error: string value in int map
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MAP-VALUE-TYPE-MISMATCH')).toBe(true);
    });

    it('should validate map contains operation', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<string>()
map.put(myMap, "key", "value")
exists = map.contains(myMap, "key")
notExists = map.contains(myMap, "nonexistent")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate map includes operation', () => {
      const code = `
//@version=6
indicator("Map Includes Test")

myMap = map.new<string>()
map.put(myMap, "first", "value1")
map.put(myMap, "second", "value2")
hasValue = map.includes(myMap, "value2")
missingValue = map.includes(myMap, "value3")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-MAP-METHODS: Map Method Validation', () => {
    it('should validate map method parameters', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<string>()
keys = map.keys(myMap)
values = map.values(myMap)
copy = map.copy(myMap)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on invalid map method parameters', () => {
      const code = `
//@version=6
indicator("Map Test")

// Wrong parameter count
keys = map.keys()           // Error: missing map parameter
size = map.size(myMap, 1)   // Error: too many parameters
      `;

      const result = createValidator().validate(code);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'PSV6-MAP-METHOD-PARAMS')).toBe(true);
    });

    it('should validate map method return types', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<string>()
map.put(myMap, "key", "value")

// Correct return type usage
keys: array<string> = map.keys(myMap)
values: array<string> = map.values(myMap)
size: int = map.size(myMap)
contains: bool = map.contains(myMap, "key")
value: string = map.get(myMap, "key")
copy: map<string> = map.copy(myMap)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-MAP-PERFORMANCE: Map Performance Validation', () => {
    it('should warn on expensive map operations in loops', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<string>()
for i = 0 to 100
    map.put(myMap, "key" + str.tostring(i), "value")
    map.get(myMap, "key" + str.tostring(i))
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-MAP-PERF-LOOP')).toBe(true);
    });

    it('should warn on too many map allocations', () => {
      const code = `
//@version=6
indicator("Map Test")

// Too many map allocations
map1 = map.new<string>()
map2 = map.new<string>()
map3 = map.new<string>()
map4 = map.new<string>()
map5 = map.new<string>()
map6 = map.new<string>()
map7 = map.new<string>()
map8 = map.new<string>()
map9 = map.new<string>()
map10 = map.new<string>()
map11 = map.new<string>()
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-MAP-PERF-ALLOCATION')).toBe(true);
    });

    it('should warn on large map operations', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<string>()
// Simulate large map operations
for i = 0 to 1000
    map.put(myMap, "key" + str.tostring(i), "value")
      `;

      const result = createValidator().validate(code);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'PSV6-MAP-PERF-LARGE')).toBe(true);
    });
  });

  describe('PSV6-MAP-BEST-PRACTICES: Map Best Practices', () => {
    it('should suggest better map naming conventions', () => {
      const code = `
//@version=6
indicator("Map Test")

// Poor naming
m = map.new<string>()
map1 = map.new<string>()
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-MAP-NAMING')).toBe(true);
    });

    it('should suggest map initialization best practices', () => {
      const code = `
//@version=6
indicator("Map Test")

// Uninitialized map usage
myMap = map.new<string>()
value = map.get(myMap, "nonexistent")  // Should suggest checking contains() first
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-MAP-INITIALIZATION')).toBe(true);
    });

    it('should suggest map memory management', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<string>()
// Map created but never cleared
      `;

      const result = createValidator().validate(code);
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info.some(i => i.code === 'PSV6-MAP-MEMORY')).toBe(true);
    });
  });

  describe('PSV6-MAP-COMPLEX: Complex Map Scenarios', () => {
    it('should handle nested map operations', () => {
      const code = `
//@version=6
indicator("Map Test")

outerMap = map.new<map<string>>()
innerMap = map.new<string>()
map.put(innerMap, "key", "value")
map.put(outerMap, "outerKey", innerMap)

// Access nested map
retrieved = map.get(outerMap, "outerKey")
value = map.get(retrieved, "key")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle map in function parameters', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<string>()

f(mapParam) =>
    map.put(mapParam, "key", "value")
    map.get(mapParam, "key")

result = f(myMap)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle map copying and operations', () => {
      const code = `
//@version=6
indicator("Map Test")

originalMap = map.new<string>()
map.put(originalMap, "key1", "value1")
map.put(originalMap, "key2", "value2")

// Copy map
copiedMap = map.copy(originalMap)

// Modify original
map.put(originalMap, "key3", "value3")

// Verify copy is independent
hasKey3 = map.contains(copiedMap, "key3")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PSV6-MAP-EDGE-CASES: Map Edge Cases', () => {
    it('should handle map with na values', () => {
      const code = `
//@version=6
indicator("Map Test")

myMap = map.new<float>()
map.put(myMap, "key", na)
value = map.get(myMap, "key")
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty map operations', () => {
      const code = `
//@version=6
indicator("Map Test")

emptyMap = map.new<string>()
size = map.size(emptyMap)
keys = map.keys(emptyMap)
values = map.values(emptyMap)
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle map.clear() on empty map', () => {
      const code = `
//@version=6
indicator("Map Test")

emptyMap = map.new<string>()
map.clear(emptyMap)  // Should be safe
      `;

      const result = createValidator().validate(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
