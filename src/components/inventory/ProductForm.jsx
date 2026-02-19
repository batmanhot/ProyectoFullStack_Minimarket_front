import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { productSchema } from '../../utils/validations';
import categoryService from '../../services/categoryService';
import supplierService from '../../services/supplierService';
import {
  Package,
  Barcode,
  FileText,
  Tag,
  AlertTriangle,
  Coins,
  TrendingUp,
  Building2
} from 'lucide-react';

const ProductForm = ({ product, onSubmit, onCancel, isLoading = false }) => {
  const isEditMode = !!product;
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [catRes, supRes] = await Promise.all([
          categoryService.getAll(),
          supplierService.getAll()
        ]);
        setCategories(catRes.data.map(c => ({ value: c.id, label: c.name })));
        setSuppliers(supRes.data.map(s => ({ value: s.id, label: s.name })));
      } catch (error) {
        console.error('Error loading metadata:', error);
      }
    };
    loadMetadata();
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: product || {
      barcode: '',
      name: '',
      description: '',
      categoryId: '',
      supplierId: '',
      priceBuy: 0,
      priceSell: 0,
      stock: 0,
      stockMin: 0,
      unit: 'unidad',
    },
  });

  // Resetear el formulario cuando cambie el producto (importante para cambiar entre editar y crear)
  useEffect(() => {
    if (product) {
      // Importante: Convertir IDs a string para que coincidan con los valores del <select> HTML
      reset({
        ...product,
        categoryId: product.categoryId?.toString() || '',
        supplierId: product.supplierId?.toString() || '',
      });
    } else {
      reset({
        barcode: '',
        name: '',
        description: '',
        categoryId: '',
        supplierId: '',
        priceBuy: 0,
        priceSell: 0,
        stock: 0,
        stockMin: 0,
        unit: 'unidad',
      });
    }
  }, [product, reset]);

  const unitOptions = [
    { value: 'unidad', label: 'Unidad' },
    { value: 'kg', label: 'Kilogramo' },
    { value: 'litro', label: 'Litro' },
    { value: 'paquete', label: 'Paquete' },
  ];

  const handleFormSubmit = (data) => {
    const formattedData = {
      ...data,
      // Al guardar, convertimos de nuevo a número para la "DB" (mock)
      categoryId: data.categoryId ? parseInt(data.categoryId, 10) : null,
      supplierId: data.supplierId ? parseInt(data.supplierId, 10) : null,
      // Asegurar que los números sean números
      priceBuy: parseFloat(data.priceBuy),
      priceSell: parseFloat(data.priceSell),
      stock: parseFloat(data.stock),
      stockMin: parseFloat(data.stockMin),
    };
    onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Código de Barras"
          type="text"
          placeholder="Escanee o ingrese código"
          icon={Barcode}
          error={errors.barcode?.message}
          required
          {...register('barcode')}
        />
        <Input
          label="Nombre del Producto"
          type="text"
          placeholder="ej: Arroz Extra 1kg"
          icon={Package}
          error={errors.name?.message}
          required
          {...register('name')}
        />
      </div>

      <Input
        label="Descripción (Opcional)"
        type="text"
        placeholder="Breve descripción del producto"
        icon={FileText}
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          key={`cat-${categories.length}`}
          label="Categoría"
          options={categories}
          error={errors.categoryId?.message}
          required
          {...register('categoryId')}
          icon={Tag}
        />
        <Select
          key={`sup-${suppliers.length}`}
          label="Proveedor"
          options={suppliers}
          error={errors.supplierId?.message}
          {...register('supplierId')}
          icon={Building2}
        />
        <Select
          label="Unidad de Medida"
          options={unitOptions}
          error={errors.unit?.message}
          required
          {...register('unit')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Input
          label="Precio Compra"
          type="number"
          step="0.01"
          placeholder="0.00"
          icon={Coins}
          error={errors.priceBuy?.message}
          required
          {...register('priceBuy')}
        />
        <Input
          label="Precio Venta"
          type="number"
          step="0.01"
          placeholder="0.00"
          icon={TrendingUp}
          error={errors.priceSell?.message}
          required
          {...register('priceSell')}
        />
        <Input
          label="Stock Actual"
          type="number"
          placeholder="0"
          icon={Package}
          error={errors.stock?.message}
          required
          {...register('stock')}
        />
        <Input
          label="Stock Mínimo"
          type="number"
          placeholder="0"
          icon={AlertTriangle}
          error={errors.stockMin?.message}
          required
          {...register('stockMin')}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>
          {isEditMode ? 'Actualizar Producto' : 'Crear Producto'}
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;
