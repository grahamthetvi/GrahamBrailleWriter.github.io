/**
 * Bridge Client — communicates with the local Go bridge binary.
 *
 * The bridge runs on http://127.0.0.1:8080 and exposes:
 *   GET  /status  → { status: "ok" }
 *   POST /print   → { printer: string, data: string (base64 BRF) }
 */

const BRIDGE_BASE = 'http://127.0.0.1:8080';
const BASE_POLL_INTERVAL_MS = 5_000;
const BACKOFF_POLL_INTERVAL_MS = 30_000;
const MAX_FAST_FAILURES = 3;

// ---------------------------------------------------------------------------
// Status polling
// ---------------------------------------------------------------------------

type StatusCallback = (connected: boolean) => void;

/**
 * Start polling the bridge /status endpoint.
 * Uses exponential backoff to reduce battery/CPU usage if the bridge is offline.
 * Calls `onChange` whenever the connection state changes.
 * Returns a cleanup function.
 */
export function startBridgeStatusPolling(onChange: StatusCallback): () => void {
  let lastState: boolean | null = null;
  let failCount = 0;
  let active = true;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  async function poll() {
    if (!active) return;
    
    const connected = await checkBridgeStatus();
    if (connected !== lastState) {
      lastState = connected;
      onChange(connected);
    }

    if (connected) {
      failCount = 0;
    } else {
      failCount++;
    }

    const interval = failCount >= MAX_FAST_FAILURES ? BACKOFF_POLL_INTERVAL_MS : BASE_POLL_INTERVAL_MS;
    
    if (active) {
      timeoutId = setTimeout(poll, interval);
    }
  }

  // Immediate first check
  poll();

  return () => {
    active = false;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

/**
 * Single-shot status check.
 */
export async function checkBridgeStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/status`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return false;

    // Parse the response to ensure we are actually talking to the Graham Bridge
    // and not another local service (e.g. webpack dev server) running on 8080.
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data && data.status === 'ok') {
        if (data.app) {
          return data.app === 'graham-bridge';
        }
        // Fallback for older bridge binaries that only returned {"status":"ok"}
        return true;
      }
      return false;
    } catch {
      return false; // Not JSON or invalid format
    }
  } catch {
    return false;
  }
}

/**
 * Fetch the list of installed printers from the bridge.
 */
export async function getPrinters(): Promise<string[]> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/printers`, {
      signal: AbortSignal.timeout(10_000), // Increase timeout as PowerShell on backend takes a few seconds
    });
    if (!res.ok) return [];
    const _printers = await res.json();
    if (Array.isArray(_printers)) {
      // Filter out null or undefined names and convert to string
      return _printers.filter(p => !!p).map(String);
    }
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

/**
 * Send BRF content to the bridge for raw printing.
 *
 * @param printer  The OS printer name (e.g. "ViewPlus Columbia").
 * @param brf      The BRF content as a plain string (UTF-8).
 * @throws         If the bridge is unreachable or returns an error.
 */
export async function printBrf(printer: string, rawData: Uint8Array): Promise<void> {
  // Encode raw binary bytes as Base64 for transport to the Go Bridge
  const binaryString = Array.from(rawData).map(b => String.fromCharCode(b)).join('');
  const data = btoa(binaryString);

  const res = await fetch(`${BRIDGE_BASE}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer, data }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bridge returned ${res.status}: ${body}`);
  }
}
