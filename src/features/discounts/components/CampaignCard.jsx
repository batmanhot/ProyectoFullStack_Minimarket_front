/**
 * CampaignCard.jsx — Tarjeta de campaña de descuento
 * Ruta: src/features/discounts/components/CampaignCard.jsx
 */

import { formatCurrency, formatDate } from '../../../shared/utils/helpers'
import { CAMPAIGN_TYPES, DAYS_OF_WEEK, isCampaignActive } from '../../../shared/utils/discountEngine'

// ─── Badge de estado ──────────────────────────────────────────────────────────
export function StatusBadge({ campaign }) {
  const now    = new Date()
  const from   = campaign.dateFrom ? new Date(campaign.dateFrom) : null
  const to     = campaign.dateTo   ? new Date(campaign.dateTo + 'T23:59:59') : null
  const active = isCampaignActive(campaign)

  if (!campaign.isActive) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">Inactiva</span>
  if (from && now < from) return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-600">Programada</span>
  if (to && now > to)     return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-500">Vencida</span>
  if (active)             return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1 w-fit">
      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block"/>Activa
    </span>
  )
  return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-600">Fuera de horario</span>
}

const TYPE_GRADIENTS = {
  campaign:  'from-blue-500 to-blue-600',
  promotion: 'from-purple-500 to-purple-600',
  volume:    'from-teal-500 to-teal-600',
  line:      'from-orange-500 to-orange-600',
}

// ─── Card principal ───────────────────────────────────────────────────────────
export default function CampaignCard({ campaign, categories, products, onEdit, onToggle, onDelete }) {
  const typeCfg  = CAMPAIGN_TYPES.find((t) => t.value === campaign.type)
  const catNames = (campaign.categoryIds || []).map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean)
  const active   = isCampaignActive(campaign)

  return (
    <div className={`bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${active ? 'border-green-200 dark:border-green-900' : 'border-gray-200 dark:border-slate-700'}`}>

      {/* Header con gradiente por tipo */}
      <div className={`bg-gradient-to-r ${TYPE_GRADIENTS[campaign.type] || 'from-gray-500 to-gray-600'} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{campaign.icon || typeCfg?.icon}</span>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">{campaign.name}</div>
            <div className="text-white/60 text-xs">{typeCfg?.label}</div>
          </div>
        </div>
        <StatusBadge campaign={campaign}/>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">

        {/* Resumen visual del descuento */}
        <div className="text-center py-2">
          {campaign.type === 'promotion' ? (
            <span className="text-3xl font-black text-purple-600">{campaign.buyQty}×{campaign.payQty}</span>
          ) : campaign.type === 'volume' ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-3xl font-black text-teal-600">{campaign.discountPct}%</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">descuento</span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1 font-medium">
                ≥ <span className="font-bold">{formatCurrency(campaign.minAmount)}</span> en subtotal
              </div>
            </div>
          ) : campaign.type === 'line' ? (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <div className="text-center">
                  <span className="text-2xl font-black text-orange-500">{campaign.minQty}</span>
                  <p className="text-[10px] text-gray-400 leading-tight">compras</p>
                </div>
                <span className="text-gray-300 text-xl font-light">→</span>
                <div className="text-center">
                  <span className="text-2xl font-black text-orange-600">{campaign.discountPct}%</span>
                  <p className="text-[10px] text-gray-400 leading-tight">el {campaign.discountOnNth}°</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-[11px] text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 font-medium">
                🔂 1 vez por compra
              </div>
            </div>
          ) : (
            <span className="text-3xl font-black text-blue-600">{campaign.discountPct}%</span>
          )}
          {campaign.type !== 'volume' && campaign.type !== 'line' && (
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">de descuento</div>
          )}
        </div>

        {/* Detalles */}
        <div className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300">
          <div className="flex justify-between">
            <span className="text-gray-400 dark:text-slate-500">Vigencia</span>
            <span>{formatDate(campaign.dateFrom)} — {formatDate(campaign.dateTo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 dark:text-slate-500">Aplica a</span>
            <span className="text-right max-w-[60%] truncate">
              {campaign.type === 'promotion'
                ? `${campaign.productIds?.length || 0} producto(s)`
                : campaign.scope === 'all'        ? 'Todos los productos'
                : campaign.scope === 'categories' ? catNames.join(', ') || 'Categorías sel.'
                : campaign.scope === 'brand'      ? campaign.brands?.join(', ') || 'Marcas sel.'
                : `${campaign.productIds?.length || 0} producto(s)`}
            </span>
          </div>

          {campaign.type === 'volume' && (
            <div className="text-[11px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-lg px-2 py-1.5 leading-relaxed">
              {campaign.scope === 'all'
                ? `Por compras ≥ ${formatCurrency(campaign.minAmount)} → ${campaign.discountPct}% de descuento`
                : campaign.scope === 'categories'
                  ? `Por compras ≥ ${formatCurrency(campaign.minAmount)} en ${catNames.join(', ') || 'categorías sel.'} → ${campaign.discountPct}%`
                  : `Por compras ≥ ${formatCurrency(campaign.minAmount)} en ${campaign.brands?.join(', ') || 'marcas sel.'} → ${campaign.discountPct}%`}
            </div>
          )}

          {campaign.type === 'line' && (
            <div className="text-[11px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-2 py-1.5 leading-relaxed">
              {campaign.scope === 'all'
                ? `Por la compra de ${campaign.minQty} uds., el ${campaign.discountOnNth}° tiene ${campaign.discountPct}% desc.`
                : campaign.scope === 'categories'
                  ? `Por ${campaign.minQty} uds. en ${catNames.join(', ') || 'categorías sel.'}, el ${campaign.discountOnNth}° tiene ${campaign.discountPct}% desc.`
                  : `Por ${campaign.minQty} uds. en ${campaign.brands?.join(', ') || 'marcas sel.'}, el ${campaign.discountOnNth}° tiene ${campaign.discountPct}% desc.`}
            </div>
          )}

          {campaign.type === 'promotion' && parseInt(campaign.maxPerPurchase) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500">Límite por compra</span>
              <span className="text-purple-600 font-medium">{campaign.maxPerPurchase}× máx.</span>
            </div>
          )}

          {campaign.type === 'promotion' && (campaign.productIds?.length || 0) > 0 && (
            <div className="pt-0.5">
              <p className="text-gray-400 dark:text-slate-500 mb-1">Productos:</p>
              <div className="flex flex-wrap gap-1">
                {(campaign.productIds || []).slice(0, 3).map((id) => {
                  const prod = products?.find((p) => p.id === id)
                  return prod ? (
                    <span key={id} className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">{prod.name}</span>
                  ) : null
                })}
                {(campaign.productIds?.length || 0) > 3 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-full">+{campaign.productIds.length - 3} más</span>
                )}
              </div>
            </div>
          )}

          {campaign.daysOfWeek?.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500">Días</span>
              <span>{campaign.daysOfWeek.map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label).join(', ')}</span>
            </div>
          )}

          {campaign.description && (
            <p className="text-gray-400 dark:text-slate-500 italic">{campaign.description}</p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
          <button onClick={() => onToggle(campaign)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              campaign.isActive
                ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600'
                : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100'
            }`}>
            {campaign.isActive ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={() => onEdit(campaign)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100">
            Editar
          </button>
          <button onClick={() => onDelete(campaign)}
            className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
