import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Tag, Plus, Search, Edit, Trash2, ArrowLeft, RefreshCw } from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import CategoryForm from '../../components/inventory/CategoryForm';
import categoryService from '../../services/categoryService';

const CategoriesPage = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isFormLoading, setIsFormLoading] = useState(false);

    const loadCategories = async () => {
        setIsLoading(true);
        try {
            const response = await categoryService.getAll();
            setCategories(response.data);
        } catch (error) {
            toast.error(error.message || 'Error al cargar categorías');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreate = () => {
        setModalMode('create');
        setSelectedCategory(null);
        setIsModalOpen(true);
    };

    const handleEdit = (category) => {
        setModalMode('edit');
        setSelectedCategory(category);
        setIsModalOpen(true);
    };

    const handleDelete = async (category) => {
        if (!window.confirm(`¿Estás seguro de eliminar la categoría "${category.name}"?`)) return;
        try {
            await categoryService.delete(category.id);
            toast.success('Categoría eliminada');
            loadCategories();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleSubmit = async (data) => {
        setIsFormLoading(true);
        try {
            if (modalMode === 'create') {
                await categoryService.create(data);
                toast.success('Categoría creada');
            } else {
                await categoryService.update(selectedCategory.id, data);
                toast.success('Categoría actualizada');
            }
            setIsModalOpen(false);
            loadCategories();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsFormLoading(false);
        }
    };

    const columns = [
        { header: 'Nombre', accessor: 'name' },
        { header: 'Descripción', accessor: 'description' },
        {
            header: 'Acciones',
            render: (category) => (
                <div className="flex space-x-2">
                    <button onClick={() => handleEdit(category)} className="text-blue-600 hover:text-blue-900"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(category)} className="text-red-600 hover:text-red-900"><Trash2 size={18} /></button>
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
                            <Tag className="w-8 h-8 text-primary-600 mr-3" />
                            <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <Card>
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-3 sm:space-y-0">
                        <div className="w-full sm:w-96">
                            <Input placeholder="Buscar categorías..." icon={Search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex space-x-3">
                            <Button variant="secondary" icon={RefreshCw} onClick={loadCategories} disabled={isLoading}>Actualizar</Button>
                            <Button icon={Plus} onClick={handleCreate}>Nueva Categoría</Button>
                        </div>
                    </div>

                    <Table columns={columns} data={filteredCategories} />
                </Card>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'create' ? 'Nueva Categoría' : 'Editar Categoría'}>
                <CategoryForm category={selectedCategory} onSubmit={handleSubmit} onCancel={() => setIsModalOpen(false)} isLoading={isFormLoading} />
            </Modal>
        </div>
    );
};

export default CategoriesPage;
