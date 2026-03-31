import { useEffect, useRef } from 'react';
import type { SessionMetadata } from '../services/sessionStore';

interface RestoreModalProps {
  sessions: SessionMetadata[];
  onRestore: (id: string) => void;
  onDiscardItem: (id: string) => void;
  onDiscardAll: () => void;
}

export function RestoreModal({ sessions, onRestore, onDiscardItem, onDiscardAll }: RestoreModalProps) {
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the primary button when opened
  useEffect(() => {
    primaryBtnRef.current?.focus();
  }, []);

  const singleSession = sessions.length === 1 ? sessions[0] : null;

  return (
    <div
      className="welcome-overlay"
      aria-label="Restore previous session"
      onClick={onDiscardAll}
    >
      <div
        className="welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <header className="welcome-header">
          <h2 id="restore-title">Restore Unsaved Documents?</h2>
          <button
            className="welcome-close"
            onClick={onDiscardAll}
            aria-label="Discard all previous sessions"
          >
            ✕
          </button>
        </header>

        <div className="welcome-body" style={{ padding: '1rem 2rem', overflowY: 'auto' }}>
          <p>Unsaved changes from previous sessions were found in your browser.</p>
          
          {singleSession ? (
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
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Last edited: {new Date(singleSession.updatedAt).toLocaleString()}
              </div>
              {singleSession.preview || <em>Empty document</em>}
            </div>
          ) : (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sessions.map(session => (
                <div
                  key={session.id}
                  style={{
                    background: 'rgba(0,0,0,0.05)',
                    padding: '1rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Last edited: {new Date(session.updatedAt).toLocaleString()}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="welcome-btn-secondary" 
                        onClick={() => onDiscardItem(session.id)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'transparent' }}
                      >
                        Discard
                      </button>
                      <button 
                        className="welcome-btn-primary" 
                        onClick={() => onRestore(session.id)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {session.preview || <em>Empty document</em>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {singleSession && <p>Would you like to restore this document?</p>}
        </div>

        <footer className="welcome-footer" style={{ gap: '1rem', padding: '1rem 2rem' }}>
          <button
            className="welcome-btn-secondary"
            onClick={onDiscardAll}
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            {singleSession ? 'Discard' : 'Discard All'}
          </button>
          {singleSession && (
            <button
              ref={primaryBtnRef}
              className="welcome-btn-primary"
              onClick={() => onRestore(singleSession.id)}
            >
              Restore
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
