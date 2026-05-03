import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, UserInfo } from '../lib/api';

export interface PlayerIdentity {
  type: 'guest' | 'account';
  displayName: string;
  user?: UserInfo;
}

interface PlayerContextValue {
  player: PlayerIdentity | null;
  loading: boolean;
  setGuestName: (name: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const GUEST_KEY = 'vtvl_guest_name';
/** Username cached so startup can restore display name without a network round-trip. */
const CACHED_USERNAME_KEY = 'vtvl_cached_username';
/** userId cached so player.user.id is available for stats lookups without a round-trip. */
const CACHED_USER_ID_KEY = 'vtvl_cached_user_id';

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On startup, restore identity from the cached username/userId if available.
    // The actual session is maintained by the HttpOnly cookie — no token is stored
    // in JavaScript-accessible storage. Session validity is verified lazily on the
    // next authenticated API call (a 401/403 clears the cached identity).
    const cachedUsername = localStorage.getItem(CACHED_USERNAME_KEY);
    const cachedUserId = localStorage.getItem(CACHED_USER_ID_KEY);

    if (cachedUsername && cachedUserId) {
      // Restore full account identity from cache — no network call needed.
      // The HttpOnly cookie will authenticate the next request automatically.
      const cachedUser: UserInfo = { id: cachedUserId, username: cachedUsername, email: '' };
      setPlayer({ type: 'account', displayName: cachedUsername, user: cachedUser });
      setLoading(false);
      return;
    }

    // No cached account identity — check whether the server has an active session
    // (covers the first load after a new login from another tab/device).
    api.auth.me().then((res) => {
      if (res.user) {
        localStorage.setItem(CACHED_USERNAME_KEY, res.user.username);
        localStorage.setItem(CACHED_USER_ID_KEY, res.user.id);
        setPlayer({ type: 'account', displayName: res.user.username, user: res.user });
      } else {
        const guestName = localStorage.getItem(GUEST_KEY);
        if (guestName) setPlayer({ type: 'guest', displayName: guestName });
      }
    }).catch(() => {
      // Network unavailable — restore from guest name if present.
      const guestName = localStorage.getItem(GUEST_KEY);
      if (guestName) setPlayer({ type: 'guest', displayName: guestName });
    }).finally(() => setLoading(false));
  }, []);

  const setGuestName = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 24);
    localStorage.setItem(GUEST_KEY, trimmed);
    setPlayer({ type: 'guest', displayName: trimmed });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    localStorage.setItem(CACHED_USERNAME_KEY, res.user.username);
    localStorage.setItem(CACHED_USER_ID_KEY, res.user.id);
    setPlayer({ type: 'account', displayName: res.user.username, user: res.user });
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await api.auth.register(username, email, password);
    localStorage.setItem(CACHED_USERNAME_KEY, res.user.username);
    localStorage.setItem(CACHED_USER_ID_KEY, res.user.id);
    setPlayer({ type: 'account', displayName: res.user.username, user: res.user });
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    localStorage.removeItem(CACHED_USERNAME_KEY);
    localStorage.removeItem(CACHED_USER_ID_KEY);
    const guestName = localStorage.getItem(GUEST_KEY);
    setPlayer(guestName ? { type: 'guest', displayName: guestName } : null);
  }, []);

  return (
    <PlayerContext.Provider value={{ player, loading, setGuestName, login, register, logout }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
