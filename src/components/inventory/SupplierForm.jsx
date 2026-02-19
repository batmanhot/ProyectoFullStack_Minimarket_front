import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../common/Input';
import Button from '../common/Button';
import { supplierSchema } from '../../utils/validations';
import { User, Phone, Mail, MapPin, FileDigit, Building2 } from 'lucide-react';

const SupplierForm = ({ supplier, onSubmit, onCancel, isLoading = false }) => {
    const isEditMode = !!supplier;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(supplierSchema),
        defaultValues: supplier || {
            name: '',
            contactName: '',
            phone: '',
            email: '',
            address: '',
            taxId: '',
        },
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
                label="Nombre / Razón Social"
                type="text"
                placeholder="ej: Distribuidora SAC"
                icon={Building2}
                error={errors.name?.message}
                required
                {...register('name')}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    label="Nombre de Contacto"
                    type="text"
                    placeholder="ej: Juan Pérez"
                    icon={User}
                    error={errors.contactName?.message}
                    {...register('contactName')}
                />
                <Input
                    label="RUC / NIT"
                    type="text"
                    placeholder="Número de identificación fiscal"
                    icon={FileDigit}
                    error={errors.taxId?.message}
                    {...register('taxId')}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    label="Teléfono"
                    type="text"
                    placeholder="ej: 987654321"
                    icon={Phone}
                    error={errors.phone?.message}
                    {...register('phone')}
                />
                <Input
                    label="Email"
                    type="email"
                    placeholder="ej: contacto@empresa.com"
                    icon={Mail}
                    error={errors.email?.message}
                    {...register('email')}
                />
            </div>

            <Input
                label="Dirección"
                type="text"
                placeholder="Dirección física"
                icon={MapPin}
                error={errors.address?.message}
                {...register('address')}
            />

            <div className="flex justify-end space-x-3 pt-4">
                <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
                    Cancelar
                </Button>
                <Button type="submit" loading={isLoading} disabled={isLoading}>
                    {isEditMode ? 'Actualizar Proveedor' : 'Crear Proveedor'}
                </Button>
            </div>
        </form>
    );
};

export default SupplierForm;
