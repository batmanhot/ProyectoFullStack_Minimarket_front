import api from '../config/api';

// ============================================
// VENTAS MOCK PARA DESARROLLO (Persistido en localStorage)
// ============================================
const getStoredSales = () => {
    const stored = localStorage.getItem('minimarket_sales');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing stored sales', e);
            return [];
        }
    }
    return [
        {
            id: 1,
            invoiceNumber: 'V001-000001',
            date: new Date().toISOString(),
            items: [
                { productId: 1, name: 'Arroz Extra 1kg', quantity: 2, price: 4.50, subtotal: 9.00 }
            ],
            total: 9.00,
            paymentMethod: 'cash',
            receiptType: 'ticket',
            status: 'completed'
        }
    ];
};

let MOCK_SALES = getStoredSales();

const saveSales = (sales) => {
    localStorage.setItem('minimarket_sales', JSON.stringify(sales));
};

let nextId = MOCK_SALES.length > 0 ? Math.max(...MOCK_SALES.map(s => s.id)) + 1 : 1;

const saleService = {
    createSale: async (saleData) => {
        try {
            // Simulamos latencia de red
            await new Promise(resolve => setTimeout(resolve, 800));

            let prefix = 'V001';
            if (saleData.receiptType === 'boleta') prefix = 'B001';
            if (saleData.receiptType === 'factura') prefix = 'F001';

            const newSale = {
                id: nextId++,
                invoiceNumber: `${prefix}-${String(nextId).padStart(6, '0')}`,
                date: new Date().toISOString(),
                ...saleData,
                status: 'completed'
            };

            // Simular validación extra para tarjeta (simulando Mercado Pago)
            if (saleData.paymentMethod === 'card') {
                console.log('Preparando datos para Mercado Pago...', saleData.cardInfo);
                await new Promise(resolve => setTimeout(resolve, 1500)); // Simular tokenización
            }

            MOCK_SALES = [newSale, ...MOCK_SALES]; // Agregar al inicio del historial
            saveSales(MOCK_SALES);

            return {
                data: newSale,
                message: 'Venta procesada exitosamente'
            };
        } catch (error) {
            throw error.response?.data || { message: 'Error al procesar la venta' };
        }
    },

    getHistory: async (filters = {}) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            let data = [...MOCK_SALES];

            if (filters.startDate) {
                const start = new Date(filters.startDate);
                data = data.filter(s => new Date(s.date) >= start);
            }

            if (filters.endDate) {
                const end = new Date(filters.endDate);
                // Ajustar al final del día
                end.setHours(23, 59, 59, 999);
                data = data.filter(s => new Date(s.date) <= end);
            }

            if (filters.type && filters.type !== 'all') {
                data = data.filter(s => (s.receiptType || 'ticket') === filters.type);
            }

            return { data };
        } catch (error) {
            throw error.response?.data || { message: 'Error al obtener historial' };
        }
    },

    getById: async (id) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const sale = MOCK_SALES.find(s => s.id === parseInt(id));
            if (!sale) throw { message: 'Venta no encontrada' };
            return { data: sale };
        } catch (error) {
            throw error.response?.data || error || { message: 'Error al obtener venta' };
        }
    }
};

export default saleService;
