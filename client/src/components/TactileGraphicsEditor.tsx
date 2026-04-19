import { useState, useEffect } from 'react';
import type { GraphicSpec, GraphicShape, GraphicShapeType } from '../types/graphic';
import { generateGraphicBrf } from '../utils/graphicBraille';

interface TactileGraphicsEditorProps {
  initialSpec?: GraphicSpec;
  onInsert: (block: string) => void;
  onClose: () => void;
}

const DEFAULT_SPEC: GraphicSpec = {
  version: 1,
  width: 40,
  height: 25,
  shapes: [],
};

export function TactileGraphicsEditor({ initialSpec, onInsert, onClose }: TactileGraphicsEditorProps) {
  const [spec, setSpec] = useState<GraphicSpec>(initialSpec || DEFAULT_SPEC);
  const [selectedTool, setSelectedTool] = useState<GraphicShapeType | 'select'>('select');
  const [previewBrf, setPreviewBrf] = useState('');
  
  // Update preview whenever spec changes
  useEffect(() => {
    setPreviewBrf(generateGraphicBrf(spec));
  }, [spec]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'select') return;

    const rect = e.currentTarget.getBoundingClientRect();
    // Approximate mapping from screen pixels to braille dots
    // Assuming each braille cell is ~10px wide and 15px high, 2 dots wide, 3 dots high
    const x = Math.round(((e.clientX - rect.left) / rect.width) * (spec.width * 2));
    const y = Math.round(((e.clientY - rect.top) / rect.height) * (spec.height * 3));

    const newShapeId = Date.now().toString();

    let newShape: GraphicShape;
    switch (selectedTool) {
      case 'polygon':
        newShape = { id: newShapeId, type: 'polygon', x, y, radius: 10, sides: 3, angle: 0 };
        break;
      case 'clock':
        newShape = { id: newShapeId, type: 'clock', x, y, radius: 15, hours: 3, minutes: 0 };
        break;
      case 'fraction':
        newShape = { id: newShapeId, type: 'fraction', x, y, radius: 15, numerator: 1, denominator: 2 };
        break;
      case 'base10':
        newShape = { id: newShapeId, type: 'base10', x, y, hundreds: 1, tens: 2, ones: 3 };
        break;
      case 'manipulatives':
        newShape = { id: newShapeId, type: 'manipulatives', x, y, rows: 2, cols: 3, spacing: 5 };
        break;
      case 'numberLine':
        newShape = { id: newShapeId, type: 'numberLine', x, y, length: 30, start: 0, end: 10, step: 1, isVertical: false };
        break;
      case 'freehand':
        newShape = { id: newShapeId, type: 'freehand', x, y, points: [{ x, y }] };
        break;
      default:
        return;
    }

    setSpec(prev => ({ ...prev, shapes: [...prev.shapes, newShape] }));
    setSelectedTool('select'); // Reset to select after placing
  };

  const handleInsert = () => {
    const json = JSON.stringify(spec);
    const brf = generateGraphicBrf(spec);
    const block = `:::graphic\n${json}\n---\n${brf}\n:::\n`;
    onInsert(block);
  };

  const clearCanvas = () => {
    setSpec(prev => ({ ...prev, shapes: [] }));
  };

  return (
    <div className="tactile-graphics-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', background: 'var(--bg-card)', color: 'var(--text-color)' }}>
      <div className="toolbar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className={`toolbar-btn ${selectedTool === 'select' ? 'toolbar-btn--active' : ''}`} onClick={() => setSelectedTool('select')}>Select</button>
        <button className={`toolbar-btn ${selectedTool === 'polygon' ? 'toolbar-btn--active' : ''}`} onClick={() => setSelectedTool('polygon')}>Polygon</button>
        <button className={`toolbar-btn ${selectedTool === 'clock' ? 'toolbar-btn--active' : ''}`} onClick={() => setSelectedTool('clock')}>Clock</button>
        <button className={`toolbar-btn ${selectedTool === 'fraction' ? 'toolbar-btn--active' : ''}`} onClick={() => setSelectedTool('fraction')}>Fraction</button>
        <button className={`toolbar-btn ${selectedTool === 'base10' ? 'toolbar-btn--active' : ''}`} onClick={() => setSelectedTool('base10')}>Base-10</button>
        <button className={`toolbar-btn ${selectedTool === 'manipulatives' ? 'toolbar-btn--active' : ''}`} onClick={() => setSelectedTool('manipulatives')}>Manipulatives</button>
        <button className={`toolbar-btn ${selectedTool === 'numberLine' ? 'toolbar-btn--active' : ''}`} onClick={() => setSelectedTool('numberLine')}>Number Line</button>
        <button className={`toolbar-btn ${selectedTool === 'freehand' ? 'toolbar-btn--active' : ''}`} onClick={() => setSelectedTool('freehand')}>Freehand</button>
        <div style={{ flex: 1 }}></div>
        <button className="toolbar-btn" onClick={clearCanvas}>Clear</button>
        <button className="toolbar-btn toolbar-btn--primary" onClick={handleInsert}>Insert Graphic</button>
        <button className="toolbar-btn" onClick={onClose}>Close</button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
        <div 
          className="canvas-container" 
          onClick={handleCanvasClick}
          style={{ 
            flex: 2, 
            border: '1px solid var(--border-color)', 
            background: '#fff', 
            color: '#000',
            overflow: 'auto',
            cursor: selectedTool === 'select' ? 'default' : 'crosshair',
            fontFamily: 'monospace',
            whiteSpace: 'pre',
            lineHeight: '1.2',
            padding: '1rem'
          }}
        >
          {previewBrf || 'Click to place a shape...'}
        </div>

        <div className="properties-panel" style={{ flex: 1, border: '1px solid var(--border-color)', padding: '1rem', overflowY: 'auto' }}>
          <h3>Properties</h3>
          {spec.shapes.length === 0 ? (
            <p>No shapes added yet.</p>
          ) : (
            spec.shapes.map((shape, index) => (
              <div key={shape.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <strong>{shape.type}</strong>
                <button 
                  style={{ float: 'right', background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}
                  onClick={() => setSpec(prev => ({ ...prev, shapes: prev.shapes.filter(s => s.id !== shape.id) }))}
                >
                  ✕
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {Object.entries(shape).map(([key, value]) => {
                    if (key === 'id' || key === 'type' || key === 'points') return null;
                    return (
                      <label key={key} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                        {key}
                        <input 
                          type={typeof value === 'boolean' ? 'checkbox' : 'number'}
                          checked={typeof value === 'boolean' ? value : undefined}
                          value={typeof value === 'number' ? value : undefined}
                          onChange={(e) => {
                            const newVal = typeof value === 'boolean' ? e.target.checked : Number(e.target.value);
                            setSpec(prev => {
                              const newShapes = [...prev.shapes];
                              (newShapes[index] as unknown as Record<string, unknown>)[key] = newVal;
                              return { ...prev, shapes: newShapes };
                            });
                          }}
                          style={{ padding: '0.25rem', marginTop: '0.2rem' }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
