# Documentación API SuitAPI

## Casos (Suits)

### Agregar Participante
`POST /api/cases/{id}/participants`

Agrega un usuario como participante a un caso.

**Body:**
- `user_tag`: (string) El tag único del usuario.
- `permission_level`: (string) Nivel de permiso (`read`, `write`).

**Respuesta:**
- `200 OK`: `{"message": "Participant added"}`

---

### Quitar Participante
`DELETE /api/cases/{id}/participants/{user_id}`

Elimina un usuario de la lista de participantes de un caso y revoca su acceso a la agenda del mismo.

**Parámetros:**
- `id`: ID del caso.
- `user_id`: ID del usuario a eliminar.

**Respuesta:**
- `200 OK`: `{"message": "Participant removed"}`

---

### Ver Participantes
`GET /api/cases/{id}/participants`

Retorna la lista de todos los participantes, incluido el creador (dueño) del caso.

---

### Permisos de Escritura (Archivos, Multimedia, Honorarios, Gastos)
Para realizar operaciones de creación, actualización o eliminación en objetos asociados a un caso, el usuario debe cumplir una de las siguientes condiciones:
1. Ser **Administrador**.
2. Ser el **Abogado Dueño** del caso.
3. Ser un **Participante** con `permission_level` igual a `write`.

Si el nivel de permiso es `read`, el usuario solo podrá visualizar el contenido but no podrá realizar modificaciones (retornará `403 Forbidden`).

En el caso de **Archivos** y **Multimedia** que no estén asociados a un caso (`suit_case_id` null), solo el propietario (quien subió el archivo) o un administrador pueden borrarlos.

---

## Honorarios

### Listar Honorarios (por Caso o Cliente)
`GET /api/suit-cases/{suit_case}/honorarios`
`GET /api/clients/{client}/honorarios`

Permite obtener los honorarios asociados a un caso o cliente.

**Query Parameters:**
- `user_id`: (opcional, int) Filtra los honorarios creados por un usuario específico.

**Reglas de Filtrado:**
- Si el usuario es **Administrador**, puede filtrar por cualquier `user_id`.
- Si el usuario **NO es Administrador**, el resultado estará limitado a sus propios honorarios, independientemente de si envía un `user_id` diferente.

### Listar Honorarios por Rango de Fechas
`GET /api/honorarios/by-date-range`

Retorna los honorarios creados entre dos fechas.

**Query Parameters:**
- `from`: (requerido, date Y-m-d) Fecha inicial.
- `to`: (requerido, date Y-m-d) Fecha final.
- `user_id`: (opcional, int) Filtra los honorarios creados por un usuario específico (aplican las mismas reglas de filtrado que arriba).

---

## Repositorio de Archivos Públicos (Public Files)

Este repositorio permite a cualquier usuario autenticado subir, listar, editar y eliminar archivos que **no están asociados a un caso** ni requieren encriptación, ahorrando así procesamiento y almacenamiento.

### Listar Archivos Públicos
`GET /api/public-files`

Obtiene una lista paginada (15 por página) de los archivos públicos ordenados por los más recientes.

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid-del-archivo",
      "name": "nombre_archivo.pdf",
      "url": "http://dominio/storage/files/uuid-del-archivo.pdf",
      "mime_type": "application/pdf",
      "size": 102400,
      "hash": "hash_sha256_del_archivo",
      "created_at": "2026-03-20T23:45:00+00:00",
      "updated_at": "2026-03-20T23:45:00+00:00",
      "user": {
        "id": 1,
        "name": "Nombre de Usuario",
        "email": "usuario@ejemplo.com"
      }
    }
  ],
  "links": { ... },
  "meta": { ... }
}
```

### Subir un Archivo Público
`POST /api/public-files`

Sube un archivo al repositorio público. El límite máximo es de 100MB.

**Body (multipart/form-data):**
- `file`: (archivo) El archivo que deseas subir.

**Respuesta Exitosa (201 Created):**
Retorna la representación JSON del archivo subido en la clave `data` (similar al formato listado arriba).

### Ver un Archivo Específico
`GET /api/public-files/{public_file}`

**Parámetros de Ruta:**
- `public_file`: El UUID del archivo.

**Respuesta Exitosa (200 OK):**
Retorna el JSON del archivo solicitado.

### Modificar Nombre del Archivo
`PUT /api/public-files/{public_file}`

Permite cambiar el nombre de presentación de un archivo público.

**Body (JSON o Form Data):**
- `name`: (string, max: 255) Nuevo nombre para el archivo.

**Respuesta Exitosa (200 OK):**
Retorna el JSON del archivo actualizado.

### Eliminar Archivo Público
`DELETE /api/public-files/{public_file}`

Elimina lógicamente (soft delete) el registro del archivo.

**Respuesta Exitosa (204 No Content):**
No retorna contenido si se elimina correctamente.

### Obtener Fecha de Última Modificación
`GET /api/public-files/last-modified`

Retorna la fecha de la última actualización de cualquier registro de archivo público, útil para control de caché del cliente.

**Respuesta Exitosa (200 OK):**
```json
{
  "last_modified": "2026-03-20T23:45:00+00:00"
}
```
