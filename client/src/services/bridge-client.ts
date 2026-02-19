/**
 * Bridge Client — communicates with the local Go bridge binary.
 *
 * The bridge runs on http://127.0.0.1:8080 and exposes:
 *   GET  /status  → { status: "ok" }
 *   POST /print   → { printer: string, data: string (base64 BRF) }
 */

const BRIDGE_BASE = 'http://127.0.0.1:8080';
const STATUS_POLL_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Status polling
// ---------------------------------------------------------------------------

type StatusCallback = (connected: boolean) => void;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling the bridge /status endpoint every 5 seconds.
 * Calls `onChange` whenever the connection state changes.
 * Returns a cleanup function.
 */
export function startBridgeStatusPolling(onChange: StatusCallback): () => void {
  let lastState: boolean | null = null;

  async function poll() {
    const connected = await checkBridgeStatus();
    if (connected !== lastState) {
      lastState = connected;
      onChange(connected);
    }
  }

  // Immediate first check
  poll();

  pollTimer = setInterval(poll, STATUS_POLL_INTERVAL_MS);

  return () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
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
    return res.ok;
  } catch {
    return false;
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
export async function printBrf(printer: string, brf: string): Promise<void> {
  // Encode BRF as Base64 for transport.
  const data = btoa(unescape(encodeURIComponent(brf)));

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
