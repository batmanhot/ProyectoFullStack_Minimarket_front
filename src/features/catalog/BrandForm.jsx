import { useState } from 'react'
import { brandService } from '../../services/index'
import { inputCls, labelCls, btnSecondary, btnPrimary, BRAND_COLORS, ColorDot } from './catalog.shared'
import toast from 'react-hot-toast'

export function BrandForm({ brand, onClose }) {
  const [name, setName]               = useState(brand?.name || '')
  const [description, setDescription] = useState(brand?.description || '')
  const [color, setColor]             = useState(brand?.color || BRAND_COLORS[0])
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      if (brand) {
        const result = await brandService.update(brand.id, { name: name.trim(), description: description.trim(), color })
        if (result.error) { setError(result.error); return }
        toast.success('Marca actualizada')
      } else {
        const result = await brandService.create({ name: name.trim(), description: description.trim(), color, isActive: true })
        if (result.error) { setError(result.error); return }
        toast.success('Marca creada')
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Nombre de la marca *</label>
        <input value={name} onChange={e => { setName(e.target.value); setError('') }} className={inputCls} placeholder="Ej: Alicorp, Gloria, Backus..."/>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <div><label className={labelCls}>Descripción / Rubro</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Descripción opcional..."/></div>
      <div>
        <label className={labelCls}>Color de la marca</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {BRAND_COLORS.map(c => <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }}/>)}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded-full cursor-pointer border border-gray-200 p-0.5"/>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500"><ColorDot color={color} size="lg"/><span>Vista previa del color seleccionado</span></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Guardando...' : brand ? 'Guardar cambios' : 'Crear marca'}</button>
      </div>
    </form>
  )
}
