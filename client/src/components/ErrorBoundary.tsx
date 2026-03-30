import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  handleRestart = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Pull recent backup so they don't lose work
      const rawText = localStorage.getItem('graham-braille-editor-text-backup') || '';
      
      const componentStack = this.state.errorInfo?.componentStack || 'Unknown stack';
      const errorMessage = this.state.error?.message || 'Unknown error';

      const emailBody = `Describe what you were doing before the crash:\\n\\n\\n--- Crash details ---\\nError: ${errorMessage}\\n\\nStack Trace:\\n${componentStack}`;
      const mailtoLink = `mailto:grahamthetvi@icloud.com?subject=Graham%20Braille%20Editor%20Crash&body=${encodeURIComponent(emailBody)}`;

      return (
        <div className="error-boundary-overlay" style={{ padding: '2rem', background: '#2c0b0e', color: '#ffb3b3', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ color: '#ff4d4d' }}>🚨 Application Crashed</h1>
            <p>We are very sorry, but the Braille Editor encountered an unexpected error. Don't worry, your work may be safe.</p>
            
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button 
                onClick={this.handleRestart}
                style={{ padding: '0.8rem 1.5rem', background: '#ff4d4d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Reload Application
              </button>
              <a 
                href={mailtoLink}
                style={{ padding: '0.8rem 1.5rem', background: 'transparent', color: '#ffb3b3', border: '1px solid #ff4d4d', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold' }}
              >
                📧 Report To Developer
              </a>
            </div>

            {rawText.trim() && (
               <div style={{ marginTop: '2.5rem' }}>
                 <h2 style={{ fontSize: '1.2rem' }}>Rescue your untranslated text:</h2>
                 <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Copy everything below to a safe place before clicking "Reload Application".</p>
                 <textarea 
                   readOnly 
                   value={rawText} 
                   style={{ 
                     width: '100%', 
                     height: '250px', 
                     padding: '1rem', 
                     background: '#1a0505', 
                     color: '#ffb3b3', 
                     border: '1px solid #801a1a', 
                     borderRadius: '4px',
                     fontFamily: 'monospace'
                   }}
                 />
               </div>
            )}

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a0505', borderRadius: '4px', border: '1px solid #801a1a', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '1rem', marginTop: 0 }}>Error Details (for developers)</h3>
              <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                {this.state.error?.toString()}
                {'\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
