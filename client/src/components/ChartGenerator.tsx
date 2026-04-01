import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import {
    generateChartBrf,
    buildChartSummaryPlainText,
} from '../utils/chartBraille';
import {
    type ChartKind,
    type ChartSpec,
    CHART_LIMITS,
    validateChartSpec,
    parseCsvRows,
} from '../types/chart';

interface ChartGeneratorProps {
    onInsert: (text: string) => void;
    onClose: () => void;
}

const STEPS = ['Data', 'Chart type and grid', 'Labels', 'Review'] as const;

function buildSpecFromState(
    kind: ChartKind,
    values: number[],
    cellsWidth: number,
    cellsHeight: number,
    title: string,
    xAxisLabel: string,
    yAxisLabel: string
): ChartSpec {
    const spec: ChartSpec = {
        kind,
        values,
        cellsWidth,
        cellsHeight,
    };
    const t = title.trim();
    const x = xAxisLabel.trim();
    const y = yAxisLabel.trim();
    if (t) spec.title = t;
    if (x) spec.xAxisLabel = x;
    if (y) spec.yAxisLabel = y;
    return spec;
}

export function ChartGenerator({ onInsert, onClose }: ChartGeneratorProps) {
    const [step, setStep] = useState(0);
    const [chartType, setChartType] = useState<ChartKind>('line');
    const [cellsWidth, setCellsWidth] = useState(30);
    const [cellsHeight, setCellsHeight] = useState(15);

    /** One string per row for controlled inputs (allows empty while editing). */
    const [pointRows, setPointRows] = useState<string[]>(['', '', '']);
    const [csvPaste, setCsvPaste] = useState('');
    const [title, setTitle] = useState('');
    const [xAxisLabel, setXAxisLabel] = useState('');
    const [yAxisLabel, setYAxisLabel] = useState('');

    const [liveMessage, setLiveMessage] = useState('');
    const [fieldErrors, setFieldErrors] = useState<string[]>([]);

    const firstFieldRef = useRef<HTMLInputElement>(null);

    const announce = useCallback((msg: string) => {
        setLiveMessage(msg);
    }, []);

    useEffect(() => {
        firstFieldRef.current?.focus();
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    function parsePointValues(): number[] {
        const out: number[] = [];
        for (const raw of pointRows) {
            const s = raw.trim();
            if (s === '') continue;
            const n = parseFloat(s);
            if (!Number.isNaN(n)) out.push(n);
        }
        return out;
    }

    function getSpecForValidation(): ChartSpec {
        return buildSpecFromState(
            chartType,
            parsePointValues(),
            cellsWidth,
            cellsHeight,
            title,
            xAxisLabel,
            yAxisLabel
        );
    }

    function goNext() {
        setFieldErrors([]);
        if (step === 0) {
            const values = parsePointValues();
            const spec = buildSpecFromState(
                chartType,
                values,
                cellsWidth,
                cellsHeight,
                title,
                xAxisLabel,
                yAxisLabel
            );
            const v = validateChartSpec(spec);
            if (!v.ok) {
                setFieldErrors(v.errors);
                announce(v.errors.join(' '));
                return;
            }
            announce(`Data OK. ${values.length} points.`);
        }
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }

    function goBack() {
        setFieldErrors([]);
        setStep((s) => Math.max(s - 1, 0));
    }

    function applyCsv() {
        const { values, rowCount } = parseCsvRows(csvPaste);
        if (values.length === 0) {
            setFieldErrors(['No numbers found in pasted text.']);
            announce('No numbers found in pasted text.');
            return;
        }
        setPointRows(values.map(String));
        setFieldErrors([]);
        announce(`${values.length} points loaded from ${rowCount} rows.`);
        setCsvPaste('');
    }

    function handleInsert() {
        const spec = getSpecForValidation();
        const v = validateChartSpec(spec);
        if (!v.ok) {
            setFieldErrors(v.errors);
            announce(v.errors.join(' '));
            setStep(0);
            return;
        }
        const brf = generateChartBrf(spec);
        const summary = buildChartSummaryPlainText(spec);
        const block = `${summary}\n\n:::chart\n${brf}\n:::\n`;
        onInsert(block);
    }

    const reviewSpec = getSpecForValidation();
    const reviewValidation = validateChartSpec(reviewSpec);
    const reviewSummaryPreview =
        reviewValidation.ok && reviewSpec.values.length > 0
            ? buildChartSummaryPlainText(reviewSpec)
            : '';

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
        <div
            className="welcome-overlay"
            onClick={onClose}
            aria-label="Close chart generator"
        >
            <div
                className="welcome-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="chart-gen-title"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '560px' }}
            >
                <header className="welcome-header">
                    <h2 id="chart-gen-title">Data-to-Braille Chart Generator</h2>
                    <button
                        type="button"
                        className="welcome-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </header>

                <div aria-live="polite" style={{ fontSize: '0.82rem', minHeight: '1.25em', marginBottom: '8px', opacity: 0.92 }}>
                    {liveMessage ? <span>Status: {liveMessage}</span> : <span aria-hidden> </span>}
                </div>

                <div className="welcome-body" style={{ padding: '20px' }}>
                    <p
                        style={{
                            marginTop: 0,
                            marginBottom: '12px',
                            fontSize: '0.9rem',
                            color: 'var(--text-color)',
                            opacity: 0.85,
                        }}
                    >
                        Step {step + 1} of {STEPS.length}: {STEPS[step]}. Chart graphics use
                        low-resolution 6-dot cells; a plain-text summary is inserted with each chart
                        so exact values stay available for reading and embossing.
                    </p>

                    <ol
                        aria-label="Progress"
                        style={{
                            margin: '0 0 16px 0',
                            paddingLeft: '1.25rem',
                            fontSize: '0.85rem',
                            opacity: 0.9,
                        }}
                    >
                        {STEPS.map((name, i) => (
                            <li
                                key={name}
                                style={{
                                    fontWeight: i === step ? 700 : 400,
                                }}
                            >
                                {name}
                            </li>
                        ))}
                    </ol>

                    {fieldErrors.length > 0 && (
                        <div
                            role="alert"
                            style={{
                                marginBottom: '12px',
                                padding: '10px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                            }}
                        >
                            {fieldErrors.map((err) => (
                                <div key={err}>{err}</div>
                            ))}
                        </div>
                    )}

                    {step === 0 && (
                        <div>
                            <table
                                    style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        marginBottom: '12px',
                                    }}
                                >
                                    <caption
                                        style={{
                                            textAlign: 'left',
                                            fontWeight: 'bold',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        Values (one number per row)
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th
                                                scope="col"
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '4px 8px',
                                                    borderBottom: '1px solid var(--border-color)',
                                                }}
                                            >
                                                #
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '4px 8px',
                                                    borderBottom: '1px solid var(--border-color)',
                                                }}
                                            >
                                                Value
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pointRows.map((row, i) => (
                                            <tr key={i}>
                                                <td
                                                    style={{
                                                        padding: '6px 8px',
                                                        verticalAlign: 'middle',
                                                        width: '2.5rem',
                                                    }}
                                                >
                                                    {i + 1}
                                                </td>
                                                <td style={{ padding: '4px' }}>
                                                    <input
                                                        ref={i === 0 ? firstFieldRef : undefined}
                                                        type="text"
                                                        inputMode="decimal"
                                                        aria-label={`Value row ${i + 1}`}
                                                        value={row}
                                                        onChange={(e) => {
                                                            const next = [...pointRows];
                                                            next[i] = e.target.value;
                                                            setPointRows(next);
                                                        }}
                                                        style={inputStyle}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    marginBottom: '16px',
                                }}
                            >
                                <button
                                    type="button"
                                    className="welcome-btn-secondary"
                                    onClick={() => {
                                        setPointRows([...pointRows, '']);
                                        announce(`Row ${pointRows.length + 1} added.`);
                                    }}
                                >
                                    Add row
                                </button>
                                <button
                                    type="button"
                                    className="welcome-btn-secondary"
                                    onClick={() => {
                                        if (pointRows.length <= 1) {
                                            announce('At least one row must remain.');
                                            return;
                                        }
                                        setPointRows(pointRows.slice(0, -1));
                                        announce('Last row removed.');
                                    }}
                                >
                                    Remove last row
                                </button>
                            </div>

                            <div>
                                <label htmlFor="chart-csv-paste" style={labelStyle}>
                                    Optional: paste CSV (numbers separated by commas or new lines)
                                </label>
                                <textarea
                                    id="chart-csv-paste"
                                    rows={3}
                                    value={csvPaste}
                                    onChange={(e) => setCsvPaste(e.target.value)}
                                    placeholder="e.g. 10, 20, 30 or one value per line"
                                    style={{
                                        ...inputStyle,
                                        fontFamily: 'monospace',
                                        resize: 'vertical',
                                    }}
                                />
                                <button
                                    type="button"
                                    className="welcome-btn-secondary"
                                    style={{ marginTop: '8px' }}
                                    onClick={applyCsv}
                                >
                                    Load from pasted text
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div>
                            <div style={{ marginBottom: '15px' }}>
                                <label htmlFor="chart-type-select" style={labelStyle}>
                                    Chart type
                                </label>
                                <select
                                    id="chart-type-select"
                                    value={chartType}
                                    onChange={(e) =>
                                        setChartType(e.target.value as ChartKind)
                                    }
                                    style={inputStyle}
                                >
                                    <option value="line">Line chart</option>
                                    <option value="bar">Bar chart</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 140px' }}>
                                    <label htmlFor="chart-width" style={labelStyle}>
                                        Width (cells, {CHART_LIMITS.cellsWidth.min}–
                                        {CHART_LIMITS.cellsWidth.max})
                                    </label>
                                    <input
                                        id="chart-width"
                                        type="number"
                                        min={CHART_LIMITS.cellsWidth.min}
                                        max={CHART_LIMITS.cellsWidth.max}
                                        value={cellsWidth}
                                        onChange={(e) =>
                                            setCellsWidth(parseInt(e.target.value, 10) || CHART_LIMITS.cellsWidth.min)
                                        }
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ flex: '1 1 140px' }}>
                                    <label htmlFor="chart-height" style={labelStyle}>
                                        Height (lines, {CHART_LIMITS.cellsHeight.min}–
                                        {CHART_LIMITS.cellsHeight.max})
                                    </label>
                                    <input
                                        id="chart-height"
                                        type="number"
                                        min={CHART_LIMITS.cellsHeight.min}
                                        max={CHART_LIMITS.cellsHeight.max}
                                        value={cellsHeight}
                                        onChange={(e) =>
                                            setCellsHeight(parseInt(e.target.value, 10) || CHART_LIMITS.cellsHeight.min)
                                        }
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <div style={{ marginBottom: '12px' }}>
                                <label htmlFor="chart-title" style={labelStyle}>
                                    Title (optional)
                                </label>
                                <input
                                    id="chart-title"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label htmlFor="chart-x-label" style={labelStyle}>
                                    X-axis label (optional)
                                </label>
                                <input
                                    id="chart-x-label"
                                    type="text"
                                    value={xAxisLabel}
                                    onChange={(e) => setXAxisLabel(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label htmlFor="chart-y-label" style={labelStyle}>
                                    Y-axis label (optional)
                                </label>
                                <input
                                    id="chart-y-label"
                                    type="text"
                                    value={yAxisLabel}
                                    onChange={(e) => setYAxisLabel(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <h3
                                style={{
                                    margin: '0 0 8px 0',
                                    fontSize: '1rem',
                                }}
                            >
                                Review — text summary to insert
                            </h3>
                            <p style={{ fontSize: '0.88rem', opacity: 0.9, marginTop: 0 }}>
                                Plain English below will appear above the tactile chart and will be
                                translated with your literary table like the rest of the document.
                            </p>
                            {reviewValidation.ok && reviewSummaryPreview ? (
                                <pre
                                    style={{
                                        ...inputStyle,
                                        whiteSpace: 'pre-wrap',
                                        maxHeight: '220px',
                                        overflow: 'auto',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    {reviewSummaryPreview}
                                </pre>
                            ) : (
                                <p role="alert">Fix data on step 1 before inserting.</p>
                            )}
                        </div>
                    )}
                </div>

                <footer
                    className="welcome-footer"
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            className="welcome-btn-secondary"
                            onClick={goBack}
                            disabled={step === 0}
                        >
                            Back
                        </button>
                        {step < STEPS.length - 1 && (
                            <button
                                type="button"
                                className="welcome-btn-primary"
                                onClick={goNext}
                            >
                                Next
                            </button>
                        )}
                    </div>
                    {step === STEPS.length - 1 && (
                        <button
                            type="button"
                            className="welcome-btn-primary"
                            onClick={handleInsert}
                            disabled={!reviewValidation.ok}
                        >
                            Insert chart and summary
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
}
