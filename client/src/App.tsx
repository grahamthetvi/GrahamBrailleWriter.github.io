import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { PrintPanel } from './components/PrintPanel';
import { StatusBar } from './components/StatusBar';
import { startBridgeStatusPolling } from './services/bridge-client';
import { useBraille } from './hooks/useBraille';
import { asciiToUnicodeBraille } from './utils/braille';
import { TABLE_GROUPS, DEFAULT_TABLE } from './utils/tableRegistry';
import './App.css';

/**
 * Root application component.
 *
 * Architecture:
 *   • Monaco Editor captures text (debounced 500 ms).
 *   • Text + selected table → braille Web Worker (liblouis WASM, off-main-thread).
 *   • Worker translates in chunks for large documents, streaming PROGRESS events.
 *   • Translated BRF displayed as Unicode braille in the preview pane.
 *   • Download button exports the raw BRF file.
 *   • PrintPanel sends BRF to the optional local Go bridge for embosser printing.
 */
export default function App() {
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [selectedTable, setSelectedTable]     = useState(DEFAULT_TABLE);

  const { translate, translatedText, isLoading, progress, error, workerReady } =
    useBraille();

  // ── Track input stats for the status bar ────────────────────────────────
  const [inputText, setInputText] = useState('');
  const wordCount = inputText.trim() === '' ? 0 : inputText.trim().split(/\s+/).length;
  const charCount = inputText.length;

  // ── Bridge status polling ────────────────────────────────────────────────
  useEffect(() => {
    const stopPolling = startBridgeStatusPolling(setBridgeConnected);
    return stopPolling;
  }, []);

  // ── Text change handler (called by Editor with debounced value) ──────────
  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    if (text.trim()) {
      translate(text, selectedTable);
    }
  }, [translate, selectedTable]);

  // ── Re-translate when table changes ─────────────────────────────────────
  const prevTableRef = useRef(selectedTable);
  useEffect(() => {
    if (selectedTable !== prevTableRef.current && inputText.trim()) {
      prevTableRef.current = selectedTable;
      translate(inputText, selectedTable);
    }
  }, [selectedTable, inputText, translate]);

  // ── File upload ──────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setInputText(text);
      translate(text, selectedTable);
    };
    reader.readAsText(file, 'utf-8');
    // Reset input so the same file can be re-loaded if needed
    e.target.value = '';
  }

  // ── BRF download ─────────────────────────────────────────────────────────
  function handleDownloadBrf() {
    if (!translatedText) return;
    const blob = new Blob([translatedText], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'output.brf';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Displayed braille output ─────────────────────────────────────────────
  const unicodeBraille = translatedText ? asciiToUnicodeBraille(translatedText) : '';

  return (
    <div className="app-layout">
      {/* ── Header toolbar ───────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-title">
          <h1>Braille Vibe</h1>
          <span className="subtitle">Braille Editing &amp; Embossing Suite</span>
        </div>

        <div className="toolbar">
          {/* Table selector */}
          <label className="toolbar-label" htmlFor="table-select">
            Table
          </label>
          <select
            id="table-select"
            className="table-select"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            title="Select a liblouis braille translation table"
          >
            {TABLE_GROUPS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.tables.map((t) => (
                  <option key={t.file} value={t.file}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Worker ready indicator */}
          <span
            className={`worker-indicator ${workerReady ? 'ready' : 'loading'}`}
            title={workerReady ? 'liblouis WASM ready' : 'Loading liblouis…'}
          >
            {workerReady ? '● Ready' : '● Loading…'}
          </span>

          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.text,.md,.rst,.adoc"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className="toolbar-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Load a text file for translation"
          >
            Open File
          </button>

          {/* Download BRF */}
          <button
            className="toolbar-btn toolbar-btn--primary"
            onClick={handleDownloadBrf}
            disabled={!translatedText}
            title="Download the translated BRF file"
          >
            Download BRF
          </button>
        </div>
      </header>

      {/* ── Main two-pane layout ─────────────────────────────────────────── */}
      <main className="app-main">
        {/* Left pane: text editor */}
        <section className="editor-pane">
          <div className="pane-title">Text Input</div>
          <Editor onTextChange={handleTextChange} />
        </section>

        {/* Right pane: braille preview + print panel */}
        <aside className="side-pane">
          <section className="brf-preview">
            <div className="pane-title">
              BRF Preview
              {isLoading && translatedText && (
                <span className="preview-loading"> — translating…</span>
              )}
            </div>

            {/* Progress bar for chunked large-document translation */}
            {isLoading && progress > 0 && progress < 100 && (
              <div className="progress-bar-wrap" role="progressbar" aria-valuenow={progress}>
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                <span className="progress-label">{progress}%</span>
              </div>
            )}

            {error && (
              <p className="translation-error">
                Translation error: {error}
              </p>
            )}

            {unicodeBraille ? (
              <pre className="brf-output">{unicodeBraille}</pre>
            ) : (
              <p className="brf-placeholder">
                {workerReady
                  ? 'Type in the editor or open a file to see braille output.'
                  : 'Loading liblouis WASM…'}
              </p>
            )}
          </section>

          <PrintPanel brf={translatedText} bridgeConnected={bridgeConnected} />
        </aside>
      </main>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <StatusBar
        bridgeConnected={bridgeConnected}
        brfLength={translatedText.length}
        wordCount={wordCount}
        charCount={charCount}
        isLoading={isLoading}
        progress={progress}
      />
    </div>
  );
}
