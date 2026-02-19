import api from '../config/api';
import categoryService from './categoryService';
import supplierService from './supplierService';

const getStoredData = (key, defaultValue) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
};

const saveStoredData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

let MOCK_PRODUCTS = getStoredData('pos_products', [
    {
        id: 1,
        barcode: '7750123456789',
        name: 'Arroz Extra 1kg',
        description: 'Arroz de grano largo calidad extra',
        categoryId: 1,
        categoryName: 'Abarrotes',
        priceBuy: 3.20,
        priceSell: 4.50,
        stock: 50,
        stockMin: 10,
        unit: 'unidad',
        isActive: true,
        imageUrl: null,
        createdAt: '2026-01-15T10:00:00Z'
    },
    {
        id: 2,
        barcode: '7750987654321',
        name: 'Aceite Vegetal 1L',
        description: 'Aceite vegetal refinado',
        categoryId: 1,
        categoryName: 'Abarrotes',
        priceBuy: 7.50,
        priceSell: 9.90,
        stock: 24,
        stockMin: 5,
        unit: 'unidad',
        isActive: true,
        imageUrl: null,
        createdAt: '2026-01-20T14:30:00Z'
    },
    {
        id: 3,
        barcode: '7751122334455',
        name: 'Leche Evaporada 400g',
        description: 'Leche entera evaporada en lata',
        categoryId: 2,
        categoryName: 'Lácteos',
        priceBuy: 3.80,
        priceSell: 4.80,
        stock: 12,
        stockMin: 20,
        unit: 'unidad',
        isActive: true,
        imageUrl: null,
        createdAt: '2026-02-01T09:15:00Z'
    }
]);

let nextId = Math.max(...MOCK_PRODUCTS.map(p => p.id), 0) + 1;

const enrichProductData = async (productData) => {
    const enriched = { ...productData };

    if (productData.categoryId) {
        try {
            const catRes = await categoryService.getById(productData.categoryId);
            enriched.categoryName = catRes.data.name;
        } catch (e) {
            console.warn('Category not found for enrichment');
        }
    }

    if (productData.supplierId) {
        try {
            const supRes = await supplierService.getById(productData.supplierId);
            enriched.supplierName = supRes.data.name;
        } catch (e) {
            console.warn('Supplier not found for enrichment');
        }
    }

    return enriched;
};

const productService = {
    // Obtener todos los productos
    getAll: async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            return { data: MOCK_PRODUCTS };
        } catch (error) {
            throw error.response?.data || { message: 'Error al obtener productos' };
        }
    },

    // Obtener un producto por ID
    getById: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            const product = MOCK_PRODUCTS.find(p => p.id === parseInt(id));
            if (!product) throw { message: 'Producto no encontrado' };
            return { data: product };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al obtener producto' };
        }
    },

    // Crear un nuevo producto
    create: async (productData) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));

            // Verificar si el barcode ya existe
            const existingProduct = MOCK_PRODUCTS.find(p => p.barcode === productData.barcode);
            if (existingProduct) {
                throw { message: 'El código de barras ya está registrado' };
            }

            const enriched = await enrichProductData(productData);

            const newProduct = {
                id: nextId++,
                ...enriched,
                stock: parseFloat(productData.stock) || 0,
                stockMin: parseFloat(productData.stockMin) || 0,
                priceBuy: parseFloat(productData.priceBuy) || 0,
                priceSell: parseFloat(productData.priceSell) || 0,
                isActive: true,
                createdAt: new Date().toISOString()
            };

            MOCK_PRODUCTS = [...MOCK_PRODUCTS, newProduct];
            saveStoredData('pos_products', MOCK_PRODUCTS);
            return { data: newProduct, message: 'Producto creado exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al crear producto' };
        }
    },

    // Actualizar un producto
    update: async (id, productData) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));

            const index = MOCK_PRODUCTS.findIndex(p => p.id === parseInt(id));
            if (index === -1) throw { message: 'Producto no encontrado' };

            // Verificar barcode duplicado
            if (productData.barcode) {
                const existingProduct = MOCK_PRODUCTS.find(
                    p => p.barcode === productData.barcode && p.id !== parseInt(id)
                );
                if (existingProduct) {
                    throw { message: 'El código de barras ya está registrado por otro producto' };
                }
            }

            const enriched = await enrichProductData(productData);

            const updatedProduct = {
                ...MOCK_PRODUCTS[index],
                ...enriched,
                stock: productData.stock !== undefined ? parseFloat(productData.stock) : MOCK_PRODUCTS[index].stock,
                stockMin: productData.stockMin !== undefined ? parseFloat(productData.stockMin) : MOCK_PRODUCTS[index].stockMin,
                priceBuy: productData.priceBuy !== undefined ? parseFloat(productData.priceBuy) : MOCK_PRODUCTS[index].priceBuy,
                priceSell: productData.priceSell !== undefined ? parseFloat(productData.priceSell) : MOCK_PRODUCTS[index].priceSell,
                updatedAt: new Date().toISOString()
            };

            MOCK_PRODUCTS = MOCK_PRODUCTS.map(p => p.id === parseInt(id) ? updatedProduct : p);
            saveStoredData('pos_products', MOCK_PRODUCTS);

            return { data: updatedProduct, message: 'Producto actualizado exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al actualizar producto' };
        }
    },

    // Eliminar un producto
    delete: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            MOCK_PRODUCTS = MOCK_PRODUCTS.filter(p => p.id !== parseInt(id));
            saveStoredData('pos_products', MOCK_PRODUCTS);
            return { message: 'Producto eliminado exitosamente' };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al eliminar producto' };
        }
    },

    // Cambiar estado de un producto
    toggleStatus: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            const index = MOCK_PRODUCTS.findIndex(p => p.id === parseInt(id));
            if (index === -1) throw { message: 'Producto no encontrado' };

            const updatedProduct = {
                ...MOCK_PRODUCTS[index],
                isActive: !MOCK_PRODUCTS[index].isActive,
                updatedAt: new Date().toISOString()
            };

            MOCK_PRODUCTS = MOCK_PRODUCTS.map(p => p.id === parseInt(id) ? updatedProduct : p);
            saveStoredData('pos_products', MOCK_PRODUCTS);

            return {
                data: updatedProduct,
                message: `Producto ${updatedProduct.isActive ? 'activado' : 'desactivado'} exitosamente`
            };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al cambiar estado del producto' };
        }
    },
};

export default productService;
