# Despliegue gradual (canary) y rollback — GoPalermo

Infra actual: un PC + Docker Compose + túneles Cloudflare (sin orquestador).
El "canary" aquí es **por audiencia** (equipo valida en verde antes de abrir
al público), no por porcentaje: los túneles no reparten % entre versiones.

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
docker compose build
```
2. Levantar stack verde en puertos alternos (canary):
```powershell
docker compose -p gopalermo-green up -d
# (ajustar puertos si colisionan; ver docker-compose.override.yml de ejemplo)
```
3. Humo en verde (directo, sin túnel):
```powershell
curl http://localhost:3001/api/health
curl http://localhost:5173/manifest.webmanifest
# login de prueba + 1 pedido de prueba
```
4. Validación interna (10–30 min): el equipo usa las URLs verdes.
5. Corte: apuntar los túneles al stack verde (o `docker compose up -d`
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
docker compose build backend frontend comercio domiciliario admin
docker compose up -d

# 3. Verificar
curl http://localhost:3001/api/health
```

Si el fallo es solo de frontend, basta `build`+`up -d` de esa app.
Si el fallo es de datos (migración mala), restaurar el dump MySQL
(ver "Respaldo BD" abajo) — único caso que no es instantáneo.

## Respaldo BD (antes de cada release con migración)

```powershell
docker exec <mysql-container> mysqldump -u root -p domicilios_palermo > backup-vX.sql
```
