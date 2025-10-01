import { EnhancedModularValidator } from './EnhancedModularValidator';

const tests = [
  {
    name: 'input.symbol',
    code: `
//@version=6
indicator("Symbol Input")

otherSymbol = input.symbol("NASDAQ:AAPL", title="Compare Symbol")
otherClose = request.security(otherSymbol, timeframe.period, close)
plot(otherClose)
    `
  },
  {
    name: 'input.timeframe',
    code: `
//@version=6
indicator("Timeframe Input")

tf = input.timeframe("D", title="Timeframe")
htfClose = request.security(syminfo.tickerid, tf, close)
plot(htfClose)
    `
  },
  {
    name: 'input.session',
    code: `
//@version=6
indicator("Session Input")

sessionTime = input.session("0930-1600", title="Session")
inSession = not na(time(timeframe.period, sessionTime))
bgcolor(inSession ? color.new(color.blue, 90) : na)
    `
  },
  {
    name: 'input.time',
    code: `
//@version=6
indicator("Time Input")

startTime = input.time(timestamp("01 Jan 2024 00:00 +0000"), title="Start Time")
afterStart = time >= startTime
bgcolor(afterStart ? color.new(color.green, 95) : na)
    `
  }
];

const validator = new EnhancedModularValidator();

for (const test of tests) {
  console.log(`\n=== ${test.name} ===`);
  const result = validator.validate(test.code);
  console.log('Valid:', result.isValid);
  console.log('Errors:', result.errors.map(e => ({ line: e.line, code: e.code, message: e.message })));
}

