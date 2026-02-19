import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banknote, FileText, CheckCircle2 } from 'lucide-react';

import Input from '../common/Input';
import Button from '../common/Button';

const openingSchema = z.object({
    amount: z.coerce.number().min(0, 'El monto debe ser mayor o igual a 0')
});

const closingSchema = z.object({
    amount: z.coerce.number().min(0, 'El monto debe ser mayor o igual a 0'),
    notes: z.string().optional()
});

const CashSessionModal = ({ type = 'open', onSubmit, onCancel, isLoading = false, initialData = null }) => {
    const isOpening = type === 'open' || type === 'edit';
    const isEditing = type === 'edit';

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(isOpening && !isEditing ? openingSchema : isEditing ? openingSchema : closingSchema),
        defaultValues: {
            amount: initialData?.amount || 0,
            notes: initialData?.notes || ''
        }
    });

    return (
        <div className="space-y-6">
            <div className={`p-4 rounded-xl border ${isOpening ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
                <p className="text-sm font-medium">
                    {isOpening
                        ? 'Ingrese el monto inicial con el que comienza el turno en caja.'
                        : 'Ingrese el monto total contado físicamente en caja para el arqueo.'}
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                    label={isOpening ? "Monto Inicial (S/)" : "Monto Final en Caja (S/)"}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    icon={Banknote}
                    error={errors.amount?.message}
                    {...register('amount')}
                />

                {!isOpening && (
                    <Input
                        label="Notas de Cierre"
                        type="text"
                        placeholder="Alguna observación sobre el arqueo..."
                        icon={FileText}
                        error={errors.notes?.message}
                        {...register('notes')}
                    />
                )}

                <div className="flex space-x-3 pt-4">
                    <Button variant="ghost" fullWidth onClick={onCancel}>Cancelar</Button>
                    <Button
                        type="submit"
                        fullWidth
                        loading={isLoading}
                        icon={CheckCircle2}
                    >
                        {isEditing ? 'Actualizar Monto' : isOpening ? 'Abrir Caja' : 'Cerrar Caja'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CashSessionModal;
