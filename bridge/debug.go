package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Job event model
// ---------------------------------------------------------------------------

// JobEvent captures everything about a single print attempt.
type JobEvent struct {
	ID      int       `json:"id"`
	Time    time.Time `json:"time"`
	Printer string    `json:"printer"`
	Bytes   int       `json:"bytes"`
	BRFText string    `json:"brf_text"` // first 4 KB of BRF as plain text
	HexDump string    `json:"hex_dump"` // first 256 bytes formatted as hex
	ErrMsg  string    `json:"error"`    // empty on success
}

var (
	jobMu  sync.RWMutex
	jobs   []JobEvent
	nextID = 1

	subsMu sync.Mutex
	subs   []chan JobEvent
)

// appendJob records a job and broadcasts it to all SSE subscribers.
func appendJob(e JobEvent) {
	jobMu.Lock()
	e.ID = nextID
	nextID++
	jobs = append(jobs, e)
	if len(jobs) > 200 {
		jobs = jobs[len(jobs)-200:]
	}
	jobMu.Unlock()

	subsMu.Lock()
	for _, ch := range subs {
		select {
		case ch <- e:
		default:
		}
	}
	subsMu.Unlock()
}

func subscribe() chan JobEvent {
	ch := make(chan JobEvent, 8)
	subsMu.Lock()
	subs = append(subs, ch)
	subsMu.Unlock()
	return ch
}

func unsubscribe(ch chan JobEvent) {
	subsMu.Lock()
	defer subsMu.Unlock()
	for i, s := range subs {
		if s == ch {
			subs = append(subs[:i], subs[i+1:]...)
			return
		}
	}
}

// ---------------------------------------------------------------------------
// Hex dump helper
// ---------------------------------------------------------------------------

func hexDump(data []byte) string {
	if len(data) > 256 {
		data = data[:256]
	}
	var sb strings.Builder
	for i := 0; i < len(data); i += 16 {
		end := i + 16
		if end > len(data) {
			end = len(data)
		}
		row := data[i:end]
		sb.WriteString(fmt.Sprintf("%04x  ", i))
		for j, b := range row {
			sb.WriteString(fmt.Sprintf("%02x ", b))
			if j == 7 {
				sb.WriteByte(' ')
			}
		}
		// Pad short rows
		if len(row) < 16 {
			pad := (16 - len(row)) * 3
			if len(row) <= 8 {
				pad++
			}
			sb.WriteString(strings.Repeat(" ", pad))
		}
		sb.WriteString(" |")
		for _, b := range row {
			if b >= 0x20 && b < 0x7f {
				sb.WriteByte(b)
			} else {
				sb.WriteByte('.')
			}
		}
		sb.WriteString("|\n")
	}
	return sb.String()
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// handleDebugPage serves the standalone HTML debug UI.
func handleDebugPage(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, debugHTML)
}

// handleLogStream streams job events as Server-Sent Events.
func handleLogStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Replay existing jobs first.
	jobMu.RLock()
	existing := make([]JobEvent, len(jobs))
	copy(existing, jobs)
	jobMu.RUnlock()
	for _, e := range existing {
		writeSSE(w, flusher, e)
	}

	ch := subscribe()
	defer unsubscribe(ch)
	for {
		select {
		case <-r.Context().Done():
			return
		case e := <-ch:
			writeSSE(w, flusher, e)
		}
	}
}

func writeSSE(w http.ResponseWriter, f http.Flusher, e JobEvent) {
	data, _ := json.Marshal(e)
	fmt.Fprintf(w, "data: %s\n\n", data)
	f.Flush()
}

// handlePrinters returns a JSON array of available printer names.
func handlePrinters(w http.ResponseWriter, _ *http.Request) {
	printers := listPrinters()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(printers)
}

// handleTestPrint sends a known-good BRF test page to a named printer.
func handleTestPrint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Printer string `json:"printer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Printer == "" {
		http.Error(w, "printer name required", http.StatusBadRequest)
		return
	}

	// A simple BRF test page:
	//   Line 1: heading (in Grade 1 braille the caps indicator is ,)
	//   Lines 2-4: alphabet rows a-j, k-t, u-z
	//   Line 5: numbers #a-#e  (1–5 with number indicator)
	//   Line 6: "hello world" in Grade 2
	const testBRF = ",GRAHAM BRIDGE TE/ PAGE\r\n\r\n" +
		"abcdefghij\r\n" +
		"klmnopqrst\r\n" +
		"uvwxyz\r\n\r\n" +
		"#a #b #c #d #e\r\n\r\n" +
		"hello _w.\r\n"

	data := []byte(testBRF)
	err := sendToPrinter(req.Printer, data)

	e := JobEvent{
		Time:    time.Now(),
		Printer: req.Printer,
		Bytes:   len(data),
		BRFText: testBRF,
		HexDump: hexDump(data),
	}
	if err != nil {
		e.ErrMsg = err.Error()
		appendJob(e)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	appendJob(e)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"queued"}`))
}

// ---------------------------------------------------------------------------
// Embedded HTML debug page
// ---------------------------------------------------------------------------

const debugHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Graham Bridge – Debug</title>
<style>
:root {
  --bg:#0f1117; --surface:#1a1d27; --border:#2a2d3a;
  --primary:#6c8eff; --success:#4caf7d; --danger:#f55;
  --text:#e0e4f0; --muted:#7a7f99;
  --mono:'JetBrains Mono','Fira Code','Cascadia Code',monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{background:var(--surface);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}
header h1{font-size:1.05rem;font-weight:700}
header h1 span{color:var(--primary)}
.badge{font-size:.7rem;background:var(--success);color:#000;padding:2px 8px;border-radius:999px;font-weight:700;transition:background .3s}
.badge.offline{background:var(--danger);color:#fff}
.badge.connecting{background:#777;color:#fff}
.status-bar{display:flex;align-items:center;gap:8px;padding:6px 16px;background:var(--surface);border-bottom:1px solid var(--border);font-size:.78rem;color:var(--muted);flex-shrink:0}
.dot{width:8px;height:8px;border-radius:50%;background:var(--success);flex-shrink:0;transition:background .3s}
.dot.offline{background:var(--danger)}
.dot.connecting{background:#aaa}
main{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:1px;flex:1;overflow:hidden;background:var(--border)}
section{background:var(--bg);display:flex;flex-direction:column;overflow:hidden;min-height:0}
.sh{background:var(--surface);padding:8px 14px;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.sb{flex:1;overflow:auto;padding:10px}
table{width:100%;border-collapse:collapse;font-size:.78rem}
th{color:var(--muted);font-weight:600;padding:4px 8px;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap}
td{padding:5px 8px;border-bottom:1px solid var(--border);vertical-align:top}
tr:last-child td{border-bottom:none}
.ok{color:var(--success);font-weight:700}
.err{color:var(--danger);font-weight:700}
.ts{color:var(--muted);font-size:.73rem;font-family:var(--mono);white-space:nowrap}
.pc{color:var(--primary);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bc{color:var(--muted);font-family:var(--mono);white-space:nowrap}
.printer-list{list-style:none}
.printer-list li{padding:7px 10px;border-radius:6px;cursor:pointer;font-size:.82rem;display:flex;align-items:center;gap:8px;transition:background .12s}
.printer-list li:hover{background:var(--surface)}
.printer-list li.sel{background:rgba(108,142,255,.15);color:var(--primary)}
.test-btn{margin:10px;padding:9px 18px;background:var(--primary);color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:.82rem;transition:opacity .15s;flex-shrink:0}
.test-btn:hover{opacity:.85}
.test-btn:disabled{opacity:.35;cursor:not-allowed}
.mono-box{font-family:var(--mono);font-size:.75rem;white-space:pre;line-height:1.65;color:var(--text)}
.hex-box{font-family:var(--mono);font-size:.7rem;white-space:pre;line-height:1.75;color:var(--primary)}
.empty{color:var(--muted);font-size:.82rem;text-align:center;padding:36px 20px}
.ref-btn{background:none;border:1px solid var(--border);color:var(--muted);padding:2px 9px;border-radius:4px;cursor:pointer;font-size:.72rem}
.ref-btn:hover{border-color:var(--primary);color:var(--primary)}
</style>
</head>
<body>
<header>
  <h1>🖨 <span>Graham</span> Bridge — Debug Dashboard</h1>
  <span class="badge connecting" id="badge">CONNECTING</span>
</header>
<div class="status-bar">
  <div class="dot connecting" id="dot"></div>
  <span id="status-txt">Connecting to event stream…</span>
</div>
<main>

<!-- ── Print Job Log ── -->
<section>
  <div class="sh">
    <span>Print Job Log</span>
    <span id="job-count" style="color:var(--text);font-size:.8rem">0 jobs</span>
  </div>
  <div class="sb" id="log-sb">
    <div class="empty" id="log-empty">No print jobs received yet.<br>Send a job from the web app.</div>
    <table id="log-tbl" style="display:none">
      <thead><tr><th>#</th><th>Time</th><th>Printer</th><th>Bytes</th><th>Result</th></tr></thead>
      <tbody id="log-body"></tbody>
    </table>
  </div>
</section>

<!-- ── Printer List + Test ── -->
<section>
  <div class="sh">
    <span>Available Printers</span>
    <button class="ref-btn" onclick="loadPrinters()">↻ Refresh</button>
  </div>
  <div class="sb" id="printer-sb">
    <div class="empty" id="printer-empty">Loading…</div>
    <ul class="printer-list" id="printer-ul" style="display:none"></ul>
  </div>
  <button class="test-btn" id="test-btn" onclick="sendTest()" disabled>
    🧪 Send Test Page to Selected Printer
  </button>
</section>

<!-- ── BRF Text ── -->
<section>
  <div class="sh"><span>BRF Text — last job</span></div>
  <div class="sb">
    <div class="empty" id="brf-empty">No BRF data yet.</div>
    <pre class="mono-box" id="brf-box" style="display:none"></pre>
  </div>
</section>

<!-- ── Hex Dump ── -->
<section>
  <div class="sh"><span>Hex Dump — first 256 bytes of last job</span></div>
  <div class="sb">
    <div class="empty" id="hex-empty">No data yet.</div>
    <pre class="hex-box" id="hex-box" style="display:none"></pre>
  </div>
</section>

</main>
<script>
let selPrinter = null, jobCount = 0;

// ── SSE stream ───────────────────────────────────────────────
const es = new EventSource('/log-stream');
es.onopen = () => {
  set('#badge','LIVE',['connecting','offline'],[]);
  set('#dot','',['connecting','offline'],[]);
  document.getElementById('status-txt').textContent =
    'Connected — listening for print jobs on port 8080';
};
es.onerror = () => {
  set('#badge','OFFLINE',[],['offline']);
  set('#dot','',['connecting'],['offline']);
  document.getElementById('status-txt').textContent =
    'Connection lost — is the bridge still running?';
};
es.onmessage = ev => {
  const job = JSON.parse(ev.data);
  addRow(job);
  updatePreview(job);
};

function set(sel, txt, rem, add) {
  const el = document.querySelector(sel);
  if (txt !== '') el.textContent = txt;
  rem.forEach(c => el.classList.remove(c));
  add.forEach(c => el.classList.add(c));
}

function fmt(iso) {
  return new Date(iso).toLocaleTimeString([], {hour12:false});
}

function addRow(job) {
  jobCount++;
  document.getElementById('job-count').textContent =
    jobCount + ' job' + (jobCount !== 1 ? 's' : '');
  document.getElementById('log-empty').style.display = 'none';
  document.getElementById('log-tbl').style.display = '';
  const ok = !job.error;
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td class="ts">#'+job.id+'</td>'+
    '<td class="ts">'+fmt(job.time)+'</td>'+
    '<td class="pc" title="'+esc(job.printer)+'">'+esc(job.printer)+'</td>'+
    '<td class="bc">'+job.bytes+' B</td>'+
    '<td class="'+(ok?'ok':'err')+'">'+(ok?'✅ OK':'❌ '+esc(job.error))+'</td>';
  document.getElementById('log-body').prepend(tr);
}

function updatePreview(job) {
  if (job.brf_text) {
    document.getElementById('brf-empty').style.display = 'none';
    const b = document.getElementById('brf-box');
    b.style.display = ''; b.textContent = job.brf_text;
  }
  if (job.hex_dump) {
    document.getElementById('hex-empty').style.display = 'none';
    const h = document.getElementById('hex-box');
    h.style.display = ''; h.textContent = job.hex_dump;
  }
}

// ── Printer list ─────────────────────────────────────────────
async function loadPrinters() {
  document.getElementById('printer-empty').textContent = 'Loading…';
  document.getElementById('printer-empty').style.display = '';
  document.getElementById('printer-ul').style.display = 'none';
  try {
    const list = await fetch('/printers').then(r => r.json());
    const ul = document.getElementById('printer-ul');
    ul.innerHTML = '';
    if (!list || list.length === 0) {
      document.getElementById('printer-empty').textContent =
        'No printers found on this machine.';
      return;
    }
    document.getElementById('printer-empty').style.display = 'none';
    ul.style.display = '';
    list.forEach(name => {
      const li = document.createElement('li');
      li.innerHTML = '<span>🖨</span>'+esc(name);
      li.onclick = () => {
        document.querySelectorAll('#printer-ul li').forEach(l=>l.classList.remove('sel'));
        li.classList.add('sel');
        selPrinter = name;
        document.getElementById('test-btn').disabled = false;
      };
      ul.appendChild(li);
    });
  } catch(e) {
    document.getElementById('printer-empty').textContent =
      'Failed: '+e.message;
  }
}

// ── Test print ───────────────────────────────────────────────
async function sendTest() {
  if (!selPrinter) return;
  const btn = document.getElementById('test-btn');
  btn.disabled = true; btn.textContent = '⏳ Sending…';
  try {
    const r = await fetch('/testprint', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({printer:selPrinter})
    });
    btn.textContent = r.ok ? '✅ Sent! Check the embosser.' : '❌ Send failed.';
  } catch(e) {
    btn.textContent = '❌ Error: '+e.message;
  }
  setTimeout(() => {
    btn.textContent = '🧪 Send Test Page to Selected Printer';
    btn.disabled = false;
  }, 4000);
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

loadPrinters();
</script>
</body>
</html>`
