import { useEffect, useRef } from 'react';

interface WelcomeModalProps {
  onClose: () => void;
}

/**
 * First-visit onboarding modal.
 * Shown once, dismissed state saved to localStorage ('graham-braille-welcome-seen').
 * Covers: page layout settings, Bridge app, and Math/LaTeX translation.
 */
export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the "Get Started" button as soon as the modal opens.
  useEffect(() => {
    primaryBtnRef.current?.focus();
  }, []);

  // ESC key dismisses the modal.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    /* Clicking the backdrop also closes the modal */
    <div
      className="welcome-overlay"
      onClick={onClose}
      aria-label="Close welcome guide"
    >
      <div
        className="welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        /* Stop clicks inside the card from bubbling to the backdrop */
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="welcome-header">
          <h2 id="welcome-title">Welcome to Graham Braille Editor</h2>
          <button
            className="welcome-close"
            onClick={onClose}
            aria-label="Close welcome guide"
          >
            ✕
          </button>
        </header>

        {/* ── Body — three feature sections ────────────────────────────── */}
        <div className="welcome-body">

          {/* 1. Page Layout */}
          <section className="welcome-section">
            <div className="welcome-section-icon" aria-hidden="true">⚙</div>
            <div>
              <h3>Page Layout — Cells &amp; Lines</h3>
              <p>
                Click the <strong>⚙ Layout</strong> button in the BRF Preview pane to
                set the dimensions of every page. <strong>Cells / row</strong> is the
                line width (10–100 cells); most embossers use <strong>40</strong> for
                US Letter or <strong>32</strong> for A4. <strong>Lines / page</strong>{' '}
                sets how many braille lines fit on one side (5–50); commonly{' '}
                <strong>25</strong> for letter or <strong>28</strong> for A4. These
                settings control both the on-screen preview and the downloaded{' '}
                <code>.brf</code> file, and are remembered between visits.
              </p>
            </div>
          </section>

          {/* 2. Bridge App */}
          <section className="welcome-section">
            <div className="welcome-section-icon" aria-hidden="true">🖨</div>
            <div className="welcome-bridge-content">
              <h3>Bridge App &mdash; Direct Embosser Printing</h3>
              <p>
                To print directly to an embosser, download the <strong>Graham Bridge</strong> helper app for your platform:
              </p>

              <div className="install-grid">
                <div className="install-card">
                  <h4>🪟 Windows</h4>
                  <ol>
                    <li>Download &amp; extract the Windows zip</li>
                    <li>Move <code>.exe</code> to a safe folder</li>
                    <li>Add to <strong>Startup</strong> folder</li>
                  </ol>
                </div>
                <div className="install-card">
                  <h4>🍎 macOS</h4>
                  <ol>
                    <li>Drag <code>.app</code> to Applications</li>
                    <li>Right-click &rarr; <strong>Open</strong> first time</li>
                    <li>Add to <strong>Login Items</strong></li>
                  </ol>
                </div>
                <div className="install-card">
                  <h4>🐧 Linux</h4>
                  <ol>
                    <li>Move binary to <code>/usr/local/bin</code></li>
                    <li>Install <code>.desktop</code> shortcut</li>
                    <li>Launch from app menu</li>
                  </ol>
                </div>
              </div>

              <div className="welcome-footer-links">
                <a href="https://github.com/grahamthetvi/Graham_Braille_Editor/releases" target="_blank" rel="noopener noreferrer" className="welcome-btn-secondary">
                  📥 Download Latest Release
                </a>
                <p className="welcome-note">
                  The bridge is only needed for direct printing. Download &amp; translation work fully in-browser without it.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Math / LaTeX */}
          <section className="welcome-section">
            <div className="welcome-section-icon" aria-hidden="true">∑</div>
            <div>
              <h3>Math Translation — LaTeX to Braille</h3>
              <p>
                The editor auto-detects <strong>LaTeX math</strong> in your text and
                translates it to braille math notation. Wrap display (block) equations
                in <code>{'$$'}…{'$$'}</code> and inline expressions in{' '}
                <code>{`\\(`}…{`\\)`}</code>. Use the <strong>Math Focus</strong>{' '}
                selector in the toolbar to choose <strong>Nemeth</strong> (North
                America) or <strong>UEB Math</strong> (international standard).
              </p>
              <p className="welcome-tip">
                <strong>Tip:</strong> For best results, paste your document into an AI
                assistant (ChatGPT, Claude, Gemini, etc.) with the following request
                before pasting it here:
                <br /><br />
                <em>
                  "Please reformat my text so that every mathematical expression,
                  equation, and arithmetic operation — including plain numbers used in a
                  math context — is wrapped in LaTeX notation: <code>{`\\(`}…{`\\)`}</code>{' '}
                  for inline math and <code>{'$$'}…{'$$'}</code> for display equations.
                  Leave all non-math prose unchanged."
                </em>
              </p>
            </div>
          </section>

        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="welcome-footer">
          <button
            ref={primaryBtnRef}
            className="welcome-btn-primary"
            onClick={onClose}
          >
            Get Started
          </button>
        </footer>
      </div>
    </div>
  );
}
