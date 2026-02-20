/**
 * App.tsx — Root application component.
 *
 * Architecture:
 *  Left pane  — Monaco editor (input, plain text or LaTeX)
 *  Right pane — BrailleOutput (read-only Monaco, shows translated BRF)
 *  Toolbar    — TableSelector, worker-status indicator
 *  Status bar — bridge connectivity, BRF byte-count
 *  Side panel — PrintPanel (sends BRF to the local Go bridge)
 *
 * Data flow:
 *  Monaco keystrokes → 500 ms debounce → translate(text, table)
 *    → braille.worker (liblouis WASM, chunked) → RESULT → translatedText
 *      → BrailleOutput editor model
 *
 * Scroll synchronisation:
 *  Both Monaco editors expose their IStandaloneCodeEditor instances via
 *  onEditorReady callbacks.  A shared sync function converts each editor's
 *  scrollTop to a [0–1] ratio and applies the ratio to the other editor,
 *  with a guard flag to prevent recursive event loops.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { Editor }        from './components/Editor';
import { BrailleOutput } from './components/BrailleOutput';
import { PrintPanel }    from './components/PrintPanel';
import { StatusBar }     from './components/StatusBar';
import { TableSelector } from './components/TableSelector';
import { startBridgeStatusPolling } from './services/bridge-client';
import { useBraille } from './hooks/useBraille';
import type { BrailleTable } from './hooks/useBraille';
import './App.css';

export default function App() {
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [table, setTable] = useState<BrailleTable>('en-ueb-g2.ctb');

  const { translate, translatedText, isLoading, progress, error, workerReady } =
    useBraille();

  // ── Scroll sync ──────────────────────────────────────────────────────────
  const inputEditorRef  = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const outputEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const syncingRef      = useRef(false); // prevents recursive scroll events

  function syncScroll(
    source: monaco.editor.IStandaloneCodeEditor,
    target: monaco.editor.IStandaloneCodeEditor,
  ) {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const srcInfo = source.getScrolledVisiblePosition({ lineNumber: 1, column: 1 });
    const srcTop  = source.getScrollTop();
    const srcMax  = source.getScrollHeight() - (srcInfo ? source.getDomNode()?.clientHeight ?? 0 : 0);
    const ratio   = srcMax > 0 ? srcTop / srcMax : 0;

    const tgtMax = target.getScrollHeight() - (target.getDomNode()?.clientHeight ?? 0);
    target.setScrollTop(ratio * tgtMax);

    // Release the guard after the browser has processed the scroll event.
    requestAnimationFrame(() => { syncingRef.current = false; });
  }

  const handleInputEditorReady = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor) => {
      inputEditorRef.current = editor;
      editor.onDidScrollChange(() => {
        if (outputEditorRef.current) {
          syncScroll(editor, outputEditorRef.current);
        }
      });
    },
    [],
  );

  const handleOutputEditorReady = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor) => {
      outputEditorRef.current = editor;
      editor.onDidScrollChange(() => {
        if (inputEditorRef.current) {
          syncScroll(editor, inputEditorRef.current);
        }
      });
    },
    [],
  );

  // ── Monaco text → translation ────────────────────────────────────────────
  function handleTextChange(text: string) {
    translate(text, table);
  }

  // Re-translate when the user switches tables (use the current editor value).
  function handleTableChange(newTable: BrailleTable) {
    setTable(newTable);
    const text = inputEditorRef.current?.getValue() ?? '';
    if (text.trim()) translate(text, newTable);
  }

  // ── Bridge status polling ────────────────────────────────────────────────
  useEffect(() => {
    const stopPolling = startBridgeStatusPolling(setBridgeConnected);
    return stopPolling;
  }, []);

  // ── Worker status label ───────────────────────────────────────────────────
  const workerLabel = workerReady
    ? (isLoading
        ? progress
          ? `translating ${progress.current}/${progress.total}`
          : 'translating…'
        : 'ready')
    : 'loading engine…';

  const workerColor = workerReady
    ? (isLoading ? '#f0a500' : '#4ec94e')
    : '#888';

  return (
    <div className="app-layout">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header__brand">
          <h1>Braille Vibe</h1>
          <span className="subtitle">Braille Editing &amp; Embossing Suite</span>
        </div>

        <div className="app-header__controls">
          <TableSelector
            value={table}
            onChange={handleTableChange}
            disabled={!workerReady}
          />

          <span className="worker-status" style={{ color: workerColor }}>
            ● {workerLabel}
          </span>
        </div>
      </header>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="error-banner" role="alert">
          <strong>Translation error:</strong> {error}
        </div>
      )}

      {/* ── Split pane ───────────────────────────────────────────────────── */}
      <main className="app-main">
        {/* Left — text input */}
        <section className="editor-pane">
          <div className="pane-label">Source Text</div>
          <Editor
            onTextChange={handleTextChange}
            onEditorReady={handleInputEditorReady}
          />
        </section>

        <div className="pane-divider" />

        {/* Right — braille output + print panel */}
        <section className="output-pane">
          <div className="pane-label">
            BRF Output
            <span className="pane-label__meta">
              {translatedText.length > 0 && ` — ${translatedText.length.toLocaleString()} bytes`}
            </span>
          </div>

          <BrailleOutput
            brf={translatedText}
            isLoading={isLoading}
            progress={progress}
            onEditorReady={handleOutputEditorReady}
          />

          <PrintPanel brf={translatedText} bridgeConnected={bridgeConnected} />
        </section>
      </main>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <StatusBar
        bridgeConnected={bridgeConnected}
        brfLength={translatedText.length}
      />
    </div>
  );
}
