import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const TRENDMASTER_SNIPPET = `//@version=6
strategy("Test")

pivotTypeInput = "Traditional"
localPivotTimeframeChange = timeframe.change("1D")
securityPivotTimeframeChange = timeframe.change(timeframe.period)

type pivotGraphic
    line pivotLine
    label pivotLabel

var drawnGraphics = matrix.new<pivotGraphic>()

localPivots = ta.pivot_point_levels(pivotTypeInput, localPivotTimeframeChange)
securityPivotPointsArray = ta.pivot_point_levels(pivotTypeInput,
securityPivotTimeframeChange)

[securityPivots, securityPivotCounter] = request.security(syminfo.tickerid, "1D",
[securityPivotPointsArray, securityPivotTimeframeChange], lookahead = barmerge.lookahead_on)
`;

describe('TrendMaster Regression', () => {
  const validator = new EnhancedModularValidator();

  it('reports only indentation wrap errors for the TrendMaster snippet', () => {
    const result = validator.validate(TRENDMASTER_SNIPPET);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);

    const errorCodes = new Set(result.errors.map((err) => err.code));
    expect(errorCodes).toEqual(new Set(['PSV6-INDENT-WRAP-INSUFFICIENT']));
  });
});
