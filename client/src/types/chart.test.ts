import { describe, it, expect } from 'vitest';
import { validateChartSpec, parseCsvRows, parseCommaSeparatedNumbers, CHART_LIMITS } from './chart';
import {
    buildChartSummaryPlainText,
    buildChartSummaryNemethPlainText,
    generateLineChart,
    generateBarChart,
} from '../utils/chartBraille';
import type { ChartSpec } from './chart';

function baseSpec(over: Partial<ChartSpec> = {}): ChartSpec {
    return {
        kind: 'line',
        xValues: [0, 1, 2],
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
        const r = validateChartSpec(baseSpec({ values: [], xValues: [] }));
        expect(r.ok).toBe(false);
    });

    it('rejects mismatched x and y lengths', () => {
        const r = validateChartSpec(baseSpec({ xValues: [0, 1] }));
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

describe('parseCommaSeparatedNumbers', () => {
    it('parses comma-separated numbers', () => {
        const { numbers, errors } = parseCommaSeparatedNumbers('1, 2, 3');
        expect(errors).toHaveLength(0);
        expect(numbers).toEqual([1, 2, 3]);
    });

    it('reports invalid tokens', () => {
        const { errors } = parseCommaSeparatedNumbers('1, bad, 3');
        expect(errors.length).toBeGreaterThan(0);
    });
});

describe('parseCsvRows', () => {
    it('parses comma-separated line', () => {
        const { values, rowCount, error } = parseCsvRows('1, 2, 3');
        expect(error).toBeUndefined();
        expect(values).toEqual([1, 2, 3]);
        expect(rowCount).toBe(1);
    });

    it('parses one number per line as Y series', () => {
        const { values, error } = parseCsvRows('1\n2\n3');
        expect(error).toBeUndefined();
        expect(values).toEqual([1, 2, 3]);
    });

    it('does not flatten multi-row multi-column grids into one series', () => {
        const { values, error } = parseCsvRows('x,y\n1,2\n3,4');
        expect(values).toEqual([]);
        expect(error).toBeDefined();
    });
});

describe('generateLineChart', () => {
    it('connects segments in ascending X order regardless of input order', () => {
        const w = 12;
        const h = 10;
        const unsorted = generateLineChart([2, 0, 1], [1, 2, 3], w, h);
        const sorted = generateLineChart([0, 1, 2], [2, 3, 1], w, h);
        expect(unsorted).toBe(sorted);
    });
});

describe('generateBarChart', () => {
    it('matches after permuting (x,y) pairs when sorted order is the same', () => {
        const w = 14;
        const h = 10;
        const a = generateBarChart([2, 0, 1], [10, 20, 30], w, h);
        const b = generateBarChart([0, 1, 2], [20, 30, 10], w, h);
        expect(a).toBe(b);
    });
});

describe('buildChartSummaryPlainText', () => {
    it('includes title and value lines', () => {
        const text = buildChartSummaryPlainText(
            baseSpec({
                title: 'Test',
                xValues: [0, 1],
                values: [10, 20],
                kind: 'bar',
            })
        );
        expect(text).toContain('Bar chart: Test');
        expect(text).toContain('Values (x, y):');
        expect(text).toContain('0: 10');
        expect(text).toContain('1: 20');
    });
});

describe('buildChartSummaryNemethPlainText', () => {
    it('uses literary kind/title lines and per-line $$ blocks', () => {
        const text = buildChartSummaryNemethPlainText(
            baseSpec({
                title: 'Sales',
                xValues: [2000, 2001, 2002, 2003],
                values: [1, 2, 3, 8],
                xAxisLabel: 'Year',
                yAxisLabel: 'Units',
            })
        );
        expect(text).toBe(
            [
                'Line chart:',
                'Sales',
                '$$Grid 30 cells wide by 15 lines tall. 4 points.$$',
                '$$Range: minimum 1, maximum 8.$$',
                '$$Y-axis: Units. X-axis: Year.$$',
                'Values (x, y):',
                '  $$2000: 1$$',
                '  $$2001: 2$$',
                '  $$2002: 3$$',
                '  $$2003: 8$$',
            ].join('\n')
        );
    });
});
