import { useEffect, useRef } from 'react';

interface WelcomeModalProps {
  onClose: () => void;
}

/**
 * First-visit onboarding modal.
 * Shown once, dismissed state saved to localStorage ('graham-braille-welcome-seen').
 * Covers: page layout (presets, ViewPlus padding), Bridge app, and Math/LaTeX.
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
              <h3>Page Layout — Presets, Cells &amp; Lines</h3>
              <p>
                Click <strong>⚙ Layout</strong> in the BRF Preview pane to open page
                settings. Use quick presets: <strong>8.5×11in</strong> (US Letter,{' '}
                <strong>32 × 25</strong> cells) or <strong>11×11.5in</strong> (wide
                tractor paper, <strong>40 × 25</strong>), or choose <strong>Custom</strong>{' '}
                and set <strong>Cells / row</strong> (10–100) and{' '}
                <strong>Lines / page</strong> (5–50) yourself—for example{' '}
                <strong>28</strong> lines for A4-style pages. These values drive the
                on-screen preview, the downloaded <code>.brf</code>, and are saved for
                your next visit.
              </p>
              <p>
                <strong>ViewPlus embossers:</strong> Under Layout you can tune{' '}
                <strong>left padding</strong> (extra blank cells per line) for US Letter.
                Padding is applied when printing only if your layout is US Letter
                (8.5×11 preset or 32 × 25). Single-sheet alignment varies by model; if you
                dial in a value that works for your paper and want to share it, email{' '}
                <a href="mailto:grahamthetvi@icloud.com">grahamthetvi@icloud.com</a>.
                When you use <strong>🖨 Print</strong> with a ViewPlus driver, a short
                reminder appears there too.
              </p>
            </div>
          </section>

          {/* 2. Embossing & Printing */}
          <section className="welcome-section">
            <div className="welcome-section-icon" aria-hidden="true">🖨</div>
            <div className="welcome-bridge-content">
              <h3>Seamless Embossing (WebUSB &amp; Bridge)</h3>
              <p>
                The app includes <strong>embosser drivers</strong> for Enabling Technologies, Index, ViewPlus, Braillo, and others—pick the model that matches your device when you print.
                <strong> ChromeOS</strong> users can use WebUSB to send braille directly from the browser.
                <strong> Windows/macOS/Linux</strong> users run the small <strong>Graham Bridge</strong> app so print jobs reach the embosser reliably. ViewPlus left-margin tuning stays under <strong>⚙ Layout</strong> (see above).
              </p>

              <div className="install-grid">
                <div className="install-card">
                  <h4>🪟 Windows Bridge</h4>
                  <ol>
                    <li>Download &amp; extract the zip</li>
                    <li>Move <code>.exe</code> to a safe folder</li>
                    <li>Add to <strong>Startup</strong> folder</li>
                  </ol>
                </div>
                <div className="install-card">
                  <h4>🍎 macOS Bridge</h4>
                  <ol>
                    <li>Drag <code>.app</code> to Applications</li>
                    <li>Right-click &rarr; <strong>Open</strong> first time</li>
                    <li>Add to <strong>Login Items</strong></li>
                  </ol>
                </div>
                <div className="install-card">
                  <h4>🐧 Linux Bridge</h4>
                  <ol>
                    <li>Move binary to <code>/usr/local/bin</code></li>
                    <li>Install <code>.desktop</code> shortcut</li>
                    <li>Launch from app menu</li>
                  </ol>
                </div>
              </div>

              <div className="welcome-footer-links">
                <a href="https://github.com/grahamthetvi/Graham_Braille_Editor/releases" target="_blank" rel="noopener noreferrer" className="welcome-btn-secondary">
                  📥 Download Desktop Bridge
                </a>
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
