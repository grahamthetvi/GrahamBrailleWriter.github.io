/**
 * braille.worker.ts — ES module Web Worker (Vite worker format: 'es').
 *
 * Loading strategy
 * ─────────────────
 * Scripts are loaded via fetch() instead of importScripts() so this file
 * can run as a proper ES module worker. On first run the worker:
 *
 *   1. Fetches public/wasm/liblouis.wasm and checks the first four bytes.
 *      • If they match the WASM magic (0x00 0x61 0x73 0x6D), a true
 *        WebAssembly binary is present and is instantiated via the
 *        Emscripten glue loaded from public/wasm/liblouis.js.
 *      • Otherwise the file contains the asm.js fallback written by the
 *        setup script.  It is executed as JavaScript via new Function().
 *   2. Fetches and executes public/wasm/easy-api.js the same way.
 *   3. Enables on-demand table loading from public/tables/.
 *
 * Translation strategy — chunked for heavy text loads
 * ────────────────────────────────────────────────────
 * Large documents are split into paragraphs before being handed to
 * liblouis.translateString().  This keeps individual C-FFI calls small
 * (avoiding WASM heap exhaustion and long microtask blocks) and allows
 * progress reporting so the UI can show a loading bar.
 *
 * Message protocol  (main → worker):
 *   { text: string, table?: string, serial?: number }
 *
 * Message protocol  (worker → main):
 *   { type: 'READY' }
 *   { type: 'PROGRESS', current: number, total: number, serial: number }
 *   { type: 'RESULT',   result: string,  serial: number }
 *   { type: 'ERROR',    error:  string,  serial: number }
 *
 * The serial number is echoed back on every outbound message.  The main
 * thread keeps track of the latest serial it dispatched and silently drops
 * any response whose serial is older — this prevents stale results from
 * appearing when the user edits text while a translation is in flight.
 */

// ─── Type shims for globals set by the loaded scripts ───────────────────────
declare const WorkerGlobalScope: unknown;

interface LiblouisEasyApi {
  setLiblouisBuild(capi: object): void;
  translateString(table: string, text: string): string | null;
  enableOnDemandTableLoading(url: string): void;
  setLogLevel(level: number): void;
}

interface LiblouisModule {
  calledRun: boolean;
  onRuntimeInitialized?: () => void;
  FS: object;
  Runtime: object;
  ccall: (...args: unknown[]) => unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch a URL and execute the response body as JavaScript in the worker's
 * global scope (this = self).  Used for non-ES-module scripts that cannot
 * be loaded with a static import statement.
 *
 * new Function() runs in non-strict global context, letting the Emscripten
 * output and easy-api UMD wrapper write globals onto `self` exactly as they
 * would with importScripts().
 */
async function execRemoteScript(url: string): Promise<void> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url} — HTTP ${resp.status}`);
  }
  const src = await resp.text();
  // eslint-disable-next-line no-new-func
  new Function(src).call(self);
}

// ─── Initialisation ──────────────────────────────────────────────────────────

// Vite injects import.meta.env.BASE_URL at build time, giving us the correct
// path prefix whether we are running in dev or on GitHub Pages.
const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, '');

let ready   = false;
let liblouis: LiblouisEasyApi | undefined;

async function init(): Promise<void> {
  // Step 1 — load the liblouis build (real WASM or asm.js fallback).
  const wasmUrl  = `${BASE}/wasm/liblouis.wasm`;
  const wasmResp = await fetch(wasmUrl);
  if (!wasmResp.ok) {
    throw new Error(
      `Cannot load liblouis build from ${wasmUrl} (HTTP ${wasmResp.status}). ` +
      `Run "npm run setup:liblouis" first.`
    );
  }

  const rawBuffer  = await wasmResp.arrayBuffer();
  const header     = new Uint8Array(rawBuffer, 0, 4);
  const isRealWasm =
    header[0] === 0x00 &&
    header[1] === 0x61 &&
    header[2] === 0x73 &&
    header[3] === 0x6d;

  if (isRealWasm) {
    // True WebAssembly path: supply the already-fetched bytes via Module.wasmBinary,
    // then load the Emscripten glue which will instantiate them synchronously.
    (self as unknown as Record<string, unknown>)['Module'] = { wasmBinary: rawBuffer };
    await execRemoteScript(`${BASE}/wasm/liblouis.js`);
  } else {
    // asm.js fallback: the setup script wrote the asm.js build to the .wasm slot.
    const src = new TextDecoder().decode(rawBuffer);
    // eslint-disable-next-line no-new-func
    new Function(src).call(self);
  }

  // Wait for Emscripten's runtime to finish synchronous init.
  const capi = (self as unknown as Record<string, unknown>)['liblouis_emscripten'] as LiblouisModule;
  if (capi && !capi.calledRun) {
    await new Promise<void>((resolve) => {
      capi.onRuntimeInitialized = resolve;
    });
  }

  // Step 2 — load the Easy API wrapper.
  await execRemoteScript(`${BASE}/wasm/easy-api.js`);

  // Step 3 — wire up and configure the Easy API.
  liblouis = (self as unknown as Record<string, unknown>)['liblouis'] as LiblouisEasyApi;
  if (!liblouis || typeof liblouis.translateString !== 'function') {
    throw new Error('easy-api.js did not expose a liblouis instance on self');
  }

  if (capi) liblouis.setLiblouisBuild(capi);
  liblouis.setLogLevel(30000); // suppress debug noise; keep WARN+
  liblouis.enableOnDemandTableLoading(`${BASE}/tables/`);

  ready = true;
  self.postMessage({ type: 'READY' });
  console.info('[braille-worker] ready  isRealWasm =', isRealWasm);
}

// ─── Chunked translation ──────────────────────────────────────────────────────

/** Send PROGRESS every N paragraphs to avoid flooding the main thread. */
const PROGRESS_EVERY = 5;

/**
 * Translate the full text using liblouis, split into paragraphs so that:
 *  - individual C-FFI calls stay small (WASM heap stays healthy)
 *  - blank-line paragraph structure is preserved in the output
 *  - the UI receives periodic PROGRESS messages for a loading bar
 */
function translateChunked(text: string, table: string, serial: number): void {
  // Split on sequences of two or more newlines (handles \r\n and \n).
  const paragraphs = text.split(/\r?\n(?:\r?\n)+/);
  const total      = paragraphs.length;

  if (total <= 1) {
    // Single paragraph — fast path, no progress reporting needed.
    const result = liblouis!.translateString(table, text);
    if (result === null) {
      self.postMessage({
        type:  'ERROR',
        error: `translateString returned null for table "${table}". ` +
               'Verify the table file exists in public/tables/.',
        serial,
      });
      return;
    }
    self.postMessage({ type: 'RESULT', result, serial });
    return;
  }

  // Multiple paragraphs — translate chunk by chunk.
  const chunks: string[] = [];

  for (let i = 0; i < total; i++) {
    const para = paragraphs[i];

    if (!para.trim()) {
      // Blank separator — preserve the gap without calling liblouis.
      chunks.push('');
    } else {
      const chunk = liblouis!.translateString(table, para);
      if (chunk === null) {
        self.postMessage({
          type:  'ERROR',
          error: `translateString returned null at paragraph ${i + 1}/${total} (table="${table}").`,
          serial,
        });
        return;
      }
      chunks.push(chunk);
    }

    if ((i + 1) % PROGRESS_EVERY === 0 || i === total - 1) {
      self.postMessage({ type: 'PROGRESS', current: i + 1, total, serial });
    }
  }

  self.postMessage({ type: 'RESULT', result: chunks.join('\n\n'), serial });
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent) => {
  const {
    text,
    table  = 'en-ueb-g2.ctb',
    serial = 0,
  } = event.data as { text: string; table?: string; serial?: number };

  if (!ready || !liblouis) {
    self.postMessage({
      type:  'ERROR',
      error: 'liblouis is not ready yet — wait for the READY message.',
      serial,
    });
    return;
  }

  if (!text.trim()) {
    self.postMessage({ type: 'RESULT', result: '', serial });
    return;
  }

  try {
    translateChunked(text, table, serial);
  } catch (err) {
    self.postMessage({
      type:  'ERROR',
      error: err instanceof Error ? err.message : String(err),
      serial,
    });
  }
});

// Kick off initialisation immediately on worker start.
init().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[braille-worker] init failed:', msg);
  self.postMessage({ type: 'ERROR', error: `Worker init failed: ${msg}`, serial: -1 });
});
