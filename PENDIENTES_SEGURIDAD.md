# Pendientes de seguridad — aplicar al migrar a VPS con dominio directo

Fecha: 2026-09-28
Contexto: hoy se sirve por túneles Cloudflare desde PC local (compose desarrollo).
Al migrar a VPS, aplicar estos dos puntos:

## 1. `NODE_ENV=production` (compose prod)
- Activa cookies `Secure`, HSTS y CSP estricto.
- Usar `docker-compose.prod.yml` (ya trae `NODE_ENV=production`).
- Ojo: con `Secure`, las pruebas en `http://localhost` dejan de guardar sesión.

## 2. Cloudflare SSL Full (Strict) + HSTS
- En el dashboard de Cloudflare del dominio: SSL/TLS → Full (Strict).
- Activar HSTS.
- Con túneles ya hay cifrado de facto; esto lo blinda ante futuras malas configuraciones.
