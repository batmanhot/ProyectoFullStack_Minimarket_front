import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, CreditCard, Phone, Mail, MapPin, CheckCircle2 } from 'lucide-react';

import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';

const clientSchema = z.object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    document: z.string().min(8, 'El documento debe tener al menos 8 dígitos'),
    type: z.string().min(1, 'Seleccione un tipo de documento'),
    phone: z.string().optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    address: z.string().optional()
});

const ClientForm = ({ client = null, onSubmit, onCancel, isLoading = false }) => {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(clientSchema),
        defaultValues: client || {
            name: '',
            document: '',
            type: 'DNI',
            phone: '',
            email: '',
            address: ''
        }
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <Input
                        label="Nombre Completo / Razón Social"
                        icon={User}
                        placeholder="Ej: Juan Pérez o Empresa S.A."
                        error={errors.name?.message}
                        {...register('name')}
                    />
                </div>

                <Select
                    label="Tipo Documento"
                    icon={CreditCard}
                    error={errors.type?.message}
                    {...register('type')}
                >
                    <option value="DNI">DNI (Persona)</option>
                    <option value="RUC">RUC (Empresa)</option>
                    <option value="PAS">Pasaporte</option>
                    <option value="CE">Carnet de Extranjería</option>
                </Select>

                <Input
                    label="Número de Documento"
                    icon={CreditCard}
                    placeholder="Número de identidad"
                    error={errors.document?.message}
                    {...register('document')}
                />

                <Input
                    label="Teléfono / WhatsApp"
                    icon={Phone}
                    placeholder="987654321"
                    error={errors.phone?.message}
                    {...register('phone')}
                />

                <Input
                    label="Correo Electrónico"
                    icon={Mail}
                    placeholder="cliente@ejemplo.com"
                    error={errors.email?.message}
                    {...register('email')}
                />

                <div className="md:col-span-2">
                    <Input
                        label="Dirección"
                        icon={MapPin}
                        placeholder="Calle, Distrito, Ciudad"
                        error={errors.address?.message}
                        {...register('address')}
                    />
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    loading={isLoading}
                    icon={CheckCircle2}
                >
                    {client ? 'Actualizar Cliente' : 'Registrar Cliente'}
                </Button>
            </div>
        </form>
    );
};

export default ClientForm;
