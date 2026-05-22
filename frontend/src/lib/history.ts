// Chat history manager using localStorage

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  scanResult?: any;
  blocked?: boolean;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  stats: { safe: number; suspicious: number; malicious: number };
}

const STORAGE_KEY = "promptshield_history";
const MAX_SESSIONS = 50;

export function getAllSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const sessions: ChatSession[] = JSON.parse(raw);
    return sessions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function getSession(id: string): ChatSession | null {
  const sessions = getAllSessions();
  return sessions.find(s => s.id === id) || null;
}

export function saveSession(session: ChatSession): void {
  if (typeof window === "undefined") return;
  try {
    const sessions = getAllSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.unshift(session);
    }
    // Keep only MAX_SESSIONS
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const sessions = getAllSessions().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

export function clearAllSessions(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function createNewSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    stats: { safe: 0, suspicious: 0, malicious: 0 },
  };
}

export function generateTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === "user");
  if (!firstUser) return "New Chat";
  const text = firstUser.text.trim();
  if (text.length <= 40) return text;
  return text.slice(0, 37) + "…";
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
