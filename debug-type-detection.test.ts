import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from './EnhancedModularValidator';

describe('Debug Type Detection', () => {
  it('should not flag chart.point variables as enum types', () => {
    const validator = new EnhancedModularValidator();
    
    const script = `
//@version=6
indicator("Test")

type Point3D
    float x
    float y
    float z

type Camera
    int anchorX
    float anchorY

method project(Camera this, Point3D p) =>
    chart.point.from_index(0, 0)

if barstate.islast
    Camera cam = Camera.new(0, 0)
    Point3D top = Point3D.new(0, 0, 0)
    
    // These should not be flagged as enum types
    chart.point summitScreenPoint = cam.project(top)
    chart.point baseScreenPoint = cam.project(Point3D.new(0, 0, 0))
    
    // Property access should work
    float yMax = summitScreenPoint.price
    float yMin = baseScreenPoint.price
`;

    const result = validator.validate(script);
    
    console.log('\n=== TYPE DETECTION DEBUG ===');
    console.log('isValid:', result.isValid);
    console.log('Number of errors:', result.errors.length);
    console.log('Number of warnings:', result.warnings.length);
    console.log('Number of info:', result.info.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.code}: ${error.message}`);
        console.log(`   Line ${error.line}, Column ${error.column}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning.code}: ${warning.message}`);
        console.log(`   Line ${warning.line}, Column ${warning.column}`);
      });
    }
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
