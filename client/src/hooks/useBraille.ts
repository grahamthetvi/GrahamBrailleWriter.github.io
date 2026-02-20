/**
 * useBraille — React hook that owns the braille Web Worker lifecycle.
 *
 * Usage:
 *   const { translate, translatedText, isLoading, progress, error, workerReady } = useBraille();
 *   translate('Hello world', 'en-ueb-g2.ctb');
 *
 * Serial-number guard
 * ───────────────────
 * Every call to translate() stamps a monotonically increasing serial onto
 * the message sent to the worker.  The worker echoes the serial back on
 * every PROGRESS / RESULT / ERROR response.  Responses whose serial is older
 * than the most recently dispatched serial are silently dropped, so rapid
 * typing never renders stale braille output.
 *
 * Worker message protocol:
 *   send    → { text: string, table: string, serial: number }
 *   receive → { type: 'READY' }
 *             { type: 'PROGRESS', current: number, total: number, serial: number }
 *             { type: 'RESULT',   result: string,  serial: number }
 *             { type: 'ERROR',    error:  string,  serial: number }
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Public types ─────────────────────────────────────────────────────────────

export type BrailleTable =
  // English — UEB (preferred modern standard)
  | 'en-ueb-g2.ctb'
  | 'en-ueb-g1.ctb'
  | 'en-ueb-math.ctb'
  // English — US legacy
  | 'en-us-g2.ctb'
  | 'en-us-g1.ctb'
  | 'en-us-comp8.ctb'
  | 'en-us-comp6.ctb'
  // English — UK
  | 'en-GB-g2.ctb'
  | 'en-gb-g1.utb'
  // English — Indian
  | 'en-in-g1.ctb'
  // French
  | 'Fr-Fr-g2.ctb'
  | 'Fr-Ca-g2.ctb'
  // Spanish
  | 'Es-Es-g1.ctb'
  | 'Es-Es-G0.utb'
  // German
  | 'de-g2.ctb'
  | 'de-g1.ctb'
  // Arabic
  | 'ar-ar-g1.utb'
  // Other common
  | 'UEBC-g2.ctb'
  | 'UEBC-g1.utb'
  // Fallback — allow any string so callers can use tables not listed here
  | (string & Record<never, never>);

export interface TranslationProgress {
  /** Paragraphs processed so far. */
  current: number;
  /** Total paragraphs in the current job. */
  total: number;
}

export interface UseBrailleReturn {
  /** Call with plain text (and optional table name) to request a translation. */
  translate: (text: string, table?: BrailleTable) => void;
  /** The most recent translated BRF string (Braille ASCII). */
  translatedText: string;
  /** True while the worker is initialising or a translation is in flight. */
  isLoading: boolean;
  /**
   * Progress of a multi-paragraph translation, or null when idle / on single-
   * paragraph jobs (which complete too quickly to need a progress bar).
   */
  progress: TranslationProgress | null;
  /** Non-null when the last translation attempt produced an error. */
  error: string | null;
  /** True once the worker has signalled it is ready. */
  workerReady: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBraille(): UseBrailleReturn {
  const workerRef  = useRef<Worker | null>(null);
  /** Monotonically increasing.  Incremented on every translate() call. */
  const serialRef  = useRef(0);

  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading]           = useState(true);   // true until READY
  const [progress, setProgress]             = useState<TranslationProgress | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [workerReady, setWorkerReady]       = useState(false);

  // ── Spawn / tear down the worker ──────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/braille.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.addEventListener('message', (e: MessageEvent) => {
      const msg = e.data as
        | { type: 'READY' }
        | { type: 'PROGRESS'; current: number; total: number; serial: number }
        | { type: 'RESULT';   result: string;  serial: number }
        | { type: 'ERROR';    error:  string;  serial: number };

      if (msg.type === 'READY') {
        setWorkerReady(true);
        setIsLoading(false);
        return;
      }

      // Drop responses that belong to a superseded translate() call.
      if (msg.serial !== serialRef.current) return;

      if (msg.type === 'PROGRESS') {
        setProgress({ current: msg.current, total: msg.total });
      } else if (msg.type === 'RESULT') {
        setTranslatedText(msg.result);
        setProgress(null);
        setIsLoading(false);
        setError(null);
      } else if (msg.type === 'ERROR') {
        setError(msg.error);
        setProgress(null);
        setIsLoading(false);
      }
    });

    worker.addEventListener('error', (e: ErrorEvent) => {
      setError(`Worker error: ${e.message}`);
      setProgress(null);
      setIsLoading(false);
    });

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ── Public translate function ──────────────────────────────────────────────
  const translate = useCallback((text: string, table: BrailleTable = 'en-ueb-g2.ctb') => {
    if (!workerRef.current) return;
    const serial = ++serialRef.current;
    setIsLoading(true);
    setError(null);
    setProgress(null);
    workerRef.current.postMessage({ text, table, serial });
  }, []);

  return { translate, translatedText, isLoading, progress, error, workerReady };
}
