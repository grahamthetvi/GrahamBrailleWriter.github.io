import { useEffect, useRef, useState } from 'react';

const AUTOSAVE_KEY = 'graham-braille-editor-text-backup';
const AUTOSAVE_DEBOUNCE_MS = 1000;

export function useAutosave(
  currentText: string,
  enabled: boolean,
  onBackupFound: (backupText: string) => void
) {
  const [hasChecked, setHasChecked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initial Load: Check for backup
  useEffect(() => {
    if (!hasChecked) {
      const backup = localStorage.getItem(AUTOSAVE_KEY);
      if (backup && backup.trim()) {
        onBackupFound(backup);
      }
      setHasChecked(true);
    }
  }, [hasChecked, onBackupFound]);

  // 2. Debounced save
  useEffect(() => {
    if (!hasChecked || !enabled) return;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, currentText);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentText, hasChecked, enabled]);

  // Provide a manual clear method (e.g. if the user wants to trash their document)
  function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
  }

  return { clearAutosave };
}
