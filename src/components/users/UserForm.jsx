import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { createUserSchema, editUserSchema } from '../../utils/validations';
import { User, Mail, Lock, UserCircle } from 'lucide-react';

const UserForm = ({ user, onSubmit, onCancel, isLoading = false }) => {
  const isEditMode = !!user;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isEditMode ? editUserSchema : createUserSchema),
    defaultValues: user || {
      username: '',
      email: '',
      password: '',
      fullName: '',
      role: '',
    },
  });

  const roleOptions = [
    { value: 'admin', label: 'Administrador' },
    { value: 'gerente', label: 'Gerente' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'cajero', label: 'Cajero' },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Usuario */}
        <Input
          label="Nombre de Usuario"
          type="text"
          placeholder="ej: jperez"
          icon={User}
          error={errors.username?.message}
          required
          {...register('username')}
        />

        {/* Email */}
        <Input
          label="Email"
          type="email"
          placeholder="usuario@ejemplo.com"
          icon={Mail}
          error={errors.email?.message}
          required
          {...register('email')}
        />
      </div>

      {/* Nombre Completo */}
      <Input
        label="Nombre Completo"
        type="text"
        placeholder="ej: Juan Pérez García"
        icon={UserCircle}
        error={errors.fullName?.message}
        required
        {...register('fullName')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contraseña */}
        {!isEditMode && (
          <Input
            label="Contraseña"
            type="password"
            placeholder="Mínimo 6 caracteres"
            icon={Lock}
            error={errors.password?.message}
            required
            {...register('password')}
          />
        )}

        {/* Rol */}
        <Select
          label="Rol"
          options={roleOptions}
          error={errors.role?.message}
          required
          {...register('role')}
        />
      </div>

      {isEditMode && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Nota:</strong> Para cambiar la contraseña del usuario, 
            debe hacerlo desde la opción de cambiar contraseña en su perfil.
          </p>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={isLoading}
          disabled={isLoading}
        >
          {isEditMode ? 'Actualizar Usuario' : 'Crear Usuario'}
        </Button>
      </div>
    </form>
  );
};

export default UserForm;
