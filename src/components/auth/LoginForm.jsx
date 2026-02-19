import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

import Button from '../common/Button';
import Input from '../common/Input';
import Card from '../common/Card';
import { loginSchema } from '../../utils/validations';
import authService from '../../services/authService';
import useAuthStore from '../../store/authStore';

const LoginForm = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const response = await authService.login(data);
      
      // Guardar en el store
      login(response.user, response.token);
      
      toast.success(`¡Bienvenido, ${response.user.fullName}!`);
      
      // Redireccionar según el rol
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-xl mb-4">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Sistema POS</h1>
          <p className="mt-2 text-gray-600">Inicia sesión para continuar</p>
        </div>

        {/* Formulario de login */}
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Usuario */}
            <div>
              <Input
                label="Usuario"
                type="text"
                placeholder="Ingresa tu usuario"
                icon={User}
                error={errors.username?.message}
                {...register('username')}
              />
            </div>

            {/* Contraseña */}
            <div>
              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresa tu contraseña"
                  icon={Lock}
                  error={errors.password?.message}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Recordar sesión y olvidé contraseña */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-gray-600">Recordarme</span>
              </label>
              <a
                href="/forgot-password"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {/* Botón de submit */}
            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              disabled={isLoading}
            >
              Iniciar Sesión
            </Button>
          </form>

          {/* Usuarios de prueba */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-900 mb-2">
              👤 Usuarios de Prueba:
            </p>
            <div className="space-y-1 text-xs text-blue-800">
              <div className="flex justify-between">
                <span className="font-medium">Admin:</span>
                <span className="font-mono">admin / admin123</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Gerente:</span>
                <span className="font-mono">gerente / gerente123</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Supervisor:</span>
                <span className="font-mono">supervisor / super123</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Cajero:</span>
                <span className="font-mono">cajero / cajero123</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Pie de página */}
        <p className="mt-8 text-center text-sm text-gray-600">
          Sistema de Punto de Venta v1.0
          <br />
          © 2026 Todos los derechos reservados
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
