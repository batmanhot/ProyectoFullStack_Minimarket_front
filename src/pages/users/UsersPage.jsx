import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Users as UsersIcon, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Power,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import UserForm from '../../components/users/UserForm';
import userService from '../../services/userService';

const UsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' o 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [isFormLoading, setIsFormLoading] = useState(false);

  // Cargar usuarios
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const response = await userService.getAll();
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      toast.error(error.message || 'Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filtrar usuarios
  useEffect(() => {
    if (searchTerm === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  // Abrir modal para crear
  const handleCreate = () => {
    setModalMode('create');
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleEdit = (user) => {
    setModalMode('edit');
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  // Crear o actualizar usuario
  const handleSubmit = async (data) => {
    setIsFormLoading(true);
    try {
      if (modalMode === 'create') {
        await userService.create(data);
        toast.success('Usuario creado exitosamente');
      } else {
        await userService.update(selectedUser.id, data);
        toast.success('Usuario actualizado exitosamente');
      }
      handleCloseModal();
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Error al guardar usuario');
    } finally {
      setIsFormLoading(false);
    }
  };

  // Cambiar estado del usuario
  const handleToggleStatus = async (user) => {
    try {
      await userService.toggleStatus(user.id);
      toast.success(`Usuario ${!user.isActive ? 'activado' : 'desactivado'} exitosamente`);
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Error al cambiar estado');
    }
  };

  // Eliminar usuario
  const handleDelete = async (user) => {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${user.fullName}"?`)) {
      return;
    }

    try {
      await userService.delete(user.id);
      toast.success('Usuario eliminado exitosamente');
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar usuario');
    }
  };

  // Obtener badge de rol
  const getRoleBadge = (role) => {
    const badges = {
      admin: { variant: 'danger', label: 'Admin' },
      gerente: { variant: 'info', label: 'Gerente' },
      supervisor: { variant: 'warning', label: 'Supervisor' },
      cajero: { variant: 'success', label: 'Cajero' },
    };
    const badge = badges[role] || { variant: 'default', label: role };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  // Columnas de la tabla
  const columns = [
    {
      header: 'Usuario',
      accessor: 'username',
      render: (user) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-600 font-semibold">
              {user.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
            <p className="text-sm text-gray-500">@{user.username}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Email',
      accessor: 'email',
    },
    {
      header: 'Rol',
      accessor: 'role',
      render: (user) => getRoleBadge(user.role),
    },
    {
      header: 'Estado',
      accessor: 'isActive',
      render: (user) => (
        <Badge variant={user.isActive ? 'success' : 'default'}>
          {user.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      header: 'Acciones',
      accessor: 'actions',
      render: (user) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(user);
            }}
            className="text-blue-600 hover:text-blue-900"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleStatus(user);
            }}
            className={`${
              user.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'
            }`}
            title={user.isActive ? 'Desactivar' : 'Activar'}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(user);
            }}
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
                <UsersIcon className="w-8 h-8 text-primary-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Gestión de Usuarios
                  </h1>
                  <p className="text-sm text-gray-500">
                    Administra los usuarios del sistema
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
                placeholder="Buscar usuarios..."
                icon={Search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex space-x-3">
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={loadUsers}
                disabled={isLoading}
              >
                Actualizar
              </Button>
              <Button
                icon={Plus}
                onClick={handleCreate}
              >
                Nuevo Usuario
              </Button>
            </div>
          </div>

          {/* Tabla */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-2 text-gray-500">Cargando usuarios...</p>
            </div>
          ) : (
            <>
              <Table
                columns={columns}
                data={filteredUsers}
              />
              {filteredUsers.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    No se encontraron usuarios que coincidan con "{searchTerm}"
                  </p>
                </div>
              )}
            </>
          )}

          {/* Estadísticas */}
          <div className="mt-6 flex justify-between items-center text-sm text-gray-600">
            <span>
              Total de usuarios: <strong>{users.length}</strong>
            </span>
            <span>
              Mostrando: <strong>{filteredUsers.length}</strong> usuarios
            </span>
          </div>
        </Card>
      </div>

      {/* Modal de formulario */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalMode === 'create' ? 'Crear Nuevo Usuario' : 'Editar Usuario'}
        size="lg"
      >
        <UserForm
          user={selectedUser}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isLoading={isFormLoading}
        />
      </Modal>
    </div>
  );
};

export default UsersPage;
