import { GridCanvas } from './chartBraille';

export class GraphicCanvas extends GridCanvas {
  constructor(cellColumns: number, cellLines: number) {
    super(cellColumns, cellLines);
  }

  drawCircle(cx: number, cy: number, radius: number) {
    let x = radius;
    let y = 0;
    let err = 0;

    while (x >= y) {
      this.setPoint(cx + x, cy + y);
      this.setPoint(cx + y, cy + x);
      this.setPoint(cx - y, cy + x);
      this.setPoint(cx - x, cy + y);
      this.setPoint(cx - x, cy - y);
      this.setPoint(cx - y, cy - x);
      this.setPoint(cx + y, cy - x);
      this.setPoint(cx + x, cy - y);

      if (err <= 0) {
        y += 1;
        err += 2 * y + 1;
      }
      if (err > 0) {
        x -= 1;
        err -= 2 * x + 1;
      }
    }
  }

  drawPolygon(cx: number, cy: number, radius: number, sides: number, angleDegrees: number) {
    if (sides < 3) return;
    const points: { x: number; y: number }[] = [];
    const angleRad = (angleDegrees * Math.PI) / 180;
    for (let i = 0; i < sides; i++) {
      const theta = angleRad + (i * 2 * Math.PI) / sides;
      points.push({
        x: cx + radius * Math.cos(theta),
        y: cy + radius * Math.sin(theta),
      });
    }
    for (let i = 0; i < sides; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % sides];
      this.drawLine(p1.x, p1.y, p2.x, p2.y);
    }
  }

  drawClock(cx: number, cy: number, radius: number, hours: number, minutes: number) {
    this.drawCircle(cx, cy, radius);
    // Draw tick marks
    for (let i = 0; i < 12; i++) {
      const theta = (i * 2 * Math.PI) / 12;
      const x1 = cx + radius * 0.8 * Math.cos(theta);
      const y1 = cy + radius * 0.8 * Math.sin(theta);
      const x2 = cx + radius * Math.cos(theta);
      const y2 = cy + radius * Math.sin(theta);
      this.drawLine(x1, y1, x2, y2);
    }
    // Minute hand
    const minTheta = (minutes * 2 * Math.PI) / 60 - Math.PI / 2;
    this.drawLine(cx, cy, cx + radius * 0.8 * Math.cos(minTheta), cy + radius * 0.8 * Math.sin(minTheta));
    // Hour hand
    const hourTheta = ((hours % 12 + minutes / 60) * 2 * Math.PI) / 12 - Math.PI / 2;
    this.drawLine(cx, cy, cx + radius * 0.5 * Math.cos(hourTheta), cy + radius * 0.5 * Math.sin(hourTheta));
  }

  drawFraction(cx: number, cy: number, radius: number, numerator: number, denominator: number) {
    if (denominator <= 0) return;
    this.drawCircle(cx, cy, radius);
    for (let i = 0; i < denominator; i++) {
      const theta = (i * 2 * Math.PI) / denominator - Math.PI / 2;
      this.drawLine(cx, cy, cx + radius * Math.cos(theta), cy + radius * Math.sin(theta));
    }
    // Fill numerator sectors with dots
    for (let i = 0; i < numerator; i++) {
      const theta1 = (i * 2 * Math.PI) / denominator - Math.PI / 2;
      const theta2 = ((i + 1) * 2 * Math.PI) / denominator - Math.PI / 2;
      const midTheta = (theta1 + theta2) / 2;
      for (let r = 2; r < radius - 1; r += 2) {
        this.setPoint(Math.round(cx + r * Math.cos(midTheta)), Math.round(cy + r * Math.sin(midTheta)));
      }
    }
  }

  drawBase10(x: number, y: number, hundreds: number, tens: number, ones: number) {
    let currentX = x;
    const blockH = 10;
    const blockW = 10;

    // Hundreds (10x10 squares)
    for (let i = 0; i < hundreds; i++) {
      this.drawPolygon(currentX + blockW / 2, y + blockH / 2, blockW / 2, 4, 45); // Approximate square
      currentX += blockW + 2;
    }

    // Tens (1x10 lines)
    for (let i = 0; i < tens; i++) {
      this.drawLine(currentX, y, currentX, y + blockH);
      currentX += 3;
    }

    // Ones (1x1 dots)
    for (let i = 0; i < ones; i++) {
      this.setPoint(currentX, y + blockH);
      currentX += 3;
    }
  }

  drawManipulatives(x: number, y: number, rows: number, cols: number, spacing: number) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.drawCircle(x + c * spacing, y + r * spacing, 2);
      }
    }
  }

  drawNumberLine(x: number, y: number, length: number, start: number, end: number, step: number, isVertical: boolean) {
    if (isVertical) {
      this.drawLine(x, y, x, y + length);
      const numTicks = Math.floor((end - start) / step) + 1;
      const tickSpacing = length / (numTicks - 1 || 1);
      for (let i = 0; i < numTicks; i++) {
        const tickY = y + i * tickSpacing;
        this.drawLine(x - 2, tickY, x + 2, tickY);
      }
    } else {
      this.drawLine(x, y, x + length, y);
      const numTicks = Math.floor((end - start) / step) + 1;
      const tickSpacing = length / (numTicks - 1 || 1);
      for (let i = 0; i < numTicks; i++) {
        const tickX = x + i * tickSpacing;
        this.drawLine(tickX, y - 2, tickX, y + 2);
      }
    }
  }
}

export interface GraphicResult {
  brf: string;
  summary: string;
}

export function generateClock(radius: number, hours: number, minutes: number): GraphicResult {
  const cellsW = Math.ceil((radius * 2) / 2) + 2;
  const cellsH = Math.ceil((radius * 2) / 3) + 2;
  const canvas = new GraphicCanvas(cellsW, cellsH);
  canvas.drawClock(cellsW, cellsH * 1.5, radius, hours, minutes);
  
  return {
    brf: canvas.renderToBRF(),
    summary: `Clock showing ${hours}:${minutes.toString().padStart(2, '0')}`
  };
}

export function generateFraction(radius: number, numerator: number, denominator: number): GraphicResult {
  const cellsW = Math.ceil((radius * 2) / 2) + 2;
  const cellsH = Math.ceil((radius * 2) / 3) + 2;
  const canvas = new GraphicCanvas(cellsW, cellsH);
  canvas.drawFraction(cellsW, cellsH * 1.5, radius, numerator, denominator);
  
  return {
    brf: canvas.renderToBRF(),
    summary: `Fraction circle showing ${numerator} out of ${denominator}`
  };
}

export function generateNumberLine(length: number, start: number, end: number, step: number, isVertical: boolean): GraphicResult {
  let cellsW = 2;
  let cellsH = 2;
  if (isVertical) {
    cellsH = Math.ceil(length / 3) + 2;
    cellsW = 4;
  } else {
    cellsW = Math.ceil(length / 2) + 2;
    cellsH = 4;
  }
  const canvas = new GraphicCanvas(cellsW, cellsH);
  canvas.drawNumberLine(2, 2, length, start, end, step, isVertical);
  
  return {
    brf: canvas.renderToBRF(),
    summary: `Number line from ${start} to ${end} with steps of ${step}`
  };
}

export function generateBase10(hundreds: number, tens: number, ones: number): GraphicResult {
  const widthDots = hundreds * 12 + tens * 3 + ones * 3 + 2;
  const heightDots = 12;
  const cellsW = Math.ceil(widthDots / 2) + 2;
  const cellsH = Math.ceil(heightDots / 3) + 2;
  const canvas = new GraphicCanvas(cellsW, cellsH);
  canvas.drawBase10(2, 2, hundreds, tens, ones);
  
  return {
    brf: canvas.renderToBRF(),
    summary: `Base-10 blocks showing ${hundreds} hundreds, ${tens} tens, and ${ones} ones`
  };
}

export function generateManipulatives(rows: number, cols: number, spacing: number): GraphicResult {
  const widthDots = cols * spacing + 4;
  const heightDots = rows * spacing + 4;
  const cellsW = Math.ceil(widthDots / 2) + 2;
  const cellsH = Math.ceil(heightDots / 3) + 2;
  const canvas = new GraphicCanvas(cellsW, cellsH);
  canvas.drawManipulatives(2, 2, rows, cols, spacing);
  
  return {
    brf: canvas.renderToBRF(),
    summary: `Array of manipulatives with ${rows} rows and ${cols} columns`
  };
}

export function generatePolygon(radius: number, sides: number, angle: number): GraphicResult {
  const cellsW = Math.ceil((radius * 2) / 2) + 2;
  const cellsH = Math.ceil((radius * 2) / 3) + 2;
  const canvas = new GraphicCanvas(cellsW, cellsH);
  canvas.drawPolygon(cellsW, cellsH * 1.5, radius, sides, angle);
  
  return {
    brf: canvas.renderToBRF(),
    summary: `Polygon with ${sides} sides`
  };
}
