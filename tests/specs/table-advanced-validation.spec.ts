import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { expectHas } from './test-utils';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  enablePerformanceAnalysis: true,
});

describe('Table Advanced Functions Validation', () => {
  it('validates advanced table styling and cell setters', () => {
    const code = `//@version=6
indicator("Table Advanced")

// Create table
var t = table.new(position.top_right, 3, 2)

// Table styling
table.set_position(t, position.top_left)
table.set_bgcolor(t, color.new(color.blue, 80))
table.set_border_color(t, color.red)
table.set_border_width(t, 2)
table.set_frame_color(t, color.green)
table.set_frame_width(t, 3)

// Cell setters
table.cell_set_text(t, 0, 0, "Header")
table.cell_set_bgcolor(t, 0, 0, color.yellow)
table.cell_set_text_color(t, 0, 0, color.black)
table.cell_set_text_size(t, 0, 0, 12)
`;
    const r = createValidator().validate(code);
    expect(r.isValid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('errors on table.set_position wrong arity', () => {
    const code = `//@version=6
indicator("Table Set Position Error")
var t = table.new(position.top_left, 1, 1)
table.set_position(t)
`;
    const r = createValidator().validate(code);
    expectHas(r, { errors: ['PSV6-FUNCTION-PARAM-COUNT'] });
  });

  it('warns on invalid position constant', () => {
    const code = `//@version=6
indicator("Table Position Warn")
var t = table.new(position.top_left, 1, 1)
table.set_position(t, custom_position)
`;
    const r = createValidator().validate(code);
    expectHas(r, { warnings: ['PSV6-TABLE-POSITION-TYPE'] });
  });

  it('errors on string literal position type', () => {
    const code = `//@version=6
indicator("Table Position Type Error")
var t = table.new(position.top_left, 1, 1)
table.set_position(t, "top_left")
`;
    const r = createValidator().validate(code);
    expectHas(r, { errors: ['PSV6-FUNCTION-PARAM-TYPE'] });
  });

  it('validates table.set_bgcolor parameter types', () => {
    const code = `//@version=6
indicator("Table Bgcolor")
var t = table.new(position.top_left, 1, 1)
table.set_bgcolor(t, color.blue)
`;
    const r = createValidator().validate(code);
    expect(r.errors).toEqual([]);
  });

  it('warns on non-color table.set_bgcolor', () => {
    const code = `//@version=6
indicator("Table Bgcolor Warn")
var t = table.new(position.top_left, 1, 1)
table.set_bgcolor(t, 123)
`;
    const r = createValidator().validate(code);
    expectHas(r, { warnings: ['PSV6-TABLE-COLOR-TYPE'] });
  });

  it('validates table.set_border_width positive width', () => {
    const code = `//@version=6
indicator("Table Border Width")
var t = table.new(position.top_left, 1, 1)
table.set_border_width(t, 4)
`;
    const r = createValidator().validate(code);
    expect(r.errors).toEqual([]);
  });

  it('warns on table.set_border_width <= 0', () => {
    const code = `//@version=6
indicator("Table Border Width Warn")
var t = table.new(position.top_left, 1, 1)
table.set_border_width(t, 0)
`;
    const r = createValidator().validate(code);
    expectHas(r, { warnings: ['PSV6-TABLE-BORDER-WIDTH'] });
  });

  it('validates table.set_frame_* color and width', () => {
    const code = `//@version=6
indicator("Table Frame")
var t = table.new(position.top_left, 1, 1)
table.set_frame_color(t, color.new(color.red, 30))
table.set_frame_width(t, 2)
`;
    const r = createValidator().validate(code);
    expect(r.errors).toEqual([]);
  });

  it('warns on invalid cell text color', () => {
    const code = `//@version=6
indicator("Cell Text Color Warn")
var t = table.new(position.top_left, 1, 1)
table.cell_set_text_color(t, 0, 0, 42)
`;
    const r = createValidator().validate(code);
    expectHas(r, { warnings: ['PSV6-TABLE-CELL-COLOR-TYPE'] });
  });

  it('warns on invalid cell text size', () => {
    const code = `//@version=6
indicator("Cell Text Size Warn")
var t = table.new(position.top_left, 1, 1)
table.cell_set_text_size(t, 0, 0, 3)
`;
    const r = createValidator().validate(code);
    expectHas(r, { warnings: ['PSV6-TABLE-CELL-TEXT-SIZE'] });
  });

  it('errors on wrong arity for table.clear', () => {
    const code = `//@version=6
indicator("Table Clear Error")
var t = table.new(position.top_left, 1, 1)
table.clear()
`;
    const r = createValidator().validate(code);
    expectHas(r, { errors: ['PSV6-FUNCTION-PARAM-COUNT'] });
  });
});

