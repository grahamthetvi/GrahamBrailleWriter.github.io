const INDEX_KEY = 'graham-braille-editor-sessions-index';
const LEGACY_AUTOSAVE_KEY = 'graham-braille-editor-text-backup';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionMetadata {
  id: string;
  preview: string;
  updatedAt: number;
  isExported: boolean;
}

export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getSessionIndex(): SessionMetadata[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionMetadata[];
  } catch {
    return [];
  }
}

function saveSessionIndex(index: SessionMetadata[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function cleanupOldSessions() {
  const index = getSessionIndex();
  const now = Date.now();
  
  const validSessions = index.filter(session => {
    // Keep it if it's less than 30 days old and NOT exported.
    // Exported sessions don't need to be kept to save browser space.
    const isExpired = (now - session.updatedAt) > THIRTY_DAYS_MS;
    if (isExpired || session.isExported) {
      localStorage.removeItem(`graham-braille-editor-session-${session.id}`);
      return false;
    }
    return true;
  });

  saveSessionIndex(validSessions);
}

export function getRecoverableSessions(): SessionMetadata[] {
  return getSessionIndex()
    .filter(s => !s.isExported)
    .sort((a, b) => b.updatedAt - a.updatedAt); // Newest first
}

export function getSessionText(id: string): string | null {
  return localStorage.getItem(`graham-braille-editor-session-${id}`);
}

export function saveSession(id: string, text: string) {
  const trimmed = text.trim();
  const index = getSessionIndex();
  let session = index.find(s => s.id === id);
  
  if (trimmed === "" && !session) {
    // Don't create new sessions for completely empty documents
    return;
  }
  
  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines.length > 0 ? lines[0] : '';
  const preview = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
  
  const updatedAt = Date.now();

  if (session) {
    session.preview = preview;
    session.updatedAt = updatedAt;
  } else {
    session = { id, preview, updatedAt, isExported: false };
    index.push(session);
  }

  saveSessionIndex(index);
  localStorage.setItem(`graham-braille-editor-session-${id}`, text);
}

export function markExported(id: string) {
  const index = getSessionIndex();
  const session = index.find(s => s.id === id);
  if (session) {
    session.isExported = true;
    saveSessionIndex(index);
    // Remove actual text data immediately since it's exported and doesn't need recovery
    localStorage.removeItem(`graham-braille-editor-session-${id}`);
  }
}

export function discardSession(id: string) {
  const index = getSessionIndex().filter(s => s.id !== id);
  saveSessionIndex(index);
  localStorage.removeItem(`graham-braille-editor-session-${id}`);
}

export function discardAllSessions() {
  const index = getSessionIndex();
  for (const session of index) {
    localStorage.removeItem(`graham-braille-editor-session-${session.id}`);
  }
  saveSessionIndex([]);
}

export function migrateLegacyAutosave() {
  const legacyText = localStorage.getItem(LEGACY_AUTOSAVE_KEY);
  if (legacyText && legacyText.trim()) {
    const id = generateSessionId();
    saveSession(id, legacyText);
    
    // Fudge the timestamp back a minute so it doesn't just say "seconds ago" unless it actually was
    const index = getSessionIndex();
    const session = index.find(s => s.id === id);
    if (session) {
      session.updatedAt = Date.now() - 60000;
      saveSessionIndex(index);
    }
  }
  // Remove the old key so we don't migrate again
  localStorage.removeItem(LEGACY_AUTOSAVE_KEY);
}
