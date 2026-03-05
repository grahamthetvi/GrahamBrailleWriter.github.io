/**
 * useBraille — React hook that owns the braille Web Worker lifecycle.
 *
 * Usage:
 *   const { translate, translatedText, isLoading, progress, error } = useBraille();
 *   translate('Hello world', 'en-ueb-g2.ctb');
 *
 * The worker is an ES module worker (Vite worker format: 'es').
 * Message protocol matches workers/braille.worker.ts:
 *   send    → { text: string, table?: string }
 *   receive → { type: 'READY' }
 *             { type: 'RESULT',   result: string }
 *             { type: 'CONVERT_MATH_RESULT', result: string }
 *             { type: 'PROGRESS', percent: number }
 *             { type: 'ERROR',    error:  string }
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type BrailleTable = 'en-ueb-g2.ctb' | 'en-ueb-g1.ctb' | 'en-us-g1.ctb' | 'en-us-g2.ctb';
export type MathCode = 'nemeth' | 'ueb';

export interface UseBrailleReturn {
  /** Call this with plain text and an optional liblouis table filename and math code. */
  translate: (text: string, table?: string, mathCode?: MathCode) => void;
  /** Translates only the math portions of the text and returns the new text via a Promise. */
  convertMath: (text: string, mathCode?: MathCode) => Promise<string>;
  /** The most recent translated BRF string (Braille ASCII). */
  translatedText: string;
  /** True while the worker is initialising or a translation is in flight. */
  isLoading: boolean;
  /**
   * Translation progress (0–100) for large documents being processed in chunks.
   * Always 100 once a RESULT arrives; resets to 0 at the start of a new job.
   */
  progress: number;
  /** Non-null when the last translation attempt produced an error. */
  error: string | null;
  /** True once the worker has signalled it is ready. */
  workerReady: boolean;
}

export function useBraille(): UseBrailleReturn {
  const workerRef = useRef<Worker | null>(null);
  const convertMathResolvers = useRef<Array<(result: string) => void>>([]);

  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(true);   // true until READY
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);

  // -------------------------------------------------------------------------
  // Spawn / tear down the worker
  // -------------------------------------------------------------------------
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/braille.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.addEventListener('message', (e: MessageEvent) => {
      const msg = e.data as
        | { type: 'READY' }
        | { type: 'RESULT'; result: string }
        | { type: 'CONVERT_MATH_RESULT'; result: string }
        | { type: 'PROGRESS'; percent: number }
        | { type: 'ERROR'; error: string };

      if (msg.type === 'READY') {
        setWorkerReady(true);
        setIsLoading(false);
      } else if (msg.type === 'PROGRESS') {
        setProgress(msg.percent);
      } else if (msg.type === 'RESULT') {
        setTranslatedText(msg.result);
        setProgress(100);
        setIsLoading(false);
        setError(null);
      } else if (msg.type === 'CONVERT_MATH_RESULT') {
        const resolve = convertMathResolvers.current.shift();
        if (resolve) resolve(msg.result);
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
  const translate = useCallback((text: string, table = 'en-ueb-g2.ctb', mathCode: MathCode = 'nemeth') => {
    if (!workerRef.current) return;
    setIsLoading(true);
    setProgress(0);
    setError(null);
    workerRef.current.postMessage({ type: 'TRANSLATE', text, table, mathCode });
  }, []);

  // -------------------------------------------------------------------------
  // Public convertMath function
  // -------------------------------------------------------------------------
  const convertMath = useCallback((text: string, mathCode: MathCode = 'nemeth'): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not ready'));
        return;
      }
      convertMathResolvers.current.push(resolve);
      workerRef.current.postMessage({ type: 'CONVERT_MATH_ONLY', text, mathCode });
    });
  }, []);

  return { translate, convertMath, translatedText, isLoading, progress, error, workerReady };
}
