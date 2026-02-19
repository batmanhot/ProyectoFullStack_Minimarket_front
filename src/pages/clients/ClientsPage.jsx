import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
    Users,
    Plus,
    Search,
    Edit,
    Trash2,
    Power,
    UserCheck,
    Mail,
    Phone,
    MapPin,
    RefreshCw,
    ArrowLeft
} from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ClientForm from '../../components/clients/ClientForm';
import clientService from '../../services/clientService';
import { useNavigate } from 'react-router-dom';

const ClientsPage = () => {
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedClient, setSelectedClient] = useState(null);
    const [isFormLoading, setIsFormLoading] = useState(false);

    const loadClients = async () => {
        setIsLoading(true);
        try {
            const response = await clientService.getAll();
            setClients(response.data);
            setFilteredClients(response.data);
        } catch (error) {
            toast.error(error.message || 'Error al cargar clientes');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadClients();
    }, []);

    useEffect(() => {
        if (searchTerm === '') {
            setFilteredClients(clients);
        } else {
            const term = searchTerm.toLowerCase();
            const filtered = clients.filter(client =>
                (client.name?.toLowerCase().includes(term)) ||
                (client.document?.toLowerCase().includes(term)) ||
                (client.email?.toLowerCase().includes(term))
            );
            setFilteredClients(filtered);
        }
    }, [searchTerm, clients]);

    const handleCreate = () => {
        setModalMode('create');
        setSelectedClient(null);
        setIsModalOpen(true);
    };

    const handleEdit = (client) => {
        setModalMode('edit');
        setSelectedClient(client);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedClient(null);
    };

    const handleSubmit = async (data) => {
        setIsFormLoading(true);
        try {
            if (modalMode === 'create') {
                await clientService.create(data);
                toast.success('Cliente registrado exitosamente');
            } else {
                await clientService.update(selectedClient.id, data);
                toast.success('Cliente actualizado exitosamente');
            }
            handleCloseModal();
            loadClients();
        } catch (error) {
            toast.error(error.message || 'Error al guardar cliente');
        } finally {
            setIsFormLoading(false);
        }
    };

    const handleToggleStatus = async (client) => {
        try {
            await clientService.toggleStatus(client.id);
            toast.success(`Cliente ${!client.isActive ? 'activado' : 'desactivado'}`);
            loadClients();
        } catch (error) {
            toast.error(error.message || 'Error al cambiar estado');
        }
    };

    const handleDelete = async (client) => {
        if (!window.confirm(`¿Estás seguro de eliminar a "${client.name}"?`)) return;
        try {
            await clientService.delete(client.id);
            toast.success('Cliente eliminado');
            loadClients();
        } catch (error) {
            toast.error(error.message || 'Error al eliminar cliente');
        }
    };

    const columns = [
        {
            header: 'Cliente',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <UserCheck className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="ml-4">
                        <div className="text-sm font-bold text-gray-900">{row.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{row.type}: {row.document}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Contacto',
            accessor: 'phone',
            render: (row) => (
                <div className="space-y-1">
                    {row.phone !== '-' && (
                        <div className="text-sm text-gray-600 flex items-center">
                            <Phone size={14} className="mr-1 text-gray-400" /> {row.phone}
                        </div>
                    )}
                    {row.email !== '-' && (
                        <div className="text-xs text-blue-600 flex items-center hover:underline cursor-pointer">
                            <Mail size={14} className="mr-1 text-blue-400" /> {row.email}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Dirección',
            accessor: 'address',
            render: (row) => (
                <div className="text-xs text-gray-500 max-w-xs truncate flex items-center">
                    <MapPin size={14} className="mr-1 shrink-0" /> {row.address}
                </div>
            )
        },
        {
            header: 'Estado',
            accessor: 'isActive',
            render: (row) => (
                <Badge variant={row.isActive ? 'success' : 'default'}>
                    {row.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
            )
        },
        {
            header: 'Acciones',
            accessor: 'actions',
            render: (row) => (
                <div className="flex space-x-2">
                    <button onClick={() => handleEdit(row)} className="text-blue-600 hover:text-blue-900" title="Editar">
                        <Edit size={18} />
                    </button>
                    <button
                        onClick={() => handleToggleStatus(row)}
                        className={row.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}
                        title={row.isActive ? 'Desactivar' : 'Activar'}
                    >
                        <Power size={18} />
                    </button>
                    <button onClick={() => handleDelete(row)} className="text-red-600 hover:text-red-900" title="Eliminar">
                        <Trash2 size={18} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>Volver</Button>
                        <div className="flex items-center">
                            <Users className="w-8 h-8 text-primary-600 mr-3" />
                            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <Card className="mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
                        <div className="w-full sm:w-96">
                            <Input
                                placeholder="Buscar por nombre, DNI o email..."
                                icon={Search}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex space-x-3">
                            <Button
                                variant="secondary"
                                icon={RefreshCw}
                                onClick={loadClients}
                                disabled={isLoading}
                            >
                                Actualizar
                            </Button>
                            <Button icon={Plus} onClick={handleCreate}>Nuevo Cliente</Button>
                        </div>
                    </div>
                </Card>

                <Card className="p-0 overflow-hidden shadow-xl border-none">
                    <Table columns={columns} data={filteredClients} />
                    {!isLoading && filteredClients.length === 0 && (
                        <div className="text-center py-24 bg-white">
                            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Users size={48} className="text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">No se encontraron clientes</h3>
                            <p className="text-gray-500 mt-2">Intenta con otro término de búsqueda o crea uno nuevo.</p>
                        </div>
                    )}
                </Card>
            </main>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={modalMode === 'create' ? 'Registrar Nuevo Cliente' : 'Editar Información de Cliente'}
                size="lg"
            >
                <ClientForm
                    client={selectedClient}
                    onSubmit={handleSubmit}
                    onCancel={handleCloseModal}
                    isLoading={isFormLoading}
                />
            </Modal>
        </div>
    );
};

export default ClientsPage;
