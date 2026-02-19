/**
 * braille.worker.ts — runs as a classic (IIFE) Web Worker.
 *
 * Loading strategy:
 *   1. importScripts loads the liblouis Emscripten build (sets `liblouisBuild`
 *      global) and the Easy API wrapper (sets `liblouis` global instance).
 *   2. enableOnDemandTableLoading patches the Emscripten VFS so that table
 *      files are fetched from /tables/ via synchronous XHR the first time
 *      they are needed — no pre-fetching required.
 *   3. Subsequent TRANSLATE messages are handled synchronously inside the
 *      worker so the main UI thread is never blocked.
 *
 * Message protocol  (main → worker):
 *   { type: 'TRANSLATE', payload: { text: string, table?: string } }
 *
 * Message protocol  (worker → main):
 *   { type: 'READY' }
 *   { type: 'RESULT',  payload: { brf: string } }
 *   { type: 'ERROR',   payload: { message: string } }
 */

// importScripts is available in classic (non-module) Web Workers.
declare function importScripts(...urls: string[]): void;

// Globals injected by the two importScripts calls below.
// easy-api.js sets `self.liblouis` (a default EasyApi instance) and
// `self.LiblouisEasyApi` (the constructor) when `liblouisBuild` is found.
declare let liblouis: {
  translateString(table: string, text: string): string | null;
  enableOnDemandTableLoading(url: string): void;
  setLogLevel(level: number): void;
} | undefined;

// ---------------------------------------------------------------------------
// Initialise liblouis
// ---------------------------------------------------------------------------

let ready = false;

function initLiblouis(): void {
  try {
    // Load the Emscripten asm.js build — synchronous, sets `liblouisBuild`.
    importScripts('/GrahamBrailleWriter/wasm/liblouis.js');

    // Load the Easy API wrapper — reads `liblouisBuild`, creates `self.liblouis`.
    importScripts('/GrahamBrailleWriter/wasm/easy-api.js');

    if (typeof liblouis === 'undefined') {
      throw new Error('easy-api.js did not expose a liblouis instance on self');
    }

    // Silence liblouis's own console spam in the worker; keep WARN+.
    liblouis.setLogLevel(30000);

    // On-demand table loading: tables are fetched from /tables/<name> the
    // first time lou_translateString needs them (synchronous XHR inside the
    // Emscripten FS shim).
    liblouis.enableOnDemandTableLoading('/GrahamBrailleWriter/tables/');

    ready = true;
    self.postMessage({ type: 'READY' });
    console.info('[braille-worker] liblouis ready');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[braille-worker] init failed:', msg);
    // Post READY anyway so the hook doesn't hang, but keep ready=false so
    // translation attempts report a meaningful error.
    self.postMessage({ type: 'READY' });
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.addEventListener('message', (event: MessageEvent) => {
  const { type, payload } = event.data as {
    type: string;
    payload?: { text?: string; table?: string };
  };

  if (type !== 'TRANSLATE') return;

  if (!ready || typeof liblouis === 'undefined') {
    self.postMessage({
      type: 'ERROR',
      payload: { message: 'liblouis is not ready. Ensure public/wasm assets exist.' },
    });
    return;
  }

  const text  = payload?.text  ?? '';
  const table = payload?.table ?? 'en-ueb-g2.ctb';

  if (text.trim() === '') {
    self.postMessage({ type: 'RESULT', payload: { brf: '' } });
    return;
  }

  try {
    const brf = liblouis.translateString(table, text);
    if (brf === null) {
      throw new Error(`translateString returned null — check table "${table}"`);
    }
    self.postMessage({ type: 'RESULT', payload: { brf } });
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: err instanceof Error ? err.message : String(err) },
    });
  }
});

// Kick off initialisation as soon as the worker starts.
initLiblouis();
