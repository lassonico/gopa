# GoPalermo 🛵

Plataforma de domicilios para **Palermo (Neiva, Colombia)**: clientes piden a
comercios locales, los comercios gestionan su catálogo y pedidos, y los
domiciliarios entregan. Incluye pagos en línea (Wompi), notificaciones push
(Firebase), verificación por SMS, mapas y asistencia de IA para cargar menús.

[![CI](https://github.com/lassonico/gopa/actions/workflows/ci.yml/badge.svg)](https://github.com/lassonico/gopa/actions/workflows/ci.yml)

---

## Tabla de contenido

- [Aplicaciones](#aplicaciones)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos](#requisitos)
- [Variables de entorno](#variables-de-entorno)
- [Desarrollo local](#desarrollo-local)
- [Producción](#producción-pc--túnel-cloudflare)
- [Comandos útiles](#comandos-útiles)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Despliegue y rollback](#despliegue-y-rollback)
- [Seguridad](#seguridad)
- [Pendientes](#pendientes)
- [Licencia](#licencia)

---

## Aplicaciones

Es un **monorepo**: un único backend sirve a cuatro frontends independientes
(SPA + PWA), cada uno publicado en su propio subdominio.

| Aplicación    | Rol                          | Dominio                          | Comando dev |
| ------------- | ---------------------------- | -------------------------------- | ----------- |
| `backend`     | API REST + lógica de negocio | `https://app.domipalermo.com/api`| `npm run dev` |
| `frontend`    | Cliente (quien pide)         | `https://app.domipalermo.com`    | `npm run dev` |
| `comercio`    | Panel de comercios           | `https://comercio.domipalermo.com` | `npm run dev` |
| `domiciliario`| App de repartidores          | `https://domiciliario.domipalermo.com` | `npm run dev` |
| `admin`       | Panel de administración      | `https://admin.domipalermo.com`  | `npm run dev` |

---

## Arquitectura

Un PC (o VPS) corre todo con **Docker Compose** y se expone a internet mediante
**túneles de Cloudflare** (`cloudflared`), que terminan el TLS. El navegador
habla HTTPS con Cloudflare; el túnel habla HTTP con nginx.

```
                        Internet (HTTPS)
                              │
                    ┌─────────▼──────────┐
                    │  Cloudflare (TLS)  │
                    └─────────┬──────────┘
                              │  túnel cloudflared (HTTP)
                    ┌─────────▼──────────┐
                    │   nginx (reverse   │  nginx.prod.conf
                    │   proxy por Host)  │  :80
                    └───┬────┬────┬───┬──┘
          ┌─────────────┘    │    │   └─────────────┐
          ▼                  ▼    ▼                 ▼
   ┌────────────┐   ┌──────────┐ ┌──────────┐ ┌─────────────┐
   │ frontend   │   │ comercio │ │  admin   │ │ domiciliario│  (nginx + SPA)
   └─────┬──────┘   └────┬─────┘ └────┬─────┘ └──────┬──────┘
         └───────────────┴────────────┴──────────────┘
                              │  /api/  y  /uploads/
                    ┌─────────▼──────────┐
                    │  backend (Express) │  :3001
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   MySQL 8          │  :3306
                    └────────────────────┘
```

- **Enrutado**: `nginx.prod.conf` reparte por subdominio (`server_name`) hacia
  el contenedor de cada frontend. Cada frontend ya sirve su SPA y hace proxy de
  `/api` y `/uploads` hacia `backend:3001`, aplicando su propia CSP y headers de
  seguridad en su `nginx.conf`.
- **Persistencia**: el backend usa un patrón **Repository** (`backend/src/repositories`)
  con dos motores intercambiables vía `DB_ENGINE`: `mysql` (producción) o
  `json` (desarrollo/pruebas, archivos en `backend/data/`).
- **Backend en capas**: `routes → controller → service → repository`.

---

## Stack tecnológico

| Capa            | Tecnología |
| --------------- | ---------- |
| Backend         | Node.js 22, Express 4 (CommonJS), JWT, bcrypt, Zod, Helmet, express-rate-limit |
| Base de datos   | MySQL 8 (`mysql2`) o JSON local |
| Frontends       | React 18, Vite 5, React Router 6, Axios, PWA (`vite-plugin-pwa`) |
| Mapas           | Leaflet / React-Leaflet + OpenStreetMap |
| Push / Auth     | Firebase (FCM + Phone/Google Auth), Google OAuth, Turnstile |
| Pagos           | Wompi |
| Media           | Cloudinary |
| IA              | OpenAI (principal), Gemini y DeepSeek (fallback) |
| Infra           | Docker Compose + Cloudflare Tunnel, nginx |
| Calidad         | Vitest (backend y frontends), GitHub Actions |

---

## Estructura del repositorio

```
app/
├── backend/                 # API REST (Express)
│   ├── src/
│   │   ├── config/          # Lectura y validación de variables de entorno
│   │   ├── middleware/      # Auth, CORS, CSRF, rate-limit, uploads...
│   │   ├── modules/         # Un módulo por dominio (auth, pedidos, pagos...)
│   │   ├── repositories/    # MySQLRepository | JsonFileRepository
│   │   ├── services/        # Integraciones (Firebase, Cloudinary, IA, pagos)
│   │   ├── test/            # Pruebas Vitest + supertest
│   │   └── index.js         # Arranque de Express
│   └── .env.example
├── frontend/                # Cliente (app.domipalermo.com)
├── comercio/                # Panel de comercios (comercio.domipalermo.com)
├── domiciliario/            # App repartidores (domiciliario.domipalermo.com)
├── admin/                   # Panel admin (admin.domipalermo.com)
│   └── (cada app: src/, Dockerfile, nginx.conf, vite.config.js)
├── docs/
│   └── DESPLIEGUE.md        # Canary + rollback
├── scripts/                 # Generación de íconos y sonidos
├── docker-compose.yml       # Desarrollo (publica 5173-5176, backend 3001)
├── docker-compose.override.yml  # Local (BD MySQL en el host) — gitignored
├── docker-compose.prod.yml  # Producción (MySQL en contenedor + nginx)
├── nginx.prod.conf          # Reverse proxy de producción
├── .github/workflows/ci.yml # CI
└── PENDIENTES_SEGURIDAD.md, PENDIENTES_LEGAL.md
```

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (con Compose v2)
- Node.js **22** y npm (para desarrollo sin Docker)
- [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
  configurado con el túnel del dominio (solo producción)
- Opcional: MySQL 8 local (si desarrollas con `DB_ENGINE=mysql` en el host)

---

## Variables de entorno

Los secretos **nunca** se versionan (`.env` está en `.gitignore`). Usa las
plantillas como base:

```bash
cp backend/.env.example backend/.env   # si corres el backend sin Docker
cp .env.example .env                   # compose (raíz) — si existe en tu entorno
```

Para Docker Compose, el archivo de la **raíz** `.env` alimenta las variables
`${...}` de los compose. Variables principales:

| Variable | Descripción | Ejemplo |
| -------- | ----------- | ------- |
| `PORT` | Puerto del backend | `3001` |
| `NODE_ENV` | Entorno (`production` activa cookies Secure, HSTS y CSP estricto) | `production` |
| `DB_ENGINE` | Motor de datos | `mysql` \| `json` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Conexión MySQL | `mysql` / `3306` / `domicilios_palermo` / ... |
| `DB_ROOT_PASSWORD` | Password root del MySQL en contenedor | *(secreto)* |
| `JWT_SECRET` / `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Tokens | *(secreto)* / `15m` / `7d` |
| `CORS_ORIGIN` | Orígenes permitidos (lista separada por comas) | `https://app.domipalermo.com,...` |
| `CLIENT_URL` / `COMERCIO_URL` / `DOMICILIARIO_URL` | URLs públicas por app | `https://...` |
| `TURNSTILE_*` | Cloudflare Turnstile (anti-bot) | ... |
| `GOOGLE_CLIENT_ID` | OAuth de Google | ... |
| `FIREBASE_*` | Firebase Admin (push / phone auth) | ... |
| `SMTP_*`, `ADMIN_EMAIL` | Correo saliente | ... |
| `CLOUDINARY_*` | Almacenamiento de imágenes | ... |
| `WOMPI_*` | Pasarela de pagos | ... |
| `AI_PRIMARY_PROVIDER`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` | IA para menús | `openai` |
| `IVA_RATE`, `COMISION_DEFAULT` | Reportes contables | `0.19`, `10` |

> En **producción** el backend valida al arranque que existan `JWT_SECRET`,
> `DB_PASSWORD` y `CORS_ORIGIN`; si faltan, no inicia (ver `backend/src/config/index.js`).

---

## Desarrollo local

### Opción A — Todo con Docker

```bash
# Levanta los 4 frontends (5173-5176), backend (3001) y usa el MySQL del host
docker compose up -d --build

# Ver logs
docker compose logs -f backend
```

| Servicio      | URL                     |
| ------------- | ----------------------- |
| Cliente       | http://localhost:5173   |
| Comercio      | http://localhost:5174   |
| Admin         | http://localhost:5175   |
| Domiciliario  | http://localhost:5176   |
| API           | http://localhost:3001/api/health |

### Opción B — Nativo (sin Docker)

```bash
# Backend (DB_ENGINE=json no requiere base de datos)
cd backend && npm install && npm run dev

# En otra terminal, cada frontend
cd frontend && npm install && npm run dev
```

Para usar MySQL local en el backend, copia `backend/.env.example`, pon
`DB_ENGINE=mysql` y completa `DB_*`.

---

## Producción (PC + túnel Cloudflare)

Se sirve desde este equipo con `docker-compose.prod.yml` (MySQL **en contenedor**
+ `nginx` como reverse proxy). Cloudflare termina el TLS, por lo que nginx
escucha en HTTP (`:80`) y no se usan certificados locales ni certbot.

```bash
# 1. Asegura el .env de la raíz con los secretos (DB_*, JWT_SECRET, WOMPI_*, ...)

# 2. Construye y levanta todo
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# 3. Verifica
curl http://localhost/api/health
docker compose -f docker-compose.prod.yml ps
```

**Túnel Cloudflare** (`C:\Users\Usuario\.cloudflared\config.yml`) apunta los
cuatro hostnames a `http://localhost:80`; nginx enruta por `Host`/`server_name`.
Si el servicio `cloudflared` no recarga el archivo solo, reinícialo como
administrador:

```powershell
sc stop cloudflared
sc start cloudflared
```

> El `nginx` de producción también publica los puertos `5173-5176` para seguir
> funcionando mientras el túnel se reapunta a `:80`.

**MySQL:** usa `--lower-case-table-names=1` para replicar el comportamiento de
MySQL en Windows, ya que el backend usa nombres de tabla en PascalCase
(`Usuarios`, `Comercios`, ...).

---

## Comandos útiles

```bash
# --- Backend ---
npm run dev        # nodemon
npm start          # producción
npm test           # vitest
npm run audit      # npm audit

# --- Frontends (cada app) ---
npm run dev        # vite dev
npm run build      # build de producción
npm run preview    # sirve el build
npm run test:run   # vitest (frontend)

# --- Docker ---
docker compose up -d --build
docker compose logs -f <servicio>
docker compose -f docker-compose.prod.yml ps
docker image prune                  # limpiar imágenes viejas (conservar las 2 últimas)
```

---

## Testing

El backend incluye pruebas por dominio (auth, pedidos, pagos, seguridad, etc.)
con **Vitest** + **supertest** en `backend/src/test/`. Los frontends usan Vitest
+ Testing Library.

```bash
cd backend && npm test
cd frontend && npm run test:run
```

---

## CI/CD

`.github/workflows/ci.yml` se ejecuta en push a `main`/`master` y en PRs:

1. **backend** → `npm ci` + `vitest run`
2. **frontends** (matriz: frontend, comercio, domiciliario, admin) → `npm ci` + `npm run build`
3. **docker** → `docker compose build` (solo en `main`/`master`)

> El CI **no despliega**: el despliegue es manual en el equipo (ver abajo).

---

## Despliegue y rollback

Procedimiento canary (por audiencia) y rollback rápido en
[`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

```bash
# Release: commit + tag antes de desplegar
git tag v1.0.1
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

---

## Seguridad

- `.env`, certificados, `firebase-service-account.json`, `certbot/` y datos de
  BD están **gitignored**. Nunca los commitees.
- Con `NODE_ENV=production` se activan cookies `Secure`, HSTS y CSP estricto.
- Headers de seguridad (CSP, HSTS, X-Frame-Options, etc.) en cada `nginx.conf`
  y en el backend vía Helmet.
- Rate-limiting en endpoints de API y auth; Turnstile para formularios públicos;
  CSRF con double-submit cookie.
- Pendientes al pasar a VPS con dominio directo: [`PENDIENTES_SEGURIDAD.md`](PENDIENTES_SEGURIDAD.md).

---

## Pendientes

- **Legales**: verificación de edad 18+, claridad de IVA en precios, registro
  RNBD ante la SIC. Detalle en [`PENDIENTES_LEGAL.md`](PENDIENTES_LEGAL.md).

---

## Licencia

Privado. © GoPalermo. Todos los derechos reservados.
