import { useState, useRef, useEffect, type CSSProperties } from 'react';

interface TactileGraphicGeneratorProps {
    onInsert: (text: string) => void;
    onClose: () => void;
}

export function TactileGraphicGenerator({ onInsert, onClose }: TactileGraphicGeneratorProps) {
    const [type, setType] = useState('shape');
    const [width, setWidth] = useState(30);
    const [height, setHeight] = useState(15);

    // Shape params
    const [sides, setSides] = useState(4);
    const [size, setSize] = useState(10);
    const [angle, setAngle] = useState(0);

    // Clock params
    const [time, setTime] = useState('12:00');

    // Fraction params
    const [numerator, setNumerator] = useState(1);
    const [denominator, setDenominator] = useState(2);

    // Number line params
    const [min, setMin] = useState(0);
    const [max, setMax] = useState(10);
    const [step, setStep] = useState(1);

    // Base ten params
    const [value, setValue] = useState(123);

    const firstFieldRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        firstFieldRef.current?.focus();
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    function handleInsert() {
        let params = `width=${width} height=${height}`;
        if (type === 'shape') {
            params += ` sides=${sides} size=${size} angle=${angle}`;
        } else if (type === 'clock') {
            params += ` time=${time}`;
        } else if (type === 'fraction') {
            params += ` numerator=${numerator} denominator=${denominator}`;
        } else if (type === 'number-line') {
            params += ` min=${min} max=${max} step=${step}`;
        } else if (type === 'base-ten') {
            params += ` value=${value}`;
        }

        const block = `\n:::${type} ${params} :::\n`;
        onInsert(block);
        onClose();
    }

    const inputStyle: CSSProperties = {
        padding: '6px 8px',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-color)',
        border: '1px solid var(--border-color)',
    };

    const labelStyle: CSSProperties = {
        display: 'block',
        marginBottom: '6px',
        fontWeight: 'bold',
    };

    return (
        <div className="welcome-overlay" onClick={onClose} aria-label="Close tactile graphic generator">
            <div
                className="welcome-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tactile-gen-title"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '500px' }}
            >
                <header className="welcome-header">
                    <h2 id="tactile-gen-title">Tactile Graphic Generator</h2>
                    <button type="button" className="welcome-close" onClick={onClose} aria-label="Close">✕</button>
                </header>

                <div className="welcome-body" style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <label htmlFor="graphic-type" style={labelStyle}>Graphic Type</label>
                        <select
                            id="graphic-type"
                            ref={firstFieldRef}
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            style={inputStyle}
                        >
                            <option value="shape">Shape</option>
                            <option value="clock">Clock</option>
                            <option value="fraction">Fraction</option>
                            <option value="number-line">Number Line</option>
                            <option value="base-ten">Base-Ten Blocks</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label htmlFor="graphic-width" style={labelStyle}>Width (cells)</label>
                            <input
                                id="graphic-width"
                                type="number"
                                min={5}
                                max={100}
                                value={width}
                                onChange={(e) => setWidth(Number(e.target.value))}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label htmlFor="graphic-height" style={labelStyle}>Height (lines)</label>
                            <input
                                id="graphic-height"
                                type="number"
                                min={5}
                                max={100}
                                value={height}
                                onChange={(e) => setHeight(Number(e.target.value))}
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {type === 'shape' && (
                        <>
                            <div style={{ marginBottom: '16px' }}>
                                <label htmlFor="shape-sides" style={labelStyle}>Number of Sides (0 for circle)</label>
                                <input id="shape-sides" type="number" value={sides} onChange={(e) => setSides(Number(e.target.value))} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label htmlFor="shape-size" style={labelStyle}>Size (radius)</label>
                                <input id="shape-size" type="number" value={size} onChange={(e) => setSize(Number(e.target.value))} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label htmlFor="shape-angle" style={labelStyle}>Angle Offset (radians)</label>
                                <input id="shape-angle" type="number" step="0.1" value={angle} onChange={(e) => setAngle(Number(e.target.value))} style={inputStyle} />
                            </div>
                        </>
                    )}

                    {type === 'clock' && (
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="clock-time" style={labelStyle}>Time (HH:MM)</label>
                            <input id="clock-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
                        </div>
                    )}

                    {type === 'fraction' && (
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="fraction-num" style={labelStyle}>Numerator</label>
                                <input id="fraction-num" type="number" min={0} value={numerator} onChange={(e) => setNumerator(Number(e.target.value))} style={inputStyle} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="fraction-den" style={labelStyle}>Denominator</label>
                                <input id="fraction-den" type="number" min={1} value={denominator} onChange={(e) => setDenominator(Number(e.target.value))} style={inputStyle} />
                            </div>
                        </div>
                    )}

                    {type === 'number-line' && (
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="nl-min" style={labelStyle}>Min</label>
                                <input id="nl-min" type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} style={inputStyle} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="nl-max" style={labelStyle}>Max</label>
                                <input id="nl-max" type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} style={inputStyle} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="nl-step" style={labelStyle}>Step</label>
                                <input id="nl-step" type="number" min={1} value={step} onChange={(e) => setStep(Number(e.target.value))} style={inputStyle} />
                            </div>
                        </div>
                    )}

                    {type === 'base-ten' && (
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="base-ten-val" style={labelStyle}>Value</label>
                            <input id="base-ten-val" type="number" min={0} max={999} value={value} onChange={(e) => setValue(Number(e.target.value))} style={inputStyle} />
                        </div>
                    )}

                </div>

                <footer className="welcome-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button type="button" className="toolbar-btn" onClick={onClose}>Cancel</button>
                    <button type="button" className="toolbar-btn primary" onClick={handleInsert}>Insert Graphic</button>
                </footer>
            </div>
        </div>
    );
}
