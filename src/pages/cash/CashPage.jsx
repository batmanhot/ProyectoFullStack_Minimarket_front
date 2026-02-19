import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
    DollarSign,
    ArrowUpCircle,
    ArrowDownCircle,
    History,
    Clock,
    User,
    Wallet,
    AlertCircle,
    TrendingUp,
    RefreshCw,
    Plus,
    Minus,
    Filter,
    Calendar,
    Info,
    CreditCard,
    ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import CashSessionModal from '../../components/cash/CashSessionModal';
import cashService from '../../services/cashService';

const CashPage = () => {
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('open'); // 'open', 'close', 'movement', 'edit'
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [dailyStats, setDailyStats] = useState({ total: 0, count: 0 });

    // Filtros de fecha (Ahora usando fecha local para evitar desfases con UTC)
    const todayStr = new Date().toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
    const [filters, setFilters] = useState({ startDate: todayStr, endDate: todayStr });

    // Para registrar movimiento manual
    const [movementForm, setMovementForm] = useState({ type: 'income', amount: '', description: '' });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [sessionRes, historyRes, statsRes] = await Promise.all([
                cashService.getCurrentSession(),
                cashService.getHistory(filters),
                cashService.getDailyStats()
            ]);
            setSession(sessionRes.data);
            setHistory(historyRes.data);
            setDailyStats(statsRes.data || { total: 0, cardTotal: 0, count: 0 });
        } catch (error) {
            toast.error('Error al cargar datos de caja');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filters]);

    const handleOpenRegister = async (data) => {
        setIsActionLoading(true);
        try {
            const res = await cashService.openSession(data.amount);
            setSession(res.data);
            setIsModalOpen(false);
            toast.success('Caja abierta correctamente');
            loadData(); // Refrescar historial para mostrar la abierta
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUpdateRegister = async (data) => {
        setIsActionLoading(true);
        try {
            const res = await cashService.updateSession({ openingAmount: data.amount });
            setSession(res.data);
            setIsModalOpen(false);
            toast.success('Monto inicial actualizado');
            loadData(); // Refrescar historial
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleCloseRegister = async (data) => {
        setIsActionLoading(true);
        try {
            const res = await cashService.closeSession({ closingAmount: data.amount, notes: data.notes });
            setSession(null);
            setIsModalOpen(false);
            toast.success('Caja cerrada con éxito');
            loadData(); // Refrescar historial
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleAddMovement = async (e) => {
        e.preventDefault();
        if (!movementForm.amount || !movementForm.description) return;

        setIsActionLoading(true);
        try {
            const res = await cashService.addMovement({
                type: movementForm.type,
                amount: parseFloat(movementForm.amount),
                description: movementForm.description
            });
            setSession(prev => ({
                ...prev,
                currentBalance: movementForm.type === 'income'
                    ? prev.currentBalance + parseFloat(movementForm.amount)
                    : prev.currentBalance - parseFloat(movementForm.amount),
                movements: [...(prev.movements || []), res.data]
            }));
            setMovementForm({ type: 'income', amount: '', description: '' });
            setIsModalOpen(false);
            toast.success('Movimiento registrado');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const historyColumns = [
        {
            header: 'Cierre / Estado',
            accessor: 'closedAt',
            render: (row) => row.status === 'open'
                ? <Badge variant="success">En curso (Abierto)</Badge>
                : new Date(row.closedAt).toLocaleString()
        },
        { header: 'Cajero', accessor: 'userName' },
        { header: 'Inicial', accessor: 'openingAmount', render: (row) => `S/ ${row.openingAmount.toFixed(2)}` },
        {
            header: 'Final / Actual',
            accessor: 'closingAmount',
            render: (row) => row.status === 'open'
                ? <span className="text-primary-600 font-bold">S/ {row.currentBalance.toFixed(2)}</span>
                : `S/ ${row.closingAmount.toFixed(2)}`
        },
        {
            header: 'Diferencia',
            accessor: 'difference',
            render: (row) => row.status === 'open' ? '-' : (
                <span className={row.difference === 0 ? 'text-green-600' : row.difference > 0 ? 'text-blue-600' : 'text-red-600'}>
                    {row.difference > 0 ? '+' : ''}{row.difference.toFixed(2)}
                </span>
            )
        },
        {
            header: 'Estado',
            accessor: 'status',
            render: (row) => <Badge variant={row.status === 'open' ? 'success' : 'secondary'}>{row.status === 'closed' ? 'Cerrado' : 'Abierto'}</Badge>
        }
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <RefreshCw className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>Volver</Button>
                        <div className="flex items-center">
                            <Wallet className="w-8 h-8 text-yellow-500 mr-3" />
                            <h1 className="text-2xl font-bold text-gray-900">Gestión de Caja</h1>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Nueva Tarjeta de Total del Día - SIEMPRE VISIBLE */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none shadow-xl col-span-1">
                        <div className="p-2">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-primary-100 text-sm font-bold uppercase tracking-wider">Efectivo Total Hoy</p>
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <Wallet size={20} className="text-white" />
                                </div>
                            </div>
                            <p className="text-5xl font-black tracking-tight">S/ {dailyStats.total.toFixed(2)}</p>
                            <div className="mt-4 pt-4 border-t border-primary-500/30 flex justify-between items-center">
                                <span className="text-xs text-primary-200">En caja física</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-none shadow-xl col-span-1">
                        <div className="p-2">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-indigo-100 text-sm font-bold uppercase tracking-wider">Tarjetas Total Hoy</p>
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <CreditCard size={20} className="text-white" />
                                </div>
                            </div>
                            <p className="text-5xl font-black tracking-tight">S/ {(dailyStats.cardTotal || 0).toFixed(2)}</p>
                            <div className="mt-4 pt-4 border-t border-indigo-500/30 flex justify-between items-center">
                                <span className="text-xs text-indigo-200">Ventas con tarjeta</span>
                            </div>
                        </div>
                    </Card>

                    <div className="col-span-1">
                        <Card className="bg-blue-50 border-blue-200 h-full flex items-center">
                            <div className="flex items-start space-x-3 text-blue-800 p-2">
                                <Info className="shrink-0 mt-1" size={24} />
                                <div className="space-y-2">
                                    <p className="font-bold text-lg">Sesiones: {dailyStats.count}</p>
                                    <p className="text-sm">
                                        Las ventas con tarjeta no afectan el saldo de efectivo de la caja física pero se registran en el historial.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {!session ? (
                    <Card className="bg-amber-50 border-amber-200 text-center py-16">
                        <div className="max-w-md mx-auto">
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertCircle size={40} className="text-amber-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-amber-900 mb-2">Caja Cerrada</h2>
                            <p className="text-amber-700 mb-8">Debes abrir una sesión de caja para poder realizar ventas en el POS y registrar movimientos.</p>
                            <Button
                                size="lg"
                                onClick={() => { setModalType('open'); setIsModalOpen(true); }}
                            >
                                Abrir Caja Ahora
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Resumen de Caja Activa */}
                        <div className="lg:col-span-1 space-y-6">
                            <Card className="bg-white border-2 border-primary-500 shadow-md">
                                <div className="p-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">Sesión Abierta Actual</p>
                                        <Badge variant="success">ACTIVA</Badge>
                                    </div>
                                    <p className="text-4xl font-black text-primary-700 tracking-tight">S/ {session.currentBalance.toFixed(2)}</p>
                                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                                        <div className="flex items-center space-x-2">
                                            <Clock size={16} />
                                            <span>Abierto: {new Date(session.openedAt).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card title="Detalles del Turno">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500 flex items-center"><User size={16} className="mr-2" /> Cajero</span>
                                        <span className="font-bold text-gray-900">{session.userName}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500 flex items-center"><TrendingUp size={16} className="mr-2" /> Monto Inicial</span>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-gray-900">S/ {session.openingAmount.toFixed(2)}</span>
                                            {new Date(session.openedAt).toDateString() === new Date().toDateString() && (
                                                <button
                                                    onClick={() => { setModalType('edit'); setIsModalOpen(true); }}
                                                    className="text-primary-600 hover:text-primary-700 text-xs font-bold"
                                                >
                                                    (Editar)
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card title="Registrar Movimiento">
                                <form onSubmit={handleAddMovement} className="space-y-4">
                                    <div className="flex p-1 bg-gray-100 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => setMovementForm({ ...movementForm, type: 'income' })}
                                            className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm font-bold transition-all ${movementForm.type === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            <Plus size={16} className="mr-1" /> Ingreso
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMovementForm({ ...movementForm, type: 'expense' })}
                                            className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm font-bold transition-all ${movementForm.type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            <Minus size={16} className="mr-1" /> Egreso
                                        </button>
                                    </div>
                                    <Input
                                        type="number"
                                        placeholder="Monto S/"
                                        value={movementForm.amount}
                                        onChange={(e) => setMovementForm({ ...movementForm, amount: e.target.value })}
                                        required
                                    />
                                    <Input
                                        type="text"
                                        placeholder="Descripción (ej: Pago luz, Cambio)"
                                        value={movementForm.description}
                                        onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })}
                                        required
                                    />
                                    <Button type="submit" fullWidth loading={isActionLoading}>Registrar</Button>
                                </form>
                            </Card>
                        </div>

                        {/* Historial de Movimientos de la Sesión */}
                        <div className="lg:col-span-2">
                            <Card title="Movimientos del Turno Actual" className="h-full">
                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                    {(!session.movements || session.movements.length === 0) ? (
                                        <p className="text-center text-gray-400 py-12">No hay movimientos registrados en este turno.</p>
                                    ) : (
                                        session.movements.filter(m => m.paymentMethod !== 'card').slice().reverse().map((m, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="flex items-center space-x-4">
                                                    <div className={`p-2 rounded-full ${m.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                        {m.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{m.description}</p>
                                                        <p className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleTimeString()}</p>
                                                    </div>
                                                </div>
                                                <p className={`text-lg font-black ${m.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {m.type === 'income' ? '+' : '-'} S/ {m.amount.toFixed(2)}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Ventas con Tarjeta (Nueva Sección Solicitada) */}
                        <div className="lg:col-span-3">
                            <Card title="Ventas con Tarjeta (Turno Actual)" icon={CreditCard}>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                                    {(!session.movements || session.movements.filter(m => m.paymentMethod === 'card').length === 0) ? (
                                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                            <CreditCard size={48} className="mx-auto text-gray-300 mb-3" />
                                            <p className="text-gray-400 font-medium">No se han registrado ventas con tarjeta en este turno todavía.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {session.movements.filter(m => m.paymentMethod === 'card').slice().reverse().map((m, idx) => (
                                                <div key={idx} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                                                            <CreditCard size={20} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 line-clamp-1">{m.description}</p>
                                                            <p className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleTimeString()}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-lg font-black text-indigo-600">
                                                        S/ {m.amount.toFixed(2)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </div >
                )}

                {/* Historial de Cierres de Caja */}
                <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                        <div className="flex items-center">
                            <History className="text-gray-400 mr-2" size={24} />
                            <h2 className="text-xl font-bold text-gray-800">Historial de Turnos</h2>
                        </div>

                        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-3">
                            <Filter size={18} className="text-gray-400 ml-2" />
                            <div className="flex items-center space-x-2 text-sm">
                                <span className="text-gray-500">Desde:</span>
                                <input
                                    type="date"
                                    className="border-none focus:ring-0 p-1 text-gray-700"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                />
                                <span className="text-gray-500">Hasta:</span>
                                <input
                                    type="date"
                                    className="border-none focus:ring-0 p-1 text-gray-700"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <Card className="overflow-hidden p-0">
                        <Table columns={historyColumns} data={history} />
                    </Card>
                </section>
            </main >

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    modalType === 'open' ? 'Apertura de Caja' :
                        modalType === 'edit' ? 'Editar Monto Inicial' :
                            'Cierre de Arqueo'
                }
                size="md"
            >
                <CashSessionModal
                    type={modalType}
                    initialData={modalType === 'edit' ? { amount: session.openingAmount } : null}
                    onSubmit={
                        modalType === 'open' ? handleOpenRegister :
                            modalType === 'edit' ? handleUpdateRegister :
                                handleCloseRegister
                    }
                    onCancel={() => setIsModalOpen(false)}
                    isLoading={isActionLoading}
                />
            </Modal>
        </div >
    );
};

export default CashPage;
