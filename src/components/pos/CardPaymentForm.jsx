import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreditCard, Calendar, Lock, User } from 'lucide-react';
import { cardSchema } from '../../utils/validations';
import Input from '../common/Input';
import Button from '../common/Button';

const CardPaymentForm = ({ total, onSubmit, onCancel, isLoading = false }) => {
    const {
        register,
        handleSubmit,
        formState: { errors, isValid },
        setValue,
        watch
    } = useForm({
        resolver: zodResolver(cardSchema),
        mode: 'onChange'
    });

    const cardNumber = watch('cardNumber');
    const expiryDate = watch('expiryDate');

    // Simple formatting for card number
    const handleCardNumberChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 16) value = value.slice(0, 16);
        const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
        setValue('cardNumber', formatted, { shouldValidate: true });
    };

    // Simple formatting for expiry date
    const handleExpiryChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 4) value = value.slice(0, 4);
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        setValue('expiryDate', value, { shouldValidate: true });
    };

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <Input
                        label="Nombre en la Tarjeta"
                        icon={User}
                        placeholder="Ej: JUAN PEREZ"
                        error={errors.cardName?.message}
                        {...register('cardName')}
                    />
                </div>

                <div className="md:col-span-2">
                    <Input
                        label="Número de Tarjeta"
                        icon={CreditCard}
                        placeholder="0000 0000 0000 0000"
                        error={errors.cardNumber?.message}
                        onChange={handleCardNumberChange}
                        value={cardNumber || ''}
                    />
                </div>

                <Input
                    label="Vencimiento (MM/YY)"
                    icon={Calendar}
                    placeholder="MM/YY"
                    error={errors.expiryDate?.message}
                    onChange={handleExpiryChange}
                    value={expiryDate || ''}
                />

                <Input
                    label="CVV"
                    icon={Lock}
                    type="password"
                    placeholder="123"
                    maxLength={4}
                    error={errors.cvv?.message}
                    {...register('cvv')}
                />
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-4 flex justify-between items-center">
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Resumen de Pago</p>
                    <p className="text-sm font-medium text-gray-700">Pago con Tarjeta bancaria</p>
                </div>
                <p className="text-xl font-black text-primary-700">S/ {total.toFixed(2)}</p>
            </div>

            <div className="flex space-x-3 pt-4">
                <Button variant="ghost" fullWidth onClick={onCancel} type="button">
                    Atrás
                </Button>
                <Button
                    fullWidth
                    loading={isLoading}
                    disabled={!isValid || isLoading}
                    onClick={handleSubmit(onSubmit)}
                    icon={CreditCard}
                >
                    Procesar Pago
                </Button>
            </div>
        </div>
    );
};

export default CardPaymentForm;
