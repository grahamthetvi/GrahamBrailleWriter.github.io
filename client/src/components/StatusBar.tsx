interface StatusBarProps {
  bridgeConnected: boolean;
  brfLength: number;
}

/**
 * Displays bridge connection status and document stats at the bottom of the screen.
 */
export function StatusBar({ bridgeConnected, brfLength }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span
        className={`bridge-indicator ${bridgeConnected ? 'connected' : 'disconnected'}`}
        title={bridgeConnected ? 'Bridge running on localhost:8080' : 'Bridge not detected'}
      >
        {bridgeConnected ? '● Bridge Connected' : '○ Bridge Offline'}
      </span>
      <span className="brf-stats">
        BRF: {brfLength} bytes
      </span>
    </div>
  );
}
