#!/usr/bin/env node
/**
 * setup-liblouis.js  (ESM — runs under Node ≥ 18)
 *
 * Prepares public/wasm/ and public/tables/ for the braille Web Worker.
 *
 * Steps
 * ─────
 * 1. Copy liblouis.wasm from node_modules/liblouis-js/build/
 *    (If the build dir ships no .wasm — e.g. the asm.js-only npm release —
 *    fall back to copying the asm.js build so the app still works; a
 *    warning is printed to guide the developer toward a real WASM build.)
 * 2. Copy easy-api.js from node_modules/liblouis-js/
 * 3. Download en-ueb-g2.ctb (Grade 2) and en-us-g1.ctb (Grade 1)
 *    directly from the liblouis/liblouis GitHub repository.
 *
 * Outputs
 * ───────
 *   public/wasm/liblouis.wasm  — WASM binary (or asm.js fallback)
 *   public/wasm/easy-api.js    — liblouis Easy API JS wrapper
 *   public/tables/en-ueb-g2.ctb
 *   public/tables/en-us-g1.ctb
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Resolve node_modules — support both client-local and monorepo-root installs
// ---------------------------------------------------------------------------

function findInNodeModules(packageName) {
  const candidates = [
    resolve(__dirname, '..', 'node_modules', packageName),
    resolve(__dirname, '..', '..', 'node_modules', packageName),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    `Cannot find "${packageName}" in node_modules. ` +
    `Run "npm install" in the client or project root first.`
  );
}

const liblouisDir = findInNodeModules('liblouis-js');

// ---------------------------------------------------------------------------
// Ensure output directories exist
// ---------------------------------------------------------------------------

const publicDir = resolve(__dirname, '..', 'public');
const wasmDir = join(publicDir, 'wasm');
const tablesDir = join(publicDir, 'tables');

mkdirSync(wasmDir, { recursive: true });
mkdirSync(tablesDir, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Copy WASM binary (or asm.js fallback)
// ---------------------------------------------------------------------------

const wasmSrc = join(liblouisDir, 'build', 'liblouis.wasm');
const wasmDest = join(wasmDir, 'liblouis.wasm');

if (existsSync(wasmSrc)) {
  copyFileSync(wasmSrc, wasmDest);
  console.log('✓  Copied WASM binary         → public/wasm/liblouis.wasm');
} else {
  // asm.js fallback: the official npm release of liblouis-js ships only an
  // Emscripten asm.js build — no .wasm binary is included.
  // Copy the asm.js file so the worker can still function, but warn loudly.
  const asmSrc = join(liblouisDir, 'liblouis-no-tables.js');
  copyFileSync(asmSrc, wasmDest);

  console.warn(
    '\n⚠️  WARNING: No liblouis.wasm found in node_modules/liblouis-js/build/\n' +
    '    The installed liblouis-js package provides only an asm.js build.\n' +
    '    An asm.js fallback has been written to public/wasm/liblouis.wasm\n' +
    '    so the app is functional, but for full WebAssembly performance\n' +
    '    you must compile liblouis from source with Emscripten (-s WASM=1)\n' +
    '    and place the resulting liblouis.wasm in node_modules/liblouis-js/build/.\n'
  );
}

// ---------------------------------------------------------------------------
// 2. Copy and Patch Easy API wrapper
// ---------------------------------------------------------------------------

const easyApiSrc = join(liblouisDir, 'easy-api.js');
const easyApiDest = join(wasmDir, 'easy-api.js');

let easyApiScript = readFileSync(easyApiSrc, 'utf8');

// Patch double-initialization bug: preserve the JS callback reference
// so subsequent calls to setLiblouisBuild don't erroneously pass an integer
// pointer back into registerLogCallback.
easyApiScript = easyApiScript.replace(
  'liblouis.registerLogCallback(liblouis._log_callback_fn_pointer);',
  'liblouis.registerLogCallback(liblouis._log_callback_js_fn || null);'
);
easyApiScript = easyApiScript.replace(
  'liblouis._log_callback_fn_pointer = capi.Runtime.addFunction(function(logLvl, msg) {',
  `liblouis._log_callback_js_fn = fn;
	liblouis._log_callback_fn_pointer = capi.Runtime.addFunction(function(logLvl, msg) {`
);

writeFileSync(easyApiDest, easyApiScript);
console.log('✓  Copied & Patched Easy API wrapper → public/wasm/easy-api.js');

// ---------------------------------------------------------------------------
// 3. Copy ALL braille tables bundled in node_modules/liblouis-js/tables/
//    to ensure dependencies (like en-ueb-g1.ctb and braille-patterns.cti) 
//    are available at runtime.
// ---------------------------------------------------------------------------

import { readdirSync } from 'fs';

const localTablesDir = join(liblouisDir, 'tables');
const files = readdirSync(localTablesDir);

let copied = 0;
for (const file of files) {
  // Only copy actual table files to avoid copying Makefiles or READMEs
  if (file.endsWith('.ctb') || file.endsWith('.cti') || file.endsWith('.uti') || file.endsWith('.dis') || file.endsWith('.tbl')) {
    const src = join(localTablesDir, file);
    const dest = join(tablesDir, file);
    copyFileSync(src, dest);
    copied++;
  }
}

console.log(`✓  Copied ${copied} braille tables  → public/tables/`);

console.log('\\nLibLouis asset setup complete. Run "npm run dev" to start the app.');
