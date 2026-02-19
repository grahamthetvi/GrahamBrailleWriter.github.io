/**
 * useBraille — React hook that owns the braille Web Worker lifecycle.
 *
 * Usage:
 *   const { translate, translatedText, isLoading, error } = useBraille();
 *   translate('Hello world');   // dispatches to the worker
 *
 * The worker is an ES module worker (Vite worker format: 'es').
 * Message protocol matches braille.worker.ts:
 *   send    → { text: string, table?: BrailleTable }
 *   receive → { type: 'READY' }
 *             { type: 'RESULT', result: string }
 *             { type: 'ERROR',  error:  string }
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type BrailleTable = 'en-ueb-g2.ctb' | 'en-ueb-g1.ctb' | 'en-us-g1.ctb' | 'en-us-g2.ctb';

export interface UseBrailleReturn {
  /** Call this with plain text to request a translation. */
  translate: (text: string, table?: BrailleTable) => void;
  /** The most recent translated BRF string (Braille ASCII). */
  translatedText: string;
  /** True while the worker is initialising or a translation is in flight. */
  isLoading: boolean;
  /** Non-null when the last translation attempt produced an error. */
  error: string | null;
  /** True once the worker has signalled it is ready. */
  workerReady: boolean;
}

export function useBraille(): UseBrailleReturn {
  const workerRef = useRef<Worker | null>(null);

  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading]           = useState(true);   // true until READY
  const [error, setError]                   = useState<string | null>(null);
  const [workerReady, setWorkerReady]       = useState(false);

  // -------------------------------------------------------------------------
  // Spawn / tear down the worker
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Module worker — matches vite.config.ts `worker: { format: 'es' }`.
    const worker = new Worker(
      new URL('../workers/braille.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.addEventListener('message', (e: MessageEvent) => {
      const msg = e.data as
        | { type: 'READY' }
        | { type: 'RESULT'; result: string }
        | { type: 'ERROR';  error:  string };

      if (msg.type === 'READY') {
        setWorkerReady(true);
        setIsLoading(false);
      } else if (msg.type === 'RESULT') {
        setTranslatedText(msg.result);
        setIsLoading(false);
        setError(null);
      } else if (msg.type === 'ERROR') {
        setError(msg.error);
        setIsLoading(false);
      }
    });

    worker.addEventListener('error', (e: ErrorEvent) => {
      setError(`Worker error: ${e.message}`);
      setIsLoading(false);
    });

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Public translate function
  // -------------------------------------------------------------------------
  const translate = useCallback((text: string, table: BrailleTable = 'en-ueb-g2.ctb') => {
    if (!workerRef.current) return;
    setIsLoading(true);
    setError(null);
    workerRef.current.postMessage({ text, table });
  }, []);

  return { translate, translatedText, isLoading, error, workerReady };
}
