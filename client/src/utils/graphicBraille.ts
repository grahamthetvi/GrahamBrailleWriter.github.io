import { GridCanvas } from './chartBraille';
import type { GraphicSpec } from '../types/graphic';

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

  drawFreehand(points: { x: number; y: number }[]) {
    if (points.length === 0) return;
    for (let i = 0; i < points.length - 1; i++) {
      this.drawLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
  }
}

export function generateGraphicBrf(spec: GraphicSpec): string {
  const canvas = new GraphicCanvas(spec.width, spec.height);

  for (const shape of spec.shapes) {
    switch (shape.type) {
      case 'polygon':
        canvas.drawPolygon(shape.x, shape.y, shape.radius, shape.sides, shape.angle);
        break;
      case 'clock':
        canvas.drawClock(shape.x, shape.y, shape.radius, shape.hours, shape.minutes);
        break;
      case 'fraction':
        canvas.drawFraction(shape.x, shape.y, shape.radius, shape.numerator, shape.denominator);
        break;
      case 'base10':
        canvas.drawBase10(shape.x, shape.y, shape.hundreds, shape.tens, shape.ones);
        break;
      case 'manipulatives':
        canvas.drawManipulatives(shape.x, shape.y, shape.rows, shape.cols, shape.spacing);
        break;
      case 'numberLine':
        canvas.drawNumberLine(shape.x, shape.y, shape.length, shape.start, shape.end, shape.step, shape.isVertical);
        break;
      case 'freehand':
        canvas.drawFreehand(shape.points);
        break;
    }
  }

  return canvas.renderToBRF();
}
