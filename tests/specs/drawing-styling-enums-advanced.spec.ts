import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { createConstantAstService } from './ast-helpers';

const createValidator = () => new EnhancedModularValidator({
  targetVersion: 6,
  strictMode: true,
  ast: { mode: 'primary', service: createConstantAstService() },
});

describe('Advanced drawing/styling enums and display extensions', () => {
  it('detects extra text formatting constants', () => {
    const code = `//@version=6
indicator("Text Format Advanced")

fmt1 = text.format_bold_italic
fmt2 = text.format_underline
fmt3 = text.format_strikethrough
plot(close)`;

    const result = createValidator().validate(code);
    expect(result.info.some(i => i.code === 'PSV6-ADDITIONAL-CONSTANT')).toBe(true);
  });

  it('detects extra box/table styling constants', () => {
    const code = `//@version=6
indicator("Box/Table Styling Advanced")

bs = box.border_style_double
mh = table.cell_merge_horizontal
mv = table.cell_merge_vertical
plot(close)`;

    const result = createValidator().validate(code);
    expect(result.info.some(i => i.code === 'PSV6-SPECIALIZED-CONSTANT')).toBe(true);
  });

  it('detects extended display constants for specialized views', () => {
    const code = `//@version=6
indicator("Display Extended")
plot(close, display=display.price_scale_only)
plot(open, display=display.data_window_only)`;

    const result = createValidator().validate(code);
    const displayInfo = result.info.filter(i => i.code === 'PSV6-DISPLAY-CONSTANT');
    expect(displayInfo.length).toBeGreaterThanOrEqual(2);
  });
});

