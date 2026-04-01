/**
 * chartBraille.ts
 * Generates ASCII BRF strings representing data charts mapped to a 6-dot braille cell grid.
 *
 * Phase C (future): optional axis ticks/labels with compact numeric vs vertical-word encoding;
 * see chartAdvanced.ts. Chart label numeric-indicator policy is a product convention, not enforced here.
 */

import type { ChartSpec } from '../types/chart';

// Mapping of ASCII BRF characters [0x20-0x5F] to their Unicode Braille pattern offsets (0-63)
const BRF_TO_UNICODE_OFFSETS = [
    0x00, 0x2E, 0x10, 0x3C, 0x2B, 0x29, 0x2F, 0x04,
    0x37, 0x3E, 0x21, 0x2C, 0x20, 0x24, 0x28, 0x0C,
    0x34, 0x02, 0x06, 0x12, 0x32, 0x22, 0x16, 0x36,
    0x26, 0x14, 0x31, 0x30, 0x23, 0x3F, 0x1C, 0x39,
    0x08, 0x01, 0x03, 0x09, 0x19, 0x11, 0x0B, 0x1B,
    0x13, 0x0A, 0x1A, 0x05, 0x07, 0x0D, 0x1D, 0x15,
    0x0F, 0x1F, 0x17, 0x0E, 0x1E, 0x25, 0x27, 0x3A,
    0x2D, 0x3D, 0x35, 0x2A, 0x33, 0x3B, 0x18, 0x38
];

// Inverted map: from Unicode dot offset (0-63) to ASCII BRF character code
const UNICODE_OFFSET_TO_ASCII = new Array(64).fill(0x20); // space is 0x20
for (let i = 0; i < BRF_TO_UNICODE_OFFSETS.length; i++) {
    UNICODE_OFFSET_TO_ASCII[BRF_TO_UNICODE_OFFSETS[i]] = 0x20 + i;
}

export class GridCanvas {
    public width: number;
    public height: number;
    public data: boolean[][];

    constructor(cellColumns: number, cellLines: number) {
        // Each braille cell is 2 dots wide, 3 dots high
        this.width = cellColumns * 2;
        this.height = cellLines * 3;
        // initialized to false (empty)
        this.data = Array.from({ length: this.height }, () => Array(this.width).fill(false));
    }

    setPoint(x: number, y: number) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.data[y][x] = true;
        }
    }

    drawLine(x0: number, y0: number, x1: number, y1: number) {
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.setPoint(x0, y0);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    /**
     * Renders the 2D boolean grid into standard ASCII BRF text.
     */
    renderToBRF(): string {
        const lines: string[] = [];
        const charWidth = Math.floor(this.width / 2);
        const charHeight = Math.floor(this.height / 3);

        for (let cy = 0; cy < charHeight; cy++) {
            let rowStr = '';
            for (let cx = 0; cx < charWidth; cx++) {
                let offset = 0;
                
                // Read 6 logical dots for this 2x3 cell block
                if (this.data[cy * 3][cx * 2])         offset += 0x01; // Dot 1 (top-left)
                if (this.data[cy * 3 + 1][cx * 2])     offset += 0x02; // Dot 2 (middle-left)
                if (this.data[cy * 3 + 2][cx * 2])     offset += 0x04; // Dot 3 (bottom-left)
                if (this.data[cy * 3][cx * 2 + 1])     offset += 0x08; // Dot 4 (top-right)
                if (this.data[cy * 3 + 1][cx * 2 + 1]) offset += 0x10; // Dot 5 (middle-right)
                if (this.data[cy * 3 + 2][cx * 2 + 1]) offset += 0x20; // Dot 6 (bottom-right)

                const asciiCode = UNICODE_OFFSET_TO_ASCII[offset];
                rowStr += String.fromCharCode(asciiCode);
            }
            lines.push(rowStr);
        }

        return lines.join('\n');
    }
}

/** Full chart BRF from a validated ChartSpec (single series). */
export function generateChartBrf(spec: ChartSpec): string {
    if (spec.kind === 'line') {
        return generateLineChart(spec.values, spec.cellsWidth, spec.cellsHeight);
    }
    return generateBarChart(spec.values, spec.cellsWidth, spec.cellsHeight);
}

/**
 * Plain-English summary and value list for screen readers and embossing clarity.
 * Insert above the :::chart block; the editor translates this text with the active table.
 */
export function buildChartSummaryPlainText(spec: ChartSpec): string {
    const v = spec.values;
    if (v.length === 0) return '';

    const kindLabel = spec.kind === 'line' ? 'Line chart' : 'Bar chart';
    const lines: string[] = [];

    const head = spec.title?.trim()
        ? `${kindLabel}: ${spec.title.trim()}`
        : `${kindLabel}`;
    lines.push(head);
    lines.push(
        `Grid ${spec.cellsWidth} cells wide by ${spec.cellsHeight} lines tall. ` +
            `${v.length} point${v.length === 1 ? '' : 's'}.`
    );

    const min = Math.min(...v);
    const max = Math.max(...v);
    lines.push(`Range: minimum ${min}, maximum ${max}.`);

    if (spec.xAxisLabel?.trim() || spec.yAxisLabel?.trim()) {
        const xl = spec.xAxisLabel?.trim();
        const yl = spec.yAxisLabel?.trim();
        const parts: string[] = [];
        if (yl) parts.push(`Y-axis: ${yl}`);
        if (xl) parts.push(`X-axis: ${xl}`);
        lines.push(parts.join('. ') + '.');
    }

    lines.push('Values (index: value):');
    v.forEach((n, i) => {
        lines.push(`  ${i + 1}: ${n}`);
    });

    return lines.join('\n');
}

export function generateLineChart(data: number[], cellsWidth: number, cellsHeight: number): string {
    if (data.length === 0) return '';
    // Use a minimum of 2x2 cells
    cellsWidth = Math.max(2, cellsWidth);
    cellsHeight = Math.max(2, cellsHeight);

    const canvas = new GridCanvas(cellsWidth, cellsHeight);
    
    // Y-axis (left edge), X-axis (bottom edge)
    canvas.drawLine(0, 0, 0, canvas.height - 1);
    canvas.drawLine(0, canvas.height - 1, canvas.width - 1, canvas.height - 1);

    const minYield = Math.min(...data);
    let maxYield = Math.max(...data);
    if (minYield === maxYield) {
        maxYield += 1;
    }

    const drawW = canvas.width - 2;
    const drawH = canvas.height - 2;

    const stepX = drawW / Math.max(1, data.length - 1);

    const points = data.map((val, i) => {
        const x = 1 + Math.round(i * stepX);
        const yNorm = (val - minYield) / (maxYield - minYield);
        const y = (canvas.height - 2) - Math.round(yNorm * drawH);
        return { x, y };
    });

    for (let i = 0; i < points.length - 1; i++) {
        canvas.drawLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    return canvas.renderToBRF();
}

export function generateBarChart(data: number[], cellsWidth: number, cellsHeight: number): string {
    if (data.length === 0) return '';
    cellsWidth = Math.max(2, cellsWidth);
    cellsHeight = Math.max(2, cellsHeight);

    const canvas = new GridCanvas(cellsWidth, cellsHeight);
    
    // Y-axis (left edge), X-axis (bottom edge)
    canvas.drawLine(0, 0, 0, canvas.height - 1);
    canvas.drawLine(0, canvas.height - 1, canvas.width - 1, canvas.height - 1);

    const maxYield = Math.max(...data, 1);

    const drawW = canvas.width - 2;
    const drawH = canvas.height - 2;

    const barAreaWidth = drawW / data.length;
    // Leave some space between bars if possible
    const barWidth = Math.max(1, Math.floor(barAreaWidth * 0.8));

    data.forEach((val, i) => {
        // Center the bar in its segment
        const xStart = 1 + Math.round(i * barAreaWidth + (barAreaWidth - barWidth) / 2);
        const yNorm = Math.max(0, val / maxYield); // Don't let negative logic break it
        const barH = Math.round(yNorm * drawH);
        const yEnd = canvas.height - 2;
        const yStart = yEnd - barH;

        for (let x = xStart; x < xStart + barWidth; x++) {
            canvas.drawLine(x, yStart, x, yEnd);
        }
    });

    return canvas.renderToBRF();
}
