# TODO - Corrección Catálogo (modales de creación rápida)

- [x] Revisar y actualizar `src/features/catalog/Catalog.jsx`:
  - [x] Agregar helper de ID seguro con fallback (sin depender solo de `crypto.randomUUID`).
  - [x] Reemplazar usos directos de `crypto.randomUUID()` por helper.
  - [x] Corregir referencia inválida a `setModal` en integración con `BatchesView`.
- [ ] Ajustar lint en `Catalog.jsx` (exports/props/variables no usadas y key duplicada).
- [ ] Verificar que no queden usos inseguros de `randomUUID` en `Catalog.jsx`.
- [ ] Entregar resumen de cambios aplicados.
