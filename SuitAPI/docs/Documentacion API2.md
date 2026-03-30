# Documentación de API - SuitAPI (Parte 1 y 2)

Esta documentación cubre las rutas esenciales de la API de SuitAPI, incluyendo autenticación, caché, casos, documentos, clientes y archivos públicos.

---

# 1. Documentos

## Índice de Seccion Documentos

1.1. [Listar Documentos](#1.1.-listar-documentos) - `GET /api/documents`
1.2. [Obtener Total de Páginas de Documentos](#1.2.-obtener-total-de-paginas-de-documentos) - `GET /api/documents/total-pages`
1.3. [Obtener Total de Páginas de Documentos con Filtros](#1.3.-obtener-total-de-paginas-de-documentos-con-filtros) - `GET /api/documents/total-pages-filtered`
1.4. [Buscar Documentos](#1.4.-buscar-documentos) - `GET /api/documents/search`
1.5. [Listar Documentos con Filtros (Paginado)](#1.5.-listar-documentos-con-filtros-(paginado)) - `GET /api/documents/paged-filtered`
1.6. [Crear un Documento](#1.6.-crear-un-documento) - `POST /api/documents`
1.7. [Obtener Contenido de un Documento](#1.7.-obtener-contenido-de-un-documento) - `GET /api/documents/{document}`
1.8. [Actualizar Contenido de un Documento (Nueva Versión)](#1.8.-actualizar-contenido-de-un-documento-nueva-versión) - `PUT /api/documents/{document}`
1.9. [Actualizar Nombre de un Documento](#1.9.-actualizar-nombre-de-un-documento) - `PATCH /api/documents/{document}/name`
1.10. [Actualizar Solo el Estado de un Documento](#1.10.-actualizar-solo-el-estado-de-un-documento) - `PATCH /api/documents/{document}/status`
1.11. [Versiones de un Documento](#1.11.-versiones-de-un-documento) - `GET /api/documents/{document}/versions`
1.12. [Obtener Contenido de una Versión Específica](#1.12.-obtener-contenido-de-una-versión-específica) - `GET /api/documents/{document}/versions/{versionNumber}`
1.13. [Verificar si un Documento está Bloqueado](#1.13.-verificar-si-un-documento-esta-bloqueado) - `GET /api/documents/{document}/is-locked`
1.14. [Bloquear Documento para Edición](#1.14.-bloquear-documento-para-edicion) - `POST /api/documents/{document}/lock`
1.15. [Desbloquear Documento](#1.15.-desbloquear-documento) - `POST /api/documents/{document}/unlock`
1.16. [Sincronización Descendente de Documentos](#1.16.-sincronizacion-descendente-de-documentos) - `GET /api/documents/sync?since={timestamp}`
1.17. [Sincronización Ascendente de Documentos](#1.17.-sincronizacion-ascendente-de-documentos) - `POST /api/documents/sync`
1.18. [Última Modificación Global de Documentos](#1.18.-ultima-modificacion-global-de-documentos) - `GET /api/documents/last-modified`
1.19. [Última Modificación de Documento Específico](#1.19.-ultima-modificacion-de-documento-especifico) - `GET /api/documents/{document}/last-modified`

---

## 1.1. Listar Documentos
`GET /api/documents`

Lista los documentos accesibles para el usuario (paginado, 40 por página). Incluye la última versión y el usuario que tiene el bloqueo activo si lo hay. Soporta ordenamiento personalizado.

- **Query Params:**
  - `sort_by` (string, opcional): Campo por el cual ordenar. Valores permitidos: `updated_at`, `created_at`, `name`. Por defecto `updated_at`.
  - `sort_direction` (string, opcional): Dirección del ordenamiento. Valores permitidos: `asc`, `desc`. Por defecto `desc`.

---

## 1.2. Obtener Total de Páginas de Documentos
`GET /api/documents/total-pages`

Retorna el conteo total de documentos accesibles sin ningún filtro adicional.

---

## 1.3. Obtener Total de Páginas de Documentos con Filtros
`GET /api/documents/total-pages-filtered`

Retorna el conteo total de documentos que cumplen con los criterios de filtrado seleccionados. Útil para calcular la paginación dinámica en el cliente.

- **Query Params:**
  - `byUser`, `client`, `state`, `suit_case_id` (mismos filtros que en la búsqueda).

**Respuesta Exitosa (200 OK):**
```json
{
  "total_documents": 45,
  "per_page": 15,
  "total_pages": 3
}
```

---

## 1.4. Buscar Documentos
`GET /api/documents/search`

Busca documentos que coincidan con un término de búsqueda en el nombre. Retorna los primeros 10 resultados. Incluye filtros opcionales y ordenamiento.

- **Query Params:**
  - `search` (string, opcional): Término de búsqueda para el nombre del documento.
  - `byUser` (integer, opcional): Filtra por `user_id`. **Solo disponible para administradores.**
  - `client` (integer, opcional): Filtra documentos asociados a un cliente específico.
  - `state` (string, opcional): Filtra por estado (`Borrador`, `Firmado`, `Presentado`).
  - `suit_case_id` (integer, opcional): Filtra por el ID del caso.
  - `sort_by` (string, opcional): `updated_at`, `created_at` o `name`. Por defecto `updated_at`.
  - `sort_direction` (string, opcional): `asc` o `desc`. Por defecto `desc`.

**Respuesta Exitosa (200 OK):**
Lista de hasta 10 objetos `Document`.

---

## 1.5. Listar Documentos con Filtros (Paginado)
`GET /api/documents/paged-filtered`

Lista los documentos accesibles aplicando los mismos filtros que el endpoint de búsqueda, pero con soporte para paginación estándar (40 por página) y ordenamiento.

- **Query Params:**
  - `page` (integer, opcional): Número de página.
  - `byUser` (integer, opcional): **Solo para administradores.**
  - `client` (integer, opcional): ID del cliente.
  - `state` (string, opcional): Estado del documento.
  - `suit_case_id` (integer, opcional): ID del caso.
  - `sort_by` (string, opcional): Campo de ordenamiento (`updated_at`, `created_at`, `name`).
  - `sort_direction` (string, opcional): Dirección (`asc`, `desc`).

**Respuesta Exitosa (200 OK):**
Objeto de paginación de Laravel conteniendo la lista de documentos.

---

## 1.6. Crear un Documento
`POST /api/documents`

Crea un nuevo documento con su primera versión (v1). El contenido se recibe como HTML puro, se encripta con AES-256-CBC y se almacena en el filesystem. En base de datos queda registrada la versión con el path al archivo encriptado.

> **Importante:** El contenido ya no se envía como archivo multipart. Se envía como campo de texto `content` en un body JSON estándar.

- **Body (JSON):**
  - `name` (string, requerido): Nombre del documento.
  - `content` (string, requerido): Contenido HTML del documento. Se almacena encriptado.
  - `suit_case_id` (integer, opcional): ID del caso asociado.
  - `event_id` (integer, opcional): ID del evento asociado.
  - `status` (string, opcional): `Borrador`, `Firmado` o `Presentado`. Por defecto `Borrador`.

**Ejemplo de uso:**
```json
{
  "name": "Escrito inicial",
  "content": "<h1 style=\"margin: 2cm;\">Escrito de inicio...</h1><p>Contenido del documento</p>",
  "suit_case_id": 1
}
```

**Respuesta Exitosa (201 Created):**
```json
{
  "id": 42,
  "name": "Escrito inicial",
  "status": "Borrador",
  "suit_case_id": 1,
  "user_id": 1,
  "latest_version": {
    "id": 100,
    "version_number": 1,
    "mime_type": "text/html",
    "size": 1024,
    "created_at": "2026-03-25T18:00:00.000000Z"
  },
  "created_at": "2026-03-25T18:00:00.000000Z",
  "updated_at": "2026-03-25T18:00:00.000000Z"
}
```

---

## 1.7. Obtener Contenido de un Documento
`GET /api/documents/{document}`

Descarga el contenido desencriptado de la **última versión** del documento. La respuesta no es JSON — es el contenido crudo del documento con su Content-Type correspondiente (`text/html`).

El cliente debe renderizar directamente la respuesta recibida. Todos los márgenes, estilos y estructura HTML que se enviaron en el `POST`/`PUT` se preservan sin modificaciones.

**Respuesta Exitosa (200 OK):**
```
Content-Type: text/html
Content-Disposition: attachment; filename=\"Escrito inicial.html\"

<h1 style=\"margin: 2cm;\">Escrito de inicio...</h1><p>Contenido del documento</p>
```

---

## 1.8. Actualizar Contenido de un Documento (Nueva Versión)
`PUT /api/documents/{document}`

Actualiza el contenido de un documento existente, creando siempre una **nueva versión**. La versión anterior se conserva en el historial.

Este endpoint utiliza un sistema de bloqueo a nivel de base de datos para prevenir ediciones concurrentes.

- **Body (JSON):**
  - `content` (string, requerido): Nuevo contenido HTML para la nueva versión.

**Ejemplo:**
```json
{
  "content": "<h1>Versión 2 del escrito</h1><p>Contenido actualizado</p>"
}
```

**Respuesta Exitosa (201 Created):**
Retorna el objeto de la nueva `DocumentVersion` creada, con el creador cargado.
```json
{
  "id": 101,
  "document_id": 42,
  "version_number": 2,
  "mime_type": "text/html",
  "size": 1200,
  "created_by": 1,
  "created_at": "2026-03-25T18:05:00.000000Z"
}
```

---

## 1.9. Actualizar Nombre de un Documento
`PATCH /api/documents/{document}/name`

Actualiza el nombre de un documento. Este endpoint solo debe funcionar si el documento no está bloqueado. Esta operación no crea una nueva versión.

- **Body (JSON):**
  - `name` (string, requerido): Nuevo nombre para el documento.

**Respuesta Exitosa (200 OK):**
Retorna el documento completo con su `latestVersion` y el `locker`.

---

## 1.10. Actualizar Solo el Estado de un Documento
`PATCH /api/documents/{document}/status`

Atajo para cambiar únicamente el estado de un documento sin crear una versión nueva.

- **Body (JSON):**
  - `status` (string, requerido): `Borrador`, `Firmado` o `Presentado`.

**Respuesta Exitosa (200 OK):**
Retorna el documento con `latestVersion.creator` y `locker`.

---

## 1.11. Versiones de un Documento
`GET /api/documents/{document}/versions`

Lista el historial completo de versiones de un documento, ordenadas de la más reciente a la más antigua. Cada versión incluye quién la creó y cuándo.

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 101,
    "document_id": 42,
    "version_number": 2,
    "mime_type": "text/html",
    "size": 1200,
    "creator": { "id": 1, "name": "Juan Pérez" },
    "created_at": "2026-03-25T18:05:00.000000Z"
  },
  {
    "id": 100,
    "document_id": 42,
    "version_number": 1,
    "mime_type": "text/html",
    "size": 1024,
    "creator": { "id": 1, "name": "Juan Pérez" },
    "created_at": "2026-03-25T18:00:00.000000Z"
  }
]
```

---

## 1.12. Obtener Contenido de una Versión Específica
`GET /api/documents/{document}/versions/{versionNumber}`

Descarga el contenido desencriptado de una versión específica del documento mediante su número de versión. La respuesta es el contenido crudo (HTML).

- **Parámetros de ruta:**
  - `document`: ID del documento.
  - `versionNumber`: Número de la versión a recuperar (ej. 1, 2, 3).

**Respuesta Exitosa (200 OK):**
```
Content-Type: text/html
Content-Disposition: inline; filename=\"Nombre del Documento.html\"

<h1>Contenido de la versión solicitada</h1>...
```

---

## 1.13. Verificar si un Documento está Bloqueado
`GET /api/documents/{document}/is-locked`

Indica si un documento se encuentra actualmente bajo edición por algún usuario.

**Respuesta Exitosa (200 OK):**
```json
{
  "is_locked": true
}
```

---

## 1.14. Bloquear Documento para Edición
`POST /api/documents/{document}/lock`

Adquiere un bloqueo exclusivo sobre un documento por un periodo de 5 minutos, evitando conflictos de edición concurrente.

---

## 1.15. Desbloquear Documento
`POST /api/documents/{document}/unlock`

Libera el bloqueo de un documento antes de que expire el tiempo de gracia.

---

## 1.16. Sincronización Descendente de Documentos
`GET /api/documents/sync?since={timestamp}`

Obtiene todos los documentos accesibles por el usuario que hayan sido creados o modificados después del timestamp. Incluye información de bloqueos (`locker`) y la última versión disponible.

---

## 1.17. Sincronización Ascendente de Documentos
`POST /api/documents/sync`

Permite subir ediciones de documentos realizadas offline. Las ediciones se guardan como **nuevas versiones** del documento original si no hay conflictos. El mismo mecanismo de encriptación/almacenamiento que usa `POST /api/documents` se aplica aquí.

- **Body (JSON):**
  - `documents` (array, requerido): Lista de objetos de documento. Cada objeto puede tener:
    - `id` (integer, opcional): Si se incluye, se actualiza el documento existente creando una nueva versión.
    - `name` (string, requerido): Nombre del documento.
    - `content` (string, requerido): Contenido HTML del documento.
    - `last_updated_at` (ISO8601 date, opcional): Para detección de conflictos.
    - `suit_case_id` (integer, requerido solo si es creación sin `id`).

**Respuesta Exitosa (200 OK):**
```json
{
  "synced": [
    { "id": 42, "name": "Escrito actualizado", "latest_version": { "version_number": 2 } }
  ],
  "conflicts": []
}
```
El campo `conflicts` indica conflictos de concurrencia, pero actualmente ya no se utiliza para documentos, ya que el sistema de versiones maneja los cambios de forma diferente. La respuesta siempre retornará un array vacío de `conflicts` para los documentos.

---

## 1.18. Última Modificación Global de Documentos
`GET /api/documents/last-modified`

Indica cuándo se modificó/creó por última vez un documento accesible para el usuario.

**Respuesta Exitosa (200 OK):**
```json
{
  "last_modified": "2026-03-21T16:20:00.000000Z"
}
```

---

## 1.19. Última Modificación de Documento Específico
`GET /api/documents/{document}/last-modified`

Retorna el timestamp de actualización de un documento mediante su ID.

---

# 2. Plantillas

## Índice de Sección Plantillas

2.1. [Listar Plantillas (Paginado)](#2.1.-listar-plantillas-(paginado)) - `GET /api/templates`
2.2. [Buscar Plantillas (Paginado)](#2.2.-buscar-plantillas-(paginado)) - `GET /api/templates/search`
2.3. [Listar Plantillas por Categoría](#2.3.-listar-plantillas-por-categoría) - `GET /api/template-categories/{id}/templates-list`
2.4. [Crear una Plantilla](#2.4.-crear-una-plantilla) - `POST /api/templates`
2.5. [Ver Detalle de una Plantilla](#2.5.-ver-detalle-de-una-plantilla) - `GET /api/templates/{template}`
2.6. [Actualizar una Plantilla](#2.6.-actualizar-una-plantilla) - `PUT /api/templates/{template}`
2.7. [Eliminar una Plantilla](#2.7.-eliminar-una-plantilla) - `DELETE /api/templates/{template}`
2.8. [Listar Categorías de Plantillas](#2.8.-listar-categorías-de-plantillas) - `GET /api/template-categories`
2.9. [Listado de Requisitos](#2.9.-listado-de-requisitos) - `GET /api/requisitos`
2.10. [Sincronización de Plantillas (Sync Down/Up)](#2.10.-sincronización-de-plantillas-(sync-down/up))
2.11. [Última Modificación Global](#2.11.-última-modificación-global)

---

## 2.1. Listar Plantillas (Paginado)
`GET /api/templates`

Retorna una lista paginada (40 por página) de plantillas de forma "lightweight" (solo `id`, `title` y `template_category_id`), ordenadas por las más recientes primero. Esto es ideal para mostrar un catálogo sin sobrecargar la red con el contenido HTML de cada plantilla.

---

## 2.2. Buscar Plantillas (Paginado)
`GET /api/templates/search`

Busca plantillas que coincidan con un término de búsqueda en el título o contenido. Retorna una lista paginada de 10 resultados por página, ordenados por las más recientes primero.

- **Query Params:**
  - `q` (string, requerido): Término de búsqueda (mínimo 1 carácter).

**Respuesta Exitosa (200 OK):**
Objeto de paginación de Laravel conteniendo la lista de plantillas en formato "lightweight".

- **Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Escrito de Inicio",
      "template_category_id": 2
    },
    {
      "id": 2,
      "title": "Contrato de Locación",
      "template_category_id": 1
    }
  ],
  "links": { "first": "...", "last": "...", "prev": null, "next": "..." },
  "meta": { "current_page": 1, "from": 1, "last_page": 1, "per_page": 40, "to": 2, "total": 2 }
}
```

---

## 2.2. Listar Plantillas por Categoría
`GET /api/template-categories/{id}/templates-list`

Idéntico al listado general pero filtrado por una categoría específica. Retorna los objetos en formato "lightweight".

---

## 2.3. Crear una Plantilla
`POST /api/templates`

Crea una nueva plantilla de documento, opcionalmente asociando requisitos de autocompletado.

- **Body (JSON):**
  - `title` (string, requerido): Título de la plantilla.
  - `content` (string, requerido): Contenido HTML con placeholders (si aplica).
  - `template_category_id` (integer, opcional): ID de la categoría. Si se omite, se asigna a la categoría por defecto.
  - `requirements` (array, opcional): Lista de requisitos.
    - `id_requisito` (integer, requerido): ID del requisito (ver 2.8).
    - `id_campo` (integer, requerido): ID del campo en el editor/frontend.
    - `NEntidad` (integer, requerido): Índice de entidad (ej: 1 para primer cliente, 2 para segundo).
    - `note` (string, opcional): Nota aclaratoria.

**Ejemplo de uso:**
```json
{
  "title": "Cédula de Notificación",
  "content": "<h1>Notificación...</h1><p>Se notifica a {{clientCompleteName}}...</p>",
  "template_category_id": null,
  "requirements": [
    {
      "id_requisito": 14,
      "id_campo": 105,
      "NEntidad": 1,
      "note": "Nombre del cliente principal"
    }
  ]
}
```

---

## 2.4. Ver Detalle de una Plantilla
`GET /api/templates/{template}`

Retorna el objeto completo de la plantilla, incluyendo el campo `content` (HTML) y sus `requirements` cargados.

**Respuesta Exitosa (200 OK):**
```json
{
  "id": 1,
  "title": "Cédula de Notificación",
  "content": "<h1>Notificación...</h1><p>Se notifica a {{clientCompleteName}}...</p>",
  "template_category_id": 1,
  "category": { "id": 1, "name": "General" },
  "requirements": [ { "id": 14, "name": "clientCompleteName", "pivot": { "id_campo": 105, "NEntidad": 1 } } ],
  "created_at": "...",
  "updated_at": "..."
}
```

---

## 2.5. Actualizar una Plantilla
`PUT /api/templates/{template}`

Actualiza los datos de una plantilla. Incluye soporte para detección de conflictos mediante `last_updated_at`.

- **Body:** Los mismos campos que en la creación (opcionales).
- **Control de Conflictos:** Si se envía `last_updated_at` y el registro fue modificado posteriormente en el servidor, retornará un error `409 Conflict`.

---

## 2.6. Eliminar una Plantilla
`DELETE /api/templates/{template}`

Realiza la eliminación física de la plantilla y registra un **Tombstone** para la sincronización offline.

---

## 2.7. Listar Categorías de Plantillas
`GET /api/template-categories`

Retorna el catálogo completo de categorías disponibles para organizar plantillas de documentos.

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Contratos",
      "templates_count": 5
    },
    {
      "id": 2,
      "name": "Escritos Judiciales",
      "templates_count": 12
    }
  ]
}
```

---

## 2.8. Listado de Requisitos
`GET /api/requisitos`

Retorna todos los campos de requerimiento (requisitos) definidos para ser usados en plantillas.

- **Tipos de Requisitos Disponibles:**
    - **Generales:** `role`, `text`, `number`, `date`, `dateTime`.
    - **Caso:** `caseTitle`, `caseNumber`, `caseType`, `caseExpedientType`, `radicacion`, `jurisdiccion`, `competencia`, `dependencia`, `caseStartDate`, `caseEndDate`.
    - **Cliente:** `clientCompleteName`, `clientFirstName`, `clientLastName`, `clientIdentification`, `clientAddress`, `clientEmail`, `clientPhone`.
    - **Abogado:** `userCompleteName`, `userName`, `userLastName`, `userEmail`, `userRegistration`, `userCuit`.
    - **Otros:** `amount`, `paymentType`, `city`, `province`, `address`, `anioNombrado`, `mesNombrado`, `diaNombrado`, `anioNumero`, `mesNumero`, `diaNumero`, `fechaConMesNombrado`, `eventType`, `eventName`, `eventDate`, `custom`.

---

## 2.9. Sincronización de Plantillas (Sync Down/Up)

### Sincronización Descendente (Sync Down)
- `GET /api/templates/sync?since={timestamp}`
- `GET /api/template-categories/sync?since={timestamp}`

Retornan los registros modificados después del timestamp, incluyendo una lista de `deleted_ids` extraídos de los Tombstones para que el cliente limpie su caché local.

### Sincronización Ascendente (Sync Up)
- `POST /api/templates/sync`: Envía un array de `templates` para creación/actualización masiva.
- `POST /api/template-categories/sync`: Envía un array de `categories` para creación/actualización masiva.

---

## 2.10. Última Modificación Global
- `GET /api/templates/last-modified`
- `GET /api/template-categories/last-modified`

Retornan el timestamp de la última modificación en sus respectivas tablas. Útil para invalidación de caché.


---

# 3. Bitácora (Activity Log)

## Índice de Sección Bitácora

3.1. [Consultar Bitácora](#3.1.-consultar-bitácora) - `GET /api/bitacora`
3.2. [Limpiar Toda la Bitácora](#3.2.-limpiar-toda-la-bitácora) - `DELETE /api/bitacora/clear`
3.3. [Mantenimiento de Bitácora](#3.3.-mantenimiento-de-bitácora) - `DELETE /api/bitacora/cleanup`

---

## 3.1. Consultar Bitácora
`GET /api/bitacora`

Retorna un listado paginado (30 registros) de los movimientos realizados. **Solo accesible para administradores.**

- **Query Params:**
  - `entity_type` (string, opcional): Filtra por el tipo de entidad afectada.
  - `sort` (string, opcional): `newest` (por defecto) o `oldest`.
  - `page` (integer, opcional): Número de página.

**Mapeo de `entityType`:**

| entityType | Descripción |
| :--- | :--- |
| `case` | Expediente / Caso |
| `client` | Cliente |
| `document` | Documento |
| `agenda` | Agenda |
| `event` | Evento |
| `user` | Usuario |
| `multimedia` | Archivo Multimedia |
| `file` | Archivo de Caso |
| `role` | Rol de Usuario |
| `jurisdiction` | Jurisdicción |
| `competency` | Competencia |
| `judicial_dependency` | Dependencia Judicial |
| `tax` | Gasto / Tasa |
| `fee` | Honorario |
| `delivery` | Entrega de Pago |
| `radicacion` | Sede Judicial / Radicación |
| `tombstone` | Registro de eliminación (Tombstone) |

**Acciones registradas:**

| Acción | Descripción |
| :--- | :--- |
| `created` | Creación de una entidad. |
| `updated` | Actualización de datos (en documentos, genera nueva versión). |
| `deleted` | Baja de una entidad (física o lógica). |
| `closed` | Cierre de un caso. |
| `reopened` | Reapertura de un caso. |
| `locked` | Bloqueo de un documento. |
| `unlocked` | Desbloqueo de un documento. |
| `uploaded` | Carga de un archivo o multimedia. |
| `photo_uploaded` | Carga de foto de perfil de usuario. |
| `status_updated` | Cambio de estado en un documento. |
| `name_updated` | Cambio de nombre en un documento. |
| `participant_added` | Agregado de participante a un caso. |
| `participant_removed` | Remoción de participante de un caso. |

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "name": "Administrador",
        "last_name": "Sistema"
      },
      "action": "created",
      "entity_info": {
        "id": 10,
        "type": "case",
        "data": {
          "id": 10,
          "name": "Expediente Nro 123/24",
          "attributes": {
            "id": 10,
            "title": "Expediente Nro 123/24",
            "lawyer_id": 1,
            "client_id": 5,
            "status": "active",
            ...
          }
        }
      },
      "created_at": "2026-03-26 10:00:00"
    }
  ],
  "links": { ... },
  "meta": { ... }
}
```

---

## 3.2. Limpiar Toda la Bitácora
`DELETE /api/bitacora/clear`

Elimina todos los registros de la bitácora permanentemente. **Solo accesible para administradores.**

---

## 3.3. Mantenimiento de Bitácora
`DELETE /api/bitacora/cleanup`

Elimina registros más antiguos a N días. **Solo accesible para administradores.**

- **Body (JSON):**
  - `days` (integer, requerido): Cantidad de días a conservar. Registros anteriores a hoy - N días serán eliminados.

---

# 4. Casos

## Índice de Sección Casos

4.1. [Listar Casos](#4.1.-listar-casos) - `GET /api/cases`
4.2. [Buscar Casos](#4.2.-buscar-casos) - `GET /api/cases/search`
4.3. [Crear un Caso](#4.3.-crear-un-caso) - `POST /api/cases`
4.4. [Ver Detalle de un Caso](#4.4.-ver-detalle-de-un-caso) - `GET /api/cases/{case}`
4.5. [Actualizar un Caso](#4.5.-actualizar-un-caso) - `PUT /api/cases/{case}`
4.6. [Eliminar un Caso](#4.6.-eliminar-un-caso) - `DELETE /api/cases/{case}`
4.7. [Listar Casos Abiertos / Cerrados](#4.7.-listar-casos-abiertos-/-cerrados)
4.8. [Cerrar / Reabrir un Caso](#4.8.-cerrar-/-reabrir-un-caso)
4.9. [Última Modificación Global de Casos](#4.9.-última-modificación-global-de-casos) - `GET /api/cases/last-modified`
4.10. [Última Modificación de un Caso Específico](#4.10.-última-modificación-de-un-caso-específico) - `GET /api/cases/{case}/last-modified`
4.11. [Sincronización Global de Casos (Sync Down)](#4.11.-sincronización-global-de-casos-(sync-down)) - `GET /api/suit-cases/sync`
4.12. [Sincronización Ascendente (Sync Up)](#4.12.-sincronización-ascendente-(sync-up)) - `POST /api/suit-cases/sync`
4.13. [Sincronización Detallada (Sync Down Específico)](#4.13.-sincronización-detallada-(sync-down-específico)) - `GET /api/cases/{case}/syncDown/{date}`
4.14. [Clientes de un Caso](#4.14.-clientes-de-un-caso)
4.15. [Participantes de un Caso](#4.15.-participantes-de-un-caso)
4.16. [Agenda de un Caso](#4.16.-agenda-de-un-caso)
4.17. [Generación de Enlaces (QR)](#4.17.-generación-de-enlaces-(qr)) - `POST /api/suit-cases/{id}/generate-link`
4.18. [Tipos de Expediente de un Caso](#4.18.-tipos-de-expediente-de-un-caso)
4.19. [Gastos de un Caso](#4.19.-gastos-de-un-caso)
4.20. [Partes de un Caso](#4.20.-partes-de-un-caso)
4.21. [Reglas de Negocio Federal](#4.21.-reglas-de-negocio-federal)
4.22. [Workflow de Sincronización y Caché](#4.22.-workflow-de-sincronización-y-caché)

---

## 4.1. Listar Casos
`GET /api/cases`

Retorna de forma paginada (40 por página) los casos en los que el usuario es el creador (abogado) o un participante. Se pueden aplicar filtros avanzados:

- **Query Params:**
  - `case_type_id` (integer, opcional): Filtra por tipo de caso.
  - `radicacion_id` (integer, opcional): Filtra por radicación judicial.
  - `dependencia_id` (integer, opcional): Filtra por dependencia judicial específica.
  - `start_date_from` / `start_date_to` (date, opcional): Rango de fechas de inicio.
  - `end_date_from` / `end_date_to` (date, opcional): Rango de fechas de cierre.
  - `owner_id` (integer, opcional): Filtra casos cuyo creador sea un abogado en específico. Si eres usuario normal, este filtro seguirá respetando la regla global de solo mostrar los casos donde también apareces como participante. Los administradores pueden ver todos.
  - `participant_id` (integer, opcional): Filtra casos que contienen a este participante, con el mismo nivel de seguridad mencionado para `owner_id`.

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "title": "Sucesión Pérez",
    "status": "active",
    "case_type_id": 2,
    "start_date": "2026-01-15",
    "end_date": null,
    "details": "Detalles del caso...",
    "nro_expediente": "EXP-12345/26",
    "radicacion_id": 1,
    "dependencia_id": 5,
    "owner_tag": "jdoe",
    "created_at": "2026-03-21T10:00:00.000000Z",
    "updated_at": "2026-03-21T10:00:00.000000Z"
  }
]
```

## 4.2. Buscar Casos
`GET /api/cases/search`

Busca casos que coincidan con un término de búsqueda en el título. Retorna los primeros 20 resultados. Permite aplicar los mismos filtros avanzados que el listado general.

- **Query Params:**
  - `search` (string, opcional): Término de búsqueda para el título del caso.
  - `case_type_id` (integer, opcional): Filtrar por tipo de caso.
  - `status` (string, opcional): `active` o `closed`.
  - `radicacion_id` (integer, opcional): Filtrar por radicación.
  - `dependencia_id` (integer, opcional): Filtrar por dependencia.
  - `owner_id` (integer, opcional): Filtrar por creador (abogado).
  - `participant_id` (integer, opcional): Filtrar por participante.
  - `start_date_from` / `start_date_to` (date, opcional): Rango de fechas de inicio.
  - `end_date_from` / `end_date_to` (date, opcional): Rango de fechas de cierre.

**Respuesta Exitosa (200 OK):**
Lista de hasta 20 objetos `SuitCaseResource`.

---

## 4.3. Crear un Caso
`POST /api/cases`

Crea un nuevo caso legal y su agenda asociada.

- **Body (JSON):**
  - `title` (string, requerido): Título descriptivo.
  - `case_type_id` (integer, requerido): ID del tipo de caso.
  - `start_date` (date, requerido, formato Y-m-d): Fecha de inicio.
  - `details` (string, opcional): Detalles adicionales.
  - `nro_expediente` (string, requerido): Número de expediente.
  - `radicacion_id` (integer, requerido): ID de la radicación (juzgado/tribunal).
  - `dependencia_id` (integer, opcional): ID de la dependencia judicial (obligatorio si radicacion=Federal).

**Respuesta Exitosa (201 Created):**
```json
{
  "case": {
    "id": 50,
    "title": "Smith vs. Johnson",
    "lawyer_id": 1,
    "case_type_id": 1,
    "start_date": "2026-03-21",
    "details": "Litigio por daños y perjuicios.",
    "status": "active",
    "nro_expediente": "7890/2026",
    "radicacion_id": 3,
    "dependencia_id": 12,
    "updated_at": "2026-03-23T22:00:00.000000Z",
    "created_at": "2026-03-23T22:00:00.000000Z"
  },
  "agenda": {
    "id": 105,
    "name": "Agenda: Smith vs. Johnson",
    "user_id": 1,
    "suit_case_id": 50,
    "updated_at": "2026-03-23T22:00:00.000000Z",
    "created_at": "2026-03-23T22:00:00.000000Z"
  },
  "cases_last_modified": "2026-03-23T22:00:00.000000Z",
  "agendas_last_modified": "2026-03-23 22:00:00"
}
```

---

## 4.4. Ver Detalle de un Caso
`GET /api/cases/{case}`

Retorna la información detallada de un caso específico.

**Respuesta Exitosa (200 OK):**
Objeto completo del modelo `SuitCase`.

---

## 4.5. Actualizar un Caso
`PUT /api/cases/{case}`

Actualiza la información de un caso existente. Soporta detección de conflictos mediante `last_updated_at`.

- **Body (JSON):**
  - Campos opcionales: `title`, `details`, `start_date`, `case_type_id`.
  - Campos requeridos en validación: `nro_expediente`, `radicacion_id`.
  - `dependencia_id` (opcional/requerido según reglas Federales).
  - `last_updated_at` (ISO8601 date, opcional): Fecha de última actualización conocida por el cliente para evitar sobreescritura de cambios concurrentes (Conflict Detection).

**Ejemplo de uso:**
```json
{
  "title": "Smith vs. Johnson (Actualizado)",
  "last_updated_at": "2026-03-21T10:00:00.000000Z"
}
```

**Respuesta Exitosa (200 OK):**
Retorna el objeto del caso actualizado.

---

## 4.6. Eliminar un Caso
`DELETE /api/cases/{case}`

Realiza un borrado lógico (soft delete) del caso.

---

## 4.7. Listar Casos Abiertos / Cerrados
- `GET /api/cases/open`: Retorna únicamente los casos con estado activo.
- `GET /api/cases/closed`: Retorna únicamente los casos cerrados.

*Ambos endpoints devuelven datos paginados de a 40 elementos, y soportan todos los **Query Params de filtrado avanzado** definidos en la sección 4.1.*

---

## 4.8. Cerrar / Reabrir un Caso
- **POST /api/cases/{id}/close**: Finaliza un caso, estableciendo la fecha de cierre (`end_date`) al momento actual y el estado a `closed`. Esto disparará automáticamente la actualización de estado de todos los clientes asociados a `inactivo`, a menos que participen en otros casos activos.
- **POST /api/cases/{id}/reopen**: Cambia el estado de `closed` a `active` y limpia la `end_date`. Esto marcará automáticamente a los clientes asociados como `activo`.

---

## 4.9. Última Modificación Global de Casos
`GET /api/cases/last-modified`

Retorna la fecha y hora de la última modificación ocurrida en cualquier caso accesible por el usuario. Es el punto de entrada recomendado para el workflow de sincronización incremental.

- **Uso Sugerido:** El cliente consulta este endpoint periódicamente. Si el `last_modified` retornado es más reciente que el timestamp guardado localmente, debe llamar a `GET /api/suit-cases/sync` para obtener los cambios.

**Respuesta Exitosa (200 OK):**
```json
{
  "last_modified": "2026-03-21T16:00:00.000000Z"
}
```

---

## 4.10. Última Modificación de un Caso Específico
`GET /api/cases/{case}/last-modified`

Retorna un reporte detallado de las últimas modificaciones dentro de un caso y sus entidades relacionadas. Útil para saber qué sección específica del caso (ej. Gastos) requiere ser actualizada sin sincronizar todo el caso.

- **Parámetros:** `case` (ID del caso).
- **Lógica de uso:** El cliente puede comparar cada clave (`gastos`, `documentos`, etc.) contra su última sincronización local de esa relación específica.

**Respuesta Exitosa (200 OK):**
```json
{
  "case": "2026-03-21T13:00:00.000000Z",
  "partes": "2026-03-20T15:30:00.000000Z",
  "gastos": null,
  "honorarios": "2026-03-21T09:00:00.000000Z",
  "documentos": "2026-03-18T10:45:00.000000Z",
  "eventos": "2026-03-21T12:00:00.000000Z",
  "clientes": "2026-03-15T08:00:00.000000Z",
  "multimedia": null,
  "archivos": "2026-03-21T11:00:00.000000Z"
}
```

---

## 4.11. Sincronización Global de Casos (Sync Down)
`GET /api/suit-cases/sync?since={timestamp}`

Retorna todos los casos (incluyendo los eliminados lógicamente) modificados después de una fecha. Este endpoint permite al cliente mantener la lista de casos actualizada y detectar bajas remotas.

- **Parámetro:** `since` (ISO8601 string, requerido).
- **Comportamiento:** Si un caso fue eliminado, aparecerá en la respuesta con un campo `deleted_at` no nulo. El cliente debe proceder a eliminarlo de su base de datos local.

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Caso Modificado",
      "status": "active",
      "updated_at": "2026-03-22T10:00:00.000000Z",
      "deleted_at": null,
      "type": { "id": 1, "name": "Civil" }
    },
    {
      "id": 5,
      "title": "Caso Eliminado Remotamente",
      "status": "active",
      "updated_at": "2026-03-22T11:00:00.000000Z",
      "deleted_at": "2026-03-22T11:00:00.000000Z"
    }
  ]
}
```

---

## 4.12. Sincronización Ascendente (Sync Up)
`POST /api/suit-cases/sync`

Permite enviar múltiples casos desde un cliente para creación (sin `id`) o actualización masiva. Utiliza detección de conflictos mediante `last_updated_at`.

- **Body (JSON):**
  - `cases` (array): Lista de objetos de casos. Cada objeto debe incluir campos requeridos (`title`, `nro_expediente`, `radicacion_id`). Para actualizaciones, incluir `id` y `last_updated_at`.

**Respuesta Exitosa (200 OK):**
```json
{
  "synced": [
    { "id": 60, "title": "Nuevo Caso Offline", "updated_at": "..." }
  ],
  "conflicts": [42]
}
```
*`conflicts` contiene el array de IDs cuya actualización falló por ser anterior a la versión del servidor.*

---

## 4.13. Sincronización Detallada (Sync Down Específico)
`GET /api/cases/{case}/syncDown/{date}`

Retorna todos los relacionados (partes, gastos, documentos, etc.) de un caso específico que hayan sido modificados después de la fecha proporcionada.

- **Filtro Transaccional:** El sistema evalúa cambios tanto en la entidad principal (ej. datos de un cliente) como en la relación con el caso (ej. fecha en que se asoció el cliente al caso).
- **Soft Deletes:** Al igual que el sync global, los objetos con `deleted_at` deben eliminarse localmente.

**Respuesta Exitosa (200 OK):**
```json
{
  "partes": [ 
    { "id": 1, "name": "Juan Perez", "deleted_at": null, "updated_at": "..." } 
  ],
  "gastos": [],
  "documentos": [
    { "id": 10, "name": "Escrito.pdf", "deleted_at": "2026-03-22T15:00:00.000000Z" }
  ],
  "eventos": [],
  "clientes": [],
  "multimedia": [],
  "archivos": [],
  "tipo_expedientes": [],
  "participants": []
}
```

---

## 4.14. Clientes de un Caso
- `GET /api/cases/{case}/clients`: Retorna la lista de clientes asociados a un caso.
- `POST /api/cases/{case}/clients`: Asocia clientes existentes (`client_ids` array). Al asociarse a un caso `active`, el cliente pasa automáticamente a estado `activo`.
- `DELETE /api/cases/{case}/clients/{client}`: Desasocia un cliente del caso. Al desasociarse, se recalcula su estado. Si no le quedan casos activos, pasa a `inactivo`.

---

## 4.15. Participantes de un Caso
- `GET /api/cases/{id}/participants`: Retorna todos los usuarios que participan en el caso.
- `POST /api/cases/{id}/participants`: Agrega un colaborador (`user_tag`, `permission_level`).
- `DELETE /api/cases/{id}/participants/{user_id}`: Quita un participante.

---

## 4.16. Agenda de un Caso
`GET /api/cases/{id}/agenda`

Obtiene la agenda asociada a un caso con todos sus eventos.

---

## 4.17. Generación de Enlaces (QR)
`POST /api/suit-cases/{id}/generate-link`

Genera enlaces temporales firmados para descarga (`download_url`) o carga (`upload_url`) de archivos asociados al caso.

**Ejemplo de respuesta:**
```json
{
  "upload_url": "http://api.suit.com/api/suit-cases/upload-signed?case_id=10&model_type=multimedia&signature=...",
  "expires_at": "2026-03-22T19:00:00.000000Z"
}
```

---

## 4.18. Tipos de Expediente de un Caso
- `GET /api/suit-cases/{suit_case}/tipo-expedientes`: Lista los tipos de expediente asociados.
- `POST /api/suit-cases/{suit_case}/tipo-expedientes`: Sincroniza masivamente (`tipo_expediente_ids` array).

---

## 4.19. Gastos de un Caso
- `GET /api/suit-cases/{suit_case}/gastos`: Lista todos los gastos del caso.
- `POST /api/suit-cases/{suit_case}/gastos`: Registra un nuevo gasto (`gasto_type_id`, `monto`, `fecha`).

---

## 4.20. Partes de un Caso
- `GET /api/suit-cases/{suit_case}/partes`: Lista las partes (Actor, Demandado, etc.).
- `POST /api/suit-cases/{suit_case}/partes`: Asocia una parte existente.
- `DELETE /api/suit-cases/{suit_case}/partes/{parte}`: Desasocia una parte.

---

## 4.21. Reglas de Negocio Federal

Los registros de **Jurisdicción** y **Radicación** con el nombre o tipo **\"Federal\"** son inmutables. 

Si se selecciona una **Radicación** de tipo **Federal** en un caso:
1. El campo `dependencia_id` es **obligatorio**.
2. La **Dependencia Judicial** seleccionada debe pertenecer obligatoriamente a la **Jurisdicción Federal**.

---

## 4.22. Workflow de Sincronización y Caché (Check-then-Fetch)

Para asegurar una experiencia offline fluida y minimizar el consumo de datos en la aplicación móvil/escritorio, se recomienda seguir este flujo:

1. **Paso 1: Check Global**
   El cliente llama a `/api/cases/last-modified`.
   - Si el valor retornado es `<= local_timestamp`, no hay cambios globales en la lista de casos.
   - Si el valor es `>`, indica que hay nuevos casos, casos modificados o eliminados. Proceder al paso 2.

2. **Paso 2: Sync Global (Lista de Casos)**
   El cliente llama a `/api/suit-cases/sync?since={local_timestamp}`.
   - El servidor retorna el delta de casos. El cliente debe actualizar su base de datos local.
   - **Bajas:** Si un caso tiene `deleted_at != null`, el cliente DEBE eliminarlo de su base local.
   - Una vez finalizado, el cliente actualiza su `local_timestamp` global.

3. **Paso 3: Check Detallado por Caso**
   Al entrar al detalle de un expediente específico, el cliente puede optimizar llamando a `/api/cases/{case}/last-modified`.
   - Permite comparar individualmente cuándo fue la última vez que cambiaron los `gastos`, `documentos`, `eventos`, etc.
   - Si un rubro (ej. `documentos`) es más reciente que el último sync local de ese rubro, llamar a `/api/cases/{case}/syncDown/{last_case_sync}` para obtener solo lo nuevo de ese expediente.

4. **Paso 4: Sincronización Ascendente (Sync Up)**
   - Al recuperar conexión (o bajo demanda), el cliente envía sus cambios locales a `POST /api/suit-cases/sync`.
   - Manejar el array de `conflicts` (Http 409): Si un ID aparece en conflictos, significa que alguien más modificó el caso en el servidor mientras el cliente estaba offline. El cliente deberá solicitar al usuario si desea "pisar" los cambios o descartar los suyos.

---

# 5. Autenticación y Perfil

## Índice de Sección Autenticación

5.1. [Comprobación de Estado (Health Check)](#5.1.-comprobación-de-estado-(health-check)) - `GET /api/is_on`
5.2. [Inicio de Sesión (Login)](#5.2.-inicio-de-sesión-(login)) - `POST /api/login`
5.3. [Registro de Usuario](#5.3.-registro-de-usuario) - `POST /api/register`
5.4. [Cierre de Sesión (Logout)](#5.4.-cierre-de-sesión-(logout)) - `POST /api/logout`
5.5. [Información del Usuario Autenticado](#5.5.-información-del-usuario-autenticado) - `GET /api/user`
5.6. [Actualizar Perfil de Usuario](#5.6.-actualizar-perfil-de-usuario) - `PUT /api/user/profile`
5.7. [Subir Foto de Perfil](#5.7.-subir-foto-de-perfil) - `POST /api/user/profile-photo`
5.8. [Listar / Buscar Usuarios](#5.8.-listar-/-buscar-usuarios)
5.9. [Última Modificación Global de Usuarios](#5.9.-última-modificación-global-de-usuarios) - `GET /api/users/last-modified`
5.10. [Última Modificación de Usuario Específico](#5.10.-última-modificación-de-usuario-específico) - `GET /api/users/{user}/last-modified`

---

## 5.1. Comprobación de Estado (Health Check)
`GET /api/is_on`

Verifica que el servidor de la API esté activo y respondiendo.

---

## 5.2. Inicio de Sesión (Login)
`POST /api/login`

Autentica a un usuario mediante su etiqueta (tag) y contraseña.

**Respuesta Exitosa (200 OK):**
```json
{
  "access_token": "1|abcdef123456...",
  "token_type": "Bearer",
  "user": { "id": 1, "name": "John Doe", "tag": "jdoe", "role": "lawyer", ... }
}
```

---

## 5.3. Registro de Usuario
`POST /api/register`

Registra un nuevo usuario (**Solo Administradores**). Soporta `tag`, `name`, `password`, `role` y `photo`.

---

## 5.4. Cierre de Sesión (Logout)
`POST /api/logout`

Revoca el token de acceso actual.

---

## 5.5. Información del Usuario Autenticado
`GET /api/user`

Retorna la información completa del perfil del usuario logueado.

---

## 5.6. Actualizar Perfil de Usuario
`PUT /api/user/profile`

Permite al usuario modificar su `name`, `last_name`, `email` or `password`.

---

## 5.7. Subir Foto de Perfil
`POST /api/user/profile-photo`

Carga una imagen (jpg, jpeg o png) para el perfil del usuario.

---

## 5.8. Listar / Buscar Usuarios
- `GET /api/users`: Lista todos los usuarios registrados.
- `GET /api/users/search?q={query}`: Busca usuarios por tag o nombre completo.

---

## 5.9. Última Modificación Global de Usuarios
`GET /api/users/last-modified`

---

## 5.10. Última Modificación de Usuario Específico
`GET /api/users/{user}/last-modified`

---

# 6. Clientes

## Índice de Sección Clientes

6.1. [Listar Clientes](#6.1.-listar-clientes) - `GET /api/clients`
6.2. [Crear un Cliente](#6.2.-crear-un-cliente) - `POST /api/clients`
6.3. [Ver Detalle de un Cliente](#6.3.-ver-detalle-de-un-cliente) - `GET /api/clients/{client}`
6.4. [Actualizar un Cliente](#6.4.-actualizar-un-cliente) - `PUT /api/clients/{client}`
6.5. [Eliminar un Cliente](#6.5.-eliminar-un-cliente) - `DELETE /api/clients/{client}`
6.6. [Sincronización (Sync Down/Up)](#6.6.-sincronizacion-(sync-down/up))
6.7. [Última Modificación Global](#6.7.-última-modificación-global) - `GET /api/clients/last-modified`
6.8. [Última Modificación Específica](#6.8.-última-modificación-específica) - `GET /api/clients/{client}/last-modified`

---

## 6.1. Listar Clientes
`GET /api/clients`

Retorna un listado paginado (30 por página) de clientes. Incluye la información de la persona asociada.

- **Query Params:**
  - `search` (string, opcional): Busca por nombre, apellido, DNI o email de la persona.
  - `type` (string, opcional): Filtra por tipo (`person`, `company`).
  - `status` (string, opcional): Filtra por estado operativo (`activo` o `inactivo`).
  - `financial_status` (string, opcional): Filtra por estado financiero (`no deudor`, `deudor` o `moroso`).

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "first_name": "Juan",
      "last_name": "Pérez",
      "identification_number": "20123456",
      "email": "juan@example.com",
      "status": "activo",
      "financial_status": "no deudor",
      "type": "person"
    }
  ],
  "meta": { "current_page": 1, "total": 45 }
}
```

---

## 6.2. Crear un Cliente
`POST /api/clients`

Crea un nuevo cliente. Internamente crea o asocia una **Persona** centralizada para gestionar datos de identidad comunes.

- **Body (JSON):**
  - `first_name` (string, requerido): Nombre.
  - `last_name` (string, requerido): Apellido.
  - `gender` (string, requerido): `M`, `F` o `X`.
  - `identification_number` (string, opcional): DNI/CUIT.
  - `email`, `phone`, `address`, `notes` (opcionales).
  - `type` (string, opcional): `person` o `company`.

- **Atributos de estado (Automáticos):**
  - **`status`**: `activo` (tiene casos abiertos) o `inactivo` (no tiene casos o todos están cerrados).
  - **`financial_status`**: `no deudor` (sin deudas), `deudor` (honorarios pendientes < N días) o `moroso` (honorarios pendientes >= N días). *(El umbral de días es de 30 por defecto y es configurable en la sección 12).*

---

## 6.3. Ver Detalle de un Cliente
`GET /api/clients/{client}`

Retorna la información completa del cliente, incluyendo sus datos personales (Persona), sus casos asociados y sus documentos.

---

## 6.4. Actualizar un Cliente
`PUT /api/clients/{client}`

Actualiza los datos del cliente y de su Persona asociada.

- **Control de Conflictos:** Soporta `last_updated_at` para evitar sobreescrituras concurrentes.

---

## 6.5. Eliminar un Cliente
`DELETE /api/clients/{client}`

Realiza la baja lógica (Soft Delete) del cliente. No elimina la Persona asociada.

---

## 6.6. Sincronización (Sync Down/Up)

### Sincronización Descendente (Sync Down)
`GET /api/clients/sync?since={timestamp}`

Obtiene el delta de clientes modificados o creados después del timestamp.

### Sincronización Ascendente (Sync Up)
`POST /api/clients/sync`

Recibe un array de objetos `clients` para creación o actualización masiva desde el cliente offline.

---

## 6.7. Última Modificación Global
`GET /api/clients/last-modified`

---

## 6.8. Última Modificación Específica
`GET /api/clients/{client}/last-modified`

---
---

## 6.9. Consultar Documentación del Cliente
`GET /api/clients/{client}/documents`

Retorna de forma estructurada toda la documentación vinculada a un cliente, separando los documentos sin caso ("personales") de aquellos que pertenecen a expedientes donde el cliente participa.

El endpoint soporta **triple paginación simultánea** para manejar grandes volúmenes de datos sin saturar la respuesta.

- **Reglas de Acceso:**
  - **Administradores:** Ven todos los documentos y casos del cliente, sin importar quién los haya creado.
  - **Abogados:** Solo ven documentos personales de su propiedad y documentos de casos donde sean dueños o participantes.

- **Query Params:**
  - `page_personal` (default 1): Página para el bloque de 15 documentos personales.
  - `page_cases` (default 1): Página para el bloque de 5 casos integrales.
  - `page_case_docs` (default 1): Página para los 5 documentos dentro de cada uno de los casos listados.

**Respuesta Exitosa (200 OK):**
```json
{
  "personales": {
    "data": [ { "id": 1, "name": "Documento Personal.html", ... } ],
    "links": { ... },
    "meta": { "total": 20, "per_page": 15, ... }
  },
  "por_casos": {
    "data": [
      {
        "id": 10,
        "nombre": "Sucesión Pérez",
        "estado": "active",
        "fuero": "Civil y Comercial",
        "documentos": {
          "data": [ { "id": 105, "name": "Escrito Inicial.html", ... } ],
          "links": { ... },
          "meta": { "total": 50, "per_page": 5, ... }
        }
      }
    ],
    "links": { ... },
    "meta": { "total": 8, "per_page": 5, "current_page": 1 }
  }
}
```

---

## 6.10. Asociar Clientes a Documentos
Permite vincular o desvincular un listado de clientes a un documento específico. Esto habilita que los documentos aparezcan en la vista de "personales" del cliente.

### 6.10.1. Listar clientes vinculados
`GET /api/documents/{document}/clients`

- **Reglas de Acceso:** Requiere permiso de lectura (`view`) sobre el documento.

**Respuesta Exitosa (200 OK):**
```json
[
  { "id": 1, "first_name": "Juan", "last_name": "Perez", ... }
]
```

### 6.10.2. Asociar uno o más clientes
`POST /api/documents/{document}/clients`

- **Reglas de Acceso:** Requiere permiso de edición (`update`) sobre el documento.
- **Body (JSON):**
```json
{
  "client_ids": [1, 2, 5]
}
```

**Respuesta Exitosa (200 OK):**
```json
{
  "message": "Clients attached to document successfully"
}
```

### 6.10.2. Desvincular un cliente
`DELETE /api/documents/{document}/clients/{client}`

- **Reglas de Acceso:** Requiere permiso de edición (`update`) sobre el documento.

**Respuesta Exitosa (200 OK):**
```json
{
  "message": "Client detached from document successfully"
}
```

---

# 7. Agenda, Eventos y Vencimientos

## Índice de Sección Agenda

7.1. [Listar Agendas Accesibles](#7.1.-listar-agendas-accesibles) - `GET /api/agendas`
7.2. [Eventos de Agenda](#7.2.-eventos-de-agenda)
7.3. [Vencimientos (Deadlines)](#7.3.-vencimientos-(deadlines))
7.4. [Sincronización de Agenda](#7.4.-sincronización-de-agenda)
7.5. [Última Modificación de Agendas / Eventos](#7.5.-última-modificación-de-agendas-/-eventos)

---

## 7.1. Listar Agendas Accesibles
`GET /api/agendas`

Retorna Agenda Personal y Agendas de Casos accesibles.

---

## 7.2. Eventos de Agenda
- `POST /api/events`: Crea un evento manual (`agenda_id`, `title`, `starts_at`).
- `GET /api/agendas/all-events/{month}/{year}`: Todos los eventos del mes de todas las agendas accesibles.
- `GET /api/agenda/{agenda}/{month}/{year}`: Eventos de una agenda específica.

---

## 7.3. Vencimientos (Deadlines)
- `POST /api/vencimientos`: Registra un vencimiento procesal.
- `GET /api/vencimientos/{month}/{year}`: Vencimientos que ocurren en el mes solicitado.
- `GET /api/vencimientos/{deadline}`: Detalle de un vencimiento específico.
- `POST /api/vencimientos/{deadline}/completar`: Marca como `Cumplido`.
- `POST /api/vencimientos/{deadline}/prorrogar`: Establece nueva fecha para un vencido.

---

## 7.4. Sincronización de Agenda
- `GET /api/agendas/sync?since={ts}`: Descarga descendente de eventos.
- `POST /api/agendas/sync`: Sincronización ascendente masiva.

---

## 7.5. Última Modificación de Agendas / Eventos
- `GET /api/agendas/last-modified`: Cambio global en configuración/permisos.
- `GET /api/agendas/latest-event`: Timestamp del último evento modificado.

---

# 8. Economía (Honorarios y Gastos)

Esta sección cubre la gestión financiera de los casos, incluyendo el registro de honorarios profesionales, las entregas de dinero (pagos) y los gastos/costas incurridos durante el proceso judicial.

## Índice de Sección Finanzas

8.1. [Honorarios: Listados y Filtros](#8.1.-honorarios:-listados-y-filtros)
8.2. [Honorarios: Estadísticas](#8.2.-honorarios:-estadísticas)
8.3. [Honorarios: Operaciones CRUD](#8.3.-honorarios:-operaciones-crud)
8.4. [Entregas (Pagos de Honorarios)](#8.4.-entregas-(pagos-de-honorarios))
8.5. [Gastos del Caso (Operaciones)](#8.5.-gastos-del-caso-(operaciones))
8.6. [Gastos: Estadísticas](#8.6.-gastos:-estadísticas)
8.7. [Catálogos de Gastos (Tipos)](#8.7.-catálogos-de-gastos-(tipos))

---

## 8.1. Honorarios: Listados y Filtros
Existen varios endpoints para listar honorarios dependiendo del contexto. Actualmente estos listados retornan la colección completa (consultar si se requiere paginación).

### Por Rango de Fechas
`GET /api/honorarios/by-date-range`

- **Query Params:**
  - `from` (date, requerido): Fecha de inicio (YYYY-MM-DD).
  - `to` (date, requerido): Fecha de fin (YYYY-MM-DD).
  - `user_id` (integer, opcional): Filtrar por un abogado específico (Requiere rol Admin).

### Por Caso
`GET /api/suit-cases/{suit_case}/honorarios`

### Por Cliente
`GET /api/clients/{client}/honorarios`

---

## 8.2. Honorarios: Estadísticas
`GET /api/honorarios/stats`

Genera un resumen mensual de la facturación en el período indicado.

- **Query Params:**
  - `from` (date, requerido): Fecha de inicio.
  - `to` (date, requerido): Fecha de fin.
  - `user_id` (integer, opcional): Ver estadísticas de un abogado específico (Solo Admin).

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "month": "2026-03",
    "total_honorarios": 5,
    "monto_total": 250000.00,
    "pagado_total": 120000.00,
    "pendiente_total": 130000.00
  }
]
```

---

## 8.3. Honorarios: Operaciones CRUD

### Registrar Honorario
`POST /api/suit-cases/{suit_case}/honorarios`

Registra una deuda de honorarios para un cliente dentro de un caso específico.

- **Restricciones:** 
  - El usuario debe tener permiso de escritura en el caso.
  - El `client_id` enviado debe pertenecer obligatoriamente al caso.
- **Body (JSON):**
  - `client_id` (integer, requerido).
  - `monto` (decimal, requerido).
  - `detalles` (string, requerido).

**Ejemplo de Respuesta (201 Created):**
```json
{
  "id": 14,
  "monto": 50000.00,
  "detalles": "Honorarios por demanda de daños",
  "pagado": false,
  "total_entregas": 0.00,
  "client_name": "Juan Pérez",
  "suit_case_id": 5,
  "created_at": "2026-03-28T18:00:00Z"
}
```

### Ver Honorario
`GET /api/honorarios/{honorario}`

### Actualizar Honorario
`PUT /api/honorarios/{honorario}`
Permite editar el monto o los detalles siempre que el usuario tenga privilegios sobre el registro.

### Eliminar Honorario
`DELETE /api/honorarios/{honorario}`
**Restricción:** No se puede eliminar un honorario que ya tenga entregas (pagos) registradas para mantener la integridad contable.

---

## 8.4. Entregas (Pagos de Honorarios)
Las entregas representan abonos que el cliente realiza sobre un honorario.

### Listar Entregas
`GET /api/honorarios/{honorario}/entregas`

### Registrar Entrega
`POST /api/honorarios/{honorario}/entregas`

- **Body (JSON):**
  - `monto` (decimal, requerido).
  - `metodo_pago` (string, opcional): Ej. "Transferencia", "Efectivo".
  - `detalles` (string, opcional).

**Lógica de Negocio:** 
1. El sistema suma las entregas y actualiza el campo `pagado` del honorario padre automáticamente.
2. Se dispara el recalculo del estado financiero del cliente (deudor/no deudor).

### Eliminar Entrega
`DELETE /api/entregas/{entrega}`
Elimina registro de pago, recalcula el saldo del honorario y actualiza el estado financiero del cliente.

---

## 8.5. Gastos del Caso (Operaciones)

### Listar Gastos por Caso
`GET /api/suit-cases/{suit_case}/gastos`

### Registrar Gasto
`POST /api/suit-cases/{suit_case}/gastos`

- **Body (JSON):**
  - `gasto_id` (integer, requerido): ID del tipo de gasto del catálogo.
  - `monto` (decimal, requerido).
  - `client_ids` (array, opcional): IDs de clientes a los que se imputa el gasto.
  - `client_id` (integer, opcional): Alias para asignar a un único cliente.

**Restricción de Asignación:** Si el caso tiene múltiples clientes, es obligatorio enviar `client_ids` o `client_id`. Si tiene uno solo, el sistema lo asigna automáticamente si se omite.

### Listar Gastos (Filtrado por Fecha)
`GET /api/gasto-suit-cases/by-date-range`

Retorna los gastos registrados en un período, con soporte para filtrado por abogado y paginación (30 por página).

- **Query Params:**
  - `from` (date, requerido): Fecha de inicio (YYYY-MM-DD).
  - `to` (date, requerido): Fecha de fin (YYYY-MM-DD).
  - `user_id` (integer, opcional): Filtrar por un abogado específico (Solo Admin).

---

## 8.6. Gastos: Estadísticas
`GET /api/gasto-suit-cases/stats`

Genera un resumen mensual de los gastos incurridos en el período indicado.

- **Query Params:**
  - `from` (date, requerido): Fecha de inicio.
  - `to` (date, requerido): Fecha de fin.
  - `user_id` (integer, opcional): Ver estadísticas de un abogado específico (Solo Admin).

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "month": "2026-03",
    "count": 12,
    "total_amount": 45600.50
  }
]
```

---

## 8.7. Catálogos de Gastos (Tipos)
- `GET /api/gastos`: Retorna tipos de gastos (Tasa, Fotocopias, etc.).
- `GET /api/gastos/last-modified`: Último cambio global en el catálogo.

---

# 9. Infraestructura Judicial (Catálogos)

## Índice de Sección Infraestructura

9.1. [Jurisdicciones](#9.1.-jurisdicciones)
9.2. [Competencias](#9.2.-competencias)
9.3. [Dependencias Judiciales](#9.3.-dependencias-judiciales)
9.4. [Radicaciones](#9.4.-radicaciones)
9.5. [Tipos de Proceso y Evento](#9.5.-tipos-de-proceso-y-evento)
9.6. [Partes e Involucrados](#9.6.-partes-e-involucrados)

---

## 9.1. Jurisdicciones
- `GET /api/jurisdicciones`: Catálogo global.
- `GET /api/jurisdicciones/last-modified`: Timestamp del último cambio.

---

## 9.2. Competencias
- `GET /api/competencias`: Catálogo global de fueros.
- `GET /api/jurisdicciones/{jurisdiccion}/competencias`: Competencias por jurisdicción.

---

## 9.3. Dependencias Judiciales
`GET /api/dependencias-judiciales`

Retorna juzgados/tribunales junto a su jurisdicción y competencia.

---

## 9.4. Radicaciones
`GET /api/radicaciones`

Tipos de radicación (Provincial, Federal, etc.). Soporta `last-modified` y `sync`.

---

## 9.5. Tipos de Proceso y Evento
- `GET /api/case-types`: Tipos de procesos legales.
- `POST /api/case-types`: Crea nueva categoría (Solo Admin).
- `GET /api/event-types`: Tipos de eventos de agenda (Audiencia, Reunión).

---

## 9.6. Partes e Involucrados
- `GET /api/partes`: Listado de personas/partes globales.
**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@perez.com",
    "telefono": "12345678",
    "identificacion": "20-12345678-9",
    "direccion": "Calle Falsa 123",
    "genero": "M",
    "estado": "activo",
    "notas": "Cliente prioritario",
    "rol_id": 1,
    "rol": {
      "id": 1,
      "name": "Actor"
    },
    "created_at": "2026-03-29T18:00:00Z",
    "updated_at": "2026-03-29T18:05:00Z"
  }
]
```
- `POST /api/partes`: Crea una nueva persona y su registro como Parte.
  - **Body (JSON):**
    - `nombre` (string, requerido): Nombre de la persona.
    - `apellido` (string, requerido): Apellido de la persona.
    - `rol_id` (integer, requerido): ID del rol asociado (ej: Actor, Demandado).
    - `email` (string, opcional).
    - `telefono` (string, opcional).
    - `identificacion` (string, opcional): DNI, CUIT o similar.
    - `direccion` (string, opcional): Dirección física.
    - `genero` (string, opcional): Género de la persona.
    - `estado` (string, opcional): `activo` o `inactivo`.
    - `notas` (text, opcional): Observaciones adicionales.
- `PUT /api/partes/{parte}`: Actualiza los datos de una parte existente.
  - **Body (JSON):** Los mismos campos que en la creación, pero todos opcionales (`sometimes`).
- `GET /api/partes/last-modified`: Última modificación en tabla de partes.

---

# 10. Archivos y Multimedia

## Índice de Sección Archivos

10.1. [Archivos Públicos (Biblioteca)](#10.1.-archivos-públicos-(biblioteca))
10.2. [Archivos del Caso (Files)](#10.2.-archivos-del-caso-(files))
10.3. [Multimedia del Caso](#10.3.-multimedia-del-caso)

---

## 10.1. Archivos Públicos (Biblioteca)
- `GET /api/public-files`: Lista todos los archivos públicos de forma paginada (15 por página) ordenados por los más recientes.
  - **Query Params:**
    - `public_file_catalog_id` (integer, opcional): Filtra los archivos por el ID del catálogo seleccionado.
- `GET /api/public-file-catalogs/{catalog_id}/public-files`: Endpoint específico para obtener archivos filtrados por un catálogo obligatorio en la URL.
- `POST /api/public-files`: Sube un archivo público a la biblioteca.
- `GET /api/public-files/{id}/generate-link`: Genera un enlace de descarga firmado y temporal para el archivo.
- `GET /api/public-files/last-modified`: Timestamp de la última modificación en la biblioteca pública.
- `GET /api/public-files/sync`: Sincronización descendente (delta) de archivos públicos.

---

## 10.2. Archivos del Caso (Files)
- `GET /api/files`: Lista archivos de casos accesibles.
- `POST /api/files`: Sube archivo adjunto a un expediente.

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    { "id": 45, "filename": "Escrito.docx", "hash": "sha256...", "suit_case_id": 10, ... }
  ]
}
```

---

## 10.3. Multimedia del Caso
- `GET /api/multimedia`: Lista imágenes y videos de casos.
- `POST /api/multimedia`: Sube multimedia asociado opcionalmente a un caso.

---

# 11. Notificaciones

## Índice de Sección Notificaciones

11.1. [Notificaciones Pendientes](#11.1.-notificaciones-pendientes) - `GET /api/notifications`
11.2. [Sincronización de Notificaciones](#11.2.-sincronización-de-notificaciones) - `GET|POST /api/notifications/sync`
11.3. [Configuración por Evento](#11.3.-configuración-por-evento)

---

## 11.1. Notificaciones Pendientes
`GET /api/notifications`

Retorna alertas programadas no procesadas para el usuario.

---

## 11.2. Sincronización de Notificaciones
- `GET /api/notifications/sync?since={ts}`: Descarga del delta de alertas.
- `POST /api/notifications/sync`: Subida masiva de cambios.

---

## 11.3. Configuración por Evento
- `POST /api/events/{event}/notification`: Crea alerta (`notify_at`).
- `DELETE /api/events/{event}/notification`: Elimina alerta programada.
---

# 12. Configuraciones del Sistema

## Índice de Sección Configuraciones

12.1. [Listar Configuraciones](#12.1.-listar-configuraciones) - `GET /api/settings`
12.2. [Actualizar una Configuración](#12.2.-actualizar-una-configuración) - `PUT /api/settings/{key}`

---

## 12.1. Listar Configuraciones
`GET /api/settings`

Retorna todas las configuraciones globales del sistema. **Solo accesible para administradores.**

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "key": "client_moroso_threshold_days",
    "value": "30",
    "description": "Días de deuda para considerar a un cliente como moroso"
  },
  {
    "key": "deadline_urgency_days",
    "value": "3",
    "description": "Antelación para marcar un vencimiento como urgente"
  }
]
```

---

## 12.2. Actualizar una Configuración
`PUT /api/settings/{key}`

Actualiza el valor de una configuración existente. **Solo accesible para administradores.**

- **Body (JSON):**
  - `value` (string, requerido): Nuevo valor para la configuración (debe enviarse como string).

**Ejemplo de uso:**
Para cambiar el umbral de morosidad de clientes a 45 días:
`PUT /api/settings/client_moroso_threshold_days`
```json
{
  "value": "45"
}
```

**Respuesta Exitosa (200 OK):**
```json
{
  "key": "client_moroso_threshold_days",
  "value": "45"
}
```

---

---

# 13. Chatbot e Inteligencia Artificial (Módulo Mike)

Esta sección describe la integración del asistente de IA "Mike", diseñado para ayudar en la creación de plantillas jurídicas, y las herramientas administrativas para gestionar proveedores de IA.

## Índice de Sección IA

13.1. [Configuración de IA (Solo Admin)](#13.1.-configuración-de-ia-(solo-admin)) - `GET|PUT /api/ai/settings`
13.2. [Auditoría de Conversaciones (Solo Admin)](#13.2.-auditoría-de-conversaciones-(solo-admin)) - `GET /api/chatbot/admin/conversations`
13.3. [Listar mis Conversaciones](#13.3.-listar-mis-conversaciones) - `GET /api/chatbot/conversations`
13.4. [Iniciar Chat de Plantilla (Streaming)](#13.4.-iniciar-chat-de-plantilla-(streaming)) - `POST /api/chatbot/conversations`
13.5. [Continuar Conversación (Streaming)](#13.5.-continuar-conversación-(streaming)) - `POST /api/chatbot/conversations/{id}/reply`
13.6. [Eliminar Conversación](#13.6.-eliminar-conversación) - `DELETE /api/chatbot/conversations/{id}`

---

## 13.1. Configuración de IA (Solo Admin)

### Consultar Estado
`GET /api/ai/settings`

Retorna el proveedor activo, el modelo y si las API keys correspondientes están configuradas (sin mostrar el valor de la clave).

**Respuesta Exitosa (200 OK):**
```json
{
  "active_provider": "gemini",
  "active_model": "gemini-2.0-flash",
  "has_openai_key": true,
  "has_gemini_key": true,
  "has_anthropic_key": false,
  "has_deepseek_key": false
}
```

### Actualizar Configuración
`PUT /api/ai/settings`

Permite definir el proveedor activo y/o guardar nuevas API keys. Las claves se almacenan **encriptadas** en el servidor.

- **Body (JSON):**
  - `active_provider` (string): `openai`, `gemini`, `anthropic`.
  - `active_model` (string): Nombre del modelo (ej. `gpt-4o`).
  - `{provider}_key` (string): La API key del proveedor específico.

---

## 13.2. Auditoría de Conversaciones (Solo Admin)

### Listar todas las conversaciones
`GET /api/chatbot/admin/conversations`

Permite a los administradores monitorear el uso del chatbot por parte de los abogados. Retorna un listado paginado (30) con un resumen del primer mensaje.

### Ver mensajes de una conversación
`GET /api/chatbot/admin/conversations/{id}`

Muestra el historial completo de mensajes entre el usuario y el asistente Mike.

---

## 13.3. Listar mis Conversaciones
`GET /api/chatbot/conversations`

Retorna las conversaciones iniciadas por el usuario actual (Paginado 15).

---

## 13.4. Iniciar Chat de Plantilla (Streaming)
`POST /api/chatbot/conversations`

Crea una conversación y comienza el streaming SSE del asistente Mike.

- **Body (JSON):**
  - `prompt` (string, requerido): Consulta inicial o descripción del documento.
  - `html_content` (string, opcional): Contenido de un documento existente para que Mike lo analice y convierta en plantilla.

- **Mecánica de Respuesta (Server-Sent Events):**
  - La respuesta usa `Content-Type: text/event-stream`.
  - **Header `X-Conversation-Id`**: Contiene el UUID de la conversación creada. Debe guardarse en el frontend para continuar el chat.

---

## 13.5. Continuar Conversación (Streaming)
`POST /api/chatbot/conversations/{id}/reply`

Envía un nuevo mensaje a una conversación existente y recibe la respuesta vía SSE.

- **Parámetros:** `id` (UUID de la conversación).
- **Body (JSON):** `prompt` (string).

---

## 13.6. Eliminar Conversación
`DELETE /api/chatbot/conversations/{id}`

Realiza el borrado físico de la conversación y todos sus mensajes asociados.
