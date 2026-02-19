# Project: Braille Vibe (Web-Based Braille Blaster Alternative)

## Core Philosophy
We are building a high-performance, browser-based braille translation and embossing tool.
1. **Client-Side First:** All processing (translation, formatting) happens in the browser via WebAssembly.
2. **No Fatal Errors:** Large documents must not crash the UI.
3. **Hardware Direct:** We bypass standard browser printing to support Braille Embossers (ViewPlus, Index, etc.).

## Technical Stack & Constraints

### 1. The Frontend (Client)
- **Framework:** React + Vite + TypeScript.
- **Editor:** Monaco Editor (Must be used for virtualization to handle 500+ page documents without lag).
- **Braille Engine:** LibLouis compiled to WebAssembly (liblouis-js).
    - *Crucial:* Run LibLouis in a **Web Worker** to keep the main thread unblocked.
- **Math:** MathJax for rendering LaTeX -> Convert to MathML -> LibLouis for Nemeth Code translation.

### 2. The Local Bridge (Printing)
Browsers cannot send raw bytes to USB printers (required for embossers). We will use a "Sidecar" approach.
- **Language:** Go (Golang).
- **Function:** A local HTTP server (localhost:8080) that accepts POST requests containing raw braille bytes.
- **OS Integration:**
    - **Windows:** Must use `win32print` or `github.com/alexbrainman/printer` to send RAW datatype (bypassing the graphics driver).
    - **Mac/Linux:** Use CUPS raw interface.
- **Architecture:** The user installs this single binary once. The Web App detects if it's running.

### 3. File Structure (Monorepo)
- `/client` (React App)
- `/bridge` (Go App)
- `.github/workflows` (CI/CD)

### 4. The Math Pipeline (Critical)
The translation pipeline for math must follow this strict order:
1. **Extraction:** Regex identify content between `$$...$$` (block) and `\(...\)` (inline).
2. **Conversion:** Pass that LaTeX string to **MathJax** (configured to output **MathML**).
3. **Cleaning:** Strip the MathJax-specific XML headers (LibLouis is picky).
4. **Translation:** Pass the clean MathML string to `liblouis-js` using the `nemeth.ctb` table.
5. **Re-insertion:** Replace the original LaTeX placeholders with the returned Nemeth Braille ASCII.

## User Flow
1. User opens Web App.
2. Typles/Pastes text or LaTeX.
3. Web Worker translates to Braille characters in background.
4. User clicks "Emboss".
5. Web App generates a BRF (Braille Ready Format) string, prepended with specific Embosser Escape Codes (e.g., ViewPlus legacy mode).
6. Web App POSTs this data to `http://localhost:8080/print`.
7. Go Bridge sends raw bytes to the physical printer.
