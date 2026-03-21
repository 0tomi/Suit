# Documentación API - Archivos Públicos (Public Files), Catálogos y Permisos

El sistema de archivos públicos permite almacenar e indexar archivos que cualquier usuario del sistema pueda descargar. A diferencia de los documentos privados, esto actúa como una biblioteca de utilidades, formularios vacíos, plantillas, etc. y se ordenan por **Catálogos**. A estos archivos se les puede inyectar granularidad de permisos (update y delete).

---

## 1. Catálogos de Archivos (Public File Catalogs)
Los catálogos permiten agrupar archivos públicos (ej: "Plantillas", "Formularios", "General"). Se incluye el catálogo **"General"** por defecto, el cual está protegido contra edición y eliminación de forma permanente.

### `GET /api/public-file-catalogs`
Lista todos los catálogos disponibles en el sistema.

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "name": "General",
    "description": "Catálogo general por defecto",
    "created_at": "2026-03-21T18:00:00.000000Z",
    "updated_at": "2026-03-21T18:00:00.000000Z"
  }
]
```

### `POST /api/public-file-catalogs`
Crea un nuevo catálogo. **Requiere permisos de Administrador.**

**Request Body (JSON):**
```json
{
  "name": "Acuerdos",
  "description": "Modelos de acuerdos extrajudiciales vacíos"  // Opcional
}
```

**Respuesta Exitosa (201 Created):**
Devuelve el objeto completo del catálogo creado, idéntico al Payload de lista `GET`.

### `PUT /api/public-file-catalogs/{id}`
Actualiza un catálogo existente. **Requiere permisos de Administrador.**
*Nota: El catálogo **"General"** está protegido y no puede ser modificado por ningún usuario (incluyendo administradores), devolviendo siempre un Error 403.*

**Request Body (JSON - Todos opcionales):**
```json
{
  "name": "Acuerdos (Nuevo)",
  "description": "Actualizado"
}
```

### `DELETE /api/public-file-catalogs/{id}`
Elimina un catálogo. **Requiere permisos de Administrador.** 
Si el catálogo tiene archivos anexados, al eliminarse el sistema automáticamente reasignará todos los archivos huérfanos asociados al catálogo `General`. **El catálogo "General" está protegido y no puede ser eliminado por ningún usuario (incluyendo administradores), devolviendo siempre un Error 403.**

---

## 2. Archivos Públicos (Public Files)
Permite subir los ficheros tangibles. Se requiere siempre subir un archivo físico via FormData.

### `GET /api/public-file-catalogs/{id}/public-files`
Lista de manera específica por catálogo *(paginada de a 15 archivos)* todos los archivos públicos pertenecientes a él y sus metadatos correspondientes.

### `POST /api/public-files` (Content-Type: multipart/form-data)
Sube un archivo a la nube y crear el registro.

**Payload Multipart:**
- `file`: (File, Obligatorio) El archivo en bytes. Máximo 100MB.
- `public_file_catalog_id`: (Integer, Opcional). ID del catálogo al que pertenece. Si no es enviado o es enviado vacío/nulo, el backend forzará su guardado asociándolo temporalmente al catálogo `General`.

**Respuesta Exitosa (201 Created):**
```json
{
    "data": {
        "id": 1,
        "uuid": "4dc92c55-b461-4fa3-85b4-ecfb4be7ddxx",
        "name": "documento.pdf",
        "url": "http://localhost/storage/public_files/4dc92c55-b461...pdf",
        "mime_type": "application/pdf",
        "size": 150239,
        "hash": "a4d8c0...xyz",
        "created_at": "2026-03-21T18:00:00.000000Z",
        "updated_at": "2026-03-21T18:00:00.000000Z"
    }
}
```

### `PUT /api/public-files/{id}`
Permite editar el archivo base.

**Respuesta Exitosa (200 OK), Request JSON:**
```json
{
  "name": "Nombre renombrado manual.pdf",
  "public_file_catalog_id": 2
}
```

### `DELETE /api/public-files/{id}`
Efectúa un _SoftDelete_ sobre el archivo. Sólo es posible borrar el archivo si eres el **dueño (user_id coincidente)**, un **Administrador**, o si el dueño te concedió *Can Delete = true* en la tabla de Permisos.


---

## 3. Permisos Específicos sobre Archivos (Permissions)
Esta porción de la API sirve exclusivamente al DUEÑO de un archivo o bien al ADMINISTRADOR para autorizar que otro miembro en la plataforma pueda modificar y/o eliminar un archivo público sin ser la autoridad final de creación.

### `GET /api/public-files/{id}/permissions`
Lista todos aquellos usuarios que tienen un registro de permiso modificado para este archivo en particular.
*(Apenas es accesible por Dueños y Admins).*

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "public_file_id": 1,
    "user_id": 2,
    "can_update": true,
    "can_delete": false,
    "created_at": "...",
    "updated_at": "...",
    "user": {
        "id": 2,
        "name": "Juan",
        "last_name": "Perez",
        "tag": "juanp"
    }
  }
]
```

### `POST /api/public-files/{id}/permissions`
Otorga o actualiza los permisos de un usuario específico frente a este archivo público. 

**Request JSON:**
```json
{
  "user_id": 3,
  "can_update": true, 
  "can_delete": true
}
```
*Si no se mandan flags, por defecto se asumirán como falsos.*

**Respuesta Exitosa (201/200 OK):**
Devuelve el objeto asignado con las booleanas actualizadas (`can_update`, `can_delete`).

### `DELETE /api/public-files/{id}/permissions/{user_id}`
Revoca tajantemente y borra el registro de permisos del usuario X en el archivo en cuestión. Retorna estatus `204 No Content` si es exitoso.

---

## 4. Sincronización y Caché (Last-Modified)

El sistema soporta endpoints ligeros para consultar exclusivamente la fecha más reciente de modificación entre los registros.

### `GET /api/public-files/last-modified`
Ruta pública (no requiere token de autenticación) diseñada para chequeos de estrés de caché. Devuelve el `updated_at` más reciente de toda la tabla `public_files` o `null` si no hay registros activos.

**Respuesta Exitosa (200 OK):**
```json
{
    "last_modified": "2026-03-21T16:15:30.000000Z"
}
```

### `GET /api/public-files/sync`
Sirve para mantener sincronizado al cliente obteniendo todos los cambios, registros nuevos y eliminaciones incrementales a partir de una fecha en concreto (`last_sync`). Trae los datos pero **no** trae el archivo binario.

**Query Params:**
- `last_sync` (Date, ISO-8601, Obligatorio). Ejemplo: `?last_sync=2024-03-21T18:00:00.000000Z`.

**Respuesta Exitosa (200 OK):**
Retorna un arreglo de objetos tipo `PublicFile` con todos aquellos modificados o creados. Aquellos archivos que fueron borrados vendrán con un valor date asignado en la propieda `deleted_at`, aprovechando el SoftDelete para enterar al cliente.

### `GET /api/public-files/{id}/download`
Complementa al método de sincronización y listados. Permite que el cliente decida a demanda si desea descargar los bytes reales de un archivo público devolviendo directamente la descarga de archivo.

**Respuesta Exitosa (200 OK - File/Binary Response)**
*(Descarga por stream del archivo original).*

---

## 5. Estructura de las Tablas (Base de Datos)
Esta información es provista para conformar de forma más precisa el estado local (caché/offline).

### `public_files`
- `id` (BigInt, PK, Auto Increment)
- `uuid` (UUID, Unique)
- `user_id` (BigInt, FK => users.id, Cascade Delete)
- `public_file_catalog_id` (BigInt, FK => public_file_catalogs.id, Nullable, Null on Delete)
- `name` (String 255)
- `path` (String 255, Unique)
- `mime_type` (String 255)
- `size` (Unsigned BigInt)
- `hash` (String 64)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)
- `deleted_at` (Timestamp, Soft deletes)

### `public_file_catalogs`
- `id` (int, PK, Auto Increment)
- `name` (String 255, Unique)
- `description` (Text, Nullable)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### `public_file_permissions`
- `public_file_id` (BigInt, PK/FK => public_files.id, Cascade Delete)
- `user_id` (BigInt, PK/FK => users.id, Cascade Delete)
- `can_update` (Boolean, Default: false)
- `can_delete` (Boolean, Default: false)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)
*(Llave primaria compuesta: `public_file_id`, `user_id`)*
