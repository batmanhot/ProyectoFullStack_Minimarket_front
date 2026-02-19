import api from '../config/api';

// ============================================
// CLIENTES MOCK CON PERSISTENCIA LOCAL
// ============================================

const getStoredData = (key, defaultValue) => {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) return defaultValue;
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : defaultValue;
    } catch (error) {
        console.error(`Error parsing ${key} from localStorage:`, error);
        return defaultValue;
    }
};

const saveStoredData = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
    }
};

let MOCK_CLIENTS = getStoredData('pos_clients', [
    {
        id: 1,
        name: 'Consumidor Final',
        document: '00000000',
        type: 'DNI',
        phone: '-',
        email: '-',
        address: 'Ciudad',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z'
    },
    {
        id: 2,
        name: 'Empresa Demo S.A.C.',
        document: '20123456789',
        type: 'RUC',
        phone: '987654321',
        email: 'contacto@demosac.com',
        address: 'Av. Las Empresas 123',
        isActive: true,
        createdAt: '2026-01-10T10:00:00Z'
    }
]);

let nextClientId = Math.max(...MOCK_CLIENTS.map(c => c.id), 0) + 1;

const clientService = {
    getAll: async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            return { data: MOCK_CLIENTS };
        } catch (error) {
            throw { message: 'Error al obtener clientes' };
        }
    },

    getById: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            const client = MOCK_CLIENTS.find(c => c.id === parseInt(id));
            if (!client) throw { message: 'Cliente no encontrado' };
            return { data: client };
        } catch (error) {
            throw error || { message: 'Error al obtener cliente' };
        }
    },

    create: async (clientData) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const newClient = {
                id: nextClientId++,
                ...clientData,
                isActive: true,
                createdAt: new Date().toISOString()
            };
            MOCK_CLIENTS = [newClient, ...MOCK_CLIENTS];
            saveStoredData('pos_clients', MOCK_CLIENTS);
            return { data: newClient, message: 'Cliente registrado exitosamente' };
        } catch (error) {
            throw { message: 'Error al registrar cliente' };
        }
    },

    update: async (id, clientData) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const index = MOCK_CLIENTS.findIndex(c => c.id === parseInt(id));
            if (index === -1) throw { message: 'Cliente no encontrado' };

            const updatedClient = {
                ...MOCK_CLIENTS[index],
                ...clientData
            };

            MOCK_CLIENTS = MOCK_CLIENTS.map(c =>
                c.id === parseInt(id) ? updatedClient : c
            );

            saveStoredData('pos_clients', MOCK_CLIENTS);
            return { data: updatedClient, message: 'Cliente actualizado correctamente' };
        } catch (error) {
            throw error || { message: 'Error al actualizar cliente' };
        }
    },

    delete: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            const index = MOCK_CLIENTS.findIndex(c => c.id === parseInt(id));
            if (index === -1) throw { message: 'Cliente no encontrado' };

            MOCK_CLIENTS = MOCK_CLIENTS.filter(c => c.id !== parseInt(id));
            saveStoredData('pos_clients', MOCK_CLIENTS);
            return { message: 'Cliente eliminado correctamente' };
        } catch (error) {
            throw error || { message: 'Error al eliminar cliente' };
        }
    },

    toggleStatus: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const index = MOCK_CLIENTS.findIndex(c => c.id === parseInt(id));
            if (index === -1) throw { message: 'Cliente no encontrado' };

            MOCK_CLIENTS = MOCK_CLIENTS.map(c =>
                c.id === parseInt(id) ? { ...c, isActive: !c.isActive } : c
            );

            saveStoredData('pos_clients', MOCK_CLIENTS);
            return { message: 'Estado actualizado' };
        } catch (error) {
            throw error || { message: 'Error al cambiar estado' };
        }
    }
};

export default clientService;
