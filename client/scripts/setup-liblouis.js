#!/usr/bin/env node
/**
 * setup-liblouis.js  (ESM — runs under Node ≥ 18)
 *
 * Prepares public/wasm/ and public/tables/ for the braille Web Worker.
 *
 * Fetch priority for WASM binary + JS glue
 * ─────────────────────────────────────────
 * 1. unpkg.com/liblouis-build  — pre-compiled real WASM binary (preferred)
 *    The liblouis-js npm package ships only an asm.js build; the dedicated
 *    liblouis-build package on unpkg carries the genuine .wasm binary.
 * 2. node_modules/liblouis-js/build/liblouis.wasm  — local copy if present
 * 3. asm.js fallback  — copies liblouis-no-tables.js as a functional (but
 *    slower) substitute; a loud warning guides developers toward a real build.
 *
 * Outputs
 * ───────
 *   public/wasm/liblouis.wasm  — real WASM binary (or asm.js fallback)
 *   public/wasm/liblouis.js    — Emscripten JS glue (only used w/ real WASM)
 *   public/wasm/easy-api.js    — liblouis Easy API JS wrapper
 *   public/tables/en-ueb-g2.ctb
 *   public/tables/en-us-g1.ctb
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Constants ───────────────────────────────────────────────────────────────

/** Real WebAssembly binary magic bytes: \0asm */
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];

/** unpkg.com/liblouis-build — the npm package that ships the compiled WASM. */
const UNPKG_BASE = 'https://unpkg.com/liblouis-build';

/** Fetch timeout for network requests (ms). */
const FETCH_TIMEOUT_MS = 20_000;

// ─── Resolve node_modules ────────────────────────────────────────────────────
// Support both client-local and monorepo-root npm installs.

function findInNodeModules(packageName) {
  const candidates = [
    resolve(__dirname, '..', 'node_modules', packageName),
    resolve(__dirname, '..', '..', 'node_modules', packageName),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null; // not found — caller decides whether to error
}

// ─── Output directories ───────────────────────────────────────────────────────

const publicDir = resolve(__dirname, '..', 'public');
const wasmDir   = join(publicDir, 'wasm');
const tablesDir = join(publicDir, 'tables');

mkdirSync(wasmDir,   { recursive: true });
mkdirSync(tablesDir, { recursive: true });

// ─── Helper: fetch with timeout ───────────────────────────────────────────────

async function fetchBytes(url) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  return new Uint8Array(await resp.arrayBuffer());
}

// ─── Helper: check WASM magic bytes ─────────────────────────────────────────

function isRealWasm(bytes) {
  return (
    bytes.length >= 4 &&
    bytes[0] === WASM_MAGIC[0] &&
    bytes[1] === WASM_MAGIC[1] &&
    bytes[2] === WASM_MAGIC[2] &&
    bytes[3] === WASM_MAGIC[3]
  );
}

// ─── Step 1: WASM binary ─────────────────────────────────────────────────────

const wasmDest = join(wasmDir, 'liblouis.wasm');
const jsDest   = join(wasmDir, 'liblouis.js');

let wasmFetched = false;

// 1a — Try unpkg.com/liblouis-build (real WASM binary)
console.log('  Fetching liblouis.wasm from unpkg.com/liblouis-build …');
try {
  const bytes = await fetchBytes(`${UNPKG_BASE}/liblouis.wasm`);
  if (isRealWasm(bytes)) {
    writeFileSync(wasmDest, bytes);
    console.log('✓  Real WASM binary             → public/wasm/liblouis.wasm');
    wasmFetched = true;

    // Also fetch the matching Emscripten JS glue from the same package.
    process.stdout.write('  Fetching liblouis.js from unpkg.com/liblouis-build …');
    try {
      const jsBytes = await fetchBytes(`${UNPKG_BASE}/liblouis.js`);
      writeFileSync(jsDest, jsBytes);
      console.log(' ✓');
    } catch (err) {
      console.warn(`\n⚠️  Could not fetch liblouis.js from unpkg (${err.message})`);
      console.warn('    The existing public/wasm/liblouis.js will be used if present.');
    }
  } else {
    console.warn('⚠️  unpkg returned a file that is not a valid WASM binary — skipping.');
  }
} catch (err) {
  console.warn(`⚠️  Could not reach unpkg.com/liblouis-build: ${err.message}`);
}

// 1b — Try node_modules/liblouis-js/build/liblouis.wasm
if (!wasmFetched) {
  const liblouisDir = findInNodeModules('liblouis-js');
  const wasmSrc = liblouisDir ? join(liblouisDir, 'build', 'liblouis.wasm') : null;

  if (wasmSrc && existsSync(wasmSrc)) {
    const bytes = readFileSync(wasmSrc);
    if (isRealWasm(bytes)) {
      copyFileSync(wasmSrc, wasmDest);
      console.log('✓  Real WASM binary (node_modules) → public/wasm/liblouis.wasm');
      wasmFetched = true;
    }
  }
}

// 1c — asm.js fallback
if (!wasmFetched) {
  const liblouisDir = findInNodeModules('liblouis-js');
  if (!liblouisDir) {
    console.error(
      'ERROR: liblouis-js not found in node_modules AND unpkg.com is unreachable.\n' +
      '       Run "npm install" first, or ensure network access and retry.'
    );
    process.exit(1);
  }

  const asmSrc = join(liblouisDir, 'liblouis-no-tables.js');
  copyFileSync(asmSrc, wasmDest);
  console.warn(
    '\n⚠️  WARNING: No real WebAssembly binary available.\n' +
    '    • unpkg.com/liblouis-build was unreachable (no network or rate-limited).\n' +
    '    • node_modules/liblouis-js/build/ contains no .wasm binary.\n' +
    '    An asm.js fallback has been written to public/wasm/liblouis.wasm.\n' +
    '    The app will work but translation will be slower than with real WASM.\n' +
    '    Fix: ensure internet access and re-run "npm run setup:liblouis".\n'
  );
}

// ─── Step 2: Easy API wrapper ────────────────────────────────────────────────

const easyApiDest = join(wasmDir, 'easy-api.js');
const liblouisDir = findInNodeModules('liblouis-js');
if (liblouisDir) {
  const easyApiSrc = join(liblouisDir, 'easy-api.js');
  if (existsSync(easyApiSrc)) {
    copyFileSync(easyApiSrc, easyApiDest);
    console.log('✓  Easy API wrapper              → public/wasm/easy-api.js');
  } else {
    console.warn('⚠️  easy-api.js not found in node_modules/liblouis-js — skipping.');
  }
} else {
  console.warn('⚠️  liblouis-js not in node_modules — easy-api.js not copied.');
}

// ─── Step 3: Braille tables ───────────────────────────────────────────────────
// Download from liblouis/liblouis on GitHub; fall back to node_modules copy.

const TABLES_BASE =
  'https://raw.githubusercontent.com/liblouis/liblouis/master/tables/';

const TABLES = [
  'en-ueb-g2.ctb',  // Unified English Braille Grade 2 (default table)
  'en-us-g1.ctb',   // US English Grade 1
];

for (const table of TABLES) {
  const dest     = join(tablesDir, table);
  const url      = TABLES_BASE + table;
  const localSrc = liblouisDir ? join(liblouisDir, 'tables', table) : null;

  // Skip if already present (postinstall runs on every npm install).
  if (existsSync(dest)) {
    console.log(`✓  (cached)                      → public/tables/${table}`);
    continue;
  }

  process.stdout.write(`  Fetching ${table} … `);
  let fetched = false;
  try {
    const bytes = await fetchBytes(url);
    writeFileSync(dest, bytes);
    console.log(`✓  GitHub → public/tables/${table}`);
    fetched = true;
  } catch {
    // Network unavailable — fall through to local copy.
  }

  if (!fetched) {
    if (localSrc && existsSync(localSrc)) {
      copyFileSync(localSrc, dest);
      console.log(`✓  node_modules fallback → public/tables/${table}`);
    } else {
      console.error(`\nERROR: Cannot fetch ${table} from GitHub and no local copy exists.`);
      process.exit(1);
    }
  }
}

console.log('\nLibLouis asset setup complete. Run "npm run dev" to start the app.');
