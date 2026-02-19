import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    FileText,
    Search,
    Filter,
    ArrowLeft,
    RefreshCw,
    Eye,
    Printer,
    Download,
    Calendar,
    User,
    CreditCard as CardIcon,
    Banknote
} from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ReceiptTemplate from '../../components/pos/ReceiptTemplate';
import saleService from '../../services/saleService';

const InvoicesPage = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: 'all'
    });
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const loadInvoices = async () => {
        setIsLoading(true);
        try {
            const res = await saleService.getHistory(filters);
            setInvoices(res.data);
        } catch (error) {
            toast.error('Error al cargar comprobantes');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadInvoices();
    }, [filters]);

    const filteredInvoices = invoices.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.client?.name || 'Consumidor Final').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleViewDetail = (invoice) => {
        setSelectedInvoice(invoice);
        setIsDetailOpen(true);
    };

    const handlePrint = () => {
        window.print();
    };

    const columns = [
        {
            header: 'Número',
            accessor: 'invoiceNumber',
            render: (row) => (
                <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-3 ${row.receiptType === 'factura' ? 'bg-purple-100 text-purple-600' :
                            row.receiptType === 'boleta' ? 'bg-blue-100 text-blue-600' :
                                'bg-gray-100 text-gray-600'
                        }`}>
                        <FileText size={18} />
                    </div>
                    <span className="font-bold font-mono">{row.invoiceNumber}</span>
                </div>
            )
        },
        {
            header: 'Fecha',
            accessor: 'date',
            render: (row) => (
                <div className="text-xs text-gray-600">
                    <p className="font-medium">{new Date(row.date).toLocaleDateString()}</p>
                    <p>{new Date(row.date).toLocaleTimeString()}</p>
                </div>
            )
        },
        {
            header: 'Cliente',
            accessor: 'client',
            render: (row) => (
                <div className="text-sm">
                    <p className="font-bold text-gray-900">{row.client?.name || 'Consumidor Final'}</p>
                    <p className="text-xs text-gray-500">{row.client ? `${row.client.type}: ${row.client.document}` : '-'}</p>
                </div>
            )
        },
        {
            header: 'Tipo',
            accessor: 'receiptType',
            render: (row) => (
                <Badge variant={
                    row.receiptType === 'factura' ? 'info' :
                        row.receiptType === 'boleta' ? 'success' :
                            'default'
                } className="uppercase text-[10px]">
                    {row.receiptType || 'ticket'}
                </Badge>
            )
        },
        {
            header: 'Total',
            accessor: 'total',
            render: (row) => (
                <span className="font-black text-gray-900">S/ {row.total.toFixed(2)}</span>
            )
        },
        {
            header: 'Pago',
            accessor: 'paymentMethod',
            render: (row) => (
                <div className="flex items-center space-x-1 text-gray-500">
                    {row.paymentMethod === 'cash' ? <Banknote size={14} /> : <CardIcon size={14} />}
                    <span className="text-xs uppercase">{row.paymentMethod === 'cash' ? 'Efect.' : 'Tarj.'}</span>
                </div>
            )
        },
        {
            header: 'Acciones',
            accessor: 'actions',
            render: (row) => (
                <div className="flex space-x-2">
                    <button
                        onClick={() => handleViewDetail(row)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-primary-600 transition-colors"
                        title="Ver Detalle"
                    >
                        <Eye size={18} />
                    </button>
                    <button
                        onClick={() => {
                            setSelectedInvoice(row);
                            setTimeout(() => window.print(), 100);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                        title="Imprimir"
                    >
                        <Printer size={18} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={ArrowLeft}
                                onClick={() => navigate('/dashboard')}
                            >
                                Volver
                            </Button>
                            <div className="flex items-center">
                                <FileText className="w-8 h-8 text-primary-600 mr-3" />
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Comprobantes Emitidos</h1>
                                    <p className="text-sm text-gray-500">Historial y gestión de documentos legales</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 gap-6">
                    {/* Filtros */}
                    <Card>
                        <div className="flex flex-col lg:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Búsqueda Rápida</label>
                                <Input
                                    placeholder="Buscar por número o cliente..."
                                    icon={Search}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-[2] w-full">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Desde</label>
                                    <Input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Hasta</label>
                                    <Input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tipo</label>
                                    <select
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm h-10"
                                        value={filters.type}
                                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                    >
                                        <option value="all">Todos</option>
                                        <option value="ticket">Ticket</option>
                                        <option value="boleta">Boleta</option>
                                        <option value="factura">Factura</option>
                                    </select>
                                </div>
                            </div>
                            <Button
                                variant="secondary"
                                className="h-10"
                                onClick={loadInvoices}
                                icon={RefreshCw}
                                loading={isLoading}
                            >
                                Recargar
                            </Button>
                        </div>
                    </Card>

                    {/* Tabla */}
                    <Card className="overflow-hidden p-0">
                        <Table columns={columns} data={filteredInvoices} isLoading={isLoading} />
                        {filteredInvoices.length === 0 && !isLoading && (
                            <div className="text-center py-20 bg-white">
                                <FileText size={64} className="mx-auto text-gray-100 mb-4" />
                                <p className="text-gray-400 font-medium text-lg">No se encontraron comprobantes emitidos</p>
                                <p className="text-gray-400 text-sm">Prueba ajustando los filtros o términos de búsqueda</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Modal de Detalle */}
            <Modal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                title={`Detalle de Comprobante: ${selectedInvoice?.invoiceNumber}`}
                size="md"
            >
                {selectedInvoice && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden max-h-[500px] overflow-y-auto">
                            <ReceiptTemplate sale={selectedInvoice} />
                        </div>
                        <div className="flex space-x-3">
                            <Button variant="outline" fullWidth onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                            <Button fullWidth onClick={handlePrint} icon={Printer}>Re-imprimir</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default InvoicesPage;
