import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';
import { ChevrotainAstService } from '../../core/ast/service';

const createValidator = () =>
  new EnhancedModularValidator({
    targetVersion: 6,
    strictMode: true,
    ast: { mode: 'primary', service: new ChevrotainAstService() },
  });

describe('Specialized strategy risk/commission enums (advanced)', () => {
  it('detects advanced strategy.risk constants', () => {
    const code = `//@version=6
strategy("Risk Advanced")

_a = strategy.risk.max_consecutive_losses
_b = strategy.risk.max_daily_loss
_c = strategy.risk.position_size_limit
plot(close)`;

    const result = createValidator().validate(code);
    expect(result.info.some(i => i.code === 'PSV6-SPECIALIZED-CONSTANT')).toBe(true);
  });

  it('detects extended strategy.commission constants', () => {
    const code = `//@version=6
strategy("Commission Advanced")

_a = strategy.commission.basis_points
_b = strategy.commission.per_share_tiered
plot(close)`;

    const result = createValidator().validate(code);
    expect(result.info.some(i => i.code === 'PSV6-SPECIALIZED-CONSTANT')).toBe(true);
  });
});

