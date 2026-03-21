# Documentación Backend — Rework Casos y Nuevos Módulos

Documento de referencia para los cambios de backend introducidos en la rama `dev/fix-casos-improve-things`. Cubre la capa SQLite, los servicios de API, los servicios de sincronización y los contextos React que un agente de frontend debe consumir.

---

## Resumen de Cambios

| Capa | Archivos Modificados | Archivos Nuevos |
|------|----------------------|-----------------|
| SQLite Schema | `electron/db/schema.cjs`, `electron/db/migrations.cjs`, `electron/db/shared.cjs`, `electron/db/genericRepository.cjs` | — |
| Cache Row | `src/services/cache/caseCacheRow.js` | — |
| API Services | `src/services/caseService.js` | `radicacionService.js`, `tipoExpedienteService.js`, `rolService.js`, `tipoPagoService.js`, `gastoCatalogoService.js`, `parteService.js`, `honorarioService.js`, `entregaService.js`, `gastoSuitCaseService.js` |
| Sync Services | `src/services/sync/metadataSyncService.js`, `src/services/sync/syncCore.js` | — |
| Contexts | `src/context/AppProviders.jsx` | `RadicacionesContext.jsx`, `TipoExpedientesContext.jsx`, `RolesContext.jsx`, `TipoPagosContext.jsx`, `GastoCatalogoContext.jsx`, `PartesContext.jsx` |
| Hooks | — | `useHonorarios.js`, `useEntregas.js`, `useGastosCaso.js`, `usePartesCaso.js` |

---

## 1. Cambios en `cases` (Breaking Changes)

### 1.1 Nuevas columnas obligatorias

La API ahora requiere `nro_expediente` y `radicacion_id` para crear o actualizar casos.

**SQLite (migración v16):**
```sql
ALTER TABLE cases ADD COLUMN nro_expediente TEXT;
ALTER TABLE cases ADD COLUMN radicacion_id INTEGER;
```

**`caseCacheRow.js`** — Campos agregados al mapping:
```js
nro_expediente: caseRecord.nro_expediente || null,
radicacion_id: caseRecord.radicacion_id || null,
```

### 1.2 Nuevas funciones en `caseService.js`

```js
import { updateCase, reopenCase } from '../services/caseService.js';

// Actualizar un caso (requiere nro_expediente y radicacion_id)
const result = await updateCase(caseId, {
    title: 'Nuevo título',
    nro_expediente: '123/2026',
    radicacion_id: 1,
    // otros campos opcionales...
});

// Reabrir un caso cerrado
const result = await reopenCase(caseId);
```

---

## 2. Catálogos (Metadata Sync)

Son tablas pequeñas que cambian poco. Se sincronizan con `syncResource` usando fetch completo + replace. Se cargan automáticamente al iniciar sesión vía sus providers en `AppProviders`.

### 2.1 Radicaciones (`radicaciones`)

Representa los tribunales/juzgados donde se radican los casos.

**SQLite:**
```sql
id INTEGER PRIMARY KEY, name TEXT, data_json TEXT, synced_at TEXT
```

**Contexto:**
```jsx
import { useRadicaciones } from '../context/RadicacionesContext';

const { radicaciones, syncing } = useRadicaciones();
// radicaciones: [{ id, name, data_json, synced_at }]
```

**API Service (`radicacionService.js`):**
```js
import { getRadicaciones, createRadicacion, updateRadicacion, deleteRadicacion } from '../services/radicacionService.js';

await getRadicaciones();             // GET /radicaciones
await createRadicacion({ name });    // POST /radicaciones
await updateRadicacion(id, { name }); // PUT /radicaciones/{id}
await deleteRadicacion(id);          // DELETE /radicaciones/{id}
```

### 2.2 Tipos de Expediente (`tipo_expedientes`)

Tipos de proceso legal que puede tener un caso. Tienen `last-modified` endpoint.

**SQLite:**
```sql
id INTEGER PRIMARY KEY, case_type_id INTEGER, title TEXT, details TEXT, data_json TEXT, synced_at TEXT
```

**Contexto:**
```jsx
import { useTipoExpedientes } from '../context/TipoExpedientesContext';

const { tipo_expedientes: tipoExpedientes } = useTipoExpedientes();
```

**API Service (`tipoExpedienteService.js`):**
```js
import { getTipoExpedientes, getTipoExpedientesByCaseType, syncTipoExpedientesToCase } from '../services/tipoExpedienteService.js';

await getTipoExpedientes();                           // GET /tipo-expedientes
await getTipoExpedientesByCaseType(caseTypeId);       // GET /case-types/{id}/tipo-expedientes
await syncTipoExpedientesToCase(caseId, [1, 2, 3]);  // POST /suit-cases/{id}/tipo-expedientes
```

### 2.3 Roles (`roles`)

Catálogo de tipos de rol para Partes legales (Juez, Fiscal, Perito, etc.).

**SQLite:**
```sql
id INTEGER PRIMARY KEY, titulo TEXT, data_json TEXT, synced_at TEXT
```

**Contexto:**
```jsx
import { useRoles } from '../context/RolesContext';

// createResourceContext expone los datos bajo la clave del resourceName, NO bajo 'data'
const { roles } = useRoles();
// roles: [{ id, titulo, ... }]
```

**API Service (`rolService.js`):**
```js
import { getRoles, createRol, updateRol, deleteRol } from '../services/rolService.js';

await getRoles();                    // GET /roles
await createRol({ titulo });         // POST /roles
await updateRol(id, { titulo });     // PUT /roles/{id}
await deleteRol(id);                 // DELETE /roles/{id}
```

### 2.4 Tipos de Pago (`tipo_pagos`)

Catálogo de medios de pago (Efectivo, Transferencia, Cheque, etc.).

**SQLite:**
```sql
id INTEGER PRIMARY KEY, name TEXT, data_json TEXT, synced_at TEXT
```

**Contexto:**
```jsx
import { useTipoPagos } from '../context/TipoPagosContext';

const { tipo_pagos: tipoPagos } = useTipoPagos();
```

**API Service (`tipoPagoService.js`):**
```js
import { getTipoPagos } from '../services/tipoPagoService.js';

await getTipoPagos(); // GET /tipo-pagos (lectura pública; escritura solo admin)
```

### 2.5 Tipos de Gasto — Catálogo (`gastos_catalogo`)

Conceptos de gasto (sellados, viáticos, notificaciones, etc.). Tiene `last-modified` endpoint.

**SQLite:**
```sql
id INTEGER PRIMARY KEY, titulo TEXT, detalles TEXT, data_json TEXT, synced_at TEXT
```

**Contexto:**
```jsx
import { useGastoCatalogo } from '../context/GastoCatalogoContext';

const { gastos_catalogo: gastosCatalogo } = useGastoCatalogo();
```

**API Service (`gastoCatalogoService.js`):**
```js
import { getGastosCatalogo } from '../services/gastoCatalogoService.js';

await getGastosCatalogo(); // GET /gastos (lectura pública; escritura solo admin)
```

---

## 3. Módulos Transaccionales (On-Demand por Caso)

Estos módulos **no** se sincronizan globalmente. Se cargan bajo demanda cuando se abre el detalle de un caso.

### 3.1 Partes (`partes` + `parte_caso`)

Personas involucradas en el proceso que no son clientes (jueces, peritos, contraparte, etc.).

**SQLite:**
- `partes`: directorio global de personas
- `parte_caso`: pivot `(parte_id, suit_case_id)` para asociaciones

**Contexto (directorio global):**
```jsx
import { usePartes } from '../context/PartesContext';

const { partes } = usePartes();
// partes: [{ id, nombre, apellido, email, telefono, rol_id, ... }]
```

**API Service (`parteService.js`):**
```js
import {
    getPartes, createParte, updateParte, deleteParte,
    getPartesByCaso, linkParteToCaso, unlinkParteFromCaso
} from '../services/parteService.js';

// Directorio global
await getPartes();
await createParte({ nombre, apellido, rol_id, email?, telefono? });
await updateParte(id, data);
await deleteParte(id);

// Asociaciones caso ↔ parte (desde el detalle del caso)
await getPartesByCaso(caseId);          // GET /suit-cases/{id}/partes
await linkParteToCaso(caseId, parteId); // POST /suit-cases/{id}/partes (idempotente)
await unlinkParteFromCaso(caseId, parteId); // DELETE /suit-cases/{id}/partes/{parteId}
```

### 3.2 Honorarios (`honorarios`)

Honorarios fijados a clientes dentro de un caso.

**SQLite:**
```sql
id, suit_case_id, client_id, monto, detalles, pagado (0/1), total_entregas, data_json, synced_at
```

> El campo `pagado` es un booleano que el servidor recalcula al crear/editar/borrar una Entrega.

**API Service (`honorarioService.js`):**
```js
import {
    getHonorariosByCaso, createHonorario, updateHonorario, deleteHonorario,
    getHonorariosByClient, getHonorario, getHonorariosByDateRange
} from '../services/honorarioService.js';

await getHonorariosByCaso(caseId);
await createHonorario(caseId, { monto: 5000, client_id: 3, detalles?: '...' });
await updateHonorario(id, { monto: 6000 });
await deleteHonorario(id);

// Solo admin — rango de fechas
await getHonorariosByDateRange('2026-01-01', '2026-03-31');
```

**Estrategia de caché:** Cargar con `getHonorariosByCaso(caseId)` y persistir los resultados en SQLite con `window.electronAPI.db.upsertMany('honorarios', rows)`. Para consultas por rango de fechas (admin) → request directo sin caché.

### 3.3 Entregas (`entregas`)

Pagos parciales de un honorario.

**SQLite:**
```sql
id, honorario_id, tipo_pago_id, monto, nota, data_json, synced_at
```

**API Service (`entregaService.js`):**
```js
import {
    getEntregasByHonorario, createEntrega, updateEntrega, deleteEntrega
} from '../services/entregaService.js';

await getEntregasByHonorario(honorarioId);
await createEntrega(honorarioId, { monto: 1000, tipo_pago_id: 1, nota?: '...' });
await updateEntrega(id, { monto: 1500 });
await deleteEntrega(id);
```

> Al crear/editar/borrar una entrega, la API recalcula automáticamente `pagado` en el honorario padre.

### 3.4 Gastos de Caso (`gasto_suit_cases`)

Gastos operativos (sellados, viáticos) vinculados a un caso.

**SQLite:**
```sql
id, gasto_id, suit_case_id, monto, client_ids (TEXT/JSON), data_json, synced_at
```

**API Service (`gastoSuitCaseService.js`):**
```js
import {
    getGastosByCaso, createGastoCaso, updateGastoCaso, deleteGastoCaso,
    getGastosByDateRange
} from '../services/gastoSuitCaseService.js';

await getGastosByCaso(caseId);
await createGastoCaso(caseId, {
    gasto_id: 1,
    monto: 500,
    client_id: 3,   // un cliente
    // o client_ids: [3, 4]  // múltiples clientes
});
await updateGastoCaso(id, { monto: 600 });
await deleteGastoCaso(id);

// Rango de fechas (admins ven todo; lawyers solo sus casos)
await getGastosByDateRange('2026-01-01', '2026-03-31');
```

---

## 4. Hooks de Módulos Transaccionales (`src/hooks/`)

Los hooks encapsulan la estrategia de caché + CRUD para los módulos que se cargan **on-demand por caso**. Todos siguen el mismo patrón: carga desde SQLite primero (offline-ready), luego sincroniza desde la API en background.

### 4.1 `useHonorarios(caseId)`

```jsx
import { useHonorarios } from '../hooks/useHonorarios';

const {
    honorarios,   // Array de honorarios del caso (parseados con data_json expandido)
    loading,      // true mientras carga o sincroniza
    error,        // string o null
    reload,       // () → Promise: fuerza re-sync desde API
    addHonorario,    // (data) → Promise: POST y resincroniza
    editHonorario,   // (id, data) → Promise: PUT y resincroniza
    removeHonorario, // (id) → Promise: DELETE + borra de caché local
} = useHonorarios(caseId);

// Ejemplo de uso
await addHonorario({ monto: 5000, client_id: 3, detalles: 'Honorarios juicio' });
await editHonorario(honorario.id, { monto: 6000 });
await removeHonorario(honorario.id);
```

**Campos de cada honorario:**
```js
{
    id, suit_case_id, client_id, monto, detalles,
    pagado,         // boolean (true si total_entregas >= monto)
    total_entregas, // número: suma de todas las entregas registradas
    // + todos los campos de data_json (incluye client, suitCase si el servidor los incluye)
}
```

### 4.2 `useEntregas(honorarioId)`

```jsx
import { useEntregas } from '../hooks/useEntregas';

const {
    entregas,    // Array de entregas del honorario
    loading,
    error,
    reload,
    addEntrega,    // (data) → Promise: POST. La API recalcula `pagado` en el honorario padre.
    editEntrega,   // (id, data) → Promise: PUT
    removeEntrega, // (id) → Promise: DELETE
} = useEntregas(honorarioId);

await addEntrega({ monto: 1000, tipo_pago_id: 1, nota: 'Primer pago' });
```

> Al crear/editar/borrar una entrega, la API actualiza automáticamente `honorario.pagado`. Para reflejar este cambio, hacer `reload()` en el hook `useHonorarios` del caso.

### 4.3 `useGastosCaso(caseId)`

```jsx
import { useGastosCaso } from '../hooks/useGastosCaso';

const {
    gastos,    // Array de gastos del caso
    loading,
    error,
    reload,
    addGasto,    // (data) → Promise
    editGasto,   // (id, data) → Promise
    removeGasto, // (id) → Promise
} = useGastosCaso(caseId);

// Un solo cliente
await addGasto({ gasto_id: 1, monto: 500, client_id: 3 });

// Múltiples clientes
await addGasto({ gasto_id: 1, monto: 1000, client_ids: [3, 4] });
```

**Nota:** Si el caso tiene un único cliente, `client_id` / `client_ids` es opcional (se autoasigna en la API). Si tiene múltiples clientes, es obligatorio.

### 4.4 `usePartesCaso(caseId)`

```jsx
import { usePartesCaso } from '../hooks/usePartesCaso';

const {
    partesCaso,    // Array de objetos Parte completos (con rol) vinculados al caso
    linkedParteIds, // Set<string> de IDs vinculados — para chequeo O(1)
    loading,
    error,
    reload,
    linkParte,   // (parteId) → Promise: asocia una parte al caso (idempotente)
    unlinkParte, // (parteId) → Promise: desasocia una parte del caso
} = usePartesCaso(caseId);

// Verificar si una parte ya está vinculada
const isLinked = linkedParteIds.has(String(parte.id));

// Vincular
await linkParte(parte.id);

// Desvincular (actualización optimista del estado)
await unlinkParte(parte.id);
```

**Para el listado global de partes** (para el selector "añadir parte al caso"), usar `usePartes()` de `PartesContext`.

---

## 5. Sync Flow (Nuevos Catálogos)

Los catálogos se sincronizan en `metadataSyncService.js`. Se disparan automáticamente vía sus providers en `AppProviders`. El ciclo de vida es:

1. `createResourceContext` monta → llama a `syncFn` (e.g., `syncRadicaciones`)
2. `syncResource('radicaciones', null, fetchFn)` → verifica si hay datos locales
3. Si no hay datos o llevan >3 días sin sync → `fetchAndCacheSimpleCatalog` → `replaceCachedRows`
4. SQLite actualizado → el context re-lee y expone el recurso bajo su clave nominal (`radicaciones`, `tipo_pagos`, `roles`, etc.)

Los catálogos con `last-modified` endpoint (`tipo_expedientes`, `gastos_catalogo`) se saltan el fetch si el servidor no reporta cambios.

---

## 6. Guía de Implementación de Frontend

### Crear un caso (formulario)

Los campos `nro_expediente` y `radicacion_id` son **obligatorios** en la API. El formulario debe:
1. Mostrar un select de Radicaciones usando `useRadicaciones().radicaciones`
2. Enviar ambos campos en el body de `createCase()`

```jsx
import { useRadicaciones } from '../context/RadicacionesContext';
import { createCase } from '../services/caseService';

const { radicaciones } = useRadicaciones();

const handleSubmit = async (formData) => {
    const result = await createCase({
        title: formData.title,
        start_date: formData.startDate,
        nro_expediente: formData.nroExpediente,  // obligatorio
        radicacion_id: formData.radicacionId,    // obligatorio
        case_type_id: formData.caseTypeId,       // requerido en la API actual (pese a lo que indica la doc)
    });
};
```

### Detalle de caso — Partes

```jsx
import { getPartesByCaso, linkParteToCaso, unlinkParteFromCaso } from '../services/parteService';

// Cargar partes del caso
const partes = await getPartesByCaso(caseId);

// Asociar parte existente
await linkParteToCaso(caseId, parteId);

// Desasociar
await unlinkParteFromCaso(caseId, parteId);
```

### Honorarios dentro del detalle de caso

```jsx
import { getHonorariosByCaso, createHonorario } from '../services/honorarioService';
import { createEntrega } from '../services/entregaService';

// Cargar y cachear honorarios
const honorarios = await getHonorariosByCaso(caseId);
await window.electronAPI.db.upsertMany('honorarios', honorarios.map(buildHonorarioCacheRow));

// Registrar un pago parcial
await createEntrega(honorarioId, { monto: 1000, tipo_pago_id: 1 });
// → la API actualiza honorario.pagado automáticamente
```

---

## 7. Decisiones Técnicas

- **`fetchAndCacheSimpleCatalog` factory**: los 6 catálogos nuevos usan el mismo patrón (fetch + replace), pero tienen columnas distintas. La factory evita duplicar la lógica de logging y manejo de errores, recibiendo solo `endpoint`, `table` y `buildRow` como parámetros.

- **`parte_caso` sin whitelist dinámica**: la tabla pivot `parte_caso` está en el whitelist de `shared.cjs`, pero no tiene contexto propio. Las asociaciones se manejan directamente con el API service desde el componente de detalle del caso, lo cual es más natural para una tabla pivot.

- **Honorarios/Gastos no globales**: no entran en `clearStaleResources` porque no tienen sync global. Se cargan on-demand por caso; si el backend cambia, el usuario re-abre el caso y se re-sincroniza. Agregar estos al stale check global causaría borrados innecesarios de datos por caso.

- **`radicacion_id` nullable en SQLite pero requerido por la API**: La columna SQLite es `INTEGER` (sin NOT NULL) para tolerar datos históricos migrados antes del rework. La validación de requerido se hace en el formulario frontend, no en la capa de caché.

- **`case_type_id` es requerido en la API**: Verificado contra la API en ejecución — devuelve 422 si se omite. La documentación API lo lista como opcional, pero el comportamiento real es que es obligatorio. El formulario de creación/edición de casos debe incluir un select de CaseTypes.

- **Campos reales de la API (verificados)**: `radicaciones` devuelve `nombre_lugar` (no `name`); `tipo_pagos` devuelve `titulo` (no `name`); `tipo_expedientes` devuelve `titulo`/`detalles` (no `title`/`description`). Los mapeos en `metadataSyncService.js` fueron corregidos para reflejar esto.

---

## 8. Sync Incremental por Caso — `caseSyncDownService` + `useCaseSyncDown`

> **Introducido en**: rama `dev/improveSync-implementEndpointLastModifiedChanges`

### 8.1 Contexto y problema resuelto

Antes de este rework, al entrar a un caso el detalle se cargaba desde el contexto global (`CasesContext`) y cada sub-recurso (honorarios, gastos, partes, documentos, eventos) hacía su propio fetch completo a la API cada vez que el hook se montaba. No había forma de saber si los datos habían cambiado sin hacer la llamada.

La API ahora expone dos endpoints nuevos que permiten sync inteligente por caso:

- `GET /api/cases/{id}/last-modified` — timestamps de última modificación por entidad
- `GET /api/cases/{id}/syncDown/{date}` — todos los artefactos del caso modificados desde una fecha

El `caseSyncDownService` aprovecha estos endpoints para implementar sync incremental: solo descarga lo que cambió.

---

### 8.2 Flujo de sync al entrar a un caso

```
1. GET /cases/{id}/last-modified → serverTimestamps { partes, gastos, honorarios, documentos, eventos, clientes, multimedia, archivos }
2. Lee case_sync_meta local (SQLite) → localMeta { entity: { last_server } }
3. Clasifica entidades: upToDate[] | stale[] | noCache
   - noCache: ninguna entidad tiene meta local → se usa fecha epoch '2000-01-01 00:00:00'
   - stale: alguna entidad tiene timestamp de servidor más nuevo que el local
   - upToDate: todo coincide → retorna sin hacer ninguna llamada adicional
4. Si hay stale o noCache → GET /cases/{id}/syncDown/{oldestStaleDate}
5. Devuelve los datos al caller INMEDIATAMENTE (no espera la cache)
6. Persiste en SQLite por entidad en background (fire-and-forget, paralelo)
7. Actualiza case_sync_meta con los nuevos timestamps del servidor
```

**Clave**: el frontend nunca espera que la cache termine de escribirse. Los datos llegan del servidor y se pasan directo.

---

### 8.3 Tabla `case_sync_meta` (SQLite)

```sql
CREATE TABLE case_sync_meta (
    suit_case_id INTEGER NOT NULL,
    entity       TEXT NOT NULL,   -- 'partes' | 'gastos' | 'honorarios' | 'documentos' | 'eventos' | 'clientes' | 'multimedia' | 'archivos' | 'case'
    last_sync    TEXT,            -- ISO timestamp local del último sync
    last_server  TEXT,            -- timestamp del servidor (de last-modified)
    PRIMARY KEY (suit_case_id, entity)
);
```

Los IPC channels disponibles para manejarla desde el renderer:

```js
// Leer toda la meta de un caso
const meta = await window.electronAPI.sync.getCaseMeta(caseId);
// Retorna: { partes: { last_sync, last_server }, gastos: {...}, ... }

// Actualizar una entidad
await window.electronAPI.sync.setCaseMeta(caseId, 'honorarios', isoNow, serverTimestamp);

// Actualizar múltiples entidades en una transacción (más eficiente)
await window.electronAPI.sync.setCaseMetaBatch(caseId, [
    { entity: 'partes', lastSync: isoNow, lastServer: serverTs },
    { entity: 'gastos', lastSync: isoNow, lastServer: serverTs },
]);

// Limpiar toda la meta de un caso (ej: al hacer reset de cache)
await window.electronAPI.sync.clearCaseMeta(caseId);
```

---

### 8.4 Uso del hook `useCaseSyncDown`

Este es el punto de entrada para el frontend. Se monta en la página de detalle del caso:

```jsx
import { useCaseSyncDown } from '../hooks/useCaseSyncDown';

function CaseDetail({ caseId }) {
    const { syncing, lastSynced, syncResult, refresh } = useCaseSyncDown(caseId);

    // syncing: true mientras se está ejecutando el sync
    // lastSynced: Date | null — cuándo fue el último sync exitoso
    // syncResult: { changed: boolean, data: Object|null, staleEntities: string[] }
    //   - changed: true si hubo cambios y se ejecutó syncDown
    //   - data: payload completo retornado por el endpoint syncDown (o null si todo estaba al día)
    //   - staleEntities: entidades que estaban desactualizadas
    // refresh: () => void — fuerza una re-sincronización manual
}
```

**¿Qué hace el hook internamente?**
- Al montar (o cambiar `caseId`), llama a `syncCaseDown(caseId)` del servicio.
- Maneja generaciones para evitar race conditions en navegación rápida entre casos.
- Expone `refresh()` para re-sync manual (ej: botón "Actualizar" en la UI).

---

### 8.5 Uso directo del servicio `caseSyncDownService`

Si necesitás llamar al sync desde fuera de un componente React (ej: desde otro servicio):

```js
import { syncCaseDown, clearCaseSyncDownMeta } from '../services/sync/caseSyncDownService';

// Sincronizar un caso
const result = await syncCaseDown(caseId);
// result: { changed: boolean, data: Object|null, staleEntities: string[] }

if (result.changed) {
    // result.data contiene el payload del syncDown:
    // { partes: [...], gastos: [...], honorarios: [...], documentos: [...],
    //   eventos: [...], clientes: [...], multimedia: [...], archivos: [...] }
    // Ojo: los arrays pueden venir vacíos si esa entidad no tuvo cambios recientes.
}

// Limpiar la meta de sync de un caso (ej: al desloguear)
await clearCaseSyncDownMeta(caseId);
```

**Deduplicación automática**: si se llama a `syncCaseDown(42)` dos veces en simultáneo, ambas llamadas reciben la misma Promise. Solo se hace una request al servidor.

---

### 8.6 Qué persiste en SQLite y cómo

Cada entidad del syncDown se mapea a su tabla con su builder correspondiente:

| Entidad en syncDown | Tabla SQLite | Builder |
|---|---|---|
| `partes` | `partes` + pivot `parte_caso` | `buildParteCacheRow` + `buildParteCasoRow` |
| `gastos` | `gasto_suit_cases` | `buildGastoCacheRow` |
| `honorarios` | `honorarios` | `buildHonorarioCacheRow` |
| `documentos` | `documents` | inline (preserva `content` HTML ya cacheado) |
| `eventos` | `events` | inline (idempotente con agendaMonthSync) |
| `clientes` | `clients` | inline (upsert en directorio global) |
| `multimedia` | `multimedia` | `buildMultimediaCacheRow` |
| `archivos` | `files` | `buildFileCacheRow` |

Todos los builders están en `src/services/cache/`. Se pueden importar directamente si necesitás persistir datos manualmente:

```js
import { buildHonorarioCacheRow } from '../services/cache/honorarioCacheRow';
import { buildGastoCacheRow } from '../services/cache/gastoCacheRow';
import { buildEntregaCacheRow } from '../services/cache/entregaCacheRow';
import { buildParteCacheRow, buildParteCasoRow } from '../services/cache/parteCasoRow';
import { buildMultimediaCacheRow } from '../services/cache/multimediaCacheRow';
import { buildFileCacheRow } from '../services/cache/fileCacheRow';
```

---

## 9. Multimedia y Archivos Generales

### 9.1 Estructura SQLite

```sql
-- Multimedia (imágenes y videos)
CREATE TABLE multimedia (
    id           INTEGER PRIMARY KEY,
    suit_case_id INTEGER,
    filename     TEXT,
    mime_type    TEXT,
    size         INTEGER,
    deleted_at   TEXT,   -- null si activo, ISO string si borrado lógico
    updated_at   TEXT,
    data_json    TEXT,   -- objeto completo de la API
    synced_at    TEXT
);

-- Files (PDF, Excel, Word, CSV)
CREATE TABLE files (
    id           INTEGER PRIMARY KEY,
    suit_case_id INTEGER,
    filename     TEXT,
    mime_type    TEXT,
    size         INTEGER,
    deleted_at   TEXT,
    updated_at   TEXT,
    data_json    TEXT,
    synced_at    TEXT
);
```

**Importante**: estas tablas almacenan **solo metadatos**. El contenido binario no se cachea localmente; se descarga on-demand desde la API cada vez que se necesita.

---

### 9.2 Contextos React

```jsx
import { useMultimedia } from '../context/MultimediaContext';
import { useFiles } from '../context/FilesContext';

// Acceso al listado cacheado de metadatos
const { multimedia, syncing, initialized, refreshData } = useMultimedia();
const { files, syncing, initialized, refreshData } = useFiles();

// multimedia: Array<{ id, suit_case_id, filename, mime_type, size, deleted_at, data_json, ... }>
// files: Array<{ id, suit_case_id, filename, mime_type, size, deleted_at, data_json, ... }>

// Filtrar por caso si es necesario
const caseMultimedia = multimedia.filter(m => m.suit_case_id === caseId && !m.deleted_at);
const caseFiles = files.filter(f => f.suit_case_id === caseId && !f.deleted_at);
```

Los providers están en `AppProviders.jsx` como `MultimediaProvider` y `FilesProvider`. Se sincronizan automáticamente al iniciar sesión igual que el resto de los recursos globales.

---

### 9.3 Upload de archivos

```js
import { uploadMultimedia } from '../services/multimediaService';
import { uploadFile } from '../services/fileService';

// Desde un input de tipo file:
// <input type="file" accept="image/*,video/*" onChange={handleFile} />
async function handleMultimediaUpload(file, caseId) {
    const result = await uploadMultimedia(file, caseId);
    // result: { ok: boolean, status: number, data: { id, filename, mime_type, ... } }
    if (result.ok) {
        // El contexto global se refresca con refreshData() o al próximo mount
        await refreshData(); // del useMultimedia hook
    }
}

// Archivos generales (PDF, Excel, Word, CSV)
async function handleFileUpload(file, caseId) {
    const result = await uploadFile(file, caseId);
    if (result.ok) {
        await refreshData(); // del useFiles hook
    }
}
```

El upload usa `FormData` bajo el hood; `httpTransport` ya sabe serializarla para IPC.

---

### 9.4 Descarga de archivos (contenido binario)

La descarga retorna el contenido binario descifrado como un objeto `{ bytes, mimeType, size }`. Hay dos casos de uso:

**A. Guardar en disco (dialog nativo):**

```js
import { downloadMultimedia } from '../services/multimediaService';
import { downloadFile } from '../services/fileService';

async function handleDownload(item, isMultimedia = true) {
    const result = isMultimedia
        ? await downloadMultimedia(item.id)
        : await downloadFile(item.id);

    if (!result.ok) {
        // mostrar error
        return;
    }

    // Abre el dialog nativo de "Guardar como..." y escribe a disco
    const saveResult = await window.electronAPI.dialog.saveFile({
        defaultName: item.filename || 'archivo',
        bytes: result.data.bytes,       // Array<number>
        mimeType: result.data.mimeType,
    });

    if (saveResult.saved) {
        console.log('Guardado en:', saveResult.filePath);
    }
}
```

**B. Mostrar en memoria (preview en el renderer):**

```js
async function getPreviewUrl(multimediaId) {
    const result = await downloadMultimedia(multimediaId);
    if (!result.ok) return null;

    // Reconstruir Blob desde el array de bytes
    const uint8 = new Uint8Array(result.data.bytes);
    const blob = new Blob([uint8], { type: result.data.mimeType });
    return URL.createObjectURL(blob);
    // Usar la URL en <img src={url} /> o <video src={url} />
    // Acordarse de revocarla con URL.revokeObjectURL(url) al desmontar
}
```

---

### 9.5 Borrado lógico

```js
import { deleteMultimedia } from '../services/multimediaService';
import { deleteFile } from '../services/fileService';

// Ambas retornan { ok: boolean, status: number }
await deleteMultimedia(id);
await deleteFile(id);

// Los registros borrados tienen deleted_at != null en cache.
// Filtrar siempre por !deleted_at en la UI para no mostrarlos.
```

---

### 9.6 Sincronización incremental de multimedia/files por caso

Los cambios en multimedia y files de un caso específico se detectan automáticamente por el `caseSyncDownService` al entrar al caso. No hace falta hacer nada extra; si el servidor reporta cambios en `multimedia` o `archivos` en el `last-modified` del caso, el syncDown los trae y actualiza la cache.

Para reflejar estos cambios en los contextos globales (`MultimediaContext`, `FilesContext`), llamar a `refreshData()` después de que `useCaseSyncDown` indique que hubo cambios:

```jsx
const { syncResult } = useCaseSyncDown(caseId);
const { refreshData: refreshMultimedia } = useMultimedia();
const { refreshData: refreshFiles } = useFiles();

useEffect(() => {
    if (syncResult?.changed) {
        const hasMultimediaChanges = syncResult.staleEntities.includes('multimedia');
        const hasFilesChanges = syncResult.staleEntities.includes('archivos');
        if (hasMultimediaChanges) void refreshMultimedia();
        if (hasFilesChanges) void refreshFiles();
    }
}, [syncResult]);
```

---

## 10. Nuevos Canales IPC (Resumen)

Todos disponibles en `window.electronAPI` desde el renderer:

| Canal | Namespace | Firma | Descripción |
|---|---|---|---|
| `sync:getCaseMeta` | `sync.getCaseMeta` | `(caseId)` → `Object` | Lee timestamps per-entity de un caso |
| `sync:setCaseMeta` | `sync.setCaseMeta` | `(caseId, entity, lastSync, lastServer)` | Upsert de un timestamp |
| `sync:setCaseMetaBatch` | `sync.setCaseMetaBatch` | `(caseId, entries[])` | Upsert batch en transacción |
| `sync:clearCaseMeta` | `sync.clearCaseMeta` | `(caseId)` | Limpia toda la meta de un caso |
| `dialog:saveFile` | `dialog.saveFile` | `({ defaultName, bytes, mimeType })` → `{ saved, filePath }` | Dialog nativo "Guardar como" + escribe binario a disco |

Los canales `sync:getCaseMeta` etc. ya estaban expuestos por `preload.cjs` en el namespace `sync:`. El canal `dialog.saveFile` se agregó al namespace `dialog:` junto al existente `dialog.openImage`.

---

## 11. Notas para el Agente de Frontend

- **`useCaseSyncDown(caseId)`** es el hook que dispara el sync al entrar al caso. Montarlo en `CaseDetail.jsx` y exponer `syncResult` a los tabs/secciones que necesiten saber si hubo cambios.

- **Los hooks de sub-recursos** (`useHonorarios`, `useGastosCaso`, `usePartesCaso`, `useEntregas`) **siguen funcionando igual que antes**. El sync incremental corre en paralelo; los hooks leen de cache y luego sincronizan desde la API independientemente. En el futuro se puede optimizar pasándoles `skipApiSync: true` cuando el caseSyncDown ya corrió, pero por ahora la lógica es independiente.

- **Los builders de cache están en `src/services/cache/`**. Si necesitás persistir datos manualmente (ej: al crear un nuevo honorario desde la UI y querer actualizar la cache sin esperar el próximo sync), importar el builder y llamar a `window.electronAPI.db.upsertMany('honorarios', [buildHonorarioCacheRow(newHonorario)])`.

- **Para multimedia/files, NO cachear el contenido binario**. Solo los metadatos van a SQLite. El binario se descarga siempre on-demand con `downloadMultimedia(id)` o `downloadFile(id)`. Construir un `Blob` + `URL.createObjectURL` para preview, o usar `dialog.saveFile` para guardar a disco.

- **`deleted_at` en multimedia/files**: los registros con soft delete tienen `deleted_at` poblado. Siempre filtrar `!item.deleted_at` antes de mostrar en la UI.

- **`syncResult.data`** contiene el payload completo del syncDown (arrays por entidad). Si querés mostrar "nuevo contenido disponible" antes de que el hook de sub-recursos se re-sincronice, podés leer directamente de `syncResult.data.honorarios`, `syncResult.data.multimedia`, etc. Sin embargo, los arrays pueden estar vacíos si esa entidad no cambió — no asumir que un array vacío significa "no hay datos", significa "no hubo cambios en esa entidad desde el último sync".

---

## 12. Biblioteca de Archivos Públicos (Biblio)

> **Introducido en**: rama `dev/repoPublicoDocs`

La Biblioteca es un repositorio público de documentos accesible a **todos** los usuarios. Los archivos se agrupan en Catálogos. El catálogo **"General"** está protegido: no se puede editar ni eliminar.

### 12.1 Reglas de Negocio

| Acción | Quién puede |
|--------|-------------|
| Ver archivos | Todos |
| Subir archivos | Todos |
| Renombrar / mover catálogo | Dueño, Admin, o usuario con `can_update = true` |
| Eliminar | Dueño, Admin, o usuario con `can_delete = true` |
| Gestionar permisos | Solo dueño o Admin |
| Crear / editar / eliminar catálogo | Solo Admin (nunca "General") |

### 12.2 Flujo de Cache y Sincronización

El frontend **no** llama a la API directamente para leer datos. Todo pasa por los contextos.

**Escenario A — Cache vacío:**
```
1. Sync: fetch paginado catalog-por-catalog → GET /api/public-file-catalogs/{id}/public-files
2. Cache: todos los metadatos se guardan en SQLite (sin bytes binarios)
3. UI: getFilesForCatalog() retorna datos inmediatamente
```

**Escenario B — Cache poblado:**
```
1. UI: getFilesForCatalog() retorna datos de SQLite al instante
2. Sync BG: GET /api/public-files/last-modified
   - null → no hay archivos, nada que hacer
   - up-to-date → se salta el fetch
   - hay novedades → GET /api/public-files/sync?last_sync={timestamp}
3. Cache: upsert de nuevos/modificados; DELETE de registros con deleted_at != null
4. UI: re-render automático
```

### 12.3 Contextos

#### `usePublicFileCatalogs`

```jsx
import { usePublicFileCatalogs } from '../context/PublicFileCatalogsContext';

const { public_file_catalogs, syncing, initialized, refreshPublicFileCatalogs } = usePublicFileCatalogs();
```

`public_file_catalogs` es un `Array` con estructura:
```js
{ id, name, description, created_at, updated_at }
```

#### `usePublicFiles`

```jsx
import { usePublicFiles } from '../context/PublicFilesContext';

const {
  getFilesForCatalog,   // función de paginación en memoria
  syncing,
  initialized,
  refreshData,
  uploadFile,
  renameFile,
  deleteFile,
  downloadFile,
  getPermissions,
  setPermissions,
  revokePermission,
} = usePublicFiles();
```

### 12.4 Paginación — `getFilesForCatalog()`

El frontend le dice al backend cuántos archivos pintar y en qué página. No hay llamadas a red.

```js
const { data, total, totalPages, page } = getFilesForCatalog(catalogId, page, perPage);
// catalogId: number | null (null = todos los archivos)
// page: number, default 1
// perPage: number, default 15
```

Estructura de un archivo en `data`:
```js
{
  id, uuid, user_id, public_file_catalog_id,
  name, path, mime_type, size, hash,
  created_at, updated_at, deleted_at  // null = activo
}
```

### 12.5 Mutaciones

```js
// Subir archivo (FormData con campo `file` obligatorio)
const formData = new FormData();
formData.append('file', fileObject);
formData.append('public_file_catalog_id', '2'); // opcional
const result = await uploadFile(formData);

// Renombrar / mover de catálogo
await renameFile(id, 'Nuevo nombre.pdf');              // solo nombre
await renameFile(id, 'Nuevo nombre.pdf', catalogId);   // nombre + catálogo

// Eliminar (soft delete)
await deleteFile(id);
```

Errores comunes en mutaciones de archivos:
- `result.status === 403` → sin permiso (`can_update = false` o `can_delete = false`)
- `result.status === 404` → archivo no existe

### 12.6 Descarga de Archivos

La descarga se maneja en el proceso principal de Electron para no pasar binarios grandes (hasta 100 MB) por IPC dos veces.

```js
const result = await downloadFile(fileId, file.name);
if (result.saved) {
  // Guardado en result.filePath
} else {
  // Usuario canceló, o result.error contiene el mensaje
}
```

### 12.7 Permisos (on-demand)

Los permisos NO se cachean. Se consultan cuando el dueño abre el panel de gestión.

```js
// Consultar (solo dueño o admin)
const permissions = await getPermissions(fileId);
// [{ public_file_id, user_id, can_update, can_delete, user: { id, name, last_name, tag } }]

// Otorgar/actualizar
await setPermissions(fileId, { user_id: 2, can_update: true, can_delete: false });

// Revocar completamente
await revokePermission(fileId, userId);
```

### 12.8 Gestión de Catálogos (solo Admin)

Las mutaciones se hacen directo al servicio; luego llamar `refreshPublicFileCatalogs()`:

```js
import { createCatalog, updateCatalog, deleteCatalog } from '../services/publicFileCatalogService';

await createCatalog({ name: 'Acuerdos', description: 'Opcional' });
await updateCatalog(id, { name: 'Acuerdos (actualizado)' });
await deleteCatalog(id); // los archivos pasan a "General"

// Actualizar cache:
refreshPublicFileCatalogs();
```

Errores:
- `403` → no es Admin, o se intentó modificar "General"
- `422` → nombre duplicado

### 12.9 Tablas SQLite (migración v19)

```sql
-- Catálogos
public_file_catalogs (id PK, name, description, created_at, updated_at, synced_at)

-- Metadatos de archivos (sin binarios)
public_files (id PK, uuid, user_id, public_file_catalog_id, name, path,
              mime_type, size, hash, created_at, updated_at, deleted_at, synced_at)

-- Permisos granulares (no se sincronizan al cache, solo se guardan on-demand si se necesita)
public_file_permissions (public_file_id PK, user_id PK, can_update INT, can_delete INT,
                          created_at, updated_at)
```

### 12.10 Canal IPC nuevo

| Canal | Namespace | Firma | Descripción |
|-------|-----------|-------|-------------|
| `publicFiles:download` | `publicFiles.download` | `(fileId, suggestedName)` → `{ saved, filePath?, error? }` | Descarga binario y guarda en disco vía diálogo nativo |
