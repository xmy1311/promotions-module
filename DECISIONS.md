# Decisiones Técnicas: Módulo de Gestión de Promociones

Este documento explica **por qué** la solución se diseñó de esta manera, cómo se
resolvieron las ambigüedades del enunciado y qué se dejó fuera deliberadamente.
El criterio más importante, es el que exige la prueba: **calidad sobre cantidad**.

---

## 1. Stack seleccionado

| Capa | Elección | Motivo principal |
|---|---|---|
| **Frontend** | React 18 + Vite 5 + TS + Tailwind | Obligatorio. TypeScript aporta seguridad de tipos y Tailwind consistencia visual sin arrastrar un sistema de diseño completo. |
| **Backend** | Node.js 22 LTS + Express + TS | Node es obligatorio. Express es minimalista y predecible: se lee `app.ts` y se entiende todo el flujo de una petición. |
| **Base de datos** | SQL Server 2022 | Motor relacional robusto, ideal para expresar invariantes duras a nivel de motor (§3). |
| **Validación** | Zod | Un solo artefacto define el esquema de entrada **y** el tipo TypeScript (`z.infer`): sin DTOs duplicados. |
| **Acceso a datos** | Driver `mssql` nativo | Consultas parametrizadas puras. Sin ORM por diseño (§2). |
| **Estado del servidor (UI)** | TanStack Query | `isLoading` / `isError` sin boilerplate (codigo repetitivo) e invalidación automática de caché tras cada cambio. |
| **Formularios** | React Hook Form + Zod | Errores por campo sin re-render global, y el mismo lenguaje de validación que el backend. |
| **Pruebas** | Vitest (+ Supertest, Testing Library) | Un solo runner para frontend y backend: una sola cultura de testing en todo el proyecto. |

> 💡 **Sobre mi perfil (.NET / C#).** La prueba restringe el backend a Node o Laravel,
> así que Node.js no es una preferencia sino la restricción del enunciado. Lo
> transferible desde entornos empresariales .NET es el criterio de ingeniería, y es
> lo que se ve en el código: separación de capas, dominio puro y testeable, DTOs
> validados en el borde, configuración *fail-fast*, manejo centralizado de errores e
> invariantes replicadas en la base de datos. El mismo diseño que haría con
> ASP.NET Core + Dapper, sin el framework.

---

## 2. Por qué Node.js — y por qué **sin ORM**

Elegí Node.js sobre Laravel por tres razones:

1. **Un solo lenguaje.** Frontend y backend comparten TypeScript, los tipos del
   dominio, el esquema de validación y el runner de pruebas. Menos fricción para
   quien evalúa y para quien mantiene.
2. **Alineación con la vacante.** React, Vite y Node aparecen juntos en la oferta:
   la solución se parece a lo que el equipo mantiene a diario.
3. **Menos magia que justificar.** Laravel traería ORM, migraciones propias,
   contenedor de servicios y convenciones que resuelven problemas que este módulo
   no tiene.

**¿Por qué no un ORM?**
Con dos tablas y unas ocho consultas, Prisma o TypeORM añadirían generación de
código, un segundo sistema de migraciones y una capa de traducción para ahorrar
poco SQL. El driver `mssql` con **parámetros tipados** cierra la inyección SQL
*por construcción* —no por saneado— y deja el SQL visible y revisable en el diff
del pull request.

---

## 3. Por qué SQL Server

**Requisito del dominio.** El modelo es estrictamente relacional y tiene
invariantes duras: una promoción apunta a un producto *o* a una categoría, un
porcentaje vive entre 1 y 100, una fecha de fin es posterior a la de inicio. Un
motor relacional permite expresarlas como restricciones `CHECK`, que se sostienen
aunque alguien escriba por fuera de la API. En MongoDB esas garantías dependerían
del código de la aplicación. (mantener la integridad de los datos)

**Tipos correctos.** `DECIMAL(12,2)` para dinero y porcentajes en lugar de `FLOAT`,
y `DATE` para vigencias que son días civiles, sin hora que arrastre zona horaria.

**Alineación.** Aparece explícitamente en la oferta, junto a PostgreSQL y MongoDB.

> ⚠️ **Costo asumido.** La imagen oficial de SQL Server no corre nativamente en
> Apple Silicon (ARM64). El `README.md` documenta `azure-sql-edge` como
> alternativa local; el CI corre sobre `ubuntu-latest` (amd64), donde la imagen
> oficial funciona.

---

## 4. Por qué TypeScript

- Los estados y los tipos de descuento son **uniones cerradas**: añadir un estado
  y olvidar una rama es un error de compilación, no un bug en producción.
- El contrato de la API se define una vez con Zod y el tipo se **infiere**. No hay
  un DTO escrito a mano que se desincronice de su validación.
- `strict` y `noUncheckedIndexedAccess` obligan a tratar los casos nulos, que es
  justo donde este dominio se rompe: una promoción que no existe, un producto que
  ya no está en el catálogo.

---

## 5. Arquitectura

Tres capas ligeras con dependencias **hacia adentro**, e `infrastructure` como
única capa en contacto con SQL:

```
http  →  application  →  domain
  ↓            ↓
     infrastructure (SQL)
```

**Evitando la sobre-ingeniería.** No hay Clean Architecture ceremonial: sin
puertos y adaptadores redundantes, sin contenedor de inyección de dependencias,
sin mapeadores entre tres representaciones del mismo objeto. Para este tamaño
sería burocracia técnica.

**Dominio puro.** No conoce Express, ni el driver de base de datos, ni el reloj del
sistema: recibe un `Clock` inyectable. Esa única disciplina es la que permite que
las pruebas fijen el "hoy" y cubran todas las reglas de negocio en milisegundos,
sin levantar una base de datos.

**Defensa en profundidad.** Las reglas están replicadas a propósito en tres sitios:
**Zod** (forma del mensaje), **dominio** (regla de negocio) y **`CHECK` en SQL**
(integridad del dato). No rompe DRY: son tres audiencias y tres momentos de fallo
distintos.

---

## 6. Modelo de datos

Dos tablas, `products` y `promotions`, con una **asociación excluyente** garantizada
en el motor:

```sql
CONSTRAINT CK_promotions_target CHECK (
    (target_type = 'PRODUCT'  AND product_id IS NOT NULL AND category   IS NULL) OR
    (target_type = 'CATEGORY' AND category   IS NOT NULL AND product_id IS NULL)
)
```

| Decisión | Motivo |
|---|---|
| `DECIMAL(12,2)`, nunca `FLOAT` | Dinero y porcentajes no admiten error de redondeo binario. |
| `DATE`, no `DATETIME2` | La vigencia es un día civil. Sin hora no hay zona horaria que se cuele en la fila. |
| `end_date > start_date` estricto | El enunciado exige "posterior", no "posterior o igual". |
| Estados en inglés en el dato | La etiqueta de la interfaz no debe ser la clave del dominio ni el valor almacenado. |
| Sin `ROWVERSION` | No hay concurrencia real en el alcance. Queda como evolución (§13). |

> ⚠️ **Deuda técnica consciente.** Para cumplir el mínimo de dos tablas sin inflar el
> modelo, la categoría es un **atributo de `products`** y no una tabla propia. Su
> existencia se valida en la capa de aplicación contra `SELECT DISTINCT category`,
> lo que significa que **no tiene integridad referencial de base de datos**. Es la
> principal deuda del modelo y lo primero que cambiaría: una tabla `categories`
> con su clave foránea.

---

## 7. Estrategia de estados y ambigüedades resueltas

La transición se modeló como una **máquina de estados declarativa basada en datos**,
no en condicionales anidados:

```
            activar                  finalizar
SCHEDULED ───────────► ACTIVE ───────────────► FINISHED  (terminal)
```

```ts
const ALLOWED_TRANSITIONS: Record<PromotionStatus, readonly PromotionStatus[]> = {
  SCHEDULED: ['ACTIVE'],
  ACTIVE:    ['FINISHED'],
  FINISHED:  [],
};
```

Añadir un estado es editar este objeto, no repartir `if` por los servicios.

### Vacíos del enunciado y cómo se resolvieron

**El estado se persiste; no se deriva de las fechas.**
El enunciado pide "cambiar el estado" y "eliminar solo si está Programada". Si el
estado se calculara a partir del rango, ninguno de los dos requisitos tendría
sentido operativo y nadie podría cortar una promoción antes de tiempo. El estado
lo gobierna el usuario mediante transiciones explícitas.

> 📌 **Consecuencia visible y buscada:** el estado y la vigencia son **independientes**.
> Una promoción puede estar `Activa` sin que hoy esté dentro de su rango, y puede
> finalizarse antes de que empiece. La interfaz lo muestra como dato en lugar de
> ocultarlo; no hay corrección automática ni etiqueta de "expirada".

**Única guarda añadida: no se activa lo ya vencido.**
`SCHEDULED → ACTIVE` se rechaza con `409` si `hoy > end_date`. Es la única regla que
añadí al enunciado, y la añadí porque activar algo caducado es exactamente el error
que el módulo existe para evitar.

**"Vigentes hoy" cuenta las `Activa` dentro del rango.**
El texto define vigencia solo por fechas, sin mencionar el estado. Opté por la
lectura de negocio —lo que realmente está descontando— porque es el problema que la
prueba describe. Es una interpretación, así que el contador se rotula en la interfaz
como **"Vigentes hoy — activas y dentro del rango de fechas"**, el resumen devuelve
la fecha de referencia usada, y el desglose por estado permite reconstruir la
lectura literal.

**`Finalizada` es terminal e inmutable:** no se edita (`409`), no se elimina (`409`)
y no cambia de estado (`409`).

**Una promoción `Activa` sí se puede editar.** El enunciado solo prohíbe modificar las
`Finalizadas`; no añadí restricciones que nadie pidió. *Trade-off:* en un sistema real
probablemente se congelaría la fecha de inicio una vez activa.

**No existe "cancelar"** (`Programada → Finalizada`). El enunciado dibuja una cadena
lineal; añadir un salto sería inventar comportamiento. Queda como evolución (§13).

**El borrado es físico.** El enunciado dice "eliminar" y solo lo permite en el estado
más inofensivo.

**Sin paginación.** No se pidió. Orden estable por `start_date DESC, id DESC` y filtro
opcional por estado, que sí aporta a la interfaz y cuesta una línea.

---

## 8. Fechas y zonas horarias

Regla única de punta a punta: **las fechas son cadenas `YYYY-MM-DD`, nunca objetos
`Date`.**

- Base de datos `DATE`; API `"2026-08-27"` sin `Z`, sin offset, sin hora; el
  `<input type="date">` produce y consume ese mismo formato.
- **"Hoy" se calcula una sola vez, en el backend**, con
  `Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE })`. No es el reloj del
  contenedor ni el del navegador: es la zona horaria de negocio, configurable.
- Las comparaciones son **Orden alfabetico sobre cadenas ISO**, que coinciden con el
  orden cronológico.
- El rango es **inclusivo** en ambos extremos.

Esto no mitiga los errores de zona horaria: **los elimina por construcción**. Los
contenedores y GitHub Actions corren en UTC; sin esta decisión, una promoción que
termina hoy dejaría de contarse a las 19:00 hora de Colombia. Hay una prueba
dedicada a ese caso exacto.

---

## 9. Estrategia de validación

| Nivel | Responsabilidad |
|---|---|
| **Zod** (borde HTTP) | La *forma* del mensaje: tipos, enums, presencia y el XOR (exclusivo) producto/categoría. Rechaza lo que ni siquiera es una petición bien formada. |
| **Dominio** | Reglas de negocio: rangos, coherencia de fechas, decimales, longitud. Devuelve **todos** los problemas a la vez, no el primero, para que el formulario marque cada campo de una sola vez. |
| **`CHECK` en SQL Server** | Última línea de defensa sobre el dato. |

Una comprobación necesita base de datos y por eso vive en la capa de aplicación:
que el producto o la categoría **existan**. Sin ella, un `productId` inexistente
sería un `500` por violación de clave foránea en lugar de un `422` con el campo
señalado.

**El frontend valida, pero el backend manda.** La validación del formulario existe
para que el usuario no espere un viaje de red; los errores del servidor se proyectan
sobre el campo correspondiente cuando llegan.

---

## 10. Estrategia de pruebas

No se persigue un porcentaje de cobertura, sino que **cada regla del enunciado tenga
al menos una prueba que falle si la regla se rompe**.

| Nivel | Qué cubre |
|---|---|
| **Unitarias del dominio** | Bordes del porcentaje (0 / 0.5 / 1 / 100 / 100.01 / 101), fechas iguales frente a ordenadas, las 9 combinaciones de la máquina de estados, inmutabilidad de `Finalizada`, borrado solo en `Programada`, vigencia en los límites exactos del rango, día de negocio frente a UTC. |
| **Contrato HTTP** (Supertest + repositorio en memoria) | Códigos de estado, forma del error y traducción dominio → HTTP, sin necesitar SQL Server. |
| **Frontend** (Testing Library) | Renderizado de la lista, estado vacío, validación del formulario, acciones visibles según estado, proyección de errores del backend. |
| **Smoke test** | Integración real API + SQL Server sobre la pila levantada. |

> 💡 **Decisión sobre la integración.** En lugar de duplicar la infraestructura
> levantando un SQL Server como servicio en la etapa `test` *y además* en el smoke
> test, la integración real la cubre el smoke test, que ya levanta el sistema
> completo y ejecuta un recorrido de negocio (`crear → validar → listar → resumen →
> transición → borrado rechazado`). *Trade-off:* la etapa `test` no toca la base de datos.

---

## 11. Docker

- **Multi-stage** en ambas imágenes: se compila con las dependencias completas y se
  ejecuta con `--omit=dev`. El backend corre como usuario `node`, sin privilegios.
- **El frontend se sirve con Nginx**, que hace de **proxy inverso** de `/api` y
  `/health`. La SPA usa rutas relativas y la URL del backend nunca se quema en el
  bundle: la misma imagen sirve en cualquier entorno.
- **Los servicios se encadenan por salud, no por orden de arranque**
  (`depends_on: condition: service_healthy`). Sin esto, el backend intentaría
  conectarse a un SQL Server que todavía está inicializando.
- **Sin credenciales por defecto.** Las variables se declaran como
  `${MSSQL_SA_PASSWORD:?…}`: Compose aborta con un error explícito si faltan.
- Las **migraciones corren al arrancar, antes de abrir el puerto**: si el esquema no
  está listo, el proceso no escucha y `/health` no puede responder 200 en falso.

---

## 12. CI/CD y seguridad

### Pipeline

Cuatro etapas encadenadas con `needs:` — `lint` → `test` → `build` → `smoke`.

El smoke test **no se simula**: verifica las variables requeridas, levanta la pila con
`docker compose`, espera al `/health` con reintentos y timeout duro, exige `200`,
ejecuta el recorrido de negocio real, comprueba que el frontend se sirve, vuelca los
logs si algo falla y siempre termina con `docker compose down -v`.

> 📌 **Secretos.** El repositorio no contiene ningún valor real. `MSSQL_SA_PASSWORD`
> se inyecta desde GitHub Secrets. Consecuencia buscada: si el secreto no está
> configurado, el pipeline **falla a propósito** nombrando la variable que falta.
> Ese fallo es la evidencia de que el control funciona.

### Controles de seguridad implementados

| Riesgo | Control |
|---|---|
| Inyección SQL | Parámetros tipados en todas las consultas. La única interpolación (`CREATE DATABASE`, que no admite parámetros) está acotada a `[A-Za-z0-9_]` en el esquema de configuración. |
| XSS | React escapa por defecto; sin `dangerouslySetInnerHTML`. Nginx añade `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`. |
| Cabeceras | Helmet en la API. |
| CORS | Lista blanca explícita; sin orígenes configurados no se habilita. |
| Fuga de información | Manejador de errores central. El cliente nunca recibe stacks, cadenas de conexión ni mensajes del driver; el detalle va al log con un `requestId` que también viaja en la cabecera `x-request-id`. `/health` reporta la base caída sin decir dónde está ni con qué usuario. |
| Logs | Pino con redacción explícita de `password`, `authorization` y `cookie`. |
| Secretos | Ninguno en el repositorio; `.env` en `.gitignore`; `.env.example` sin valores; validación *fail-fast* al arrancar. |
| Abuso | Rate limit sobre `/api` (no sobre `/health`, que es la sonda de los orquestadores) y límite de 100 kB en el cuerpo. |

**Fuera de alcance, conscientemente:** autenticación y autorización (no las pide el
enunciado), HTTPS y certificados (corresponde al borde de despliegue), rotación de
secretos, auditoría de accesos y análisis de dependencias en el pipeline
(`npm audit` / Dependabot serían el siguiente paso natural).

---

## 13. Fuera de alcance y evolución

**No implementado a propósito:** autenticación, autorización, multitenancy, auditoría,
borrado lógico, detección de solapamiento entre promociones, paginación, bloqueo
optimista, métricas y trazas, despliegue en la nube. Ninguno lo pide el enunciado y
todos competirían con la prioridad declarada de calidad sobre cantidad.

**Cómo evolucionaría dentro de un SaaS multitenant:**

| Necesidad | Camino |
|---|---|
| Aislamiento entre clientes | `tenant_id` en ambas tablas con índices compuestos y **Row-Level Security** de SQL Server sobre `SESSION_CONTEXT`, de modo que el aislamiento no dependa de recordar un `WHERE` en cada consulta. El `tenant_id` se resuelve desde el token en un middleware y se propaga por contexto de petición. |
| Integridad de categorías | Tabla `categories` con clave foránea, cerrando la deuda del §6. |
| Edición concurrente | `ROWVERSION` con `If-Match` / ETag. |
| Trazabilidad | Tabla `promotion_status_history`: quién cambió el estado, cuándo y desde dónde. |
| Ciclo de vida automático | Tarea programada que finalice las promociones vencidas, pasando por la **misma** máquina de estados que la API. |
| Observabilidad | `/metrics` en formato Prometheus y `requestId` propagado a un agregador de logs. |
| Documentación de API | Generar OpenAPI desde los esquemas Zod existentes, sin duplicar el contrato. |

---

## 14. Uso de IA en el desarrollo

Usé asistencia de IA durante la construcción de este módulo. La prueba no lo
restringe, así que lo declaro abiertamente junto con el reparto del trabajo.

**Lo que decidí yo:** el stack dentro de las restricciones del enunciado, la
resolución de cada ambigüedad (§7), el alcance de lo que deliberadamente no se
implementa (§13) y los criterios de calidad: separación de capas, dominio puro y
testeable, reglase de negocio  en base de datos, y comentarios que justifiquen
el porqué en lugar de describir el qué.

**Dónde aceleré con IA:** redacción del código a partir de esos criterios,
construcción de la batería de pruebas alrededor de las reglas que definí, y
borradores de documentación.

**Lo que verifiqué yo:** lint, tipos, las 116 pruebas, ambos builds,
`docker compose up`, el smoke test contra la aplicación real y el pipeline
completo en GitHub Actions. Revisé el código y pedí correcciones — entre otras,
reducir los comentarios a los que explican una decisión no evidente.

