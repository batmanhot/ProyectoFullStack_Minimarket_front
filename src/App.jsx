import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import UsersPage from './pages/users/UsersPage';
import ProductsPage from './pages/inventory/ProductsPage';
import CategoriesPage from './pages/inventory/CategoriesPage';
import SuppliersPage from './pages/inventory/SuppliersPage';
import POSPage from './pages/pos/POSPage';
import CashPage from './pages/cash/CashPage';
import ClientsPage from './pages/clients/ClientsPage';
import ReportsPage from './pages/reports/ReportsPage';
import InvoicesPage from './pages/invoices/InvoicesPage';

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';

// Store
import useAuthStore from './store/authStore';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#363636',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={['admin', 'gerente', 'supervisor']}>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/categories"
          element={
            <ProtectedRoute allowedRoles={['admin', 'gerente', 'supervisor']}>
              <CategoriesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/suppliers"
          element={
            <ProtectedRoute allowedRoles={['admin', 'gerente', 'supervisor']}>
              <SuppliersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pos"
          element={
            <ProtectedRoute allowedRoles={['admin', 'gerente', 'supervisor', 'cajero']}>
              <POSPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients"
          element={
            <ProtectedRoute allowedRoles={['admin', 'gerente', 'supervisor']}>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cash"
          element={
            <ProtectedRoute allowedRoles={['admin', 'gerente', 'supervisor', 'cajero']}>
              <CashPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'gerente', 'supervisor']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invoices"
          element={
            <ProtectedRoute allowedRoles={['admin', 'gerente', 'supervisor']}>
              <InvoicesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-8">Página no encontrada</p>
                <a
                  href="/"
                  className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Volver al inicio
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;