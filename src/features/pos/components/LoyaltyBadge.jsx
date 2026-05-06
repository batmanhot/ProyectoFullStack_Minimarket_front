/**
 * LoyaltyBadge.jsx — Badge + panel de puntos en el POS
 * Ruta: src/features/pos/components/LoyaltyBadge.jsx
 *
 * Se muestra en el panel lateral del POS cuando hay un cliente seleccionado.
 * Muestra: nivel, puntos disponibles, puntos que ganará con esta compra,
 * y permite iniciar el canje.
 */

import { useState, useMemo } from 'react'
import { formatCurrency }   from '../../../shared/utils/helpers'
import {
  getClientLevel, getNextLevel, calcPointsEarned, calcRedemptionValue,
  LOYALTY_CONFIG_DEFAULTS,
} from '../../../shared/utils/LoyaltyEngine'

export default function LoyaltyBadge({ client, saleTotal, onRedeem, loyaltyConfig = LOYALTY_CONFIG_DEFAULTS }) {
  const [redeemMode, setRedeemMode] = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState('')

  const accumulated = client?.loyaltyAccumulated || 0
  const available   = client?.loyaltyPoints      || 0
  const level       = getClientLevel(accumulated)
  const nextLevel   = getNextLevel(accumulated)
  const willEarn    = calcPointsEarned(saleTotal, accumulated, loyaltyConfig)

  const maxRedeem      = Math.min(available, Math.floor(saleTotal / loyaltyConfig.pointsValue))
  const redeemPts      = Math.min(parseInt(pointsToRedeem) || 0, maxRedeem)
  const redemption     = calcRedemptionValue(redeemPts, saleTotal, loyaltyConfig)
  const redeemDiscount = redemption?.discount || 0
  const canRedeem      = available >= loyaltyConfig.minRedeemPoints

  const progressPct = useMemo(() => {
    if (!nextLevel) return 100
    const range = nextLevel.level.min - level.min
    const curr  = accumulated - level.min
    return Math.min(100, Math.round((curr / range) * 100))
  }, [accumulated, level, nextLevel])

  if (!client) return null

  return (
    <div className={`rounded-xl border p-3 ${level.bg} dark:bg-opacity-10`}>
      {/* Header: nivel + puntos */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{level.icon}</span>
          <div>
            <p className={`text-xs font-bold ${level.color}`}>{level.name}</p>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">{client.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-gray-800 dark:text-slate-100">{available.toLocaleString()} pts</p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">disponibles</p>
        </div>
      </div>

      {/* Barra de progreso al siguiente nivel */}
      {nextLevel && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-500 mb-0.5">
            <span>{accumulated.toLocaleString()} pts acumulados</span>
            <span>→ {nextLevel.level.name}: {nextLevel.level.min.toLocaleString()} pts</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}/>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
            Faltan {nextLevel.pointsNeeded.toLocaleString()} pts para {nextLevel.level.name}
          </p>
        </div>
      )}

      {/* Puntos que ganará con esta compra */}
      {willEarn > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-2 py-1 mb-2">
          <span>⭐</span>
          <span>Con esta compra ganará <strong>+{willEarn} pts</strong>
            {level.multiplier > 1 && <span className="text-green-500"> (×{level.multiplier} por nivel {level.name})</span>}
          </span>
        </div>
      )}

      {/* Panel de canje */}
      {!redeemMode ? (
        <button
          onClick={() => setRedeemMode(true)}
          disabled={!canRedeem}
          className={`w-full py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            canRedeem
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-400 cursor-not-allowed'
          }`}>
          {canRedeem
            ? `🎁 Canjear puntos (${available.toLocaleString()} disp.)`
            : `Mín. ${loyaltyConfig.minRedeemPoints} pts para canjear`}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number" min={loyaltyConfig.minRedeemPoints} max={maxRedeem} step="10"
              value={pointsToRedeem}
              onChange={(e) => setPointsToRedeem(e.target.value)}
              placeholder={`Min. ${loyaltyConfig.minRedeemPoints}`}
              className="flex-1 px-2 py-1.5 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-amber-400 dark:bg-slate-700 dark:text-slate-100"
            />
            <span className="text-xs text-gray-500 dark:text-slate-400">pts</span>
          </div>
          {redeemPts >= loyaltyConfig.minRedeemPoints && (
            <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1">
              {redeemPts} pts → <strong>-{formatCurrency(redeemDiscount)}</strong> de descuento
              {redeemPts > available && <span className="text-red-500 ml-1"> (excede disponible)</span>}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setRedeemMode(false); setPointsToRedeem('') }}
              className="flex-1 py-1.5 text-xs border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (
                  redeemPts >= loyaltyConfig.minRedeemPoints &&
                  redeemPts <= available &&
                  redemption?.valid &&
                  redeemDiscount > 0
                ) {
                  onRedeem?.(redeemPts, redeemDiscount)
                  setRedeemMode(false)
                  setPointsToRedeem('')
                }
              }}
              disabled={
                redeemPts < loyaltyConfig.minRedeemPoints ||
                redeemPts > available ||
                !redemption?.valid ||
                redeemDiscount <= 0
              }
              className="flex-1 py-1.5 text-xs bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors">
              Aplicar canje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
