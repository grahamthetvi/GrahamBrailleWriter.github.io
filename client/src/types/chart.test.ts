import { describe, it, expect } from 'vitest';
import { validateChartSpec, parseCsvRows, CHART_LIMITS } from './chart';
import { buildChartSummaryPlainText } from '../utils/chartBraille';
import type { ChartSpec } from './chart';

function baseSpec(over: Partial<ChartSpec> = {}): ChartSpec {
    return {
        kind: 'line',
        values: [1, 2, 3],
        cellsWidth: 30,
        cellsHeight: 15,
        ...over,
    };
}

describe('validateChartSpec', () => {
    it('accepts valid spec', () => {
        const r = validateChartSpec(baseSpec());
        expect(r.ok).toBe(true);
        expect(r.errors).toHaveLength(0);
    });

    it('rejects empty values', () => {
        const r = validateChartSpec(baseSpec({ values: [] }));
        expect(r.ok).toBe(false);
    });

    it('rejects too many points', () => {
        const r = validateChartSpec(
            baseSpec({ values: new Array(CHART_LIMITS.maxPoints + 1).fill(0) })
        );
        expect(r.ok).toBe(false);
    });

    it('rejects out-of-range grid', () => {
        expect(validateChartSpec(baseSpec({ cellsWidth: 2 })).ok).toBe(false);
        expect(validateChartSpec(baseSpec({ cellsHeight: 2 })).ok).toBe(false);
    });
});

describe('parseCsvRows', () => {
    it('parses comma-separated line', () => {
        const { values, rowCount } = parseCsvRows('1, 2, 3');
        expect(values).toEqual([1, 2, 3]);
        expect(rowCount).toBe(1);
    });

    it('skips header row when non-numeric', () => {
        const { values } = parseCsvRows('x,y\n1,2\n3,4');
        expect(values.length).toBeGreaterThan(0);
    });
});

describe('buildChartSummaryPlainText', () => {
    it('includes title and value lines', () => {
        const text = buildChartSummaryPlainText(
            baseSpec({
                title: 'Test',
                values: [10, 20],
                kind: 'bar',
            })
        );
        expect(text).toContain('Bar chart: Test');
        expect(text).toContain('Values (index: value):');
        expect(text).toContain('1: 10');
        expect(text).toContain('2: 20');
    });
});
