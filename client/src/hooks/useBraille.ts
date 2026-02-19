/**
 * useBraille — React hook that owns the braille Web Worker lifecycle.
 *
 * Usage:
 *   const { translate, translatedText, isLoading, error } = useBraille();
 *   translate('Hello world');   // dispatches to the worker
 *
 * The worker runs liblouis in an IIFE classic worker (not a module worker).
 * This means the worker URL must NOT be created with { type: 'module' }.
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
    // Classic IIFE worker — do NOT pass { type: 'module' }.
    const worker = new Worker(
      new URL('../workers/braille.worker.ts', import.meta.url),
    );

    worker.addEventListener('message', (e: MessageEvent) => {
      const { type, payload } = e.data as {
        type: string;
        payload?: { brf?: string; message?: string };
      };

      if (type === 'READY') {
        setWorkerReady(true);
        setIsLoading(false);
      } else if (type === 'RESULT') {
        setTranslatedText(payload?.brf ?? '');
        setIsLoading(false);
        setError(null);
      } else if (type === 'ERROR') {
        setError(payload?.message ?? 'Unknown error from braille worker');
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
    workerRef.current.postMessage({ type: 'TRANSLATE', payload: { text, table } });
  }, []);

  return { translate, translatedText, isLoading, error, workerReady };
}
