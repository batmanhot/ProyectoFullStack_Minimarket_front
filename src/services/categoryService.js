import api from '../config/api';

const getStoredData = (key, defaultValue) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
};

const saveStoredData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

let MOCK_CATEGORIES = getStoredData('pos_categories', [
    { id: 1, name: 'Abarrotes', description: 'Productos básicos de consumo diario' },
    { id: 2, name: 'Lácteos', description: 'Leche, quesos, yogures' },
    { id: 3, name: 'Bebidas', description: 'Gaseosas, jugos, aguas' },
    { id: 4, name: 'Limpieza', description: 'Detergentes, desinfectantes' },
    { id: 5, name: 'Carnes', description: 'Pollo, res, cerdo' },
]);

let nextId = Math.max(...MOCK_CATEGORIES.map(c => c.id), 0) + 1;

const categoryService = {
    getAll: async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            return { data: MOCK_CATEGORIES };
        } catch (error) {
            throw error.response?.data || { message: 'Error al obtener categorías' };
        }
    },

    getById: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            const category = MOCK_CATEGORIES.find(c => c.id === parseInt(id));
            if (!category) throw { message: 'Categoría no encontrada' };
            return { data: category };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al obtener categoría' };
        }
    },

    create: async (data) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            const newCategory = { id: nextId++, ...data };
            MOCK_CATEGORIES = [...MOCK_CATEGORIES, newCategory];
            saveStoredData('pos_categories', MOCK_CATEGORIES);
            return { data: newCategory, message: 'Categoría creada exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al crear categoría' };
        }
    },

    update: async (id, data) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            const index = MOCK_CATEGORIES.findIndex(c => c.id === parseInt(id));
            if (index === -1) throw { message: 'Categoría no encontrada' };
            const updatedCategory = { ...MOCK_CATEGORIES[index], ...data };
            MOCK_CATEGORIES = MOCK_CATEGORIES.map(c => c.id === parseInt(id) ? updatedCategory : c);
            saveStoredData('pos_categories', MOCK_CATEGORIES);
            return { data: updatedCategory, message: 'Categoría actualizada exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al actualizar categoría' };
        }
    },

    delete: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            const index = MOCK_CATEGORIES.findIndex(c => c.id === parseInt(id));
            if (index === -1) throw { message: 'Categoría no encontrada' };
            MOCK_CATEGORIES = MOCK_CATEGORIES.filter(c => c.id !== parseInt(id));
            saveStoredData('pos_categories', MOCK_CATEGORIES);
            return { message: 'Categoría eliminada exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al eliminar categoría' };
        }
    },
};

export default categoryService;
