import { create } from 'zustand';
import type { Role, User } from '@/lib/api/types';
import { getSupabase } from '@/lib/supabase';

const TOKEN_KEY = 'citecheck_token';
const USER_KEY = 'citecheck_user';

function getInitialToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getInitialUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

type SessionState = {
  token: string | null;
  user: User | null;
  selectedFinding: string | null;
  theme: 'dark' | 'light';
  reducedMotion: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void | Promise<void>;
  setSelectedFinding: (id: string | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setReducedMotion: (value: boolean) => void;
  demoRole: (role: Role) => void;
};

let isLoggingOut = false;

export const useSession = create<SessionState>((set) => ({
  token: getInitialToken(),
  user: getInitialUser(),
  selectedFinding: null,
  theme: 'light',
  reducedMotion: false,
  setSession: (token, user) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // ignore quota / private mode errors
    }
    set({ token, user });
  },
  logout: async () => {
    if (isLoggingOut) return;
    isLoggingOut = true;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('citecheck_oauth_role');
      sessionStorage.clear();
      const sb = getSupabase();
      if (sb) {
        // scope: 'local' clears local session storage and avoids long network hangs
        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    } catch {
      // ignore
    } finally {
      set({ token: null, user: null, selectedFinding: null });
      setTimeout(() => {
        isLoggingOut = false;
      }, 300);
    }
  },
  setSelectedFinding: (selectedFinding) => set({ selectedFinding }),
  setTheme: (theme) => set({ theme }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  demoRole: (role) => {
    const user: User = {
      id: `preview-${role}`,
      name: role === 'creator' ? 'Meera Nair' : role === 'reviewer' ? 'Nisha Rao' : 'Arjun Mehta',
      role,
    };
    const token = `preview-${role}`;
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
    set({ user, token });
  },
}));
