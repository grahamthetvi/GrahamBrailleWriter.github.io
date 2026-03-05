import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { PrintPanel } from './components/PrintPanel';
import { StatusBar } from './components/StatusBar';
import { WelcomeModal } from './components/WelcomeModal';
import { PerkinsViewer } from './components/PerkinsViewer';
import { startBridgeStatusPolling } from './services/bridge-client';
import { useBraille, type MathCode } from './hooks/useBraille';
import { asciiToUnicodeBraille } from './utils/braille';
import { formatBrfPages, formatBrfForOutput } from './utils/brailleFormat';
import { TABLE_GROUPS, DEFAULT_TABLE } from './utils/tableRegistry';
import './App.css';

/**
 * Root application component.
 *
 * Architecture:
 *   • Monaco Editor captures text (debounced 500 ms).
 *   • Text + selected table → braille Web Worker (liblouis WASM, off-main-thread).
 *   • Worker translates in chunks for large documents, streaming PROGRESS events.
 *   • Translated BRF is paginated by page layout settings and displayed as
 *     discrete page blocks (Word-like scrolling view).
 *   • Download button exports the formatted BRF file (CRLF + form feeds).
 *   • PrintPanel sends BRF to the optional local Go bridge for embosser printing.
 *   • Theme toggle cycles dark → light → high-contrast, persisted to localStorage.
 *   • Page layout settings (cells per row, lines per page) persist to localStorage.
 */

type Theme = 'dark' | 'light' | 'high-contrast';

const monacoThemeMap: Record<Theme, string> = {
  dark: 'vs-dark',
  light: 'vs',
  'high-contrast': 'hc-black',
};

const themeLabels: Record<Theme, string> = {
  dark: 'Light',
  light: 'Hi-Con',
  'high-contrast': 'Dark',
};

interface PageSettings {
  cellsPerRow: number;
  linesPerPage: number;
}

const DEFAULT_PAGE_SETTINGS: PageSettings = { cellsPerRow: 40, linesPerPage: 25 };

export default function App() {
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem('graham-braille-welcome-seen')
  );

  function handleWelcomeClose() {
    localStorage.setItem('graham-braille-welcome-seen', '1');
    setShowWelcome(false);
  }

  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [selectedTable, setSelectedTable] = useState(DEFAULT_TABLE);
  const [mathCode, setMathCode] = useState<MathCode>('nemeth');

  // ── Perkins Viewer ───────────────────────────────────────────────────────
  const [isPerkinsMode, setIsPerkinsMode] = useState(false);

  // ── Theme management ─────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('graham-braille-theme') as Theme | null;
    return stored ?? 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('graham-braille-theme', theme);
  }, [theme]);

  function cycleTheme() {
    setTheme(prev =>
      prev === 'dark' ? 'light' : prev === 'light' ? 'high-contrast' : 'dark'
    );
  }

  // ── Page layout settings ─────────────────────────────────────────────────
  const [pageSettings, setPageSettings] = useState<PageSettings>(() => {
    try {
      const s = localStorage.getItem('graham-braille-page-settings');
      return s ? (JSON.parse(s) as PageSettings) : DEFAULT_PAGE_SETTINGS;
    } catch {
      return DEFAULT_PAGE_SETTINGS;
    }
  });

  useEffect(() => {
    localStorage.setItem('graham-braille-page-settings', JSON.stringify(pageSettings));
  }, [pageSettings]);

  const [showPageSettings, setShowPageSettings] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const { translate, convertMath, translatedText, isLoading, progress, error, workerReady } =
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
      translate(text, selectedTable, mathCode);
    }
  }, [translate, selectedTable, mathCode]);

  // ── Re-translate when table changes ─────────────────────────────────────
  const prevTableRef = useRef(selectedTable);
  const prevMathRef = useRef(mathCode);
  useEffect(() => {
    if ((selectedTable !== prevTableRef.current || mathCode !== prevMathRef.current) && inputText.trim()) {
      prevTableRef.current = selectedTable;
      prevMathRef.current = mathCode;
      translate(inputText, selectedTable, mathCode);
    }
  }, [selectedTable, mathCode, inputText, translate]);

  // ── File upload ──────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Separate state that is only set on file load or math conversion; passed as `value` to Editor
  // so Monaco's content is replaced. Kept out of inputText feedback loop.
  const [fileContent, setFileContent] = useState<string | undefined>(undefined);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setInputText(text);
      setFileContent(text);
      translate(text, selectedTable, mathCode);
    };
    reader.readAsText(file, 'utf-8');
    // Reset input so the same file can be re-loaded if needed
    e.target.value = '';
  }

  // ── BRF download ─────────────────────────────────────────────────────────
  function handleDownloadBrf() {
    if (!translatedText) return;
    const formatted = formatBrfForOutput(
      translatedText,
      pageSettings.cellsPerRow,
      pageSettings.linesPerPage,
    );
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.brf';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Convert Math ─────────────────────────────────────────────────────────
  async function handleConvertMath() {
    if (!inputText.trim()) return;
    try {
      const result = await convertMath(inputText, mathCode);
      setInputText(result);
      setFileContent(result);
      translate(result, selectedTable, mathCode);
    } catch (err) {
      console.error('Failed to convert math:', err);
    }
  }

  // ── Paginated braille output ─────────────────────────────────────────────
  const unicodeBraille = translatedText ? asciiToUnicodeBraille(translatedText) : '';
  const brfPages = unicodeBraille
    ? formatBrfPages(unicodeBraille, pageSettings.cellsPerRow, pageSettings.linesPerPage)
    : [];

  // ── Page settings input handlers ─────────────────────────────────────────
  function handleCellsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 10 && v <= 100) {
      setPageSettings(s => ({ ...s, cellsPerRow: v }));
    }
  }

  function handleLinesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 5 && v <= 50) {
      setPageSettings(s => ({ ...s, linesPerPage: v }));
    }
  }

  return (
    <div className="app-layout">
      {/* Skip navigation link for keyboard and screen reader users */}
      <a className="skip-link" href="#main-content">Skip to main content</a>

      {/* ── Header toolbar ───────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-title">
          <h1>Graham Braille Editor</h1>
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
            disabled={isPerkinsMode}
            title="Select a liblouis braille translation table"
            aria-label="Select braille translation table"
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

          {/* Math Code selector */}
          <label className="toolbar-label" htmlFor="math-select">
            Math Focus
          </label>
          <select
            id="math-select"
            className="table-select"
            value={mathCode}
            onChange={(e) => setMathCode(e.target.value as MathCode)}
            disabled={isPerkinsMode}
            title="Select math braille code"
            aria-label="Select math braille code"
          >
            <option value="nemeth">Nemeth</option>
            <option value="ueb">UEB Math</option>
          </select>

          {/* Worker ready indicator */}
          <span
            role="status"
            aria-live="polite"
            aria-label={workerReady ? 'liblouis WASM ready' : 'Loading liblouis WASM'}
            className={`worker-indicator ${workerReady ? 'ready' : 'loading'}`}
            title={workerReady ? 'liblouis WASM ready' : 'Loading liblouis…'}
          >
            {workerReady ? '● Ready' : '● Loading…'}
          </span>

          {/* Scan & Convert Math */}
          <button
            className="toolbar-btn"
            onClick={handleConvertMath}
            disabled={!workerReady || !inputText.trim() || isPerkinsMode}
            title="Scan text for LaTeX and substitute with braille math"
            aria-label="Scan text for LaTeX and substitute with braille math"
          >
            Scan & Convert Math
          </button>

          {/* File upload — input is screen-reader-hidden; button is the control */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.text,.md,.rst,.adoc"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            disabled={isPerkinsMode}
          />
          <button
            className="toolbar-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPerkinsMode}
            title="Load a text file for translation"
            aria-label="Open text file for translation"
          >
            Open File
          </button>

          {/* Download BRF */}
          <button
            className="toolbar-btn toolbar-btn--primary"
            onClick={handleDownloadBrf}
            disabled={!translatedText || isPerkinsMode}
            title="Download the translated BRF file"
            aria-label="Download translated BRF file"
          >
            Download BRF
          </button>

          {/* Print to Embosser toggle */}
          <button
            className={`toolbar-btn${showPrint ? ' toolbar-btn--active' : ''}`}
            onClick={() => setShowPrint(s => !s)}
            disabled={isPerkinsMode}
            aria-expanded={showPrint}
            title="Toggle Print to Embosser panel"
          >
            🖨 Print
          </button>

          {/* Perkins Mode toggle */}
          <button
            className={`toolbar-btn${isPerkinsMode ? ' toolbar-btn--active' : ''}`}
            onClick={() => setIsPerkinsMode(s => !s)}
            aria-expanded={isPerkinsMode}
            title="Toggle Perkins Brailler Translator layout"
          >
            🎹 Perkins Viewer
          </button>

          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={cycleTheme}
            aria-label={`Switch theme (current: ${theme}). Click to switch to ${themeLabels[theme]} theme.`}
            title="Cycle theme: dark → light → high contrast"
          >
            {themeLabels[theme]}
          </button>

          {/* Help / re-open welcome guide */}
          <button
            className="toolbar-btn"
            onClick={() => setShowWelcome(true)}
            aria-label="Open help guide"
            title="Open the Getting Started guide"
          >
            ?
          </button>
        </div>

        {/* Compact print bar — full-width row below the toolbar */}
        {showPrint && (
          <div className="header-print-bar">
            <PrintPanel brf={translatedText} bridgeConnected={bridgeConnected} compact />
          </div>
        )}
      </header>

      {/* ── Main two-pane layout ─────────────────────────────────────────── */}
      <main id="main-content" className="app-main">
        {/* Left pane: text editor */}
        <section className="editor-pane">
          <div className="pane-title">Text Input</div>
          <Editor
            onTextChange={handleTextChange}
            monacoTheme={monacoThemeMap[theme]}
            value={fileContent}
            cellsPerRow={pageSettings.cellsPerRow}
          />
        </section>

        {/* Right pane: braille preview + print panel */}
        <aside className="side-pane">
          {isPerkinsMode ? (
            <PerkinsViewer rawText={inputText} />
          ) : (
            <section
              className="brf-preview"
              aria-label="Braille preview output"
              aria-live="polite"
            >
              {/* Pane title row with settings toggle */}
              <div className="pane-title-row">
                <div className="pane-title">
                  BRF Preview
                  {isLoading && translatedText && (
                    <span className="preview-loading"> — translating…</span>
                  )}
                </div>
                <button
                  className="layout-settings-btn"
                  onClick={() => setShowPageSettings(s => !s)}
                  aria-expanded={showPageSettings}
                  aria-controls="page-settings-panel"
                  title="Configure page layout (cells per row, lines per page)"
                >
                  ⚙ Layout
                </button>
              </div>

              {/* Page layout settings panel */}
              {showPageSettings && (
                <div id="page-settings-panel" className="page-settings-panel">
                  <label className="settings-field">
                    <span>Cells / row</span>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={pageSettings.cellsPerRow}
                      onChange={handleCellsChange}
                      aria-label="Braille cells per row"
                    />
                  </label>
                  <label className="settings-field">
                    <span>Lines / page</span>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={pageSettings.linesPerPage}
                      onChange={handleLinesChange}
                      aria-label="Lines per page"
                    />
                  </label>
                  <p className="settings-hint">
                    Common: 40 × 25 (letter), 32 × 28 (A4)
                  </p>
                </div>
              )}

              {/* Progress bar for chunked large-document translation */}
              {isLoading && progress > 0 && progress < 100 && (
                <div
                  className="progress-bar-wrap"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Translation progress"
                >
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                  <span className="progress-label">{progress}%</span>
                </div>
              )}

              {error && (
                <p className="translation-error" role="alert">
                  Translation error: {error}
                </p>
              )}

              {/* Paginated Word-like braille output */}
              {brfPages.length > 0 ? (
                <div className="brf-pages-container" aria-label="Braille pages">
                  {brfPages.map((pageContent, i) => (
                    <div
                      key={i}
                      className="brf-page"
                      aria-label={`Braille page ${i + 1} of ${brfPages.length}`}
                    >
                      <div className="brf-page-number" aria-hidden="true">
                        p. {i + 1}
                      </div>
                      <pre className="brf-page-content">{pageContent}</pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="brf-placeholder" aria-live="polite">
                  {workerReady
                    ? 'Type in the editor or open a file to see braille output.'
                    : 'Loading liblouis WASM…'}
                </p>
              )}
            </section>
          )}

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

      {/* ── First-visit welcome / onboarding modal ────────────────────── */}
      {showWelcome && <WelcomeModal onClose={handleWelcomeClose} />}
    </div>
  );
}
