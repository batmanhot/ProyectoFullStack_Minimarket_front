/**
 * Discounts.jsx — Gestión de Descuentos v2
 * Ruta: src/features/discounts/Discounts.jsx
 *
 * CAMBIOS vs v1 (God Component de 1318 líneas):
 *  - Este archivo pasó de 1318 a ~95 líneas de UI pura
 *  - Lógica de formulario    → CampaignForm.jsx    (~330 líneas)
 *  - Tarjeta de campaña      → CampaignCard.jsx    (~180 líneas)
 *  - Modal de plantillas     → TemplatesModal.jsx  (~170 líneas)
 *  - Cada subcomponente tiene una responsabilidad única y es testeable
 */

import { useState, useMemo } from 'react'
import { useStore }          from '../../store/index'
import { CAMPAIGN_TYPES, isCampaignActive } from '../../shared/utils/discountEngine'
import Modal                 from '../../shared/components/ui/Modal'
import ConfirmModal          from '../../shared/components/ui/ConfirmModal'
import { EmptyState }        from '../../shared/components/ui/Skeleton'
import toast                 from 'react-hot-toast'

import CampaignCard          from './components/CampaignCard'
import CampaignForm          from './components/CampaignForm'
import TemplatesModal        from './components/TemplatesModal'

export default function Discounts() {
  const {
    discountCampaigns = [], categories, products,
    updateDiscountCampaign, deleteDiscountCampaign,
  } = useStore()

  const [modal,         setModal]         = useState(null)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [filterType,    setFilterType]    = useState('all')
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [showTemplates, setShowTemplates] = useState(false)

  const kpis = useMemo(() => ({
    total:     discountCampaigns.length,
    active:    discountCampaigns.filter(isCampaignActive).length,
    scheduled: discountCampaigns.filter((c) => c.isActive && c.dateFrom && new Date(c.dateFrom) > new Date()).length,
    expired:   discountCampaigns.filter((c) => c.dateTo && new Date(c.dateTo + 'T23:59:59') < new Date()).length,
  }), [discountCampaigns])

  const filtered = useMemo(() => {
    let list = [...discountCampaigns].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    if (filterType !== 'all')       list = list.filter((c) => c.type === filterType)
    if (filterStatus === 'active')  list = list.filter(isCampaignActive)
    if (filterStatus === 'inactive')list = list.filter((c) => !isCampaignActive(c))
    return list
  }, [discountCampaigns, filterType, filterStatus])

  const handleToggle = (campaign) => {
    updateDiscountCampaign(campaign.id, { isActive: !campaign.isActive })
    toast.success(campaign.isActive ? 'Campaña desactivada' : 'Campaña activada')
  }

  const handleDelete = (campaign) => {
    deleteDiscountCampaign(campaign.id)
    toast.success('Campaña eliminada')
    setDeleteTarget(null)
  }

  const handleTemplate = (tpl) => {
    setModal({
      type: 'form',
      data: {
        ...tpl,
        id: null, name: tpl.name,
        dateFrom: tpl.dateFrom || '', dateTo: tpl.dateTo || '',
        daysOfWeek: [], categoryIds: [], productIds: [], brands: [],
        isActive: true,
      },
    })
    setShowTemplates(false)
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-800 dark:text-slate-100">Gestión de Descuentos</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500">Campañas, promociones y descuentos automáticos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplates(true)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
            ⚡ Usar plantilla
          </button>
          <button onClick={() => setModal({ type: 'form', data: null })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Nueva campaña
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total campañas', value: kpis.total,     bg: 'bg-gray-50 dark:bg-slate-800/50',  text: 'text-gray-800 dark:text-slate-100' },
          { label: '🟢 Activas',     value: kpis.active,    bg: 'bg-green-50',  text: 'text-green-700' },
          { label: '📅 Programadas', value: kpis.scheduled, bg: 'bg-blue-50',   text: 'text-blue-700'  },
          { label: '⏰ Vencidas',    value: kpis.expired,   bg: 'bg-gray-50 dark:bg-slate-800/50',  text: 'text-gray-500 dark:text-slate-400' },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.text}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Info POS */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">💡</span>
        <div>
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Aplicación automática en el POS</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Las campañas activas se aplican automáticamente al agregar productos al carrito según la jerarquía N1 → N2 → N3.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          <button onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500 dark:text-slate-400'}`}>
            Todos
          </button>
          {CAMPAIGN_TYPES.map((t) => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === t.value ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500 dark:text-slate-400'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {[{ k: 'all', l: 'Todos' }, { k: 'active', l: 'Activas' }, { k: 'inactive', l: 'Inactivas' }].map((f) => (
            <button key={f.k} onClick={() => setFilterStatus(f.k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus === f.k ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500 dark:text-slate-400'}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de campañas */}
      {filtered.length === 0 ? (
        <EmptyState icon="🏷️" title="Sin campañas de descuento"
          message="Crea tu primera campaña o usa una de las plantillas predefinidas."
          action={{ label: 'Nueva campaña', onClick: () => setModal({ type: 'form', data: null }) }}/>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} categories={categories} products={products}
              onEdit={(c) => setModal({ type: 'form', data: c })}
              onToggle={handleToggle}
              onDelete={(c) => setDeleteTarget(c)}/>
          ))}
        </div>
      )}

      {/* Modales */}
      {modal?.type === 'form' && (
        <Modal title={modal.data?.id ? 'Editar campaña' : 'Nueva campaña de descuento'} size="lg" onClose={() => setModal(null)}>
          <CampaignForm
            campaign={modal.data?.id ? modal.data : null}
            categories={categories}
            products={products}
            onClose={() => setModal(null)}/>
        </Modal>
      )}

      {showTemplates && (
        <TemplatesModal onUse={handleTemplate} onClose={() => setShowTemplates(false)}/>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar campaña?"
          message={`Se eliminará permanentemente "${deleteTarget.name}". Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar" variant="danger"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}/>
      )}
    </div>
  )
}
