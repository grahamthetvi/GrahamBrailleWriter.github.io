import { useEffect, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { PrintPanel } from './components/PrintPanel';
import { StatusBar } from './components/StatusBar';
import { startBridgeStatusPolling } from './services/bridge-client';
import './App.css';

/**
 * Root application component.
 *
 * Architecture:
 * - Monaco Editor captures text input (debounced 500ms)
 * - Text is sent to a Web Worker running liblouis for Braille translation
 * - Translated BRF is displayed and made available to PrintPanel
 * - PrintPanel sends BRF to the local Go bridge for raw embosser printing
 */
export default function App() {
  const [brf, setBrf] = useState('');
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // Initialise Braille Web Worker
  useEffect(() => {
    const worker = new Worker(
      new URL('./services/braille-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.addEventListener('message', (e: MessageEvent) => {
      const { type, payload } = e.data;
      if (type === 'RESULT') {
        setBrf(payload.brf as string);
      } else if (type === 'ERROR') {
        console.error('[braille-worker] error:', payload.message);
      }
    });

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Bridge status polling
  useEffect(() => {
    const stopPolling = startBridgeStatusPolling(setBridgeConnected);
    return stopPolling;
  }, []);

  // Send text to worker for translation
  function handleTextChange(text: string) {
    workerRef.current?.postMessage({ type: 'TRANSLATE', payload: { text } });
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Braille Vibe</h1>
        <p className="subtitle">Braille Editing &amp; Embossing Suite</p>
      </header>

      <main className="app-main">
        <section className="editor-pane">
          <h2>Text Input</h2>
          <Editor onTextChange={handleTextChange} />
        </section>

        <aside className="side-pane">
          <section className="brf-preview">
            <h2>BRF Preview</h2>
            <pre className="brf-output">{brf || '(start typing to see Braille output)'}</pre>
          </section>

          <PrintPanel brf={brf} bridgeConnected={bridgeConnected} />
        </aside>
      </main>

      <StatusBar bridgeConnected={bridgeConnected} brfLength={brf.length} />
    </div>
  );
}
