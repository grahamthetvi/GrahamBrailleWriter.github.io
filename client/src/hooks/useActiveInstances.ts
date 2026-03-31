import { useEffect, useState } from 'react';

const BROADCAST_CHANNEL_NAME = 'graham-braille-editor-instances';

export function useActiveInstances() {
  const [isSecondaryInstance, setIsSecondaryInstance] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      setIsChecking(false);
      return;
    }

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    let isPrimary = true;

    const timeout = setTimeout(() => {
      if (isPrimary) {
        setIsChecking(false);
      }
    }, 250); // 250ms is plenty for local BroadcastChannel communication

    channel.onmessage = (event) => {
      if (event.data === 'PING') {
        // Someone else just opened a new tab. Tell them we exist!
        channel.postMessage('PONG');
      } else if (event.data === 'PONG') {
        // We heard a PONG, meaning an older tab is already active
        isPrimary = false;
        setIsSecondaryInstance(true);
        setIsChecking(false);
        clearTimeout(timeout);
      }
    };

    // Shout out to see if anyone is listening
    channel.postMessage('PING');

    return () => {
      channel.close();
      clearTimeout(timeout);
    };
  }, []);

  return { isSecondaryInstance, isChecking };
}
