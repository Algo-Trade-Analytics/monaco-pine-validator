import { ChevrotainAstService } from './core/ast/service';

const service = new ChevrotainAstService();
const code = `//@version=6
indicator("Test")
complexFunc() =>
    if close > open
        if volume > ta.sma(volume, 20)
            if high > ta.highest(high, 10)
                if low < ta.lowest(low, 10)
                    if rsi > 70
                        if macd > 0
                            1
                        else
                            2
                    else
                        3
                else
                    4
            else
                5
        else
            6
    else
        7`;

const { ast, diagnostics } = service.parse(code, { filename: 'test.pine' });
console.log('Diagnostics', diagnostics);
console.log('AST null?', ast === null);
