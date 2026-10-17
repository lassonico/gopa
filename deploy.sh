#!/usr/bin/env bash
#
# Deploy seguro para GoPalermo (producción).
#
# SIEMPRE usa docker-compose.prod.yml. Esto evita el accidente de recrear el
# backend con la config de desarrollo (docker-compose.yml + override), que
# apunta a la BD local (host.docker.internal) y hace "desaparecer" comercios.
#
# Uso:
#   ./deploy.sh                  # despliega todo el stack
#   ./deploy.sh frontend         # despliega solo servicios puntuales
#   ./deploy.sh frontend admin   # varios servicios
#   ./deploy.sh --no-build       # solo up (sin reconstruir imágenes)
#
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
SERVICES_TODOS=(backend frontend comercio admin domiciliario nginx)
BUILD=1
SERVICES=()

for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | tail -n +2
      exit 0
      ;;
    -*) echo "Opción desconocida: $arg" >&2; exit 2 ;;
    *) SERVICES+=("$arg") ;;
  esac
done

[ ${#SERVICES[@]} -eq 0 ] && SERVICES=("${SERVICES_TODOS[@]}")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: no existe $COMPOSE_FILE en $SCRIPT_DIR" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1 && ! docker-compose --version >/dev/null 2>&1; then
  echo "ERROR: no hay docker compose disponible." >&2
  exit 1
fi

# Prefijo fijo: siempre el compose de producción, nunca el de desarrollo.
DC=(docker compose -f "$COMPOSE_FILE")

echo "==> Desplegando con $COMPOSE_FILE: ${SERVICES[*]}"

if [ "$BUILD" -eq 1 ]; then
  echo "==> Build de imágenes"
  "${DC[@]}" build "${SERVICES[@]}"
fi

echo "==> Levantando servicios"
"${DC[@]}" up -d "${SERVICES[@]}"

# --- Verificaciones post-deploy -------------------------------------------

echo "==> Esperando a que el backend responda"
backend_ok=0
for _ in $(seq 1 30); do
  if docker exec app-backend-1 wget -qO- http://localhost:3001/api/health 2>/dev/null | grep -q '"status":"ok"'; then
    backend_ok=1
    break
  fi
  sleep 2
done

if [ "$backend_ok" -ne 1 ]; then
  echo "ERROR: el backend no respondió /api/health. Revisa: docker logs app-backend-1" >&2
  exit 1
fi
echo "    backend OK"

# Salvaguarda: el backend debe apuntar a la BD de producción (mysql), no a la local.
db_host=$(docker inspect app-backend-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^DB_HOST=' | cut -d= -f2 || true)
if [ "$db_host" != "mysql" ]; then
  echo "ERROR: el backend está usando DB_HOST='$db_host' (se esperaba 'mysql')." >&2
  echo "       Alguien lo levantó con el compose de desarrollo. Corrige con:" >&2
  echo "       docker compose -f $COMPOSE_FILE up -d backend" >&2
  exit 1
fi
echo "    DB_HOST=mysql OK"

echo "==> Despliegue completado"
docker ps --filter "name=app-" --format "    {{.Names}}\t{{.Status}}"
