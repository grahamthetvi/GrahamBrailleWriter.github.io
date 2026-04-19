/**
 * Structured chart data for the chart generator and BRF emitters.
 * All rendering flows from ChartSpec — not ad hoc string parsing.
 */

export type ChartKind = 'line' | 'bar';

/** Single-series chart (line or bar); multi-series can extend this later. */
export interface ChartSpec {
  kind: ChartKind;
  /** Y value per point */
  values: number[];
  /** X coordinate per point; same length as values (often 0..n-1 when only Y was entered). */
  xValues: number[];
  cellsWidth: number;
  cellsHeight: number;
  /** Optional labels for the plain-text summary (numeric axis labels are not drawn in the tactile bitmap). */
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  landscape?: boolean;
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

  if (spec.values.length !== spec.xValues.length) {
    errors.push('X and Y must have the same number of values.');
  }

  spec.values.forEach((v, i) => {
    if (!Number.isFinite(v)) {
      errors.push(`Invalid Y value at position ${i + 1}.`);
    }
  });

  spec.xValues.forEach((v, i) => {
    if (!Number.isFinite(v)) {
      errors.push(`Invalid X value at position ${i + 1}.`);
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

const CSV_Y_ONLY_AMBIGUOUS =
  'That paste looks like multiple columns. Use one Y value per line, one line of comma-separated Y values, or two columns (X, Y) on every line.';

function finiteNumbersInRow(cells: string[]): number[] {
  const out: number[] = [];
  for (const c of cells) {
    if (c === '') continue;
    const n = parseFloat(c);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Parse CSV-ish paste for **Y-only** series: safe cases only.
 *
 * - One non-empty line: all numbers on that line are Y values (in order).
 * - Several lines: each line must contribute exactly one number (Y), or the paste is rejected
 *   so we do not flatten multi-column grids into a single series by mistake.
 *
 * Optional header row is skipped when the first row is not all-numeric.
 * On ambiguous multi-column data, returns `values: []` and `error` set.
 */
export function parseCsvRows(csv: string): {
  values: number[];
  rowCount: number;
  columnCount: number;
  error?: string;
} {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { values: [], rowCount: 0, columnCount: 0 };
  }

  const rows = lines.map((line) => line.split(/[,;\t]/).map((c) => c.trim()));
  const columnCount = Math.max(...rows.map((r) => r.length));

  const allNumeric = (cells: string[]) =>
    cells.every((c) => c !== '' && !Number.isNaN(parseFloat(c)));

  let startRow = 0;
  if (rows[0].length > 0 && !allNumeric(rows[0].filter((c) => c !== ''))) {
    startRow = 1;
  }

  const dataRows = rows.slice(startRow);
  if (dataRows.length === 0) {
    return { values: [], rowCount: 0, columnCount };
  }

  const numsPerRow = dataRows.map((cells) => finiteNumbersInRow(cells));

  if (numsPerRow.some((nr) => nr.length === 0)) {
    return { values: [], rowCount: dataRows.length, columnCount, error: 'No numeric values found in pasted text.' };
  }

  if (dataRows.length === 1) {
    return {
      values: numsPerRow[0],
      rowCount: 1,
      columnCount,
    };
  }

  const lengths = numsPerRow.map((nr) => nr.length);
  const uniform = lengths.every((l) => l === lengths[0]);
  if (uniform && lengths[0] === 1) {
    return {
      values: numsPerRow.map((nr) => nr[0]),
      rowCount: dataRows.length,
      columnCount,
    };
  }

  return {
    values: [],
    rowCount: dataRows.length,
    columnCount,
    error: CSV_Y_ONLY_AMBIGUOUS,
  };
}

/**
 * Parse comma-separated numbers; empty segments are skipped. Non-numeric tokens are errors.
 */
export function parseCommaSeparatedNumbers(s: string): { numbers: number[]; errors: string[] } {
  const trimmed = s.trim();
  if (!trimmed) {
    return { numbers: [], errors: [] };
  }
  const parts = trimmed.split(',').map((p) => p.trim());
  const numbers: number[] = [];
  const errors: string[] = [];
  for (const part of parts) {
    if (part === '') continue;
    const n = parseFloat(part);
    if (!Number.isFinite(n)) {
      errors.push(`Invalid number: "${part}".`);
    } else {
      numbers.push(n);
    }
  }
  return { numbers, errors };
}
