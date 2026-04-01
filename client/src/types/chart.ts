/**
 * Structured chart data for the chart generator and BRF emitters.
 * All rendering flows from ChartSpec — not ad hoc string parsing.
 */

export type ChartKind = 'line' | 'bar';

/** Single-series chart (line or bar); multi-series can extend this later. */
export interface ChartSpec {
  kind: ChartKind;
  /** Y values; X is implicit index 0..n-1 */
  values: number[];
  cellsWidth: number;
  cellsHeight: number;
  /** Optional labels for accessibility / summary text (not yet drawn in bitmap Phase A–B). */
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export const CHART_LIMITS = {
  minPoints: 1,
  maxPoints: 512,
  cellsWidth: { min: 5, max: 80 },
  cellsHeight: { min: 5, max: 40 },
} as const;

export interface ChartValidationResult {
  ok: boolean;
  /** Human-readable messages for aria-live and UI (not color-only). */
  errors: string[];
}

function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n >= min && n <= max;
}

export function validateChartSpec(spec: ChartSpec): ChartValidationResult {
  const errors: string[] = [];

  if (!spec.values.length) {
    errors.push('Add at least one data point.');
  } else if (spec.values.length > CHART_LIMITS.maxPoints) {
    errors.push(`Too many points (maximum ${CHART_LIMITS.maxPoints}).`);
  }

  spec.values.forEach((v, i) => {
    if (!Number.isFinite(v)) {
      errors.push(`Invalid number at position ${i + 1}.`);
    }
  });

  if (!inRange(spec.cellsWidth, CHART_LIMITS.cellsWidth.min, CHART_LIMITS.cellsWidth.max)) {
    errors.push(
      `Width must be between ${CHART_LIMITS.cellsWidth.min} and ${CHART_LIMITS.cellsWidth.max} cells.`
    );
  }
  if (!inRange(spec.cellsHeight, CHART_LIMITS.cellsHeight.min, CHART_LIMITS.cellsHeight.max)) {
    errors.push(
      `Height must be between ${CHART_LIMITS.cellsHeight.min} and ${CHART_LIMITS.cellsHeight.max} lines.`
    );
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Parse CSV-ish paste: rows of numbers; first column used as Y if one column,
 * or first row as header skipped if non-numeric. Keeps numbers in row order (row-major).
 */
export function parseCsvRows(csv: string): { values: number[]; rowCount: number; columnCount: number } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { values: [], rowCount: 0, columnCount: 0 };
  }

  const rows = lines.map((line) =>
    line.split(/[,;\t]/).map((c) => c.trim())
  );
  const columnCount = Math.max(...rows.map((r) => r.length));

  const allNumeric = (cells: string[]) =>
    cells.every((c) => c !== '' && !Number.isNaN(parseFloat(c)));

  let startRow = 0;
  if (rows[0].length > 0 && !allNumeric(rows[0].filter((c) => c !== ''))) {
    startRow = 1;
  }

  const values: number[] = [];
  for (let r = startRow; r < rows.length; r++) {
    const cells = rows[r];
    for (let c = 0; c < cells.length; c++) {
      if (cells[c] === '') continue;
      const n = parseFloat(cells[c]);
      if (!Number.isNaN(n)) values.push(n);
    }
  }

  return {
    values,
    rowCount: rows.length - startRow,
    columnCount,
  };
}
