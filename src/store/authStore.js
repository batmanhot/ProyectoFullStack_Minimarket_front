import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Login
      login: (userData, token) => {
        localStorage.setItem('token', token);
        set({
          user: userData,
          token: token,
          isAuthenticated: true,
        });
      },

      // Logout
      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      // Actualizar usuario
      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData },
        }));
      },

      // Verificar si el usuario tiene un rol específico
      hasRole: (role) => {
        const state = useAuthStore.getState();
        return state.user?.role === role;
      },

      // Verificar si el usuario tiene alguno de los roles especificados
      hasAnyRole: (roles) => {
        const state = useAuthStore.getState();
        return roles.includes(state.user?.role);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
