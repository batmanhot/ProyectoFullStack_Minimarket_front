import { useState } from 'react'
import { categoryService } from '../../services/index'
import { inputCls, labelCls, btnSecondary, btnPrimary, CATEGORY_COLORS, ColorDot } from './catalog.shared'
import toast from 'react-hot-toast'

export function CategoryForm({ category, onClose }) {
  const [name, setName]               = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [color, setColor]             = useState(category?.color || CATEGORY_COLORS[0])
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      if (category) {
        const result = await categoryService.update(category.id, { name: name.trim(), description: description.trim(), color })
        if (result.error) { setError(result.error); return }
        toast.success('Categoría actualizada')
      } else {
        const result = await categoryService.create({ name: name.trim(), description: description.trim(), color, isActive: true })
        if (result.error) { setError(result.error); return }
        toast.success('Categoría creada')
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Nombre *</label>
        <input value={name} onChange={e => { setName(e.target.value); setError('') }} className={inputCls} placeholder="Ej: Abarrotes, Bebidas..."/>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <div><label className={labelCls}>Descripción</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Descripción opcional..."/></div>
      <div>
        <label className={labelCls}>Color identificador</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {CATEGORY_COLORS.map(c => <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }}/>)}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded-full cursor-pointer border border-gray-200 p-0.5"/>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500"><ColorDot color={color} size="lg"/><span>Vista previa del color seleccionado</span></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Guardando...' : category ? 'Guardar cambios' : 'Crear categoría'}</button>
      </div>
    </form>
  )
}
