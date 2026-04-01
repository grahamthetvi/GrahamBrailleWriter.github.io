/**
 * Phase C — optional renderer upgrades: axis ticks, compact horizontal numbers vs vertical words,
 * Graphs-inspired sampling. Not wired into the chart modal yet.
 *
 * Product convention: omit numeric indicators in chart-only labels where applicable; document in UI.
 */

import type { ChartSpec } from '../types/chart';

/** Placeholder for future tick/label BRF derived from ChartSpec. */
export function renderAxisTicksFromSpec(spec: ChartSpec): string {
    void spec;
    return '';
}
