import { useEffect, useRef, useState } from 'react';

const AUTOSAVE_KEY = 'graham-braille-editor-text-backup';
const AUTOSAVE_DEBOUNCE_MS = 1000;

export function useAutosave(
  currentText: string,
  onRestore: (restoredText: string) => void
) {
  const [hasRestored, setHasRestored] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initial Load: Restore from backup once
  useEffect(() => {
    if (!hasRestored) {
      const backup = localStorage.getItem(AUTOSAVE_KEY);
      if (backup && backup.trim()) {
        onRestore(backup);
      }
      setHasRestored(true);
    }
  }, [hasRestored, onRestore]);

  // 2. Debounced save
  useEffect(() => {
    if (!hasRestored) return;

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
  }, [currentText, hasRestored]);

  // Provide a manual clear method (e.g. if the user wants to trash their document)
  function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
  }

  return { clearAutosave };
}
