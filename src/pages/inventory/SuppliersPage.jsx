import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Plus, Search, Edit, Trash2, ArrowLeft, RefreshCw } from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import SupplierForm from '../../components/inventory/SupplierForm';
import supplierService from '../../services/supplierService';

const SuppliersPage = () => {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [isFormLoading, setIsFormLoading] = useState(false);

    const loadSuppliers = async () => {
        setIsLoading(true);
        try {
            const response = await supplierService.getAll();
            setSuppliers(response.data);
        } catch (error) {
            toast.error(error.message || 'Error al cargar proveedores');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSuppliers();
    }, []);

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.taxId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreate = () => {
        setModalMode('create');
        setSelectedSupplier(null);
        setIsModalOpen(true);
    };

    const handleEdit = (supplier) => {
        setModalMode('edit');
        setSelectedSupplier(supplier);
        setIsModalOpen(true);
    };

    const handleDelete = async (supplier) => {
        if (!window.confirm(`¿Estás seguro de eliminar el proveedor "${supplier.name}"?`)) return;
        try {
            await supplierService.delete(supplier.id);
            toast.success('Proveedor eliminado');
            loadSuppliers();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleSubmit = async (data) => {
        setIsFormLoading(true);
        try {
            if (modalMode === 'create') {
                await supplierService.create(data);
                toast.success('Proveedor creado');
            } else {
                await supplierService.update(selectedSupplier.id, data);
                toast.success('Proveedor actualizado');
            }
            setIsModalOpen(false);
            loadSuppliers();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsFormLoading(false);
        }
    };

    const columns = [
        { header: 'Proveedor', accessor: 'name' },
        { header: 'RUC/NIT', accessor: 'taxId' },
        { header: 'Contacto', accessor: 'contactName' },
        { header: 'Teléfono', accessor: 'phone' },
        {
            header: 'Estado',
            render: (supplier) => (
                <Badge variant={supplier.isActive ? 'success' : 'default'}>
                    {supplier.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
            )
        },
        {
            header: 'Acciones',
            render: (supplier) => (
                <div className="flex space-x-2">
                    <button onClick={() => handleEdit(supplier)} className="text-blue-600 hover:text-blue-900"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(supplier)} className="text-red-600 hover:text-red-900"><Trash2 size={18} /></button>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm border-b border-gray-200 p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>Volver</Button>
                        <div className="flex items-center">
                            <Building2 className="w-8 h-8 text-primary-600 mr-3" />
                            <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <Card>
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-3 sm:space-y-0">
                        <div className="w-full sm:w-96">
                            <Input placeholder="Buscar proveedores..." icon={Search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex space-x-3">
                            <Button variant="secondary" icon={RefreshCw} onClick={loadSuppliers} disabled={isLoading}>Actualizar</Button>
                            <Button icon={Plus} onClick={handleCreate}>Nuevo Proveedor</Button>
                        </div>
                    </div>

                    <Table columns={columns} data={filteredSuppliers} />
                </Card>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'create' ? 'Nuevo Proveedor' : 'Editar Proveedor'} size="lg">
                <SupplierForm supplier={selectedSupplier} onSubmit={handleSubmit} onCancel={() => setIsModalOpen(false)} isLoading={isFormLoading} />
            </Modal>
        </div>
    );
};

export default SuppliersPage;
