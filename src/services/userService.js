import api from '../config/api';

const getStoredData = (key, defaultValue) => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

const saveStoredData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

let MOCK_USERS = getStoredData('pos_users', [
  {
    id: 1,
    username: 'admin',
    email: 'admin@pos.com',
    fullName: 'Administrador del Sistema',
    role: 'admin',
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z'
  },
  {
    id: 2,
    username: 'gerente',
    email: 'gerente@pos.com',
    fullName: 'Juan Pérez - Gerente',
    role: 'gerente',
    isActive: true,
    createdAt: '2026-01-20T14:30:00Z'
  },
  {
    id: 3,
    username: 'supervisor',
    email: 'supervisor@pos.com',
    fullName: 'María García - Supervisora',
    role: 'supervisor',
    isActive: true,
    createdAt: '2026-02-01T09:15:00Z'
  },
  {
    id: 4,
    username: 'cajero',
    email: 'cajero@pos.com',
    fullName: 'Carlos López - Cajero',
    role: 'cajero',
    isActive: true,
    createdAt: '2026-02-05T11:45:00Z'
  },
  {
    id: 5,
    username: 'cajero2',
    email: 'cajero2@pos.com',
    fullName: 'Ana Martínez - Cajera',
    role: 'cajero',
    isActive: false,
    createdAt: '2026-02-10T16:20:00Z'
  }
]);

let nextId = Math.max(...MOCK_USERS.map(u => u.id), 0) + 1;

const userService = {
  // Obtener todos los usuarios
  getAll: async () => {
    try {
      // ===== MODO DESARROLLO - SIMULACIÓN =====
      await new Promise(resolve => setTimeout(resolve, 500));
      return { data: MOCK_USERS };

      // ===== PRODUCCIÓN - DESCOMENTAR =====
      // const response = await api.get('/users');
      // return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener usuarios' };
    }
  },

  // Obtener un usuario por ID
  getById: async (id) => {
    try {
      // ===== MODO DESARROLLO - SIMULACIÓN =====
      await new Promise(resolve => setTimeout(resolve, 300));
      const user = MOCK_USERS.find(u => u.id === parseInt(id));
      if (!user) throw { message: 'Usuario no encontrado' };
      return { data: user };

      // ===== PRODUCCIÓN - DESCOMENTAR =====
      // const response = await api.get(`/users/${id}`);
      // return response.data;
    } catch (error) {
      throw error.response?.data || error || { message: 'Error al obtener usuario' };
    }
  },

  // Crear un nuevo usuario
  create: async (userData) => {
    try {
      // ===== MODO DESARROLLO - SIMULACIÓN =====
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verificar si el username ya existe
      const existingUser = MOCK_USERS.find(u => u.username === userData.username);
      if (existingUser) {
        throw { message: 'El nombre de usuario ya existe' };
      }

      // Verificar si el email ya existe
      const existingEmail = MOCK_USERS.find(u => u.email === userData.email);
      if (existingEmail) {
        throw { message: 'El email ya está registrado' };
      }

      const newUser = {
        id: nextId++,
        ...userData,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      MOCK_USERS = [...MOCK_USERS, newUser];
      saveStoredData('pos_users', MOCK_USERS);
      return { data: newUser, message: 'Usuario creado exitosamente' };

      // ===== PRODUCCIÓN - DESCOMENTAR =====
      // const response = await api.post('/users', userData);
      // return response.data;
    } catch (error) {
      throw error.response?.data || error || { message: 'Error al crear usuario' };
    }
  },

  // Actualizar un usuario
  update: async (id, userData) => {
    try {
      // ===== MODO DESARROLLO - SIMULACIÓN =====
      await new Promise(resolve => setTimeout(resolve, 500));

      const index = MOCK_USERS.findIndex(u => u.id === parseInt(id));
      if (index === -1) throw { message: 'Usuario no encontrado' };

      // Verificar username duplicado (excepto el mismo usuario)
      if (userData.username) {
        const existingUser = MOCK_USERS.find(
          u => u.username === userData.username && u.id !== parseInt(id)
        );
        if (existingUser) {
          throw { message: 'El nombre de usuario ya existe' };
        }
      }

      // Verificar email duplicado (excepto el mismo usuario)
      if (userData.email) {
        const existingEmail = MOCK_USERS.find(
          u => u.email === userData.email && u.id !== parseInt(id)
        );
        if (existingEmail) {
          throw { message: 'El email ya está registrado' };
        }
      }

      const updatedUser = {
        ...MOCK_USERS[index],
        ...userData,
        updatedAt: new Date().toISOString()
      };

      MOCK_USERS = MOCK_USERS.map(u => u.id === parseInt(id) ? updatedUser : u);
      saveStoredData('pos_users', MOCK_USERS);

      return { data: updatedUser, message: 'Usuario actualizado exitosamente' };

      // ===== PRODUCCIÓN - DESCOMENTAR =====
      // const response = await api.put(`/users/${id}`, userData);
      // return response.data;
    } catch (error) {
      throw error.response?.data || error || { message: 'Error al actualizar usuario' };
    }
  },

  // Eliminar un usuario
  delete: async (id) => {
    try {
      // ===== MODO DESARROLLO - SIMULACIÓN =====
      await new Promise(resolve => setTimeout(resolve, 500));

      const index = MOCK_USERS.findIndex(u => u.id === parseInt(id));
      if (index === -1) throw { message: 'Usuario no encontrado' };

      // No permitir eliminar al admin principal
      if (MOCK_USERS[index].username === 'admin') {
        throw { message: 'No se puede eliminar el usuario administrador principal' };
      }

      MOCK_USERS = MOCK_USERS.filter(u => u.id !== parseInt(id));
      saveStoredData('pos_users', MOCK_USERS);
      return { message: 'Usuario eliminado exitosamente' };

      // ===== PRODUCCIÓN - DESCOMENTAR =====
      // const response = await api.delete(`/users/${id}`);
      // return response.data;
    } catch (error) {
      throw error.response?.data || error || { message: 'Error al eliminar usuario' };
    }
  },

  // Cambiar estado de un usuario
  toggleStatus: async (id) => {
    try {
      // ===== MODO DESARROLLO - SIMULACIÓN =====
      await new Promise(resolve => setTimeout(resolve, 500));

      const index = MOCK_USERS.findIndex(u => u.id === parseInt(id));
      if (index === -1) throw { message: 'Usuario no encontrado' };

      // No permitir desactivar al admin principal
      if (MOCK_USERS[index].username === 'admin') {
        throw { message: 'No se puede desactivar el usuario administrador principal' };
      }

      const updatedUser = {
        ...MOCK_USERS[index],
        isActive: !MOCK_USERS[index].isActive,
        updatedAt: new Date().toISOString()
      };

      MOCK_USERS = MOCK_USERS.map(u => u.id === parseInt(id) ? updatedUser : u);
      saveStoredData('pos_users', MOCK_USERS);

      return {
        data: updatedUser,
        message: `Usuario ${updatedUser.isActive ? 'activado' : 'desactivado'} exitosamente`
      };

      // ===== PRODUCCIÓN - DESCOMENTAR =====
      // const response = await api.patch(`/users/${id}/toggle-status`);
      // return response.data;
    } catch (error) {
      throw error.response?.data || error || { message: 'Error al cambiar estado del usuario' };
    }
  },
};

export default userService;
