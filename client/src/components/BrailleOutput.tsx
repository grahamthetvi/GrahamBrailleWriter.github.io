/**
 * BrailleOutput — read-only Monaco editor that displays BRF (Braille ASCII).
 *
 * Why Monaco for the output pane?
 * ─────────────────────────────────
 * A plain <pre> or <textarea> creates a DOM node for every character; for a
 * 100 000-word document the translated BRF can exceed 600 KB of text.  Monaco
 * virtualises the viewport — only the visible lines are rendered as DOM nodes —
 * so the output pane stays fast regardless of document size.
 *
 * Scroll synchronisation
 * ───────────────────────
 * The component accepts an optional `onEditorReady` callback that receives the
 * raw monaco.editor.IStandaloneCodeEditor instance.  App.tsx uses this to hook
 * up proportional scroll sync between the left (input) and right (output) panes.
 *
 * Progress overlay
 * ─────────────────
 * When `progress` is set, a thin loading bar is rendered over the pane.  The
 * editor remains visible (showing stale / partial output) so the user can see
 * something while the worker is still translating large documents.
 */

import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import type { TranslationProgress } from '../hooks/useBraille';

interface BrailleOutputProps {
  brf: string;
  isLoading: boolean;
  progress: TranslationProgress | null;
  onEditorReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

export function BrailleOutput({
  brf,
  isLoading,
  progress,
  onEditorReady,
}: BrailleOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef    = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // ── Create / destroy the Monaco editor ──────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value:             '',
      language:          'plaintext',
      theme:             'vs-dark',
      readOnly:          true,
      wordWrap:          'off',          // BRF lines must NOT be reflowed
      minimap:           { enabled: false },
      lineNumbers:       'on',
      scrollBeyondLastLine: false,
      automaticLayout:   true,
      fontSize:          14,
      fontFamily:        '"Courier New", "Lucida Console", monospace',
      renderWhitespace:  'none',
      // Disable unnecessary features in the read-only pane.
      contextmenu:       false,
      folding:           false,
      glyphMargin:       false,
      renderLineHighlight: 'none',
    });

    editorRef.current = editor;
    if (onEditorReady) onEditorReady(editor);

    return () => {
      editor.dispose();
      editorRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep editor content in sync with translated BRF ─────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    // Only push a new value when it actually changes — setValue() resets scroll
    // position, which would fight scroll-sync logic.
    if (model.getValue() !== brf) {
      model.setValue(brf);
    }
  }, [brf]);

  // ── Compute progress bar percentage ─────────────────────────────────────
  const pct = progress
    ? Math.round((progress.current / progress.total) * 100)
    : isLoading
    ? 0
    : 100;

  const showBar = isLoading;

  return (
    <div className="braille-output-wrapper">
      {/* Loading / progress bar */}
      {showBar && (
        <div
          className="braille-progress-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={
            progress
              ? `Translating: ${progress.current} of ${progress.total} paragraphs`
              : 'Loading braille engine…'
          }
        >
          <div
            className="braille-progress-bar__fill"
            style={{
              width: progress ? `${pct}%` : '100%',
              animationName: progress ? 'none' : 'shimmer',
            }}
          />
        </div>
      )}

      {/* Monaco read-only editor */}
      <div
        ref={containerRef}
        className="braille-output-editor"
        aria-label="Braille output (BRF)"
      />
    </div>
  );
}
