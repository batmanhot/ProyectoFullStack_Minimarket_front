# TODO - Corrección Programa de Puntos (POS)

- [x] Actualizar `src/features/pos/components/PaymentPanel.jsx`
  - [x] Mantener canje de puntos en estado local (sin mutar store inmediatamente)
  - [x] Enviar `redeemedPoints` y `loyaltyDiscount` en `onConfirm`

- [ ] Actualizar `src/features/pos/POS.jsx`
  - [ ] Quitar mutación directa de cliente en `onLoyaltyRedeem`
  - [ ] Incluir datos de canje en `salePayload` al confirmar venta

- [ ] Actualizar `src/services/index.js` (`saleService.create`)
  - [ ] Aplicar canje y acumulación en una sola actualización consistente del cliente
  - [ ] Registrar transacciones `redeemed` y `earned`
  - [ ] Persistir con `updateClient(...)` para robustez

- [ ] Validar compilación
  - [ ] Ejecutar build/lint
