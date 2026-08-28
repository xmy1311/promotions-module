# Módulo de Gestión de Promociones

Aplicación web para registrar promociones de un punto de venta y controlar su
**estado** y su **vigencia**, evitando descuentos activos fuera de su rango de fechas o porcentajes mal aplicados.

| | |
|---|---|
| **Frontend** | React 18 + Vite 5 + TypeScript + Tailwind CSS |
| **Backend** | Node.js 22 + Express + TypeScript |
| **Base de datos** | SQL Server 2022 (2 tablas) |
| **Infraestructura** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions (`lint` → `test` → `build` → `smoke test`) |

Las decisiones técnicas y las ambigüedades del enunciado están justificadas en
[`DECISIONS.md`](./DECISIONS.md). El análisis previo y el diseño detallado están
en [`docs/`](./docs).

---

## 1. Requisitos previos

- **Docker Desktop** (o Docker Engine + Compose v2) — es lo único necesario para
  levantar el proyecto completo.
- **Node.js 22 LTS** — solo si vas a ejecutar tests, lint o el modo desarrollo
  fuera de Docker. El repositorio incluye `.nvmrc`; con `nvm use` obtienes la
  versión correcta.

## 2. Puesta en marcha

```bash
git clone <url-del-repositorio>
cd promotions-module

# 1. Crear el archivo de configuración local a partir de la plantilla
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env

# 2. Definir la contraseña de SQL Server en .env
#    MSSQL_SA_PASSWORD debe tener al menos 8 caracteres e incluir mayúsculas,
#    minúsculas, números y símbolos, o el contenedor de la base no arrancará.

# 3. Levantar todo
docker compose up --build
```

Cuando los tres contenedores estén sanos:

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:5173 |
| API | http://localhost:3000/api/promotions |
| Health check | http://localhost:3000/health |

> **El primer arranque tarda.** SQL Server necesita entre 30 y 60 segundos para
> aceptar conexiones. No es un cuelgue: `docker compose` espera al *healthcheck*
> de la base antes de arrancar el backend, y al del backend antes del frontend.

El esquema y un catálogo de productos de demostración se crean automáticamente:
el backend ejecuta sus migraciones al iniciar, **antes** de abrir el puerto.

Para detener y borrar los datos:

```bash
docker compose down -v
```

## 3. Modo desarrollo (con recarga en caliente)

Útil mientras se trabaja en el código. Solo la base de datos vive en Docker.

```bash
docker compose up -d db          # únicamente SQL Server

# Terminal 1 — API
cd backend
cp ../.env .env                  # y ajustar dos valores:
                                 #   DB_HOST=localhost
                                 #   DB_PASSWORD=<el mismo de MSSQL_SA_PASSWORD>
npm install
npm run dev                      # http://localhost:3000

# Terminal 2 — SPA
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

El servidor de desarrollo de Vite hace proxy de `/api` y `/health` hacia
`localhost:3000`, replicando lo que Nginx hace en producción. La aplicación
siempre usa rutas relativas y nunca necesita conocer la URL absoluta del backend.

## 4. Pruebas y calidad

```bash
# Backend  — 95 pruebas: reglas de dominio y contrato HTTP
npm --prefix backend test
npm --prefix backend run lint
npm --prefix backend run typecheck

# Frontend — 20 pruebas: tabla, formulario y resumen
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run typecheck
```

El **smoke test** se ejecuta contra la pila levantada y no simula nada:

```bash
docker compose up -d --build
./scripts/wait-for-health.sh http://localhost:3000/health 240
./scripts/smoke-test.sh http://localhost:3000
```

Comprueba `/health`, crea una promoción real, verifica que se persiste, consulta
el resumen, aplica una transición de estado y confirma que eliminar una promoción
activa devuelve `409`.

## 5. Arquitectura

```
frontend (React + Vite)          backend (Express)                 db
   SPA servida por Nginx  ──►  http ──► application ──► domain   SQL Server
   proxy de /api y /health              └──► infrastructure ──────────┘
```

El backend está organizado en capas con dependencias hacia adentro:

| Capa | Responsabilidad |
|---|---|
| `domain/` | Reglas de negocio **puras**: validaciones, máquina de estados, vigencia, resumen. Sin HTTP, sin SQL, sin reloj del sistema |
| `application/` | Orquesta repositorios y dominio; decide qué error de negocio lanzar |
| `infrastructure/` | Único lugar con SQL y con el driver de base de datos |
| `http/` | Express: rutas, validación del mensaje y traducción de errores a códigos HTTP |

El frontend valida para dar retroalimentación inmediata, pero **el backend es la
autoridad final**: sus errores de validación se proyectan sobre el campo
correspondiente del formulario.

## 6. API

| Método | Ruta | Descripción | Respuestas |
|---|---|---|---|
| `GET` | `/health` | Estado de la aplicación y de la base de datos | `200`, `503` |
| `GET` | `/api/products` | Catálogo de productos | `200` |
| `GET` | `/api/categories` | Categorías disponibles | `200` |
| `GET` | `/api/promotions?status=` | Listado, con filtro opcional por estado | `200`, `422` |
| `GET` | `/api/promotions/summary` | Contadores por estado y vigentes hoy | `200` |
| `GET` | `/api/promotions/:id` | Detalle | `200`, `404` |
| `POST` | `/api/promotions` | Crear (nace en `SCHEDULED`) | `201`, `422` |
| `PUT` | `/api/promotions/:id` | Reemplazar | `200`, `404`, `409`, `422` |
| `POST` | `/api/promotions/:id/transitions` | Cambiar de estado — cuerpo `{"to":"ACTIVE"}` | `200`, `404`, `409`, `422` |
| `DELETE` | `/api/promotions/:id` | Eliminar (solo en `SCHEDULED`) | `204`, `404`, `409` |

Todos los errores comparten la misma forma:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud no es válida",
    "details": [{ "field": "endDate", "message": "Debe ser posterior a la fecha de inicio" }]
  }
}
```

### Ciclo de vida

```
            activar                  finalizar
SCHEDULED ───────────► ACTIVE ───────────────► FINISHED  (terminal)
```

- No se puede **activar** una promoción cuya fecha de fin ya pasó.
- Una promoción **`FINISHED` es inmutable**: no se edita, no se elimina, no cambia de estado.
- Solo se puede **eliminar** en `SCHEDULED`.
- Una promoción `ACTIVE` **sí** se puede editar (ver `DECISIONS.md`).

### Fechas

Las fechas viajan y se almacenan como `YYYY-MM-DD` sin hora. La vigencia es un
rango **inclusivo** `[inicio, fin]`, y "hoy" se calcula en la zona horaria de
negocio (`APP_TIMEZONE`, por defecto `America/Bogota`), nunca con el reloj del
contenedor ni del navegador.

## 7. `/health`

Responde `200` solo cuando la aplicación **y** su base de datos están operativas.

```json
{ "status": "ok", "uptimeSeconds": 42,
  "checks": { "database": { "status": "ok", "latencyMs": 7 } } }
```

Con la base caída devuelve **`503`** y `status: "degraded"`. La consulta de
verificación tiene un tiempo máximo (`HEALTH_DB_TIMEOUT_MS`) para que una base
colgada —no caída— también produzca un veredicto. La respuesta nunca incluye el
host, el usuario ni el mensaje del driver: ese detalle va al log.

## 8. Variables de entorno

Todas están documentadas en [`.env.example`](./.env.example). El repositorio
**no contiene ningún valor real**; `.env` está en `.gitignore`.

La configuración se valida al arrancar: si falta o es inválida una variable, el
proceso **no arranca** y el mensaje nombra exactamente qué falta.

| Variable | Uso |
|---|---|
| `MSSQL_SA_PASSWORD` | Único secreto del proyecto. En CI se inyecta desde GitHub Secrets |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` | Conexión a SQL Server |
| `APP_TIMEZONE` | Zona horaria de negocio para el cálculo de "hoy" |
| `CORS_ORIGINS` | Lista blanca de orígenes, separada por comas |
| `HEALTH_DB_TIMEOUT_MS` | Tiempo máximo de la sonda de `/health` |
| `LOG_LEVEL`, `PORT`, `NODE_ENV` | Aplicación |

## 9. CI/CD

El flujo de [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) tiene cuatro
etapas encadenadas con `needs:`:

1. **lint** — ESLint y verificación de tipos en backend y frontend.
2. **test** — pruebas unitarias de ambos proyectos.
3. **build** — construcción de las dos imágenes Docker.
4. **smoke** — verifica las variables requeridas, levanta la pila con
   `docker compose`, espera el `/health`, ejecuta el recorrido de negocio real y
   comprueba que el frontend se sirve. Al fallar vuelca los logs de los
   contenedores; siempre termina con `docker compose down -v`.

### Configurar el secreto (obligatorio)

En **Settings → Secrets and variables → Actions**, crear:

| Secreto | Valor |
|---|---|
| `MSSQL_SA_PASSWORD` | Una contraseña fuerte, distinta de la de tu entorno local |

> Si el secreto no está configurado, **el pipeline falla a propósito** en la etapa
> de verificación de variables, con un mensaje que dice cuál falta. Ese
> comportamiento es el requisito de la prueba funcionando, no un defecto.

## 10. Problemas conocidos

**El contenedor de la base de datos se reinicia o queda `unhealthy`.**
Casi siempre es la contraseña: SQL Server exige al menos 8 caracteres con
mayúsculas, minúsculas, números y símbolos. Revisa `docker compose logs db`.

**Mac con Apple Silicon (M1/M2/M3).**
La imagen oficial de SQL Server no tiene build nativa para ARM64. Alternativa:
sustituir la imagen del servicio `db` por `mcr.microsoft.com/azure-sql-edge:latest`,
que sí corre en ARM y es compatible con lo que usa este proyecto. El pipeline de
CI corre sobre `ubuntu-latest` (amd64), donde la imagen oficial funciona.

**El puerto 1433 o 5173 ya está en uso.**
Cambia `DB_PORT_HOST`, `BACKEND_PORT` o `FRONTEND_PORT` en tu `.env`.
