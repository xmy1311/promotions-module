# Decisiones técnicas

Este documento explica **por qué** la solución es como es, incluidas las
ambigüedades del enunciado y lo que se decidió deliberadamente no implementar.
El criterio rector es el que fija la propia prueba: **calidad sobre cantidad**.

---

## 1. Stack seleccionado

| Capa | Elección | Motivo |
|---|---|---|
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind | Obligatorio por el enunciado. TypeScript y Tailwind aportan seguridad de tipos y estilos consistentes sin añadir un sistema de diseño completo |
| Backend | Node.js 22 LTS + Express + TypeScript | Node es obligatorio. Express es el mínimo maduro y sin magia: se lee `app.ts` y se entiende todo el flujo de una petición |
| Base de datos | SQL Server 2022 | Ver §3 |
| Validación | Zod | Un solo artefacto define el esquema y el tipo TypeScript (`z.infer`); sin DTOs duplicados |
| Datos | Driver `mssql` con consultas parametrizadas | Ver §2 sobre por qué no hay ORM |
| Estado del servidor (UI) | TanStack Query | Aporta valor real: `isLoading`/`isError` sin boilerplate e invalidación automática tras cada mutación |
| Formularios | React Hook Form + Zod | Errores por campo sin re-render global y el mismo lenguaje de validación que el backend |
| Pruebas | Vitest (+ Supertest y Testing Library) | Un solo runner para backend y frontend: una cultura de testing, no dos |

**Sobre mi perfil.** Mi experiencia principal es .NET/C#. El enunciado permite
Node o Laravel y no .NET, así que Node.js no es una preferencia sino la
restricción de la prueba. Lo que sí es transferible —y es lo que se ve en el
código— es el criterio de ingeniería del ecosistema empresarial: capas con
responsabilidad única, un dominio puro y testeable, DTOs validados en el borde,
configuración *fail-fast*, manejo centralizado de errores e invariantes
replicadas en la base de datos. Es el mismo diseño que haría con ASP.NET Core
más Dapper, sin el framework.

## 2. Por qué Node.js y no Laravel

El enunciado ofrece ambos. Elegí Node.js por tres razones concretas:

1. **Un solo lenguaje y un solo modelo mental** en toda la solución. Frontend y
   backend comparten TypeScript, la forma de los tipos del dominio, el esquema de
   validación (Zod) y el runner de pruebas. Eso reduce el coste de revisión para
   quien evalúa y el de mantenimiento para el equipo.
2. **Encaja con la vacante.** React, Vite y Node aparecen juntos en la oferta; la
   solución se parece a lo que el equipo mantiene a diario.
3. **Menos superficie que justificar.** Laravel traería un ORM, migraciones,
   contenedor de servicios y convenciones que resuelven problemas que este módulo
   no tiene. Para dos tablas, eso es coste sin beneficio.

**Sin ORM, y es intencional.** El modelo son dos tablas y unas ocho consultas.
Prisma o TypeORM añadirían generación de código, un segundo sistema de
migraciones y una capa de traducción para ahorrar poco SQL. El driver `mssql`
con parámetros tipados cierra la inyección SQL *por construcción* —no por
saneado— y deja el SQL versionado, legible y revisable en el diff.

## 3. Por qué SQL Server

Las tres opciones del enunciado eran válidas. SQL Server porque:

- Aparece explícitamente en la oferta de empleo, junto a PostgreSQL y MongoDB.
- El dominio es **relacional y con invariantes duras**: una promoción apunta a un
  producto *o* a una categoría, un porcentaje vive entre 1 y 100, una fecha de fin
  es posterior a la de inicio. Un motor relacional permite expresar todo eso como
  restricciones `CHECK` que se sostienen aunque alguien escriba por fuera de la API.
  En MongoDB esas garantías dependerían del código de la aplicación.
- Es el motor donde mi experiencia previa en el ecosistema .NET es directamente
  aplicable, y donde puedo defender decisiones de tipos (`DECIMAL` frente a
  `FLOAT`, `DATE` frente a `DATETIME2`) con criterio y no por copia.

**Coste asumido y documentado:** la imagen oficial de SQL Server no corre
nativamente en ARM64. El `README.md` documenta la alternativa `azure-sql-edge`
para Apple Silicon, y el CI corre en `ubuntu-latest` (amd64).

## 4. Por qué TypeScript

- Los estados y los tipos de descuento son **uniones cerradas**. Con TypeScript,
  añadir un estado y olvidar una rama es un error de compilación, no un bug en
  producción.
- El contrato de la API se define una vez con Zod y el tipo se **infiere**; no hay
  un DTO escrito a mano que se desincronice de su validación.
- `strict` y `noUncheckedIndexedAccess` obligan a tratar los casos nulos, que es
  justo donde este dominio se rompe (una promoción que no existe, un producto que
  ya no está en el catálogo).

## 5. Arquitectura

Tres capas ligeras con dependencias hacia adentro: `http` → `application` →
`domain`, e `infrastructure` como única capa que conoce SQL.

**No es Clean Architecture ceremonial**, y es una decisión: no hay puertos y
adaptadores por todas partes, ni contenedor de inyección de dependencias, ni
mapeadores entre tres representaciones del mismo objeto. Para un módulo de este
tamaño eso sería estructura sin beneficio.

Lo que sí se conserva de ese enfoque es lo que paga: **el dominio es puro**. No
conoce Express, ni el driver de base de datos, ni el reloj del sistema. Esa única
disciplina es la que permite cubrir todas las reglas de negocio con pruebas que
corren en milisegundos y sin levantar una base de datos.

**Reloj inyectable.** El dominio nunca llama a `new Date()`; recibe un `Clock`.
Los tests fijan "hoy" y el cálculo de vigencia deja de depender de cuándo se
ejecute la suite.

## 6. Modelo de datos

Dos tablas, `products` y `promotions`, con asociación **excluyente**:

```sql
CONSTRAINT CK_promotions_target CHECK (
    (target_type = 'PRODUCT'  AND product_id IS NOT NULL AND category   IS NULL) OR
    (target_type = 'CATEGORY' AND category   IS NOT NULL AND product_id IS NULL)
)
```

Decisiones y sus motivos:

- **`DECIMAL(12,2)`, nunca `FLOAT`.** Dinero y porcentajes no admiten error de
  redondeo binario.
- **`DATE`, no `DATETIME2`.** La vigencia es un día civil. Sin hora no hay zona
  horaria que se cuele en la fila (ver §9).
- **`end_date > start_date` estricto.** El enunciado exige "posterior", no
  "posterior o igual".
- **La categoría no tiene tabla propia.** Es un atributo de `products`, lo que
  cumple el mínimo de dos tablas sin inflar el modelo.
  *Trade-off explícito:* al no existir una tabla `categories`, la categoría de una
  promoción no tiene integridad referencial de base de datos; su existencia se
  valida en la capa de aplicación contra el catálogo (`SELECT DISTINCT category`).
  Es la principal deuda consciente del modelo y la primera cosa que cambiaría si
  el módulo creciera: una tabla `categories` con su clave foránea.
- **Sin `ROWVERSION` ni bloqueo optimista.** No hay concurrencia real en el alcance.
- **Estados en inglés en el dato, español en la interfaz.** La etiqueta de UI no
  debe ser la clave del dominio ni el valor almacenado.

**Las invariantes están duplicadas a propósito** en tres sitios: Zod (forma del
mensaje), dominio (regla de negocio) y `CHECK` (integridad del dato). No es DRY
roto: son tres audiencias distintas y tres momentos distintos de fallo. La
duplicación es defensa en profundidad y está documentada como tal.

## 7. Estrategia de estados

```
            activar                  finalizar
SCHEDULED ───────────► ACTIVE ───────────────► FINISHED  (terminal)
```

La máquina de estados es **un dato, no una cadena de condicionales**:

```ts
const ALLOWED_TRANSITIONS: Record<PromotionStatus, readonly PromotionStatus[]> = {
  SCHEDULED: ['ACTIVE'],
  ACTIVE:    ['FINISHED'],
  FINISHED:  [],
};
```

Añadir un estado es editar esta tabla, no repartir `if` por los servicios.

### Ambigüedades del enunciado y cómo se resolvieron

El enunciado deja varios comportamientos abiertos. Ninguno se resolvió en
silencio; estos son los que importan.

**El estado se persiste; no se deriva de las fechas.**
Se podría haber calculado el estado a partir del rango (`hoy < inicio` ⇒
programada, etc.). Se descartó: si el estado fuera derivado, el requisito de
"cambiar el estado" y el de "eliminar solo si está Programada" no tendrían sentido
operativo, y el usuario no podría cortar una promoción antes de tiempo. El estado
es un dato gobernado por transiciones explícitas y la **vigencia** es una
propiedad aparte, derivada de las fechas. *Consecuencia visible y asumida:* una
promoción puede estar `Activa` y no vigente hoy; la interfaz lo muestra como dato
en lugar de ocultarlo.

**No se puede activar una promoción cuya fecha de fin ya pasó.**
Es la única regla añadida al enunciado, y se añade porque activar algo caducado es
exactamente el error que el módulo existe para evitar ("descuentos activos fuera
de su vigencia"). Devuelve `409`.

**"Vigentes hoy" cuenta las `Activa` dentro del rango.**
El texto define vigencia solo por fechas, sin mencionar el estado. Se optó por la
lectura de negocio —lo que realmente está descontando en el punto de venta— porque
es el problema que la prueba describe. *Es una interpretación, no el texto
literal*, así que: el contador se rotula en la interfaz como **"Vigentes hoy —
activas y dentro del rango de fechas"**, el resumen devuelve también la fecha de
referencia usada, y el desglose por estado permite reconstruir la lectura literal.

**Una promoción `Activa` sí se puede editar.**
El enunciado solo prohíbe modificar las `Finalizadas`. No se añaden restricciones
que nadie pidió. *Trade-off:* en un sistema real probablemente se congelaría la
fecha de inicio una vez activa; aquí se documenta en lugar de inventarse.

**`Finalizada` es terminal e inmutable en todo:** no se edita (`409`), no se
elimina (`409`) y no cambia de estado (`409`).

**No existe "cancelar"** (`SCHEDULED → FINISHED`). El enunciado dibuja una cadena
lineal; añadir un salto sería inventar comportamiento. Queda anotado como
evolución (§14).

**El borrado es físico.** El enunciado dice "eliminar" y solo lo permite en el
estado más inofensivo. Auditoría y borrado lógico quedan fuera de alcance.

**El listado no tiene paginación.** No se pidió. Orden estable por
`start_date DESC, id DESC` y filtro opcional por estado, que sí aporta valor a la
interfaz y cuesta una línea.

## 8. Estrategia de validación

Tres niveles con responsabilidades distintas:

1. **Zod en el borde HTTP** — valida la *forma* del mensaje: tipos, enums,
   presencia, y el XOR producto/categoría. Rechaza lo que ni siquiera es una
   petición bien formada.
2. **Dominio** — reglas de negocio puras: rangos, coherencia de fechas,
   decimales, longitud. Devuelve **todos** los problemas a la vez, no el primero,
   para que el formulario pueda marcar cada campo de una sola vez.
3. **`CHECK` en SQL Server** — última línea de defensa.

Una comprobación necesita base de datos y por eso vive en la capa de aplicación:
que el producto o la categoría **existan**. Sin ella, un `productId` inexistente
sería un `500` por violación de clave foránea en lugar de un `422` con el campo
señalado.

**El frontend valida, pero el backend manda.** La validación del formulario
existe para que el usuario no espere un viaje de red; los errores del servidor se
proyectan sobre el campo correspondiente cuando llegan.

## 9. Manejo de fechas y zonas horarias

Regla única de punta a punta: **las fechas son cadenas `YYYY-MM-DD`, nunca objetos
`Date`.**

- Base de datos `DATE`; API `"2026-08-27"` sin `Z`, sin offset, sin hora; el
  `<input type="date">` produce y consume ese mismo formato.
- "Hoy" se calcula **una sola vez, en el backend**, con
  `Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE })`. Cero dependencias.
- Las comparaciones son **lexicográficas sobre cadenas ISO**, que coinciden con el
  orden cronológico.
- Rango **inclusivo** en ambos extremos.

Esto no mitiga los errores de zona horaria: los elimina por construcción. Los
contenedores y GitHub Actions corren en UTC; sin esta decisión, una promoción que
termina hoy dejaría de contarse a las 19:00 hora de Colombia. Hay una prueba
dedicada a ese caso exacto.

## 10. Estrategia de pruebas

No se persigue un porcentaje de cobertura, sino que **cada regla del enunciado
tenga al menos una prueba que falle si la regla se rompe**.

| Nivel | Qué cubre |
|---|---|
| Unitarias del dominio | Creación válida · nombre requerido · objetivo requerido y excluyente · valor requerido y positivo · porcentaje en los bordes 0/1/100/101 · `fin > inicio` incluyendo la igualdad · cada transición válida e inválida · inmutabilidad de `Finalizada` · borrado solo en `Programada` · vigencia en los bordes exactos del rango · cálculo del resumen · día de negocio frente a UTC |
| Contrato HTTP (Supertest + repositorio en memoria) | Códigos de estado, forma del error y traducción dominio → HTTP, sin necesitar SQL Server |
| Frontend (Testing Library) | Renderizado de la lista, estado vacío, validación del formulario, acciones visibles según estado, proyección de errores del backend |
| Smoke test | Integración real API + SQL Server sobre la pila levantada |

**Decisión sobre la integración:** en lugar de duplicar la infraestructura
levantando un SQL Server como servicio en la etapa `test` *y además* en el smoke
test, la integración real la cubre el smoke test, que ya levanta el sistema
completo y ejecuta un recorrido de negocio (`crear → listar → resumen →
transición → borrado rechazado`). Se gana integración auténtica sin pagar dos
veces el arranque de la base. *Trade-off:* la etapa `test` no toca la base de datos.

## 11. Docker

- **Multi-stage** en ambas imágenes: se compila con las dependencias completas y
  se ejecuta con `--omit=dev`. El backend corre como usuario `node`, sin privilegios.
- **El frontend se sirve con Nginx**, que hace de **proxy inverso** de `/api` y
  `/health`. Así la SPA usa rutas relativas y la URL del backend nunca se hornea
  en el bundle: la misma imagen sirve en cualquier entorno.
- **Los servicios se encadenan por salud, no por orden de arranque**
  (`depends_on: condition: service_healthy`). Sin esto, el backend intentaría
  conectarse a un SQL Server que todavía está inicializando.
- **Sin credenciales por defecto.** Las variables se declaran como
  `${MSSQL_SA_PASSWORD:?…}`: Compose aborta con un error explícito si faltan.
- El *healthcheck* de la base prueba las dos rutas posibles de `sqlcmd`
  (`mssql-tools18` y `mssql-tools`), porque apuntar solo a una deja el contenedor
  permanentemente `unhealthy` y la pila nunca arranca.

## 12. CI/CD

Cuatro etapas encadenadas con `needs:` — `lint` → `test` → `build` → `smoke`.

El smoke test **no se simula**: verifica primero las variables requeridas, levanta
la pila con `docker compose`, espera al `/health` con reintentos y timeout duro,
exige `200`, ejecuta el recorrido de negocio real, comprueba que el frontend se
sirve, vuelca los logs si algo falla y siempre termina con `docker compose down -v`.

**Secretos.** El repositorio no contiene ningún valor real. `MSSQL_SA_PASSWORD`
se inyecta desde GitHub Secrets. Consecuencia buscada: si el secreto no está
configurado, el pipeline **falla a propósito** nombrando la variable que falta.
Ese fallo es la evidencia de que el control funciona.

## 13. Seguridad

**Implementado:**

- **Inyección SQL:** todas las consultas usan parámetros tipados del driver. No
  hay concatenación de entrada de usuario en ninguna sentencia. La única
  interpolación es el nombre de la base en `CREATE DATABASE` —que no admite
  parámetros— y por eso `DB_NAME` está restringido en el esquema de configuración
  a `[A-Za-z0-9_]`.
- **Validación de entrada** en el borde y en el dominio, con límites de longitud.
- **XSS:** React escapa por defecto; no se usa `dangerouslySetInnerHTML` en
  ningún punto. Nginx añade `X-Content-Type-Options`, `X-Frame-Options` y
  `Referrer-Policy`.
- **Cabeceras:** Helmet en la API.
- **CORS con lista blanca explícita**: sin orígenes configurados, no se habilita.
  En Docker no hace falta porque Nginx sirve todo desde el mismo origen.
- **Fuga de información:** manejador de errores centralizado. El cliente nunca
  recibe stacks, cadenas de conexión ni mensajes del driver; el detalle va al log
  con un `requestId` que también se devuelve en la cabecera `x-request-id`.
  `/health` reporta que la base está caída sin decir dónde está ni con qué usuario.
- **Logs:** Pino con redacción explícita de `password`, `authorization` y `cookie`.
- **Secretos:** ninguno en el repositorio; `.env` en `.gitignore`; `.env.example`
  sin valores; GitHub Secrets en CI; validación *fail-fast* al arrancar.
- **Rate limit** básico sobre `/api` (no sobre `/health`, que es la sonda de los
  orquestadores).
- **Límite de tamaño del cuerpo** (100 kB) y contenedor sin privilegios.

**Fuera de alcance, conscientemente:** autenticación y autorización (no las pide
el enunciado), HTTPS y gestión de certificados (corresponde al borde de
despliegue), rotación de secretos, auditoría de accesos y análisis de
dependencias en el pipeline (`npm audit` / Dependabot serían el siguiente paso
natural).

## 14. Fuera de alcance y evolución

**No implementado a propósito:** autenticación, autorización, multitenancy,
auditoría, borrado lógico, detección de solapamiento entre promociones,
paginación, bloqueo optimista, métricas y trazas, despliegue en la nube. Ninguno
lo pide el enunciado y todos competirían con la prioridad declarada de calidad
sobre cantidad.

**Cómo evolucionaría dentro de un SaaS multitenant como el de la empresa:**

- `tenant_id` en ambas tablas con índices compuestos, y **Row-Level Security** de
  SQL Server con `SESSION_CONTEXT`, de modo que el aislamiento entre clientes no
  dependa de recordar un `WHERE` en cada consulta.
- El `tenant_id` se resuelve desde el token en un middleware y se propaga por
  contexto de petición; el repositorio nunca lo recibe como parámetro opcional
  que alguien pueda olvidar.
- Tabla `categories` con clave foránea, cerrando la deuda del §6.
- `ROWVERSION` con `If-Match`/ETag para edición concurrente.
- `promotion_status_history` para auditar quién cambió el estado, cuándo y desde
  dónde.
- Estado `Cancelada` y transición `Programada → Cancelada`, si el negocio lo pide.
- Tarea programada que finalice automáticamente las promociones vencidas,
  pasando por la **misma** máquina de estados que la API.
- Observabilidad: `/metrics` en formato Prometheus y `requestId` propagado a un
  agregador de logs.
