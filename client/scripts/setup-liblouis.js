#!/usr/bin/env node
/**
 * setup-liblouis.js  (ESM — runs under Node ≥ 18)
 *
 * Copies the liblouis Emscripten build and braille table files from
 * node_modules into the Vite public directory so they can be served
 * as static assets and loaded at runtime by the braille Web Worker.
 *
 * Outputs:
 *   public/wasm/liblouis.js   — Emscripten asm.js build (no inline tables)
 *   public/wasm/easy-api.js   — liblouis Easy API wrapper
 *   public/tables/*           — All liblouis braille table files
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

// Provide a minimal shim so the rest of the script can use the familiar API.
const fs   = { copyFileSync, existsSync, mkdirSync, readdirSync, statSync };
const path = { resolve, join };

// ---------------------------------------------------------------------------
// Resolve node_modules — support both local client install and monorepo root
// ---------------------------------------------------------------------------

function findNodeModules(packageName) {
  const candidates = [
    path.resolve(__dirname, '..', 'node_modules', packageName),
    path.resolve(__dirname, '..', '..', 'node_modules', packageName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Cannot find "${packageName}" in node_modules. ` +
    `Run "npm install" in the client or project root.`
  );
}

const liblouisBuildDir = findNodeModules('liblouis-build');
const liblouisDir      = findNodeModules('liblouis');

// ---------------------------------------------------------------------------
// Target directories (relative to project root when script is run via npm)
// ---------------------------------------------------------------------------

const publicDir  = path.resolve(__dirname, '..', 'public');
const wasmDir    = path.join(publicDir, 'wasm');
const tablesDir  = path.join(publicDir, 'tables');

fs.mkdirSync(wasmDir,   { recursive: true });
fs.mkdirSync(tablesDir, { recursive: true });

// ---------------------------------------------------------------------------
// Copy Emscripten build (asm.js, no bundled tables, UTF-16 char width)
// ---------------------------------------------------------------------------

const buildSrc  = path.join(liblouisBuildDir, 'build-no-tables-utf16.js');
const buildDest = path.join(wasmDir, 'liblouis.js');
fs.copyFileSync(buildSrc, buildDest);
console.log(`✓  Copied Emscripten build  → public/wasm/liblouis.js`);

// ---------------------------------------------------------------------------
// Copy Easy API wrapper
// ---------------------------------------------------------------------------

const easyApiSrc  = path.join(liblouisDir, 'easy-api.js');
const easyApiDest = path.join(wasmDir, 'easy-api.js');
fs.copyFileSync(easyApiSrc, easyApiDest);
console.log(`✓  Copied Easy API wrapper  → public/wasm/easy-api.js`);

// ---------------------------------------------------------------------------
// Copy all braille table files
// ---------------------------------------------------------------------------

const srcTablesDir = path.join(liblouisBuildDir, 'tables');
const tableFiles   = fs.readdirSync(srcTablesDir);

let copied = 0;
for (const file of tableFiles) {
  const src  = path.join(srcTablesDir, file);
  const dest = path.join(tablesDir, file);
  const stat = fs.statSync(src);
  if (stat.isFile()) {
    fs.copyFileSync(src, dest);
    copied++;
  }
}
console.log(`✓  Copied ${copied} braille table files → public/tables/`);
console.log('\nLibLouis setup complete. Run "npm run dev" to start the app.');
