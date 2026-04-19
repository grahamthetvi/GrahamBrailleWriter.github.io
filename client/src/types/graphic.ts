export type GraphicShapeType = 'polygon' | 'clock' | 'fraction' | 'base10' | 'manipulatives' | 'numberLine' | 'freehand';

export interface GraphicShapeBase {
  id: string;
  type: GraphicShapeType;
  x: number;
  y: number;
}

export interface PolygonShape extends GraphicShapeBase {
  type: 'polygon';
  radius: number;
  sides: number;
  angle: number; // rotation angle in degrees
}

export interface ClockShape extends GraphicShapeBase {
  type: 'clock';
  radius: number;
  hours: number;
  minutes: number;
}

export interface FractionShape extends GraphicShapeBase {
  type: 'fraction';
  radius: number;
  numerator: number;
  denominator: number;
}

export interface Base10Shape extends GraphicShapeBase {
  type: 'base10';
  hundreds: number;
  tens: number;
  ones: number;
}

export interface ManipulativesShape extends GraphicShapeBase {
  type: 'manipulatives';
  rows: number;
  cols: number;
  spacing: number;
}

export interface NumberLineShape extends GraphicShapeBase {
  type: 'numberLine';
  length: number;
  start: number;
  end: number;
  step: number;
  isVertical: boolean;
}

export interface FreehandShape extends GraphicShapeBase {
  type: 'freehand';
  points: { x: number; y: number }[];
}

export type GraphicShape =
  | PolygonShape
  | ClockShape
  | FractionShape
  | Base10Shape
  | ManipulativesShape
  | NumberLineShape
  | FreehandShape;

export interface GraphicSpec {
  version: number;
  width: number; // in braille cells
  height: number; // in braille lines
  shapes: GraphicShape[];
}
