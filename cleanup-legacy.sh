#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  cleanup-legacy.sh — Elimina archivos legacy del proyecto Minimarket POS   ║
# ║                                                                              ║
# ║  Uso:                                                                        ║
# ║    chmod +x cleanup-legacy.sh                                                ║
# ║    ./cleanup-legacy.sh              # Modo preview (no elimina nada)         ║
# ║    ./cleanup-legacy.sh --confirm    # Elimina definitivamente                ║
# ║    ./cleanup-legacy.sh --backup     # Crea backup .zip antes de eliminar     ║
# ║                                                                              ║
# ║  Seguridad:                                                                  ║
# ║    - Sin --confirm solo muestra qué se eliminaría (dry-run)                  ║
# ║    - Verifica que ningún archivo esté importado antes de eliminar            ║
# ║    - Opción --backup crea un .zip de respaldo con timestamp                  ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ─── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Argumentos ───────────────────────────────────────────────────────────────
CONFIRM=false
BACKUP=false

for arg in "$@"; do
  case $arg in
    --confirm) CONFIRM=true ;;
    --backup)  BACKUP=true  ;;
    --help|-h)
      echo "Uso: $0 [--confirm] [--backup]"
      echo "  Sin flags    → solo muestra qué se eliminaría (dry-run)"
      echo "  --confirm    → elimina los archivos definitivamente"
      echo "  --backup     → crea backup .zip antes de eliminar"
      exit 0
      ;;
    *)
      echo -e "${RED}Argumento desconocido: $arg${RESET}"
      echo "Usa --help para ver las opciones."
      exit 1
      ;;
  esac
done

# ─── Detectar raíz del proyecto ───────────────────────────────────────────────
# Busca package.json subiendo desde el directorio actual
PROJECT_ROOT=""
DIR="$(pwd)"
for _ in {1..5}; do
  if [[ -f "$DIR/package.json" ]] && grep -q '"name"' "$DIR/package.json" 2>/dev/null; then
    PROJECT_ROOT="$DIR"
    break
  fi
  DIR="$(dirname "$DIR")"
done

if [[ -z "$PROJECT_ROOT" ]]; then
  echo -e "${RED}Error: no se encontró package.json en este directorio ni en sus padres.${RESET}"
  echo "Ejecuta el script desde la raíz del proyecto."
  exit 1
fi

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   Minimarket POS — Limpieza de archivos legacy   ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "${GRAY}Raíz del proyecto: ${PROJECT_ROOT}${RESET}"
echo ""

# ─── Lista de archivos legacy a eliminar ──────────────────────────────────────
# Rutas relativas a la raíz del proyecto.
# Para agregar más, añade una línea con la ruta relativa.
LEGACY_FILES=(
  "src/config/old_app.js"
  "src/features/discounts/old_Discounts.jsx"
  "src/features/discounts/oldx_Discounts.jsx"
  "src/features/discounts/oldy_Discounts.jsx"
  "src/features/pos/old_POS.jsx"
  "src/old_App.jsx"
  "src/old_index.css"
  "src/shared/components/ui/old_Sidebar.jsx"
  "src/shared/utils/old_discountEngine.js"
  "src/shared/utils/oldx_discountEngine.js"
)

# ─── FASE 1: Verificar qué archivos existen ───────────────────────────────────
echo -e "${BOLD}[1/4] Verificando archivos legacy...${RESET}"
echo ""

FOUND=()
MISSING=()
TOTAL_SIZE=0

for rel_path in "${LEGACY_FILES[@]}"; do
  abs_path="${PROJECT_ROOT}/${rel_path}"
  if [[ -f "$abs_path" ]]; then
    size=$(wc -c < "$abs_path")
    size_kb=$(echo "scale=1; $size / 1024" | bc)
    FOUND+=("$rel_path")
    TOTAL_SIZE=$((TOTAL_SIZE + size))
    echo -e "  ${GREEN}✓${RESET} ${rel_path} ${GRAY}(${size_kb} KB)${RESET}"
  else
    MISSING+=("$rel_path")
    echo -e "  ${GRAY}–${RESET} ${rel_path} ${GRAY}(no encontrado — ya fue eliminado)${RESET}"
  fi
done

echo ""
TOTAL_KB=$(echo "scale=1; $TOTAL_SIZE / 1024" | bc)
echo -e "  ${BOLD}Encontrados: ${#FOUND[@]} archivos (${TOTAL_KB} KB)${RESET}"
echo -e "  ${GRAY}Ya eliminados: ${#MISSING[@]} archivos${RESET}"

if [[ ${#FOUND[@]} -eq 0 ]]; then
  echo ""
  echo -e "${GREEN}✅ No hay archivos legacy. El proyecto ya está limpio.${RESET}"
  exit 0
fi

# ─── FASE 2: Verificar que ningún archivo esté importado ─────────────────────
echo ""
echo -e "${BOLD}[2/4] Verificando que ningún archivo esté importado...${RESET}"
echo ""

SAFE_TO_DELETE=()
HAS_IMPORTS=false

for rel_path in "${FOUND[@]}"; do
  # Extraer solo el nombre del archivo sin extensión para buscar imports
  filename=$(basename "$rel_path")
  filename_noext="${filename%.*}"

  # Buscar en todos los .js/.jsx/.ts/.tsx si alguien importa este archivo
  # grep -r busca en el proyecto, excluyendo node_modules y el propio archivo
  import_count=$(grep -r \
    --include="*.js" \
    --include="*.jsx" \
    --include="*.ts" \
    --include="*.tsx" \
    --exclude-dir="node_modules" \
    --exclude-dir=".git" \
    -l "${filename_noext}" \
    "$PROJECT_ROOT/src" 2>/dev/null | \
    grep -v "${rel_path}" | \
    wc -l || true)

  if [[ "$import_count" -gt 0 ]]; then
    importers=$(grep -r \
      --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" \
      --exclude-dir="node_modules" --exclude-dir=".git" \
      -l "${filename_noext}" \
      "$PROJECT_ROOT/src" 2>/dev/null | \
      grep -v "${rel_path}" | \
      sed "s|${PROJECT_ROOT}/||" || true)

    echo -e "  ${RED}⚠ BLOQUEADO${RESET} ${rel_path}"
    echo -e "    ${YELLOW}Importado en:${RESET}"
    while IFS= read -r importer; do
      echo -e "    ${GRAY}  → ${importer}${RESET}"
    done <<< "$importers"
    HAS_IMPORTS=true
  else
    SAFE_TO_DELETE+=("$rel_path")
    echo -e "  ${GREEN}✓ Seguro${RESET}   ${rel_path}"
  fi
done

if [[ "$HAS_IMPORTS" == true ]]; then
  echo ""
  echo -e "${YELLOW}⚠️  Algunos archivos tienen imports activos y NO serán eliminados.${RESET}"
  echo -e "${GRAY}   Revisa los importers indicados antes de continuar.${RESET}"
fi

if [[ ${#SAFE_TO_DELETE[@]} -eq 0 ]]; then
  echo ""
  echo -e "${RED}Ningún archivo es seguro de eliminar. Revisa los imports activos.${RESET}"
  exit 1
fi

# ─── FASE 3: Backup opcional ──────────────────────────────────────────────────
if [[ "$BACKUP" == true && "$CONFIRM" == true ]]; then
  echo ""
  echo -e "${BOLD}[3/4] Creando backup...${RESET}"
  echo ""

  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  BACKUP_FILE="${PROJECT_ROOT}/legacy_backup_${TIMESTAMP}.zip"

  cd "$PROJECT_ROOT"
  zip -q "$BACKUP_FILE" "${SAFE_TO_DELETE[@]}"
  BACKUP_SIZE=$(wc -c < "$BACKUP_FILE")
  BACKUP_KB=$(echo "scale=1; $BACKUP_SIZE / 1024" | bc)

  echo -e "  ${GREEN}✓${RESET} Backup creado: ${GRAY}legacy_backup_${TIMESTAMP}.zip${RESET} ${GRAY}(${BACKUP_KB} KB)${RESET}"
else
  echo ""
  echo -e "${BOLD}[3/4] Backup${RESET} ${GRAY}(omitido — usa --backup para activar)${RESET}"
fi

# ─── FASE 4: Eliminar ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[4/4] Eliminación de archivos${RESET}"
echo ""

if [[ "$CONFIRM" == false ]]; then
  echo -e "${YELLOW}  ── MODO DRY-RUN (solo vista previa) ──${RESET}"
  echo -e "${GRAY}  Los siguientes archivos SERÍAN eliminados:${RESET}"
  echo ""
  for rel_path in "${SAFE_TO_DELETE[@]}"; do
    echo -e "  ${RED}✕${RESET} ${rel_path}"
  done
  echo ""
  SAFE_KB=$(echo "scale=1; $(for f in "${SAFE_TO_DELETE[@]}"; do wc -c < "${PROJECT_ROOT}/${f}"; done | awk '{sum+=$1} END {print sum}') / 1024" | bc)
  echo -e "  ${BOLD}Total a liberar: ${SAFE_KB} KB · ${#SAFE_TO_DELETE[@]} archivos${RESET}"
  echo ""
  echo -e "${CYAN}  Para eliminar definitivamente, ejecuta:${RESET}"
  echo -e "  ${BOLD}./cleanup-legacy.sh --confirm${RESET}"
  echo -e "  ${BOLD}./cleanup-legacy.sh --confirm --backup${RESET}  ${GRAY}(con respaldo previo)${RESET}"
  echo ""
  exit 0
fi

# Eliminación real
DELETED=()
FAILED=()

for rel_path in "${SAFE_TO_DELETE[@]}"; do
  abs_path="${PROJECT_ROOT}/${rel_path}"
  if rm "$abs_path" 2>/dev/null; then
    DELETED+=("$rel_path")
    echo -e "  ${RED}✕${RESET} Eliminado: ${rel_path}"
  else
    FAILED+=("$rel_path")
    echo -e "  ${YELLOW}⚠${RESET} No se pudo eliminar: ${rel_path}"
  fi
done

# ─── Resumen final ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Resumen de limpieza${RESET}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${GREEN}✓ Eliminados:${RESET}     ${#DELETED[@]} archivos"
[[ ${#FAILED[@]}  -gt 0 ]] && echo -e "  ${RED}✕ Con error:${RESET}      ${#FAILED[@]} archivos"
[[ ${#MISSING[@]} -gt 0 ]] && echo -e "  ${GRAY}– Ya limpios:${RESET}     ${#MISSING[@]} archivos"
echo -e "  ${GREEN}✓ Espacio liberado:${RESET} ≈${TOTAL_KB} KB"
echo ""

if [[ ${#DELETED[@]} -gt 0 ]]; then
  echo -e "${GREEN}✅ Limpieza completada exitosamente.${RESET}"
  echo ""
  echo -e "${GRAY}Próximos pasos sugeridos:${RESET}"
  echo -e "  ${GRAY}1. Ejecutar: ${RESET}npm run build${GRAY} — verificar que el build sigue funcionando${RESET}"
  echo -e "  ${GRAY}2. Ejecutar: ${RESET}npm run dev${GRAY}   — verificar que el dev server arranca${RESET}"
  echo -e "  ${GRAY}3. Commit:   ${RESET}git add -A && git commit -m 'chore: remove legacy old_ files'"
fi

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo ""
  echo -e "${YELLOW}⚠️  Algunos archivos no pudieron eliminarse (puede ser un problema de permisos).${RESET}"
  echo -e "${GRAY}   Inténtalo con: sudo ./cleanup-legacy.sh --confirm${RESET}"
  exit 1
fi

exit 0
