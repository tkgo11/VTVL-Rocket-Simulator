import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, UserInfo } from '../lib/api';

export interface PlayerIdentity {
  type: 'guest' | 'account';
  displayName: string;
  user?: UserInfo;
  token?: string;
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
const TOKEN_KEY = 'vtvl_session_token';
/** Username cached alongside the token so startup never needs a network call. */
const CACHED_USERNAME_KEY = 'vtvl_cached_username';
/** userId cached so player.user.id is available offline for stats lookups. */
const CACHED_USER_ID_KEY = 'vtvl_cached_user_id';

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);

    // Restore state from localStorage without any network call.
    // If a token and cached username exist the user is treated as 'account'
    // immediately — Solo mode is completely offline even for returning users.
    // Token validity is verified lazily the next time a network call is made
    // (e.g. when entering a multiplayer room) and the token is cleared on 401.
    if (!storedToken) {
      const guestName = localStorage.getItem(GUEST_KEY);
      if (guestName) setPlayer({ type: 'guest', displayName: guestName });
      setLoading(false);
      return;
    }

    const cachedUsername = localStorage.getItem(CACHED_USERNAME_KEY);
    const cachedUserId = localStorage.getItem(CACHED_USER_ID_KEY);
    if (cachedUsername && cachedUserId) {
      // Restore full account identity from cache — no network call.
      // player.user.id is available so stats lookups work offline.
      const cachedUser: UserInfo = { id: cachedUserId, username: cachedUsername, email: '' };
      setPlayer({ type: 'account', displayName: cachedUsername, user: cachedUser, token: storedToken });
      setLoading(false);
    } else {
      // First launch after an old session without the cached identity —
      // validate once to populate the cache, then go offline from next load.
      api.auth.me(storedToken).then((res) => {
        if (res.user) {
          localStorage.setItem(CACHED_USERNAME_KEY, res.user.username);
          localStorage.setItem(CACHED_USER_ID_KEY, res.user.id);
          setPlayer({ type: 'account', displayName: res.user.username, user: res.user, token: storedToken });
        } else {
          localStorage.removeItem(TOKEN_KEY);
          const guestName = localStorage.getItem(GUEST_KEY);
          if (guestName) setPlayer({ type: 'guest', displayName: guestName });
        }
      }).catch(() => {
        // Network unavailable — restore from guest name if present.
        const guestName = localStorage.getItem(GUEST_KEY);
        if (guestName) setPlayer({ type: 'guest', displayName: guestName });
      }).finally(() => setLoading(false));
    }
  }, []);

  const setGuestName = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 24);
    localStorage.setItem(GUEST_KEY, trimmed);
    setPlayer({ type: 'guest', displayName: trimmed });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(CACHED_USERNAME_KEY, res.user.username);
    localStorage.setItem(CACHED_USER_ID_KEY, res.user.id);
    setPlayer({ type: 'account', displayName: res.user.username, user: res.user, token: res.token });
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await api.auth.register(username, email, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(CACHED_USERNAME_KEY, res.user.username);
    localStorage.setItem(CACHED_USER_ID_KEY, res.user.id);
    setPlayer({ type: 'account', displayName: res.user.username, user: res.user, token: res.token });
  }, []);

  const logout = useCallback(async () => {
    const token = player?.token;
    await api.auth.logout(token).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CACHED_USERNAME_KEY);
    localStorage.removeItem(CACHED_USER_ID_KEY);
    const guestName = localStorage.getItem(GUEST_KEY);
    setPlayer(guestName ? { type: 'guest', displayName: guestName } : null);
  }, [player]);

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
