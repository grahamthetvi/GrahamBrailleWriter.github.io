import { useState } from 'react';
import { printBrf } from '../services/bridge-client';

interface PrintPanelProps {
  brf: string;
  bridgeConnected: boolean;
}

/**
 * Printer selection and print button panel.
 * Sends the translated BRF content to the local bridge binary.
 */
export function PrintPanel({ brf, bridgeConnected }: PrintPanelProps) {
  const [printerName, setPrinterName] = useState('');
  const [status, setStatus] = useState<'idle' | 'printing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handlePrint() {
    if (!printerName.trim()) {
      setErrorMsg('Please enter a printer name.');
      return;
    }
    if (!brf) {
      setErrorMsg('No Braille content to print. Type something first.');
      return;
    }
    setStatus('printing');
    setErrorMsg('');
    try {
      await printBrf(printerName.trim(), brf);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div className="print-panel">
      <h3>Print to Embosser</h3>

      {!bridgeConnected && (
        <p className="bridge-warning">
          Bridge not connected. Download and run the bridge binary to enable printing.
        </p>
      )}

      <label htmlFor="printer-name">Printer Name</label>
      <input
        id="printer-name"
        type="text"
        placeholder="e.g. ViewPlus Columbia"
        value={printerName}
        onChange={(e) => setPrinterName(e.target.value)}
        disabled={!bridgeConnected}
      />

      <button
        onClick={handlePrint}
        disabled={!bridgeConnected || status === 'printing'}
      >
        {status === 'printing' ? 'Printing...' : 'Print'}
      </button>

      {status === 'success' && <p className="status-ok">Sent to embosser successfully.</p>}
      {status === 'error' && <p className="status-err">Error: {errorMsg}</p>}
      {errorMsg && status === 'idle' && <p className="status-err">{errorMsg}</p>}
    </div>
  );
}
