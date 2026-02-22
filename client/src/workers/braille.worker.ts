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
  const header = new Uint8Array(rawBuffer, 0, 4);
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

// ─── KaTeX & SRE Imports ──────────────────────────────────────────────────────
import katex from 'katex';
// @ts-expect-error - no types available for speech-rule-engine
import * as sre from 'speech-rule-engine';

// Initialize SRE for Nemeth Braille output once upon first translation
let sreInitialized = false;
async function ensureSreReady() {
  if (sreInitialized) return;
  await sre.setupEngine({
    domain: 'nemeth',
    modality: 'braille',
    // We don't need spoken output, just the braille ascii
    locale: 'nemeth',
  });
  sreInitialized = true;
}

// ─── Math Pipeline Helpers ──────────────────────────────────────────────────

/**
 * Strips the outer <math> tag namespace and display attributes from MathML
 */
function cleanMathML(mathml: string): string {
  // Isolate just the <math>...</math> block, KaTeX wraps it with HTML spans
  const match = mathml.match(/<math[^>]*>([\s\S]*?)<\/math>/i);
  if (!match) return mathml;

  // Let's preserve the whole math tag but remove namespaces to be safe
  let cleaned = `<math>${match[1]}</math>`;
  return cleaned;
}

/**
 * Translates LaTeX math into Nemeth Braille Code
 */
async function translateMath(latex: string): Promise<string> {
  try {
    // Ensure the engine is booted
    await ensureSreReady();

    // 1. Convert LaTeX to MathML string
    const katexHtml = katex.renderToString(latex, {
      output: 'mathml', // Only give us the MathML
      throwOnError: false,
    });

    // 2. Clean the MathML (KaTeX still mixes some HTML in the output sometimes, or at least wrapper spans)
    const cleanXml = cleanMathML(katexHtml);

    // 3. Translate using Nemeth SRE Engine
    const result = sre.toSpeech(cleanXml);
    return result || '';
  } catch (err) {
    console.warn('[braille-worker] Math translation failed:', err, latex);
    return `[Math Error: ${latex}]`;
  }
}

/**
 * Extracts math blocks, translates them, and translates the surrounding text.
 */
async function translateDocumentWithMath(text: string, textTable: string): Promise<string> {
  if (!liblouis) return '';

  // Regex to match block math $$...$$ and inline math \(...\)
  // We use a unified regex for both
  const mathRegex = /(\$\$(.*?)\$\$)|(\\\((.*?)\\\))/gs;

  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(text)) !== null) {
    // Translate the text *before* the math
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore) {
      result += liblouis.translateString(textTable, textBefore) || '';
    }

    // Determine which capture group matched (block is match[2], inline is match[4])
    const latex = match[2] !== undefined ? match[2] : match[4];

    // Translate the math
    const mathResult = await translateMath(latex);
    result += mathResult;

    lastIndex = mathRegex.lastIndex;
  }

  // Translate any remaining text after the last math block
  const remainingText = text.slice(lastIndex);
  if (remainingText) {
    result += liblouis.translateString(textTable, remainingText) || '';
  }

  return result;
}

// ─── Message handler ─────────────────────────────────────────────────────────

self.addEventListener('message', async (event: MessageEvent) => {
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
    // Check if the nemeth table is loaded on demand if needed, otherwise rely on the base table.
    // Use the math-aware translation pipeline
    const result = await translateDocumentWithMath(text, table);
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

