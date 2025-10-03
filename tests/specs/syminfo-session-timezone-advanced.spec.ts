import { describe, it, expect } from 'vitest';
import { EnhancedModularValidator } from '../../EnhancedModularValidator';

const createValidator = () => new EnhancedModularValidator({ targetVersion: 6, strictMode: true });

describe('Advanced syminfo/session/timezone variables', () => {
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

});
