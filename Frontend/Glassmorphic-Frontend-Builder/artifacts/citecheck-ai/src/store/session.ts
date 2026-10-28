import { create } from 'zustand';
import type { Role, User } from '@/lib/api/types';

type SessionState = {
  token: string | null; user: User | null; selectedFinding: string | null;
  theme: 'dark' | 'light'; reducedMotion: boolean;
  setSession: (token: string, user: User) => void; logout: () => void;
  setSelectedFinding: (id: string | null) => void; setTheme: (theme: 'dark' | 'light') => void;
  setReducedMotion: (value: boolean) => void; demoRole: (role: Role) => void;
};
export const useSession = create<SessionState>((set) => ({
  token: null, user: null, selectedFinding: null, theme: 'light', reducedMotion: false,
  setSession: (token, user) => set({ token, user }),
  logout: () => set({ token: null, user: null }),
  setSelectedFinding: (selectedFinding) => set({ selectedFinding }),
  setTheme: (theme) => set({ theme }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  demoRole: (role) => set((state) => ({ user: { id: `preview-${role}`, name: role === 'creator' ? 'Meera Nair' : role === 'reviewer' ? 'Nisha Rao' : 'Arjun Mehta', role }, token: state.token || `preview-${role}` })),
}));
