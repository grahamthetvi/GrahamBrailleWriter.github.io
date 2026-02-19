<<<<<<< HEAD
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_DIR = path.join(__dirname, '../public/liblouis-build');

// Files to download
// Trying 'build/' path first based on common patterns.
// If this fails, we might need to adjust based on package structure.
const FILES = [
    // liblouis-build versions on npm (3.2.0-rc) seem to be asm.js only (no wasm).
    // We download the JS build and rename it to liblouis.js.
    {
        url: 'https://unpkg.com/liblouis-build/build-no-tables-utf16.js',
        name: 'liblouis.js'
    },
    // Braille Tables
    {
        url: 'https://raw.githubusercontent.com/liblouis/liblouis/master/tables/en-ueb-g2.ctb',
        name: 'en-ueb-g2.ctb'
    },
    {
        url: 'https://raw.githubusercontent.com/liblouis/liblouis/master/tables/en-us-g1.ctb',
        name: 'en-us-g1.ctb'
    }
];

if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
}

function downloadFile(file) {
    const dest = path.join(DEST_DIR, file.name);
    console.log(`Downloading ${file.name} from ${file.url}...`);
    try {
        // Use curl with -L (follow redirects) and -o (output file)
        // Check if Windows or Linux to ensure command compatibility? curl works on both.
        // On Windows Powershell curl is an alias for Invoke-WebRequest unless .exe is specified or curl.exe is used.
        // We'll try just 'curl', if it fails we might need 'curl.exe'.
        // To be safe on generic Windows, we can assume external curl is installed or use Powershell's curl.
        // But 'curl' in cmd is usually the real curl.
        // We will wrap the command in valid shell syntax.
        execSync(`curl -L -o "${dest}" "${file.url}"`, { stdio: 'inherit' });
        console.log(`Downloaded ${file.name}`);
    } catch (error) {
        console.error(`Failed to download ${file.name}:`, error.message);
        throw error;
    }
}

async function main() {
    try {
        for (const file of FILES) {
            downloadFile(file);
        }
        console.log('All files downloaded successfully!');
    } catch (error) {
        console.error('Error downloading files.');
        process.exit(1);
    }
}

main();
=======
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

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
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

const publicDir  = resolve(__dirname, '..', 'public');
const wasmDir    = join(publicDir, 'wasm');
const tablesDir  = join(publicDir, 'tables');

mkdirSync(wasmDir,   { recursive: true });
mkdirSync(tablesDir, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Copy WASM binary (or asm.js fallback)
// ---------------------------------------------------------------------------

const wasmSrc  = join(liblouisDir, 'build', 'liblouis.wasm');
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
// 2. Copy Easy API wrapper
// ---------------------------------------------------------------------------

const easyApiSrc  = join(liblouisDir, 'easy-api.js');
const easyApiDest = join(wasmDir, 'easy-api.js');
copyFileSync(easyApiSrc, easyApiDest);
console.log('✓  Copied Easy API wrapper    → public/wasm/easy-api.js');

// ---------------------------------------------------------------------------
// 3. Fetch braille tables from liblouis/liblouis GitHub
//    with a fallback to the copies bundled in node_modules/liblouis-js/tables/
// ---------------------------------------------------------------------------

const TABLES_BASE =
  'https://raw.githubusercontent.com/liblouis/liblouis/master/tables/';

const TABLES = [
  'en-ueb-g2.ctb',  // English UEB Grade 2 (default)
  'en-us-g1.ctb',   // English US Grade 1
];

for (const table of TABLES) {
  const dest      = join(tablesDir, table);
  const url       = TABLES_BASE + table;
  const localSrc  = join(liblouisDir, 'tables', table);

  process.stdout.write(`  Fetching ${table} … `);

  let fetched = false;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (resp.ok) {
      const bytes = new Uint8Array(await resp.arrayBuffer());
      writeFileSync(dest, bytes);
      console.log(`✓  GitHub → public/tables/${table}`);
      fetched = true;
    } else {
      console.warn(`HTTP ${resp.status} from GitHub`);
    }
  } catch {
    // Network unavailable in this environment — fall through to local copy.
  }

  if (!fetched) {
    if (existsSync(localSrc)) {
      copyFileSync(localSrc, dest);
      console.log(`✓  node_modules fallback → public/tables/${table}`);
    } else {
      console.error(`ERROR: cannot fetch ${table} from GitHub and no local copy found.`);
      process.exit(1);
    }
  }
}

console.log('\nLibLouis asset setup complete. Run "npm run dev" to start the app.');
>>>>>>> 80da415c0a8aad56d13cba70eb196595486bd412
