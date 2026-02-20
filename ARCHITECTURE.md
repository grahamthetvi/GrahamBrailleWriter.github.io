# Braille Vibe — Architecture

A browser-based braille editor and embosser driver.  Runs on GitHub Pages with
no server-side dependency; physical embosser printing is handled by a small Go
binary (`/bridge`) that runs locally on the user's machine.

---

## Repository layout

```
GrahamBrailleWriter/
├── client/                   React + Vite + TypeScript frontend
│   ├── public/
│   │   ├── wasm/             liblouis WASM binary + JS glue + easy-api
│   │   └── tables/           liblouis translation tables (368 files)
│   ├── scripts/
│   │   └── setup-liblouis.js asset download / setup script
│   └── src/
│       ├── components/
│       │   ├── BrailleOutput.tsx   read-only Monaco (BRF display)
│       │   ├── Editor.tsx          writable Monaco (text input)
│       │   ├── PrintPanel.tsx      print-to-embosser UI
│       │   ├── StatusBar.tsx       bridge status + byte count
│       │   └── TableSelector.tsx   braille table dropdown
│       ├── hooks/
│       │   └── useBraille.ts       worker lifecycle + state
│       ├── services/
│       │   └── bridge-client.ts    HTTP client for the Go bridge
│       └── workers/
│           └── braille.worker.ts   liblouis Web Worker
└── bridge/                   Go local HTTP server (printer driver)
    ├── main.go               HTTP handlers + CORS
    ├── print_unix.go         lp-based printing (Linux / macOS)
    └── print_windows.go      Win32 spooler via syscall (no cgo)
```

---

## Data flow

```
User types text
      │
      ▼  (500 ms debounce)
Monaco Editor  ──onTextChange──►  App.tsx
                                      │
                                      │  translate(text, table, serial)
                                      ▼
                             useBraille hook
                                      │
                         postMessage({ text, table, serial })
                                      │
                                      ▼
                          braille.worker.ts  (Web Worker)
                                      │
                              liblouis WASM
                          translateString(table, para)
                          ── paragraph by paragraph ──
                                      │
                          postMessage({ type: 'PROGRESS', … })  (periodic)
                          postMessage({ type: 'RESULT', result, serial })
                                      │
                                      ▼
                             useBraille hook
                          (drops results with stale serial)
                                      │
                                      ▼
                           translatedText state
                                      │
                                      ▼
                          BrailleOutput Monaco editor
                          (read-only, virtualised DOM)
```

---

## Component responsibilities

### `Editor.tsx`
Plain Monaco editor instance (writable, `language: 'plaintext'`).  The editor
value is stored in a ref to avoid re-renders on every keystroke.  Text changes
are debounced 500 ms before calling `onTextChange`.  Exposes its Monaco
instance via `onEditorReady` for scroll-sync wiring in `App.tsx`.

### `BrailleOutput.tsx`
Read-only Monaco editor that displays the translated BRF.  Using Monaco here
instead of a `<pre>` element is the key decision that makes heavy text loads
reliable: Monaco virtualises the DOM and only renders visible lines, so a
600 KB BRF document has the same rendering cost as a 1 KB one.  Also exposes
its Monaco instance via `onEditorReady`.

### `TableSelector.tsx`
A `<select>` with `<optgroup>` for 25+ curated liblouis tables grouped by
language (English UEB, English US, British, French, Spanish, German, Arabic,
and others).  Disabled while the braille engine is loading.

### `useBraille.ts` hook
Owns the entire braille Web Worker lifecycle:
- Spawns the worker as an ES module worker (`{ type: 'module' }`).
- Assigns a monotonically increasing **serial number** to every `translate()`
  call and stamps it on the postMessage payload.
- The worker echoes the serial back on every response (PROGRESS / RESULT /
  ERROR).  The hook silently discards responses whose serial is older than
  the most recently dispatched serial — this prevents stale results from
  racing to screen when the user types rapidly.
- Exposes: `{ translate, translatedText, isLoading, progress, error, workerReady }`.

### `braille.worker.ts`
ES module Web Worker that hosts liblouis WASM.

**Initialisation (one-time)**

1. Fetches `public/wasm/liblouis.wasm` and inspects the first 4 bytes.
   - Magic `00 61 73 6D` → real WebAssembly binary.  Sets
     `Module.wasmBinary` and executes the Emscripten JS glue
     (`public/wasm/liblouis.js`) via `fetch()` + `new Function()`.
   - Anything else → asm.js fallback written by the setup script.
     Executed the same way as plain JavaScript.
2. Executes `public/wasm/easy-api.js` (the liblouis Easy API).
3. Calls `liblouis.enableOnDemandTableLoading(BASE + '/tables/')`.
   Tables are fetched by liblouis on first use (browser HTTP cache takes
   care of subsequent requests).

**Translation (per message)**

Large documents are split on double-newlines into **paragraphs**.  Each
paragraph is passed individually to `liblouis.translateString(table, para)`.
Benefits:
- Keeps individual WASM C-FFI calls small → no heap pressure.
- Blank paragraphs are passed through without calling liblouis → preserves
  document structure.
- The worker sends a `PROGRESS` message every 5 paragraphs, giving the UI
  enough data to render a meaningful loading bar without flooding postMessage.

**Why no true cancel?**

JavaScript (and WASM) workers are single-threaded.  A new message cannot
interrupt a running translation loop.  The serial-number guard in the main
thread achieves the same visible effect: the user always sees the result of
the most-recently-requested translation.

---

## liblouis WASM loading strategy

The npm package `liblouis-js` ships only an asm.js build (no real WASM).  The
`scripts/setup-liblouis.js` asset script resolves this with a three-tier
priority:

```
1. unpkg.com/liblouis-build  ← preferred: real WASM binary + matching JS glue
2. node_modules/liblouis-js/build/liblouis.wasm  ← local real WASM if present
3. node_modules/liblouis-js/liblouis-no-tables.js ← asm.js fallback (warns)
```

The script validates the downloaded `.wasm` file with a magic-byte check
before accepting it.  The worker performs the same check at runtime so both
paths are completely transparent to the rest of the codebase.

---

## Scroll synchronisation

Both Monaco editors expose their `IStandaloneCodeEditor` instance upward to
`App.tsx` via `onEditorReady` callbacks.  `App.tsx` registers
`onDidScrollChange` on each editor and converts the scroll position to a
`[0, 1]` ratio (scrollTop / maxScrollTop).  The ratio is applied to the other
editor.

A `syncingRef` boolean gate prevents the handlers from triggering each other
recursively.

---

## Bridge (Go local server)

The bridge is a small `net/http` server bound to `127.0.0.1:8080`.  It exposes
two endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/status` | GET | Health check; polled every 5 s by the frontend |
| `/print`  | POST | Accepts `{ printer: string, data: base64-BRF }`; decodes and spools |

CORS headers allow any origin (`*`) because the server is localhost-only.

### Platform print implementations

| File | Build tag | Mechanism |
|---|---|---|
| `print_unix.go`    | `!windows` | Writes a temp `.brf` file; calls `lp -d <printer> -o raw <file>` |
| `print_windows.go` | `windows`  | Calls Win32 spooler directly via `syscall.LoadDLL("winspool.drv")` (no cgo, supports cross-compilation) |

### Embosser driver / escape sequences (planned)

ViewPlus Tiger embossers boot in Graphics Mode.  The bridge must inject
initialisation bytes before the payload to force Legacy Text Mode:

```
0x1B 0x40  — ESC @ (printer reset)
<vendor-specific Legacy Text trigger>
<BRF payload>
0x0C       — Form Feed (end of job)
```

Index embossers and generic printers receive the BRF payload + Form Feed with
no extra preamble.

---

## Braille table catalogue

368 liblouis tables are shipped in `public/tables/`.  The `TableSelector`
component exposes a curated subset of 25+ tables most likely to be needed by
end users, grouped by language.  The full catalogue is available by typing the
filename directly into any future "custom table" input.

`liblouis.enableOnDemandTableLoading()` means tables not already in the
browser cache are fetched on first use — selecting "Arabic Grade 1" fetches
`ar-ar-g1.utb` (and any files it `include`s) transparently.

---

## Key design decisions vs BrailleBlaster

BrailleBlaster (Java/Kotlin desktop app, APH) processes documents as UTD
(Universal Tactile Document) XML and translates segment-by-segment with a
full ODF/NIMAS/EPUB import pipeline.  Braille Vibe deliberately trades that
breadth for simplicity and deployability:

| Concern | BrailleBlaster | Braille Vibe |
|---|---|---|
| Deployment | Desktop installer | GitHub Pages (zero-install) |
| Translation engine | liblouis via JNI | liblouis WASM in Web Worker |
| Document format | UTD / NIMAS / EPUB | Plain text (LaTeX planned) |
| Chunking strategy | Segment / XML node | Paragraph (double-newline) |
| Printer driver | OS print subsystem | Go bridge (`lp` / Win32) |
| Table selection | Full liblouis catalogue | Curated 25+ + on-demand fetch |

The paragraph-chunking approach is inspired by BrailleBlaster's segment
processing: both avoid passing a megabyte of text to a single liblouis call.

---

## Build & run

```bash
# One-time asset setup (fetches WASM from unpkg.com/liblouis-build)
cd client && npm install

# Dev server (Vite, http://localhost:5173)
npm run dev

# Production build (output: client/dist/)
npm run build

# Go bridge — dev mode (http://127.0.0.1:8080)
npm run bridge:dev          # from repo root

# Go bridge — production binaries
npm run bridge:build:linux
npm run bridge:build:windows
npm run bridge:build:mac
```

---

## Planned work

- **Math pipeline**: LaTeX → MathJax → MathML → liblouis (Nemeth / UEB Math)
  See `MATH_STRATEGY.md`.
- **ViewPlus escape-sequence injection** in the Go bridge.
- **Drag-and-drop plain-text file import** in the editor.
- **BRF download button** so users can save the output without a bridge.
- **Printer discovery** via the bridge (`GET /printers` listing available OS printers).
