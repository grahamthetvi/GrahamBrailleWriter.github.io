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
 *        WebAssembly binary is present and is instantiated via
 *        WebAssembly.instantiateStreaming(), with the Emscripten glue loaded
 *        from public/wasm/liblouis.js.
 *      • Otherwise the file contains the asm.js fallback that the setup
 *        script writes when no compiled WASM binary is found.  In that case
 *        the file is executed as JavaScript via new Function(src).call(self).
 *   2. Fetches and executes public/wasm/easy-api.js the same way.
 *   3. Enables on-demand table loading from public/tables/.
 *
 * Message protocol  (main → worker):
 *   { text: string, table?: string }
 *
 * Message protocol  (worker → main):
 *   { type: 'READY' }
 *   { type: 'RESULT', result: string }
 *   { type: 'ERROR',  error:  string }
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
 * Note: new Function() executes in global (non-strict) context, which lets
 * the Emscripten output and easy-api UMD wrapper write globals onto `self`
 * exactly as they would with importScripts().
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

let ready = false;
let liblouis: LiblouisEasyApi | undefined;

async function init(): Promise<void> {
  // ------------------------------------------------------------------
  // Step 1: load the main liblouis build.
  //
  // The setup script writes one of:
  //   • A real WASM binary  → public/wasm/liblouis.wasm  (magic: 00 61 73 6D)
  //   • An asm.js fallback  → public/wasm/liblouis.wasm  (plain text JS)
  //
  // We detect which is present by inspecting the first four bytes, then
  // initialise accordingly.
  // ------------------------------------------------------------------
  const wasmUrl = `${BASE}/wasm/liblouis.wasm`;
  const wasmResp = await fetch(wasmUrl);
  if (!wasmResp.ok) {
    throw new Error(
      `Cannot load liblouis build from ${wasmUrl} (HTTP ${wasmResp.status}). ` +
      `Run "npm run setup:liblouis" first.`
    );
  }

  const rawBuffer = await wasmResp.arrayBuffer();
  const header    = new Uint8Array(rawBuffer, 0, 4);
  const isRealWasm =
    header[0] === 0x00 &&
    header[1] === 0x61 &&
    header[2] === 0x73 &&
    header[3] === 0x6d;

  if (isRealWasm) {
    // ── True WebAssembly path ──────────────────────────────────────
    // Pre-load the Emscripten JS glue (separate file, not the .wasm itself)
    // and then supply the already-fetched WASM bytes via Module.wasmBinary so
    // Emscripten uses WebAssembly instead of asm.js.
    (self as unknown as Record<string, unknown>)['Module'] = { wasmBinary: rawBuffer };
    await execRemoteScript(`${BASE}/wasm/liblouis.js`);
  } else {
    // ── asm.js fallback path ───────────────────────────────────────
    // The setup script found no compiled WASM and wrote the asm.js build to
    // the .wasm slot as a functional fallback.  Execute it as JavaScript.
    const src = new TextDecoder().decode(rawBuffer);
    // eslint-disable-next-line no-new-func
    new Function(src).call(self);
  }

  // Wait for Emscripten's runtime to complete its synchronous initialisation.
  // (doRun() is called synchronously by the asm.js IIFE, so calledRun is
  // typically already true here, but we handle the async case defensively.)
  const capi = (self as unknown as Record<string, unknown>)['liblouis_emscripten'] as LiblouisModule;
  if (capi && !capi.calledRun) {
    await new Promise<void>((resolve) => {
      capi.onRuntimeInitialized = resolve;
    });
  }

  // ------------------------------------------------------------------
  // Step 2: load the Easy API wrapper.
  // ------------------------------------------------------------------
  await execRemoteScript(`${BASE}/wasm/easy-api.js`);

  // ------------------------------------------------------------------
  // Step 3: wire up and configure the Easy API.
  // ------------------------------------------------------------------
  liblouis = (self as unknown as Record<string, unknown>)['liblouis'] as LiblouisEasyApi;
  if (!liblouis || typeof liblouis.translateString !== 'function') {
    throw new Error('easy-api.js did not expose a liblouis instance on self');
  }

  if (capi) liblouis.setLiblouisBuild(capi);

  liblouis.setLogLevel(30000);   // suppress debug noise; keep WARN+
  liblouis.enableOnDemandTableLoading(`${BASE}/tables/`);

  ready = true;
  self.postMessage({ type: 'READY' });
  console.info('[braille-worker] ready (isRealWasm =', isRealWasm, ')');
}

// ─── Message handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent) => {
  const { text, table = 'en-ueb-g2.ctb' } = event.data as {
    text: string;
    table?: string;
  };

  if (!ready || !liblouis) {
    self.postMessage({
      type: 'ERROR',
      error: 'liblouis is not ready yet — wait for the READY message.',
    });
    return;
  }

  if (!text.trim()) {
    self.postMessage({ type: 'RESULT', result: '' });
    return;
  }

  try {
    const result = liblouis.translateString(table, text);
    if (result === null) {
      throw new Error(`translateString returned null — check table "${table}"`);
    }
    self.postMessage({ type: 'RESULT', result });
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Kick off initialisation immediately on worker start.
init().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[braille-worker] init failed:', msg);
  self.postMessage({ type: 'ERROR', error: `Worker init failed: ${msg}` });
});
