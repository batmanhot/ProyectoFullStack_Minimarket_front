import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../common/Input';
import Button from '../common/Button';
import { categorySchema } from '../../utils/validations';
import { Tag, FileText } from 'lucide-react';

const CategoryForm = ({ category, onSubmit, onCancel, isLoading = false }) => {
    const isEditMode = !!category;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(categorySchema),
        defaultValues: category || {
            name: '',
            description: '',
        },
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
                label="Nombre de la Categoría"
                type="text"
                placeholder="ej: Abarrotes"
                icon={Tag}
                error={errors.name?.message}
                required
                {...register('name')}
            />

            <Input
                label="Descripción (Opcional)"
                type="text"
                placeholder="Breve descripción..."
                icon={FileText}
                error={errors.description?.message}
                {...register('description')}
            />

            <div className="flex justify-end space-x-3 pt-4">
                <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
                    Cancelar
                </Button>
                <Button type="submit" loading={isLoading} disabled={isLoading}>
                    {isEditMode ? 'Actualizar Categoría' : 'Crear Categoría'}
                </Button>
            </div>
        </form>
    );
};

export default CategoryForm;
