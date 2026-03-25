import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as monaco from 'monaco-editor';

interface EditorProps {
  onTextChange: (text: string) => void;
  initialValue?: string;
  /** Monaco editor theme name: 'vs-dark' | 'vs' | 'hc-black' */
  monacoTheme?: string;
  /**
   * When this prop changes to a new string the editor content is replaced.
   * Use this to push externally loaded file content into the editor.
   */
  value?: string;
  /** Number of characters at which text wraps; also draws a column ruler. */
  cellsPerRow?: number;
  /** Callback fired when the editor is scrolled by the user, passing the percentage [0, 1] */
  onScrollPercentageChange?: (percentage: number) => void;
  /** Externally controlled scroll percentage, [0, 1] */
  scrollPercentage?: number;
}

export interface EditorHandle {
  insertTextAtCursor: (text: string) => void;
  /** Replace editor content without firing onTextChange (debounced translate stays quiet). */
  setValueFromBrailleSync: (text: string) => void;
}

/**
 * Monaco Editor wrapper component.
 * Stores the editor value in a ref (not state) to avoid re-render storms
 * on every keystroke. Debounces translation calls by 500ms.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(({
  onTextChange,
  initialValue = '',
  monacoTheme = 'vs-dark',
  value,
  cellsPerRow = 40,
  onScrollPercentageChange,
  scrollPercentage,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents the onDidChangeModelContent handler from firing during a
  // programmatic setValue() call, which would cause an update loop.
  const isExternalUpdate = useRef(false);
  const onTextChangeRef = useRef(onTextChange);
  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

  useImperativeHandle(ref, () => ({
    insertTextAtCursor: (text: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const position = editor.getPosition();
      if (!position) return;
      editor.executeEdits('insert-api', [
        {
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: text,
          forceMoveMarkers: true,
        }
      ]);
      editor.pushUndoStop();
      editor.focus();
    },
    setValueFromBrailleSync: (text: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      isExternalUpdate.current = true;
      editor.setValue(text);
      isExternalUpdate.current = false;
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: initialValue,
      language: 'plaintext',
      theme: monacoTheme,
      wordWrap: 'off',
      wordWrapColumn: cellsPerRow,
      rulers: [cellsPerRow],
      minimap: { enabled: false },
      fontSize: 16,
      lineHeight: 24,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });

    editorRef.current.onDidScrollChange((e) => {
      const editor = editorRef.current;
      if (!editor || !onScrollPercentageChange) return;
      
      const scrollHeight = editor.getContentHeight();
      const clientHeight = editor.getLayoutInfo().height;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      
      if (maxScroll > 0) {
        const clampedTop = Math.max(0, Math.min(e.scrollTop, maxScroll));
        onScrollPercentageChange(clampedTop / maxScroll);
      } else {
        onScrollPercentageChange(0);
      }
    });

    editorRef.current.onDidChangeModelContent(() => {
      if (isExternalUpdate.current) return;
      const text = editorRef.current?.getValue() ?? '';

      // Debounce: only notify after 500ms of inactivity
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onTextChangeRef.current(text);
      }, 500);
    });

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      editorRef.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply theme changes without recreating the editor
  useEffect(() => {
    monaco.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // Push externally loaded file content into the editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === undefined) return;
    if (editor.getValue() === value) return;
    isExternalUpdate.current = true;
    editor.setValue(value);
    isExternalUpdate.current = false;
  }, [value]);

  // Keep ruler aligned with page width (visual guide only; soft breaks use \\r between wrapped rows).
  useEffect(() => {
    editorRef.current?.updateOptions({
      wordWrapColumn: cellsPerRow,
      rulers: [cellsPerRow],
    });
  }, [cellsPerRow]);

  // Push externally controlled scroll position into the editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || scrollPercentage === undefined) return;
    
    const scrollHeight = editor.getContentHeight();
    const clientHeight = editor.getLayoutInfo().height;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    
    if (maxScroll > 0) {
      const targetTop = scrollPercentage * maxScroll;
      if (Math.abs(editor.getScrollTop() - targetTop) > 1) {
        editor.setScrollTop(targetTop);
      }
    }
  }, [scrollPercentage]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '400px' }}
    />
  );
});
