import { useEffect, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { Button } from './ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'signin' | 'signup';

const MIN_PASSWORD_LENGTH = 12;

export function SignInModal({ open, onClose }: Props) {
  const { login, register } = usePlayer();
  const [tab, setTab] = useState<Tab>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form whenever the modal is closed so a fresh open never reveals
  // previously typed credentials or a stale error message.
  useEffect(() => {
    if (!open) {
      setUsername('');
      setEmail('');
      setPassword('');
      setError('');
      setLoading(false);
      setTab('signin');
    }
  }, [open]);

  if (!open) return null;

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation gives users immediate feedback rather than
    // forcing a server round-trip for obviously bad input.
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Email and password are required');
      return;
    }
    if (tab === 'signup') {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        setError('Choose a pilot handle');
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'signup') {
        await register(username.trim(), trimmedEmail, password);
      } else {
        await login(trimmedEmail, password);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg tracking-wide">
            {tab === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 mb-6 bg-slate-800 rounded-md p-1">
          {(['signin', 'signup'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex-1 py-1.5 text-sm font-mono uppercase tracking-wider rounded-sm transition-colors ${
                tab === t ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={24}
                autoComplete="username"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="Pilot handle"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete={tab === 'signup' ? 'email' : 'username'}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={tab === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder={tab === 'signup' ? `Min ${MIN_PASSWORD_LENGTH} characters` : '••••••••'}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="text-red-400 text-sm font-mono bg-red-500/10 border border-red-500/30 rounded px-3 py-2"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-bold font-mono uppercase tracking-wider"
          >
            {loading ? 'Loading…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>

          <p className="text-center text-xs text-slate-500 pt-1">
            {tab === 'signin' ? (
              <>
                No account?{' '}
                <button type="button" onClick={() => switchTab('signup')} className="text-amber-400 hover:text-amber-300 underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have one?{' '}
                <button type="button" onClick={() => switchTab('signin')} className="text-amber-400 hover:text-amber-300 underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
