import { useState, ChangeEvent } from 'react';
import { printBrf } from '../services/bridge-client';
import { printBrfWebUSB } from '../services/webusb-client';
import { EmbosserFactory, EMBOSSER_LIST } from '../services/embossers/EmbosserFactory';
import { isChromeOS, isMac, isWindows, isLinux } from '../utils/os';

interface PrintPanelProps {
  brf: string;
  bridgeConnected: boolean;
  useWebUSB?: boolean;
  /** Renders as a compact horizontal bar for use inside the app header. */
  compact?: boolean;
}

/**
 * Printer selection and print button panel.
 * Sends the translated BRF content to the local bridge binary.
 * When `compact` is true, renders horizontally for use inside the header toolbar.
 */
export function PrintPanel({ brf, bridgeConnected, useWebUSB, compact }: PrintPanelProps) {
  const [printerName, setPrinterName] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('generic');
  const [status, setStatus] = useState<'idle' | 'printing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handlePrint() {
    if (!useWebUSB && !printerName.trim()) {
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
      const embosser = EmbosserFactory.getEmbosser(selectedDriverId);
      const bytes = embosser.generateBytes(brf, { copies: 1 });

      if (useWebUSB) {
        await printBrfWebUSB(bytes);
      } else {
        await printBrf(printerName.trim(), bytes);
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  const renderViewPlusWarning = () => {
    if (selectedDriverId !== 'viewplus') return null;

    const style = { fontSize: '0.8rem', marginTop: '0.4rem', lineHeight: 1.3 };
    if (isChromeOS()) {
      return <div style={{ ...style, color: '#d97706' }}>⚠️ <strong>ChromeOS Notice:</strong> Direct WebUSB printing to ViewPlus is experimental and might not work.</div>;
    } else if (isWindows() || isMac()) {
      return <div style={{ ...style, color: '#0369a1' }}>ℹ️ <strong>Driver Required:</strong> Ensure you have the official ViewPlus printer driver installed for your specific embosser.</div>;
    } else if (isLinux()) {
      return <div style={{ ...style, color: '#d97706' }}>⚠️ <strong>Linux Notice:</strong> ViewPlus bridging on Linux is experimental and might not work.</div>;
    }
    return null;
  };

  if (compact) {
    return (
      <div className="print-panel-compact">
        {!useWebUSB && !bridgeConnected && (
          <span className="bridge-badge" role="status">Bridge offline</span>
        )}
        {!useWebUSB && (
          <>
            <label htmlFor="printer-name-compact">Printer</label>
            <input
              id="printer-name-compact"
              type="text"
              className="printer-input"
              placeholder="e.g. ViewPlus Columbia"
              value={printerName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPrinterName(e.target.value)}
              disabled={!bridgeConnected}
            />
          </>
        )}
        <select
          className="printer-input"
          value={selectedDriverId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedDriverId(e.target.value)}
          style={{ width: '130px', marginLeft: '0.4rem' }}
        >
          {EMBOSSER_LIST.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button
          className="toolbar-btn toolbar-btn--primary"
          onClick={handlePrint}
          disabled={(!useWebUSB && !bridgeConnected) || status === 'printing'}
        >
          {status === 'printing' ? 'Sending…' : useWebUSB ? 'Select & Print (USB)' : 'Print'}
        </button>
        {renderViewPlusWarning()}
        {status === 'success' && (
          <span className="print-status-ok" aria-live="polite">✓ Sent</span>
        )}
        {(status === 'error' || (errorMsg && status === 'idle')) && (
          <span className="print-status-err" role="alert">{errorMsg}</span>
        )}
      </div>
    );
  }

  return (
    <div className="print-panel">
      <h3>{useWebUSB ? 'WebUSB Embossing' : 'Print to Embosser'}</h3>

      {!useWebUSB && !bridgeConnected && (
        <p className="bridge-warning" role="status">
          Bridge not connected. Download and run the bridge binary to enable printing.
        </p>
      )}

      {useWebUSB ? (
        <p className="webusb-info" style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
          Select your embosser securely directly from the browser window prompt.
        </p>
      ) : (
        <>
          <label htmlFor="printer-name">Printer Name</label>
          <input
            id="printer-name"
            type="text"
            placeholder="e.g. ViewPlus Columbia"
            value={printerName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPrinterName(e.target.value)}
            disabled={!bridgeConnected}
          />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
        <label htmlFor="embosser-driver">Embosser Driver Model</label>
        <select
          id="embosser-driver"
          value={selectedDriverId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedDriverId(e.target.value)}
          style={{ padding: '0.4rem' }}
        >
          {EMBOSSER_LIST.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {renderViewPlusWarning()}
      </div>

      <button
        onClick={handlePrint}
        disabled={(!useWebUSB && !bridgeConnected) || status === 'printing'}
      >
        {status === 'printing' ? 'Printing...' : useWebUSB ? 'Select Embosser & Print' : 'Print'}
      </button>

      {status === 'success' && (
        <p className="status-ok" aria-live="polite">Sent to embosser successfully.</p>
      )}
      {status === 'error' && (
        <p className="status-err" role="alert">Error: {errorMsg}</p>
      )}
      {errorMsg && status === 'idle' && (
        <p className="status-err" role="alert">{errorMsg}</p>
      )}
    </div>
  );
}
