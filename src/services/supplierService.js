import api from '../config/api';

const getStoredData = (key, defaultValue) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
};

const saveStoredData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

let MOCK_SUPPLIERS = getStoredData('pos_suppliers', [
    {
        id: 1,
        name: 'Distribuidora Alianza',
        contactName: 'Juan Pérez',
        phone: '987654321',
        email: 'contacto@alianza.com',
        address: 'Av. Industrial 123',
        taxId: '20123456789',
        isActive: true
    },
    {
        id: 2,
        name: 'Gloria S.A.A.',
        contactName: 'María García',
        phone: '999888777',
        email: 'ventas@gloria.com',
        address: 'Urb. Santa Catalina 456',
        taxId: '20100012345',
        isActive: true
    },
]);

let nextId = Math.max(...MOCK_SUPPLIERS.map(s => s.id), 0) + 1;

const supplierService = {
    getAll: async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            return { data: MOCK_SUPPLIERS };
        } catch (error) {
            throw error.response?.data || { message: 'Error al obtener proveedores' };
        }
    },

    getById: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const supplier = MOCK_SUPPLIERS.find(s => s.id === parseInt(id));
            if (!supplier) throw { message: 'Proveedor no encontrado' };
            return { data: supplier };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al obtener proveedor' };
        }
    },

    create: async (data) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const newSupplier = { id: nextId++, ...data, isActive: true };
            MOCK_SUPPLIERS = [...MOCK_SUPPLIERS, newSupplier];
            saveStoredData('pos_suppliers', MOCK_SUPPLIERS);
            return { data: newSupplier, message: 'Proveedor creado exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al crear proveedor' };
        }
    },

    update: async (id, data) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const index = MOCK_SUPPLIERS.findIndex(s => s.id === parseInt(id));
            if (index === -1) throw { message: 'Proveedor no encontrado' };
            const updatedSupplier = { ...MOCK_SUPPLIERS[index], ...data };
            MOCK_SUPPLIERS = MOCK_SUPPLIERS.map(s => s.id === parseInt(id) ? updatedSupplier : s);
            saveStoredData('pos_suppliers', MOCK_SUPPLIERS);
            return { data: updatedSupplier, message: 'Proveedor actualizado exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al actualizar proveedor' };
        }
    },

    delete: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const index = MOCK_SUPPLIERS.findIndex(s => s.id === parseInt(id));
            if (index === -1) throw { message: 'Proveedor no encontrado' };
            MOCK_SUPPLIERS = MOCK_SUPPLIERS.filter(s => s.id !== parseInt(id));
            saveStoredData('pos_suppliers', MOCK_SUPPLIERS);
            return { message: 'Proveedor eliminado exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al eliminar proveedor' };
        }
    },
};

export default supplierService;
