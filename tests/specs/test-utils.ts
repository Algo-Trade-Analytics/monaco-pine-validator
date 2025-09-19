import { ValidationResult } from '../../core/types';

/**
 * Helper function to check if validation result has specific error codes
 */
export function expectHas(result: ValidationResult, expected: {
  errors?: string[];
  warnings?: string[];
  info?: string[];
}): void {
  if (expected.errors) {
    const errorCodes = result.errors.map(e => e.code).filter(Boolean);
    expect(errorCodes).toEqual(expect.arrayContaining(expected.errors));
  }
  
  if (expected.warnings) {
    const warningCodes = result.warnings.map(w => w.code).filter(Boolean);
    expect(warningCodes).toEqual(expect.arrayContaining(expected.warnings));
  }
  
  if (expected.info) {
    const infoCodes = result.info.map(i => i.code).filter(Boolean);
    expect(infoCodes).toEqual(expect.arrayContaining(expected.info));
  }
}

/**
 * Helper function to check if validation result has no errors
 */
export function expectNoErrors(result: ValidationResult): void {
  expect(result.errors).toEqual([]);
}

/**
 * Helper function to check if validation result has no warnings
 */
export function expectNoWarnings(result: ValidationResult): void {
  expect(result.warnings).toEqual([]);
}

/**
 * Helper function to check if validation result is valid
 */
export function expectValid(result: ValidationResult): void {
  expect(result.isValid).toBe(true);
}

/**
 * Helper function to check if validation result is invalid
 */
export function expectInvalid(result: ValidationResult): void {
  expect(result.isValid).toBe(false);
}

/**
 * Helper function to check if validation result lacks specific error codes
 */
export function expectLacks(result: ValidationResult, expected: {
  errors?: string[];
  warnings?: string[];
  info?: string[];
}): void {
  if (expected.errors) {
    const errorCodes = result.errors.map(e => e.code).filter(Boolean);
    expected.errors.forEach(code => {
      expect(errorCodes).not.toContain(code);
    });
  }
  
  if (expected.warnings) {
    const warningCodes = result.warnings.map(w => w.code).filter(Boolean);
    expected.warnings.forEach(code => {
      expect(warningCodes).not.toContain(code);
    });
  }
  
  if (expected.info) {
    const infoCodes = result.info.map(i => i.code).filter(Boolean);
    expected.info.forEach(code => {
      expect(infoCodes).not.toContain(code);
    });
  }
}
