import { useState, useRef, useEffect } from 'react';
import { generateLineChart, generateBarChart } from '../utils/chartBraille';

interface ChartGeneratorProps {
  onInsert: (brf: string) => void;
  onClose: () => void;
}

export function ChartGenerator({ onInsert, onClose }: ChartGeneratorProps) {
  const [dataInput, setDataInput] = useState('');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [cellsWidth, setCellsWidth] = useState(30);
  const [cellsHeight, setCellsHeight] = useState(15);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleInsert() {
    // Parse data
    const rawNumbers = dataInput
      .split(/[\s,]+/)
      .map(s => parseFloat(s))
      .filter(n => !isNaN(n));
      
    if (rawNumbers.length === 0) {
      alert("Please enter some numeric data.");
      return;
    }
    
    let brf = '';
    if (chartType === 'line') {
      brf = generateLineChart(rawNumbers, cellsWidth, cellsHeight);
    } else {
      brf = generateBarChart(rawNumbers, cellsWidth, cellsHeight);
    }
    
    // Protect it with the custom token block
    const block = `\n:::chart\n${brf}\n:::\n`;
    onInsert(block);
  }

  return (
    <div className="welcome-overlay" onClick={onClose} aria-label="Close chart generator">
      <div 
        className="welcome-modal" 
        role="dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <header className="welcome-header">
          <h2>Data-to-Braille Chart Generator</h2>
          <button className="welcome-close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        
        <div className="welcome-body" style={{ padding: '20px' }}>
          <p style={{ marginTop: 0, marginBottom: '15px', fontSize: '0.9rem', color: 'var(--text-color)', opacity: 0.8 }}>
            <strong>Note:</strong> This charting feature is experimental and may not always work as intended. Charts are algorithmically mapped to 6-dot braille cells, which provides very low resolution.
          </p>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Chart Type
            </label>
            <select 
              value={chartType} 
              onChange={e => setChartType(e.target.value as 'line'|'bar')}
              style={{ padding: '5px', width: '100%', backgroundColor: 'var(--bg-card)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
            >
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Width (cells)</label>
              <input 
                type="number" 
                value={cellsWidth} 
                onChange={e => setCellsWidth(parseInt(e.target.value) || 10)}
                min={5} max={80}
                style={{ padding: '5px', width: '100%', backgroundColor: 'var(--bg-card)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Height (lines)</label>
              <input 
                type="number" 
                value={cellsHeight} 
                onChange={e => setCellsHeight(parseInt(e.target.value) || 5)}
                min={5} max={40}
                style={{ padding: '5px', width: '100%', backgroundColor: 'var(--bg-card)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Data Points (comma or space separated)
            </label>
            <textarea
              ref={textRef}
              rows={5}
              value={dataInput}
              onChange={e => setDataInput(e.target.value)}
              placeholder="e.g. 10, 20, 15, 30, 45"
              style={{ width: '100%', padding: '8px', fontFamily: 'monospace', backgroundColor: 'var(--bg-card)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
            />
          </div>
        </div>

        <footer className="welcome-footer">
          <button className="welcome-btn-primary" onClick={handleInsert}>
            Insert Braille Chart
          </button>
        </footer>
      </div>
    </div>
  );
}
