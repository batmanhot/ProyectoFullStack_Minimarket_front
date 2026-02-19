import api from '../config/api';

// ============================================
// USUARIOS BASE DEL SISTEMA
// (Solo para desarrollo - QUITAR en producción)
// ============================================
const USUARIOS_BASE = [
  {
    username: 'admin',
    password: 'admin123',
    user: {
      id: 1,
      username: 'admin',
      email: 'admin@pos.com',
      fullName: 'Administrador del Sistema',
      role: 'admin',
      isActive: true
    }
  },
  {
    username: 'gerente',
    password: 'gerente123',
    user: {
      id: 2,
      username: 'gerente',
      email: 'gerente@pos.com',
      fullName: 'Juan Pérez - Gerente',
      role: 'gerente',
      isActive: true
    }
  },
  {
    username: 'supervisor',
    password: 'super123',
    user: {
      id: 3,
      username: 'supervisor',
      email: 'supervisor@pos.com',
      fullName: 'María García - Supervisora',
      role: 'supervisor',
      isActive: true
    }
  },
  {
    username: 'cajero',
    password: 'cajero123',
    user: {
      id: 4,
      username: 'cajero',
      email: 'cajero@pos.com',
      fullName: 'Carlos López - Cajero',
      role: 'cajero',
      isActive: true
    }
  }
];

const authService = {
  // Login
  login: async (credentials) => {
    try {
      // ===== MODO DESARROLLO - SIMULACIÓN DE LOGIN =====
      // Comentar/eliminar este bloque cuando conectes el backend real
      
      await new Promise(resolve => setTimeout(resolve, 800)); // Simular delay de red
      
      const usuarioEncontrado = USUARIOS_BASE.find(
        u => u.username === credentials.username && u.password === credentials.password
      );

      if (!usuarioEncontrado) {
        throw { message: 'Usuario o contraseña incorrectos' };
      }

      return {
        user: usuarioEncontrado.user,
        token: `jwt-mock-${usuarioEncontrado.user.id}-${Date.now()}`,
        message: 'Login exitoso'
      };
      
      // ===== FIN MODO DESARROLLO =====
      
      // Descomenta esto cuando tengas el backend:
      // const response = await api.post('/auth/login', credentials);
      // return response.data;
      
    } catch (error) {
      throw error.response?.data || error || { message: 'Error al iniciar sesión' };
    }
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  },

  // Obtener perfil del usuario actual
  getProfile: async () => {
    try {
      const response = await api.get('/auth/profile');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener perfil' };
    }
  },

  // Cambiar contraseña
  changePassword: async (passwords) => {
    try {
      const response = await api.post('/auth/change-password', passwords);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al cambiar contraseña' };
    }
  },

  // Recuperar contraseña (solicitar reset)
  requestPasswordReset: async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al solicitar recuperación' };
    }
  },

  // Resetear contraseña con token
  resetPassword: async (token, newPassword) => {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al resetear contraseña' };
    }
  },

  // Verificar token
  verifyToken: async () => {
    try {
      const response = await api.get('/auth/verify');
      return response.data;
    } catch (error) {
      return false;
    }
  },
};

export default authService;
