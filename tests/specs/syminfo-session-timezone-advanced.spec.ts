import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const createValidator = () => new EnhancedModularValidator({ targetVersion: 6, strictMode: true });

describe('Advanced syminfo/session/timezone variables', () => {
  it('detects specialized syminfo fundamental variables', () => {
    const code = `//@version=6
indicator("Syminfo Advanced")

mc = syminfo.market_cap
pe = syminfo.pe_ratio
dy = syminfo.dividend_yield
b = syminfo.beta
v30 = syminfo.avg_volume_30d
cs = syminfo.contract_size
tv = syminfo.tick_value
mr = syminfo.margin_requirement
plot(close)`;

    const result = createValidator().validate(code);
    // These should be reported as additional syminfo variables/constants
    expect(result.info.some(i => i.code === 'PSV6-SYMINFO-ADDITIONAL')).toBe(true);
  });

  it('detects advanced session and timezone variables', () => {
    const code = `//@version=6
indicator("Session/Timezone Advanced")

ext = session.isextended_hours
pm = session.premarket_start
am = session.postmarket_end
halt = session.trading_halt_status
tz = syminfo.timezone
plot(close)`;

    const result = createValidator().validate(code);
    // Additional constants info should include these
    const addInfo = result.info.filter(i => i.code === 'PSV6-ADDITIONAL-CONSTANT');
    expect(addInfo.length).toBeGreaterThanOrEqual(1);
  });

  it('detects extended syminfo fundamental variables', () => {
    const code = `//@version=6
indicator("Syminfo Fundamentals")

targetAvg = syminfo.target_price_average
targetHigh = syminfo.target_price_high
targetLow = syminfo.target_price_low
recommendBuy = syminfo.recommendations_buy
recommendStrongSell = syminfo.recommendations_sell_strong
volType = syminfo.volumetype
country = syminfo.country
sector = syminfo.sector

plot(close)`;

    const result = createValidator().validate(code);
    expect(result.info.some(i => i.code === 'PSV6-SYMINFO-ADDITIONAL')).toBe(true);
  });
});
