import React, { useState, useEffect } from 'react';
import {
    BarChart3,
    TrendingUp,
    Users,
    Package,
    ShoppingCart,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    Download,
    FileText,
    Printer
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import SunatReportTemplate from '../../components/reports/SunatReportTemplate';
import saleService from '../../services/saleService';
import productService from '../../services/productService';
import clientService from '../../services/clientService';
import toast from 'react-hot-toast';

const ReportsPage = () => {
    const getMonthRange = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0]
        };
    };

    const period = getMonthRange();
    const [filters, setFilters] = useState({
        startDate: period.start,
        endDate: period.end
    });

    const [sales, setSales] = useState([]);
    const [stats, setStats] = useState({
        totalSales: 0,
        salesCount: 0,
        productsCount: 0,
        clientsCount: 0,
        growth: 12.5 // Mock growth
    });
    const [loading, setLoading] = useState(true);
    const [isSunatModalOpen, setIsSunatModalOpen] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        loadData();
    }, [filters]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [salesRes, productsRes, clientsRes] = await Promise.all([
                saleService.getHistory({
                    startDate: filters.startDate,
                    endDate: filters.endDate
                }),
                productService.getAll(),
                clientService.getAll()
            ]);

            const salesData = salesRes?.data || [];
            const total = salesData.reduce((acc, sale) => acc + (sale.total || 0), 0);

            setSales(salesData);
            setStats({
                totalSales: total,
                salesCount: salesData.length,
                productsCount: productsRes?.data?.length || 0,
                clientsCount: clientsRes?.data?.length || 0,
                growth: 12.5
            });
        } catch (error) {
            toast.error('Error al cargar datos de reportes');
        } finally {
            setLoading(false);
        }
    };

    const getChartData = () => {
        const grouped = sales.reduce((acc, sale) => {
            const date = new Date(sale.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
            acc[date] = (acc[date] || 0) + sale.total;
            return acc;
        }, {});

        return Object.entries(grouped)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => {
                const [dayA, monthA] = a.label.split('/');
                const [dayB, monthB] = b.label.split('/');
                return new Date(2026, monthA - 1, dayA) - new Date(2026, monthB - 1, dayB);
            })
            .slice(-7); // Last 7 days with sales
    };

    const groupedData = getChartData();
    const maxVal = Math.max(...groupedData.map(d => d.value), 1);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const statCards = [
        {
            title: 'Ventas Totales',
            value: `$${stats.totalSales.toFixed(2)}`,
            icon: TrendingUp,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            trend: '+12.5%',
            trendUp: true
        },
        {
            title: 'Transacciones',
            value: stats.salesCount,
            icon: ShoppingCart,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
            trend: '+5.2%',
            trendUp: true
        },
        {
            title: 'Productos',
            value: stats.productsCount,
            icon: Package,
            color: 'text-orange-600',
            bgColor: 'bg-orange-100',
            trend: '+2.1%',
            trendUp: true
        },
        {
            title: 'Clientes',
            value: stats.clientsCount,
            icon: Users,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
            trend: '+8.4%',
            trendUp: true
        }
    ];

    const columns = [
        { header: 'N° Factura', accessor: 'invoiceNumber' },
        {
            header: 'Fecha',
            accessor: 'date',
            render: (row) => row.date ? new Date(row.date).toLocaleString() : 'N/A'
        },
        {
            header: 'Metodo Pago',
            accessor: 'paymentMethod',
            render: (row) => (
                <span className="capitalize">{row.paymentMethod === 'cash' ? 'Efectivo' : (row.paymentMethod || 'N/A')}</span>
            )
        },
        {
            header: 'Total',
            accessor: 'total',
            render: (row) => <span className="font-bold text-gray-900">${(row.total || 0).toFixed(2)}</span>
        },
        {
            header: 'Estado',
            accessor: 'status',
            render: (row) => (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    {row.status === 'completed' ? 'Completado' : (row.status || 'Completado')}
                </span>
            )
        }
    ];

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reportes y Estadísticas</h1>
                    <p className="text-gray-600">Visualiza el rendimiento de tu negocio</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            className="text-sm border-none focus:ring-0 p-0 text-gray-700"
                        />
                        <span className="mx-2 text-gray-400">—</span>
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            className="text-sm border-none focus:ring-0 p-0 text-gray-700"
                        />
                    </div>
                    <Button
                        variant="secondary"
                        icon={FileText}
                        size="sm"
                        onClick={() => setIsSunatModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                    >
                        Exportar SUNAT (PDF)
                    </Button>
                    <Button variant="outline" icon={Download} size="sm">
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Modal de Reporte SUNAT */}
            <Modal
                isOpen={isSunatModalOpen}
                onClose={() => setIsSunatModalOpen(false)}
                title="Vista Previa: Registro de Ventas SUNAT"
                size="xl"
            >
                <div className="space-y-6">
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden max-h-[600px] overflow-y-auto overflow-x-auto p-4">
                        <SunatReportTemplate sales={sales} filters={filters} />
                    </div>
                    <div className="flex space-x-3">
                        <Button
                            variant="outline"
                            fullWidth
                            onClick={() => setIsSunatModalOpen(false)}
                        >
                            Cerrar
                        </Button>
                        <Button
                            fullWidth
                            onClick={handlePrint}
                            icon={Printer}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            Imprimir en PDF (A4 Horizontal)
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat, index) => (
                    <Card key={index} className="border-none shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`${stat.bgColor} p-3 rounded-xl`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div className={`flex items-center text-xs font-medium ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                                {stat.trend}
                                {stat.trendUp ? <ArrowUpRight className="w-3 h-3 ml-1" /> : <ArrowDownRight className="w-3 h-3 ml-1" />}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Charts Placeholder/Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <Card className="lg:col-span-2" title="Resumen de Ventas (Últimos días con actividad)">
                    <div className="h-64 flex items-end justify-around px-4 pt-8 pb-4 bg-white rounded-xl">
                        {groupedData.length > 0 ? (
                            groupedData.map((day, idx) => (
                                <div key={idx} className="flex flex-col items-center group relative w-full">
                                    <div
                                        className="w-10 sm:w-16 bg-primary-500 rounded-t-lg transition-all duration-500 hover:bg-primary-600 relative cursor-pointer"
                                        style={{ height: `${(day.value / maxVal) * 160}px` }}
                                    >
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">
                                            S/ {day.value.toFixed(2)}
                                        </div>
                                    </div>
                                    <span className="text-[10px] sm:text-xs font-bold text-gray-500 mt-3 transform -rotate-45 sm:rotate-0">
                                        {day.label}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full w-full text-gray-400">
                                <BarChart3 className="w-12 h-12 mb-2 opacity-20" />
                                <p className="text-sm font-medium">No hay ventas registradas en este periodo</p>
                            </div>
                        )}
                    </div>
                </Card>
                <Card title="Distribución de Ventas">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm text-gray-600">
                            <span>Efectivo</span>
                            <span className="font-medium text-gray-900">85%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                        </div>

                        <div className="flex justify-between items-center text-sm text-gray-600">
                            <span>Tarjeta</span>
                            <span className="font-medium text-gray-900">10%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{ width: '10%' }}></div>
                        </div>

                        <div className="flex justify-between items-center text-sm text-gray-600">
                            <span>Otros</span>
                            <span className="font-medium text-gray-900">5%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-gray-400 h-2 rounded-full" style={{ width: '5%' }}></div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Recent Sales Table */}
            <Card title="Transacciones Recientes">
                <Table
                    columns={columns}
                    data={sales}
                    loading={loading}
                />
            </Card>
        </div>
    );
};

export default ReportsPage;
