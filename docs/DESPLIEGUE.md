# Despliegue gradual (canary) y rollback — GoPalermo

Infra actual: un PC + Docker Compose + túneles Cloudflare (sin orquestador).
El "canary" aquí es **por audiencia** (equipo valida en verde antes de abrir
al público), no por porcentaje: los túneles no reparten % entre versiones.

> **ADVERTENCIA (importante):** el stack en vivo corre con
> `docker-compose.prod.yml`. Si ejecutas `docker compose up` **sin** `-f`,
> Docker usa `docker-compose.yml` + `docker-compose.override.yml` (config de
> **desarrollo**) y **recrea el backend** apuntando a la BD local
> (`host.docker.internal`). Los comercios "desaparecen" de la app (no se
> borran: el backend lee otra BD). Para evitarlo, usa siempre el script
> `deploy.sh` o pasa `-f docker-compose.prod.yml` en cada comando.

## Deploy rápido (recomendado)

```bash
./deploy.sh                  # build + up de todo el stack (producción)
./deploy.sh frontend         # solo un servicio puntual
./deploy.sh --no-build       # solo up (sin reconstruir)
```

El script usa siempre `docker-compose.prod.yml`, espera el health del backend
(`/api/health`) y valida que `DB_HOST=mysql` antes de dar por bueno el deploy.

## Requisito previo (una sola vez)

```powershell
git add -A
git commit -m "release: estado estable"
git tag v1.0.0
```

Cada release: commit + tag (`v1.0.1`, ...) antes de desplegar.

## Despliegue canary

1. Construir en verde (no toca lo que está en vivo):
```powershell
docker compose -f docker-compose.prod.yml build
```
2. Levantar stack verde en puertos alternos (canary):
```powershell
docker compose -f docker-compose.prod.yml -p gopalermo-green up -d
# (ajustar puertos si colisionan; ver docker-compose.override.yml de ejemplo)
```
3. Humo en verde (directo, sin túnel):
```powershell
curl http://localhost:3001/api/health
curl http://localhost:5173/manifest.webmanifest
# login de prueba + 1 pedido de prueba
```
4. Validación interna (10–30 min): el equipo usa las URLs verdes.
5. Corte: apuntar los túneles al stack verde (o `./deploy.sh --no-build`
   sobre el proyecto principal) y monitorear `/api/metricas` (errores 5xx,
   p95, cola DLQ).
6. Si todo OK tras 1–2h: `docker image prune` de versiones viejas
   (conservar siempre las **2 últimas**).

## Rollback rápido (< 5 min)

Las migraciones SQL son aditivas (`IF NOT EXISTS`) y las columnas nuevas
son opcionales: el código viejo corre bien sobre BD nueva.

```powershell
# 1. Volver al tag estable anterior
git checkout v1.0.0   # o el tag previo

# 2. Reconstruir y levantar
./deploy.sh
# o, equivalente manual (siempre con -f, nunca sin él):
# docker compose -f docker-compose.prod.yml build backend frontend comercio domiciliario admin
# docker compose -f docker-compose.prod.yml up -d

# 3. Verificar
./deploy.sh --no-build   # valida health + DB_HOST=mysql
```

Si el fallo es solo de frontend, basta `build`+`up -d` de esa app.
Si el fallo es de datos (migración mala), restaurar el dump MySQL
(ver "Respaldo BD" abajo) — único caso que no es instantáneo.

## Respaldo BD (antes de cada release con migración)

```powershell
docker exec <mysql-container> mysqldump -u root -p domicilios_palermo > backup-vX.sql
```
