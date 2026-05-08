#!/bin/bash
# cleanup-legacy.sh — Elimina archivos huérfanos del proyecto POS Minimarket
# Ejecutar desde la raíz del proyecto: bash cleanup-legacy.sh
#
# ARCHIVOS A ELIMINAR:
#   src/features/pos/old_POS.jsx          → versión anterior del POS (839 líneas)
#   src/features/pos/xxx_POS.jsx          → versión intermedia del POS (828 líneas)
#   src/features/inventory/old_Stocktaking.jsx → versión anterior (473 líneas)
#   src/store/xxxindex.js                 → versión experimental del store
#   src/store/index - copia.js            → copia de seguridad manual del store
#   src/services/services_index.js        → duplicado de services/index.js (809 líneas)
#
# TOTAL CÓDIGO MUERTO ELIMINADO: ~3,800 líneas

set -e

FILES=(
  "src/features/pos/old_POS.jsx"
  "src/features/pos/xxx_POS.jsx"
  "src/features/inventory/old_Stocktaking.jsx"
  "src/store/xxxindex.js"
  "src/store/index - copia.js"
  "src/services/services_index.js"
)

echo "🧹 Limpiando archivos legacy del proyecto..."
echo ""

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f")
    rm "$f"
    echo "  ✓ Eliminado: $f  ($lines líneas)"
  else
    echo "  — No existe: $f (ya fue eliminado)"
  fi
done

echo ""
echo "✅ Limpieza completada."
echo "   Recuerda hacer commit: git add -A && git commit -m 'chore: remove legacy/orphan files'"
