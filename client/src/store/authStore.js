import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user:        null,
  accessToken: null,
  isLoading:   true,

  setAuth:        ({ user, accessToken }) => set({ user, accessToken, isLoading: false }),
  setAccessToken: (token)                 => set({ accessToken: token }),
  setUser:        (user)                  => set({ user }),
  setLoading:     (v)                     => set({ isLoading: v }),
  logout:         ()                      => set({ user: null, accessToken: null, isLoading: false }),

  isAuthenticated: () => {
    const { user, accessToken } = get();
    return !!(user && accessToken);
  },
}));
