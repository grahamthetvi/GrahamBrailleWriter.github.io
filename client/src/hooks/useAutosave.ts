import { useEffect, useRef, useState } from 'react';
import {
  cleanupOldSessions,
  getRecoverableSessions,
  saveSession,
  migrateLegacyAutosave,
  type SessionMetadata,
} from '../services/sessionStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;

export function useAutosave(
  sessionId: string,
  currentText: string,
  enabled: boolean,
  isSecondaryInstance: boolean,
  isChecking: boolean,
  onBackupsFound: (sessions: SessionMetadata[]) => void
) {
  const [hasChecked, setHasChecked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Migrate any old version 1 string text backups into the new array structure 
  useEffect(() => {
    migrateLegacyAutosave();
    cleanupOldSessions();
  }, []);

  // 1. Initial Load: Check for backup
  useEffect(() => {
    if (isChecking || hasChecked) return;
    
    // If we're the second tab opened, act as a fresh document, don't show recover modal.
    if (!isSecondaryInstance) {
      const backups = getRecoverableSessions();
      if (backups.length > 0) {
        onBackupsFound(backups);
      }
    }
    setHasChecked(true);
  }, [hasChecked, isChecking, isSecondaryInstance, onBackupsFound]);

  // 2. Debounced save
  useEffect(() => {
    if (!hasChecked || isChecking || !enabled) return;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      saveSession(sessionId, currentText);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentText, sessionId, hasChecked, isChecking, enabled]);
}
