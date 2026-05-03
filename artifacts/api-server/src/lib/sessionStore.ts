// Simple in-memory session store.
// Keys are session tokens (UUIDs), values are session data.

export interface SessionData {
  userId: string;
  username: string;
  email: string;
}

const store = new Map<string, SessionData>();

export function setSession(token: string, data: SessionData): void {
  store.set(token, data);
}

export function getSession(token: string | undefined): SessionData | null {
  if (!token) return null;
  return store.get(token) ?? null;
}

export function deleteSession(token: string): void {
  store.delete(token);
}
