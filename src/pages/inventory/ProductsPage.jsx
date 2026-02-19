import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Package,
    Plus,
    Search,
    Edit,
    Trash2,
    Power,
    ArrowLeft,
    RefreshCw,
    AlertCircle
} from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ProductForm from '../../components/inventory/ProductForm';
import productService from '../../services/productService';

const ProductsPage = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isFormLoading, setIsFormLoading] = useState(false);

    const loadProducts = async () => {
        setIsLoading(true);
        try {
            const response = await productService.getAll();
            setProducts(response.data);
            setFilteredProducts(response.data);
        } catch (error) {
            toast.error(error.message || 'Error al cargar productos');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, []);

    useEffect(() => {
        if (searchTerm === '') {
            setFilteredProducts(products);
        } else {
            const filtered = products.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.categoryName?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredProducts(filtered);
        }
    }, [searchTerm, products]);

    const handleCreate = () => {
        setModalMode('create');
        setSelectedProduct(null);
        setIsModalOpen(true);
    };

    const handleEdit = (product) => {
        setModalMode('edit');
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedProduct(null);
    };

    const handleSubmit = async (data) => {
        setIsFormLoading(true);
        try {
            if (modalMode === 'create') {
                await productService.create(data);
                toast.success('Producto creado exitosamente');
            } else {
                await productService.update(selectedProduct.id, data);
                toast.success('Producto actualizado exitosamente');
            }
            handleCloseModal();
            loadProducts();
        } catch (error) {
            toast.error(error.message || 'Error al guardar producto');
        } finally {
            setIsFormLoading(false);
        }
    };

    const handleToggleStatus = async (product) => {
        try {
            await productService.toggleStatus(product.id);
            toast.success(`Producto ${!product.isActive ? 'activado' : 'desactivado'} exitosamente`);
            loadProducts();
        } catch (error) {
            toast.error(error.message || 'Error al cambiar estado');
        }
    };

    const handleDelete = async (product) => {
        if (!window.confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) {
            return;
        }

        try {
            await productService.delete(product.id);
            toast.success('Producto eliminado exitosamente');
            loadProducts();
        } catch (error) {
            toast.error(error.message || 'Error al eliminar producto');
        }
    };

    const columns = [
        {
            header: 'Producto',
            accessor: 'name',
            render: (product) => (
                <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{product.barcode}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Categoría',
            accessor: 'categoryName',
            render: (product) => (
                <span className="text-sm text-gray-600">{product.categoryName || 'S/C'}</span>
            ),
        },
        {
            header: 'Precio Venta',
            accessor: 'priceSell',
            render: (product) => (
                <span className="text-sm font-semibold text-gray-900">
                    S/ {parseFloat(product.priceSell).toFixed(2)}
                </span>
            ),
        },
        {
            header: 'Stock',
            accessor: 'stock',
            render: (product) => {
                const isLowStock = product.stock <= product.stockMin;
                return (
                    <div className="flex items-center">
                        <span className={`text-sm font-medium ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.stock} {product.unit}
                        </span>
                        {isLowStock && (
                            <AlertCircle className="w-4 h-4 text-red-500 ml-1" title="Stock Bajo" />
                        )}
                    </div>
                );
            },
        },
        {
            header: 'Estado',
            accessor: 'isActive',
            render: (product) => (
                <Badge variant={product.isActive ? 'success' : 'default'}>
                    {product.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
            ),
        },
        {
            header: 'Acciones',
            accessor: 'actions',
            render: (product) => (
                <div className="flex space-x-2">
                    <button
                        onClick={() => handleEdit(product)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleToggleStatus(product)}
                        className={`${product.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'
                            }`}
                        title={product.isActive ? 'Desactivar' : 'Activar'}
                    >
                        <Power className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(product)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                                <Package className="w-8 h-8 text-primary-600 mr-3" />
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        Control de Inventario
                                    </h1>
                                    <p className="text-sm text-gray-500">
                                        Gestiona tus productos y stock en tiempo real
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Card>
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-3 sm:space-y-0">
                        <div className="w-full sm:w-96">
                            <Input
                                type="text"
                                placeholder="Buscar por nombre o código..."
                                icon={Search}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex space-x-3">
                            <Button
                                variant="secondary"
                                icon={RefreshCw}
                                onClick={loadProducts}
                                disabled={isLoading}
                            >
                                Actualizar
                            </Button>
                            <Button
                                icon={Plus}
                                onClick={handleCreate}
                            >
                                Nuevo Producto
                            </Button>
                        </div>
                    </div>

                    {/* Tabla */}
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            <p className="mt-2 text-gray-500">Cargando productos...</p>
                        </div>
                    ) : (
                        <>
                            <Table
                                columns={columns}
                                data={filteredProducts}
                            />
                            {filteredProducts.length === 0 && (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">
                                        {searchTerm
                                            ? `No se encontraron productos para "${searchTerm}"`
                                            : 'No hay productos registrados en el inventario'}
                                    </p>
                                    {!searchTerm && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="mt-3"
                                            onClick={handleCreate}
                                        >
                                            Registrar primer producto
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Estadísticas */}
                    <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
                        <span>
                            Total productos: <strong>{products.length}</strong>
                        </span>
                        <span>
                            Mostrando: <strong>{filteredProducts.length}</strong>
                        </span>
                        <span className="text-red-600">
                            Stock bajo: <strong>{products.filter(p => p.stock <= p.stockMin).length}</strong>
                        </span>
                    </div>
                </Card>
            </div>

            {/* Modal de formulario */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={modalMode === 'create' ? 'Registrar Nuevo Producto' : 'Editar Producto'}
                size="xl"
            >
                <ProductForm
                    product={selectedProduct}
                    onSubmit={handleSubmit}
                    onCancel={handleCloseModal}
                    isLoading={isFormLoading}
                />
            </Modal>
        </div>
    );
};

export default ProductsPage;
