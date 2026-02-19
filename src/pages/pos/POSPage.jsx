import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    ShoppingCart,
    Search,
    Trash2,
    CreditCard,
    Banknote,
    ArrowLeft,
    X,
    Plus,
    Minus,
    Printer,
    CheckCircle2,
    Package
} from 'lucide-react';

import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import POSScanner from '../../components/pos/POSScanner';
import CartItem from '../../components/pos/CartItem';
import CardPaymentForm from '../../components/pos/CardPaymentForm';
import ClientSelector from '../../components/pos/ClientSelector';
import ReceiptTemplate from '../../components/pos/ReceiptTemplate';
import productService from '../../services/productService';
import saleService from '../../services/saleService';
import cashService from '../../services/cashService';

const POSPage = () => {
    const navigate = useNavigate();
    const [cart, setCart] = useState([]);
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cardData, setCardData] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null);
    const [receiptType, setReceiptType] = useState('ticket');
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [lastSale, setLastSale] = useState(null);

    // Cargar productos y verificar sesión de caja
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [prodRes, cashRes] = await Promise.all([
                    productService.getAll(),
                    cashService.getCurrentSession()
                ]);
                setProducts(prodRes.data);

                if (!cashRes.data) {
                    toast.error('Debe abrir caja antes de realizar ventas');
                    navigate('/cash');
                }
            } catch (error) {
                toast.error('Error al cargar datos');
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [navigate]);

    const handleSearch = useCallback((term) => {
        if (!term.trim()) {
            setFilteredProducts([]);
            return;
        }
        const filtered = products.filter(p =>
            p.name.toLowerCase().includes(term.toLowerCase()) ||
            p.barcode.includes(term)
        ).slice(0, 5); // Limitar a 5 resultados para búsqueda rápida
        setFilteredProducts(filtered);
    }, [products]);

    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            updateQuantity(product.id, existing.quantity + 1);
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
            toast.success(`${product.name} añadido`);
        }
    };

    const updateQuantity = (id, newQty) => {
        if (newQty < 1) return;
        setCart(cart.map(item => item.id === id ? { ...item, quantity: newQty } : item));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const clearCart = () => {
        if (cart.length === 0) return;
        if (window.confirm('¿Vaciar el carrito?')) setCart([]);
    };

    const handleBarcodeScan = (barcode) => {
        const product = products.find(p => p.barcode === barcode);
        if (product) {
            addToCart(product);
        } else {
            toast.error('Producto no encontrado');
        }
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.priceSell * item.quantity), 0);
    const igv = subtotal * 0.18;
    const total = subtotal; // Asumiendo precios con IGV incluido o no para este demo básico

    const handleCheckout = async (data = {}) => {
        if (cart.length === 0) return;
        setIsProcessing(true);
        try {
            const saleData = {
                items: cart.map(item => ({
                    productId: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.priceSell,
                    subtotal: item.priceSell * item.quantity
                })),
                paymentMethod,
                total,
                cardInfo: paymentMethod === 'card' ? data : null,
                client: selectedClient,
                receiptType
            };

            // Simular validación extra para tarjeta (simulando Mercado Pago)
            if (paymentMethod === 'card') {
                console.log('Preparando datos para Mercado Pago...', saleData.cardInfo);
                await new Promise(resolve => setTimeout(resolve, 1500)); // Simular tokenización
            }

            const saleRes = await saleService.createSale(saleData);

            // Registrar movimiento en caja
            await cashService.addMovement({
                type: 'income',
                amount: total,
                description: `Venta POS: ${receiptType.toUpperCase()} ${saleRes.data.invoiceNumber}`,
                paymentMethod: paymentMethod
            });

            setLastSale(saleRes.data);
            setIsSuccessOpen(true);
            setCart([]);
            setFilteredProducts([]); // Limpiar resultados de búsqueda
            setIsCheckoutOpen(false);
            setCardData(null);
            setPaymentMethod('cash');
            setSelectedClient(null);
            setReceiptType('ticket');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header POS */}
            <div className="bg-primary-700 text-white p-4 shadow-lg shrink-0">
                <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        <button onClick={() => navigate('/dashboard')} className="hover:bg-primary-600 p-2 rounded-lg transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                        <div className="flex items-center">
                            <ShoppingCart className="mr-3 h-8 w-8 text-secondary-400" />
                            <h1 className="text-2xl font-black tracking-tight uppercase">Punto de Venta</h1>
                        </div>
                    </div>
                    <div className="flex space-x-4">
                        <div className="bg-primary-800 px-4 py-2 rounded-lg border border-primary-500">
                            <span className="text-primary-300 text-xs block uppercase font-bold">Vendedor</span>
                            <span className="font-semibold">Admin Minimarket</span>
                        </div>
                        <div className="bg-primary-800 px-4 py-2 rounded-lg border border-primary-500">
                            <span className="text-primary-300 text-xs block uppercase font-bold">Fecha</span>
                            <span className="font-semibold font-mono">{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Lado Izquierdo: Catálogo y Búsqueda */}
                <div className="flex-1 p-6 flex flex-col space-y-4 overflow-hidden">
                    <POSScanner onScan={handleBarcodeScan} onSearch={handleSearch} />

                    <div className="flex-1 overflow-auto">
                        {filteredProducts.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Resultados de búsqueda</h3>
                                {filteredProducts.map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-primary-400 cursor-pointer flex justify-between items-center group transition-all"
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-primary-500">
                                                <Package size={24} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{product.name}</p>
                                                <p className="text-sm text-gray-500 font-mono">{product.barcode}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-primary-700">S/ {product.priceSell.toFixed(2)}</p>
                                            <Badge variant={product.stock > product.stockMin ? 'success' : 'danger'}>
                                                Stock: {product.stock}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-40">
                                <Search size={64} className="mb-4 text-gray-300" />
                                <p className="text-xl font-medium text-gray-400">Escanee un producto o use el buscador</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lado Derecho: Carrito y Totales */}
                <div className="w-[450px] bg-white border-l border-gray-200 flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center">
                            Carrito <span className="ml-2 bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-sm">{cart.length}</span>
                        </h2>
                        <button onClick={clearCart} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                            <Trash2 size={20} />
                        </button>
                    </div>

                    <div className="p-4 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Cliente</p>
                        <ClientSelector
                            selectedClient={selectedClient}
                            onSelect={(client) => {
                                setSelectedClient(client);
                                if (client && client.type === 'RUC') {
                                    setReceiptType('factura');
                                } else if (client) {
                                    setReceiptType('boleta');
                                } else {
                                    setReceiptType('ticket');
                                }
                            }}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length > 0 ? (
                            cart.map(item => (
                                <CartItem
                                    key={item.id}
                                    item={item}
                                    onUpdateQuantity={updateQuantity}
                                    onRemove={removeFromCart}
                                />
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <ShoppingCart size={40} className="text-gray-200" />
                                </div>
                                <p className="text-gray-500 font-medium">No hay productos en la venta</p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>S/ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>IGV (18%)</span>
                                <span>S/ {igv.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-end pt-2">
                                <span className="text-xl font-bold text-gray-900 uppercase">Total a Pagar</span>
                                <span className="text-4xl font-black text-primary-700 tracking-tight">S/ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        <Button
                            fullWidth
                            size="lg"
                            className="py-6 text-xl font-black uppercase tracking-widest shadow-lg transform active:scale-95 transition-transform"
                            disabled={cart.length === 0}
                            onClick={() => setIsCheckoutOpen(true)}
                        >
                            Pagar Ahora (F12)
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal de Pago */}
            <Modal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                title="Finalizar Venta"
                size="md"
            >
                <div className="space-y-6">
                    <div className="bg-primary-50 p-6 rounded-2xl text-center border border-primary-100">
                        <p className="text-primary-700 text-sm font-bold uppercase tracking-wider mb-1">Monto Total</p>
                        <p className="text-5xl font-black text-primary-900 tracking-tight">S/ {total.toFixed(2)}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Tipo de Comprobante</label>
                        <div className="flex p-1 bg-gray-100 rounded-xl space-x-1">
                            {['ticket', 'boleta', 'factura'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        if (type === 'factura' && (!selectedClient || selectedClient.type !== 'RUC')) {
                                            toast.error('Factura requiere cliente con RUC');
                                            return;
                                        }
                                        setReceiptType(type);
                                    }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold capitalize transition-all ${receiptType === type
                                        ? 'bg-white text-primary-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        {selectedClient && (
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                Emitir a: <span className="font-bold text-gray-700">{selectedClient.name}</span>
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Método de Pago</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${paymentMethod === 'cash'
                                    ? 'border-primary-500 bg-primary-50 text-primary-700 ring-4 ring-primary-50'
                                    : 'border-gray-100 hover:border-gray-200 text-gray-500'
                                    }`}
                            >
                                <Banknote size={32} className="mb-2" />
                                <span className="font-bold">Efectivo</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('card')}
                                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${paymentMethod === 'card'
                                    ? 'border-primary-500 bg-primary-50 text-primary-700 ring-4 ring-primary-50'
                                    : 'border-gray-100 hover:border-gray-200 text-gray-500'
                                    }`}
                            >
                                <CreditCard size={32} className="mb-2" />
                                <span className="font-bold">Tarjeta</span>
                            </button>
                        </div>
                    </div>

                    {paymentMethod === 'card' ? (
                        <CardPaymentForm
                            total={total}
                            onSubmit={handleCheckout}
                            onCancel={() => setPaymentMethod('cash')}
                            isLoading={isProcessing}
                        />
                    ) : (
                        <div className="pt-4 flex space-x-3">
                            <Button variant="ghost" fullWidth onClick={() => setIsCheckoutOpen(false)}>Cancelar</Button>
                            <Button
                                fullWidth
                                loading={isProcessing}
                                onClick={() => handleCheckout()}
                                icon={CheckCircle2}
                                className="h-14 font-bold text-lg"
                            >
                                Confirmar Venta
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal de Venta Exitosa e Impresión */}
            <Modal
                isOpen={isSuccessOpen}
                onClose={() => setIsSuccessOpen(false)}
                title="Venta Finalizada Exitosamente"
                size="md"
            >
                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <CheckCircle2 size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900">¡Venta Exitosa!</h3>
                        <p className="text-gray-500">¿Desea imprimir el comprobante?</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto">
                        <ReceiptTemplate sale={lastSale} />
                    </div>

                    <div className="flex space-x-3 pt-4">
                        <Button
                            variant="outline"
                            fullWidth
                            onClick={() => setIsSuccessOpen(false)}
                        >
                            Cerrar
                        </Button>
                        <Button
                            fullWidth
                            onClick={handlePrint}
                            icon={Printer}
                            className="bg-primary-600 hover:bg-primary-700"
                        >
                            Imprimir (Ctrl+P)
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default POSPage;
