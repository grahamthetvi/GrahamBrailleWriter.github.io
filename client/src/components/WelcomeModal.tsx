import { useEffect, useRef } from 'react';

interface WelcomeModalProps {
  onClose: () => void;
}

/**
 * First-visit onboarding modal.
 * Shown once, dismissed state saved to localStorage ('braille-vibe-welcome-seen').
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
            <div>
              <h3>Bridge App — Direct Embosser Printing</h3>
              <p>
                The <strong>🖨 Print</strong> toolbar button sends braille straight to
                a physical embosser (ViewPlus, Index, etc.), but it requires the free{' '}
                <strong>Graham Bridge</strong> helper app running on your computer.
                Download the right binary for your platform — Windows, macOS (Intel or
                Apple Silicon), or Linux — and run it in the background. The status bar
                will turn green once the editor detects the connection.
              </p>
              <p>
                With the bridge running, enter your printer name in the Print bar and
                click <strong>Print</strong> to send a raw BRF job via CUPS
                (macOS / Linux) or the Windows print spooler. Braille translation
                works fully in the browser without the bridge — it is only needed for
                direct-to-embosser printing.
              </p>
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
