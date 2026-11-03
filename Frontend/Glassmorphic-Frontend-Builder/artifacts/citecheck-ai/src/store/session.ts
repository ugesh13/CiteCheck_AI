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
  demoRole: (role: Role) => Promise<void>;
};

let isLoggingOut = false;

export const useSession = create<SessionState>((set, get) => ({
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
  demoRole: async (role) => {
    const currentUser = get().user;
    const isRealUser = Boolean(
      currentUser?.name &&
      !currentUser.id.startsWith('preview-') &&
      !['Meera Nair', 'Nisha Rao', 'Arjun Mehta'].includes(currentUser.name)
    );

    // If a real logged-in user (e.g. via Google OAuth) is testing different roles,
    // preserve their identity, name, and email while switching their active role.
    if (isRealUser && currentUser) {
      const updatedUser: User = {
        ...currentUser,
        role,
      };
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        localStorage.setItem('citecheck_oauth_role', role);
      } catch {
        // ignore
      }
      set({ user: updatedUser });
      return;
    }

    try {
      const email = role === 'creator' ? 'meera@lumenpay.example' : role === 'reviewer' ? 'nisha@lumenpay.example' : 'arjun@lumenpay.example';
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'demo-persona', role }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.token && data?.user) {
          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          set({ user: data.user, token: data.token });
          return;
        }
      }
    } catch (e) {
      console.warn('Real token swap failed, applying preview token fallback', e);
    }

    const personaName = role === 'creator' ? 'Meera Nair' : role === 'reviewer' ? 'Nisha Rao' : 'Arjun Mehta';
    const user: User = {
      id: `preview-${role}`,
      name: personaName,
      role,
      email: `${role}@lumenpay.example`,
    };
    const token = `preview-token-${role}`;
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
    set({ user, token });
  },
}));
