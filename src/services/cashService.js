import api from '../config/api';

// ============================================
// CAJA MOCK CON PERSISTENCIA LOCAL
// ============================================

const getStoredData = (key, defaultValue) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
};

const saveStoredData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

let MOCK_SESSIONS = getStoredData('pos_cash_sessions', [
    {
        id: 1,
        userId: 1,
        userName: 'Admin Minimarket',
        openingAmount: 100.00,
        closingAmount: 250.00,
        expectedAmount: 250.00,
        difference: 0,
        status: 'closed',
        openedAt: '2026-02-16T08:00:00Z',
        closedAt: '2026-02-16T20:00:00Z',
        notes: 'Cierre de turno normal'
    }
]);

let currentSession = getStoredData('pos_current_session', null);
let nextSessionId = Math.max(...MOCK_SESSIONS.map(s => s.id), 0) + (currentSession ? 2 : 1);
let nextMovementId = 100; // Simulado

const cashService = {
    getCurrentSession: async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            return { data: currentSession };
        } catch (error) {
            throw { message: 'Error al obtener sesión actual' };
        }
    },

    openSession: async (openingAmount) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            currentSession = {
                id: nextSessionId++,
                userId: 1,
                userName: 'Admin Minimarket',
                openingAmount: parseFloat(openingAmount),
                currentBalance: parseFloat(openingAmount),
                status: 'open',
                openedAt: new Date().toISOString(),
                movements: []
            };
            saveStoredData('pos_current_session', currentSession);
            return { data: currentSession, message: 'Caja abierta exitosamente' };
        } catch (error) {
            throw { message: 'Error al abrir caja' };
        }
    },

    updateSession: async (updateData) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            if (!currentSession) throw { message: 'No hay sesión activa' };

            // Si se actualiza el monto inicial, recalcular balance
            if (updateData.openingAmount !== undefined) {
                const diff = parseFloat(updateData.openingAmount) - currentSession.openingAmount;
                currentSession.openingAmount = parseFloat(updateData.openingAmount);
                currentSession.currentBalance += diff;
            }

            saveStoredData('pos_current_session', currentSession);
            return { data: currentSession, message: 'Caja actualizada' };
        } catch (error) {
            throw error || { message: 'Error al actualizar caja' };
        }
    },

    closeSession: async ({ closingAmount, notes }) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 600));
            if (!currentSession) throw { message: 'No hay una sesión activa' };

            const totalMovements = currentSession.movements?.reduce((acc, m) =>
                m.type === 'income' ? acc + m.amount : acc - m.amount, 0) || 0;

            const expectedAmount = currentSession.openingAmount + totalMovements;
            const difference = parseFloat(closingAmount) - expectedAmount;

            const closedSession = {
                ...currentSession,
                closingAmount: parseFloat(closingAmount),
                expectedAmount,
                difference,
                status: 'closed',
                closedAt: new Date().toISOString(),
                notes
            };

            MOCK_SESSIONS.unshift(closedSession);
            saveStoredData('pos_cash_sessions', MOCK_SESSIONS);

            currentSession = null;
            localStorage.removeItem('pos_current_session');

            return { data: closedSession, message: 'Caja cerrada exitosamente' };
        } catch (error) {
            throw error || { message: 'Error al cerrar caja' };
        }
    },

    addMovement: async (movementData) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            if (!currentSession) throw { message: 'No hay una sesión activa' };

            const newMovement = {
                id: nextMovementId++,
                sessionId: currentSession.id,
                ...movementData,
                amount: parseFloat(movementData.amount),
                createdAt: new Date().toISOString()
            };

            if (!currentSession.movements) currentSession.movements = [];
            currentSession.movements.push(newMovement);

            if (newMovement.type === 'income') {
                if (newMovement.paymentMethod !== 'card') {
                    currentSession.currentBalance += newMovement.amount;
                }
            } else {
                currentSession.currentBalance -= newMovement.amount;
            }

            saveStoredData('pos_current_session', currentSession);
            return { data: newMovement, message: 'Movimiento registrado' };
        } catch (error) {
            throw error || { message: 'Error al registrar movimiento' };
        }
    },

    getHistory: async (filters = {}) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            let history = [...MOCK_SESSIONS];

            if (currentSession) {
                history.unshift({
                    ...currentSession,
                    closingAmount: null,
                    expectedAmount: null,
                    difference: null,
                    status: 'open',
                    closedAt: null
                });
            }

            // Aplicar filtros de fecha (Comparación por string para evitar desfases de zona horaria)
            if (filters.startDate) {
                history = history.filter(s => s.openedAt.split('T')[0] >= filters.startDate);
            }
            if (filters.endDate) {
                history = history.filter(s => s.openedAt.split('T')[0] <= filters.endDate);
            }

            return { data: history };
        } catch (error) {
            throw { message: 'Error al obtener historial' };
        }
    },

    getDailyStats: async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            // Usar fecha local para estadísticas del día
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

            // Sesiones de hoy (basado en fecha local de apertura)
            const allToday = [...MOCK_SESSIONS, currentSession].filter(s =>
                s && s.openedAt.split('T')[0] === today
            );

            // El total de "Caja hoy" es: sum(balances actuales/finales de sesiones de hoy)
            const currentTotal = allToday.reduce((acc, s) => acc + (s.status === 'open' ? s.currentBalance : s.closingAmount), 0);

            // Calcular TOTAL TARJETAS HOY
            const cardTotal = allToday.reduce((acc, session) => {
                const sessionCardMovements = session.movements?.filter(m => m.paymentMethod === 'card') || [];
                return acc + sessionCardMovements.reduce((sum, m) => sum + m.amount, 0);
            }, 0);

            return { data: { total: currentTotal, cardTotal, count: allToday.length } };
        } catch (error) {
            return { data: { total: 0, cardTotal: 0, count: 0 } };
        }
    }
};

export default cashService;
