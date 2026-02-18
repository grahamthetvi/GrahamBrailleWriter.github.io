# Braille Vibe - Technical Architecture

## Overview

Braille Vibe is a comprehensive Braille editing and embossing suite. It consists of:

1. **`/client`** — A React + TypeScript SPA (built with Vite) deployed to GitHub Pages. Handles all Braille editing, translation, and UI.
2. **`/bridge`** — A small Go binary that runs locally on the user's machine. It exposes a local HTTP server (localhost:8080) that the browser communicates with to send raw bytes directly to physical embossers (especially ViewPlus devices on Windows).

## Architecture Diagram

```
┌────────────────────────────────────────────────┐
│                 Browser (GitHub Pages)          │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  React Client (/client)                  │   │
│  │                                          │   │
│  │  ┌──────────────────┐  ┌─────────────┐  │   │
│  │  │  Monaco Editor   │  │  Braille    │  │   │
│  │  │  (Text Input)    │  │  Worker     │  │   │
│  │  └────────┬─────────┘  │  (liblouis) │  │   │
│  │           │ text        └──────┬──────┘  │   │
│  │           └──────────────────►│          │   │
│  │                        BRF output        │   │
│  │                               │          │   │
│  │  ┌────────────────────────────▼───────┐  │   │
│  │  │  Print Service                      │  │   │
│  │  │  POST http://localhost:8080/print   │  │   │
│  │  └─────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────┘   │
└────────────────┬───────────────────────────────┘
                 │ HTTP (localhost only)
                 ▼
┌────────────────────────────────────────────────┐
│  Go Bridge (/bridge) — runs on user's machine  │
│                                                 │
│  Endpoints:                                     │
│    GET  /status  → 200 OK + {"status":"ok"}    │
│    POST /print   → sends raw bytes to printer  │
│                                                 │
│  Windows: Win32 RAW spooler API                 │
│  macOS:   lp / CUPS                             │
└────────────────────────────────────────────────┘
```

## Directory Structure

```
/GrahamBrailleWriter
├── ARCHITECTURE.md          # This file
├── LICENSE
├── package.json             # Monorepo root — scripts for dev, build, etc.
├── .gitignore
│
├── /client                  # Vite + React + TypeScript SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── Editor.tsx       # Monaco Editor wrapper
│       │   ├── PrintPanel.tsx   # Printer selection + print button
│       │   └── StatusBar.tsx    # Bridge connection status
│       └── services/
│           ├── braille-worker.ts  # liblouis-js WASM interface (Web Worker)
│           └── bridge-client.ts   # HTTP client for localhost:8080
│
├── /bridge                  # Go binary
│   ├── go.mod
│   ├── go.sum
│   └── main.go              # HTTP server + print logic
│
└── .github/
    └── workflows/
        ├── deploy.yml       # Build /client → GitHub Pages
        └── release.yml      # Build /bridge → GitHub Releases (exe + mac binary)
```

## Client: Key Technical Decisions

### Monaco Editor
- Used for rich text editing with large-document performance.
- The editor value is stored in a `useRef` (not `useState`) to avoid re-render storms on every keystroke.
- Translation is debounced: after 500ms of inactivity, the text is posted to the Braille Worker.

### Braille Worker (`services/braille-worker.ts`)
- Runs in a **Web Worker** to ensure Braille translation never blocks the main UI thread.
- Uses `liblouis-js` compiled to WASM for offline, in-browser Braille translation.
- Exposes a simple message-passing interface: `{ type: 'TRANSLATE', payload: text }` → `{ type: 'RESULT', payload: brf }`.
- Falls back to a mock implementation if the WASM binary is unavailable.

### Bridge Client (`services/bridge-client.ts`)
- Polls `GET /status` every 5 seconds to detect if the bridge binary is running.
- `POST /print` sends `{ printer: string, data: string }` where `data` is the BRF content encoded as Base64.

## Bridge: Key Technical Decisions

### Windows Raw Printing
- Uses the Windows `winspool.drv` API via cgo or `golang.org/x/sys/windows` to open a print job with data type `"RAW"`.
- This bypasses the GDI rendering pipeline entirely, sending raw BRF bytes directly to the ViewPlus embosser's spooler queue.
- Critical for ViewPlus Tiger embossers, which require raw byte streams.

### CORS
- The bridge sets permissive CORS headers so the GitHub Pages origin can communicate with localhost.
- Only binds to `127.0.0.1` for security (not `0.0.0.0`).

### Conditional Compilation
- `//go:build windows` tags isolate the Windows-specific printing code.
- A Unix fallback uses `exec.Command("lp", ...)` via CUPS.

## GitHub Actions

### `deploy.yml`
- Trigger: push to `main`.
- Steps: `npm ci` in `/client`, `npm run build`, deploy `dist/` to `gh-pages` branch.

### `release.yml`
- Trigger: push of a version tag (`v*.*.*`).
- Build matrix: `GOOS=windows GOARCH=amd64` → `bridge.exe`, `GOOS=darwin GOARCH=amd64` → `bridge-mac`.
- Upload both artifacts to a GitHub Release.

## Data Flow: End-to-End Print

1. User types text in Monaco Editor.
2. After debounce, text is sent to the Braille Worker.
3. Worker translates text → BRF (Braille Ready Format) using liblouis.
4. BRF is returned to the main thread.
5. User clicks "Print".
6. `bridge-client.ts` encodes BRF as Base64 and POSTs to `http://localhost:8080/print`.
7. Go bridge decodes Base64, looks up the selected printer, and sends raw bytes to the OS spooler.
8. Embosser physically prints the Braille document.
