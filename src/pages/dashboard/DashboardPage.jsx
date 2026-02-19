import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  ShoppingCart,
  Package,
  Tag,
  Building2,
  Users,
  DollarSign,
  BarChart3,
  FileText,
  Settings
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import toast from 'react-hot-toast';
import saleService from '../../services/saleService';
import productService from '../../services/productService';
import clientService from '../../services/clientService';
import cashService from '../../services/cashService';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState({
    todaySales: 0,
    productsCount: 0,
    clientsCount: 0,
    cashBalance: 0
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [salesRes, productsRes, clientsRes, cashStats] = await Promise.all([
          saleService.getHistory({ startDate: today }),
          productService.getAll(),
          clientService.getAll(),
          cashService.getDailyStats()
        ]);

        const todayTotal = salesRes.data.reduce((acc, s) => acc + s.total, 0);

        setStats({
          todaySales: todayTotal,
          productsCount: productsRes.data.length,
          clientsCount: clientsRes.data.length,
          cashBalance: cashStats.data.total
        });
      } catch (error) {
        console.error('Error loading dashboard stats', error);
      }
    };

    loadStats();
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada correctamente');
    navigate('/login');
  };

  const menuItems = [
    {
      title: 'Punto de Venta',
      description: 'Realizar ventas y cobros',
      icon: ShoppingCart,
      color: 'bg-blue-500',
      path: '/pos',
      roles: ['admin', 'gerente', 'supervisor', 'cajero']
    },
    {
      title: 'Inventario',
      description: 'Gestionar productos y stock',
      icon: Package,
      color: 'bg-green-500',
      path: '/inventory',
      roles: ['admin', 'gerente', 'supervisor']
    },
    {
      title: 'Categorías',
      description: 'Organizar productos por categorías',
      icon: Tag,
      color: 'bg-orange-500',
      path: '/inventory/categories',
      roles: ['admin', 'gerente', 'supervisor']
    },
    {
      title: 'Proveedores',
      description: 'Gestión de proveedores',
      icon: Building2,
      color: 'bg-teal-500',
      path: '/inventory/suppliers',
      roles: ['admin', 'gerente', 'supervisor']
    },
    {
      title: 'Clientes',
      description: 'Administrar clientes',
      icon: Users,
      color: 'bg-purple-500',
      path: '/clients',
      roles: ['admin', 'gerente', 'supervisor']
    },
    {
      title: 'Caja',
      description: 'Control de caja y movimientos',
      icon: DollarSign,
      color: 'bg-yellow-500',
      path: '/cash',
      roles: ['admin', 'gerente', 'supervisor', 'cajero']
    },
    {
      title: 'Comprobantes',
      description: 'Ver historial de documentos',
      icon: FileText,
      color: 'bg-indigo-500',
      path: '/invoices',
      roles: ['admin', 'gerente', 'supervisor']
    },
    {
      title: 'Reportes',
      description: 'Ver estadísticas y reportes',
      icon: BarChart3,
      color: 'bg-emerald-500',
      path: '/reports',
      roles: ['admin', 'gerente', 'supervisor']
    },
    {
      title: 'Configuración',
      description: 'Usuarios y configuración',
      icon: Settings,
      color: 'bg-gray-500',
      path: '/users',
      roles: ['admin']
    },
  ];

  // Filtrar menú según el rol del usuario
  const filteredMenu = menuItems.filter(item =>
    item.roles.includes(user?.role)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 bg-primary-600 rounded-lg mr-3">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sistema POS</h1>
                <p className="text-sm text-gray-500">Panel de Control</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={LogOut}
                onClick={handleLogout}
              >
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bienvenida */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Bienvenido, {user?.fullName}!
          </h2>
          <p className="text-gray-600">
            Selecciona una opción del menú para comenzar
          </p>
        </div>

        {/* Grid de opciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMenu.map((item, index) => {
            const Icon = item.icon;
            return (
              <Card
                key={index}
                className="hover:shadow-lg transition-shadow duration-200 cursor-pointer group"
                onClick={() => navigate(item.path)}
              >
                <div className="flex items-start space-x-4">
                  <div className={`${item.color} p-3 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Stats rápidas (Basadas en data real) */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Ventas Hoy</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">S/ {stats.todaySales.toFixed(2)}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Productos</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{stats.productsCount}</p>
              </div>
              <Package className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Clientes</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">{stats.clientsCount}</p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">En Caja</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">S/ {stats.cashBalance.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-200">
        <p className="text-center text-sm text-gray-500">
          Sistema POS v1.0 - © 2026 Todos los derechos reservados
        </p>
      </footer>
    </div>
  );
};

export default DashboardPage;
