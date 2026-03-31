import { useEffect, useRef } from 'react';

interface RestoreModalProps {
  backupText: string;
  onRestore: () => void;
  onDiscard: () => void;
}

export function RestoreModal({ backupText, onRestore, onDiscard }: RestoreModalProps) {
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the primary button when opened
  useEffect(() => {
    primaryBtnRef.current?.focus();
  }, []);

  // ESC key discards the backup (like clicking Discard)
  // or maybe we shouldn't map ESC to discard automatically for safety, 
  // but let's just make ESC ignore/discard so it doesn't block the user.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDiscard();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDiscard]);

  // Get the first line of the backup text, truncate if extremely long
  const lines = backupText.trim().split(/\r?\n/);
  const firstLine = lines.length > 0 ? lines[0] : '';
  const displayLine = firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;

  return (
    <div
      className="welcome-overlay"
      aria-label="Restore previous session"
      onClick={onDiscard}
    >
      <div
        className="welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <header className="welcome-header">
          <h2 id="restore-title">Restore Session?</h2>
          <button
            className="welcome-close"
            onClick={onDiscard}
            aria-label="Discard previous session"
          >
            ✕
          </button>
        </header>

        <div className="welcome-body" style={{ padding: '1rem 2rem' }}>
          <p>Unsaved changes from your previous session were found.</p>
          <div
            style={{
              background: 'rgba(0,0,0,0.1)',
              padding: '1rem',
              borderRadius: '4px',
              marginTop: '1rem',
              marginBottom: '1rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              border: '1px solid var(--border)',
            }}
          >
            {displayLine || <em>Empty document</em>}
          </div>
          <p>Would you like to restore this document?</p>
        </div>

        <footer className="welcome-footer" style={{ gap: '1rem' }}>
          <button
            className="welcome-btn-secondary"
            onClick={onDiscard}
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            Discard
          </button>
          <button
            ref={primaryBtnRef}
            className="welcome-btn-primary"
            onClick={onRestore}
          >
            Restore
          </button>
        </footer>
      </div>
    </div>
  );
}
