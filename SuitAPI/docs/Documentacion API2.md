# Documentación de API - SuitAPI (Parte 1 y 2)

Esta documentación cubre las rutas esenciales de la API de SuitAPI, incluyendo autenticación, caché, casos, documentos, clientes y archivos públicos.

---

## 1. Comprobación de Estado (Health Check)
`GET /api/is_on`

Verifica que el servidor de la API esté activo y respondiendo. No requiere autenticación.

**Ejemplo de uso:**
```http
GET /api/is_on HTTP/1.1
```

**Respuesta Exitosa (200 OK):**
```text
OK
```

---

## 2. Inicio de Sesión (Login)
`POST /api/login`

Autentica a un usuario mediante su etiqueta (tag) y contraseña, retornando un token de acceso de Laravel Sanctum.

- **Body (JSON):**
  - `tag` (string, requerido): Identificador del usuario.
  - `password` (string, requerido): Contraseña del usuario.

**Ejemplo de uso:**
```http
POST /api/login HTTP/1.1
Content-Type: application/json

{
  "tag": "jdoe",
  "password": "password123"
}
```

**Respuesta Exitosa (200 OK):**
```json
{
  "access_token": "1|abcdef123456...",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "name": "John Doe",
    "tag": "jdoe",
    "email": "john@example.com",
    "role": "lawyer",
    "created_at": "2026-03-21T10:00:00.000000Z",
    "updated_at": "2026-03-21T10:00:00.000000Z"
  }
}
```

---

## 3. Registro de Usuario
`POST /api/register`

Registra un nuevo usuario en el sistema. **Requiere que el usuario que realiza la petición sea Administrador.**

- **Body (JSON/Multipart):**
  - `tag` (string, requerido, único): ID de usuario único.
  - `name` (string, requerido): Nombre completo.
  - `email` (string, opcional, único): Correo electrónico.
  - `password` (string, requerido): Mínimo 8 caracteres.
  - `role` (string, opcional): `user`, `lawyer` o `admin`. Por defecto `user`.
  - `photo` (archivo, opcional): Imagen (jpg, jpeg, png, máx 4MB).

---

## 4. Cierre de Sesión (Logout)
`POST /api/logout`

Revoca el token de acceso actual del usuario autenticado.

**Respuesta Exitosa (200 OK):**
```json
{
  "message": "Sesión cerrada correctamente."
}
```

---

## 5. Información del Usuario Autenticado
`GET /api/user`

Retorna la información completa del perfil del usuario que posee el token enviado.

**Respuesta Exitosa (200 OK):**
Objeto completo del modelo `User`.

---

## 6. Última Modificación Global de Casos
`GET /api/cases/last-modified`

Retorna la fecha y hora de la última modificación ocurrida en cualquier caso accesible por el usuario.

**Respuesta Exitosa (200 OK):**
```json
{
  "last_modified": "2026-03-21T16:00:00.000000Z"
}
```

---

## 7. Última Modificación de un Caso Específico
`GET /api/cases/{case}/last-modified`

Retorna un reporte detallado de las últimas modificaciones dentro de un caso y sus entidades relacionadas (partes, gastos, honorarios, documentos, etc.).

**Ejemplo de uso:**
`GET /api/cases/10/last-modified`

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

## 8. Última Modificación Global de Documentos
`GET /api/documents/last-modified`

Indica cuándo se modificó/creó por última vez un documento accesible para el usuario.

**Respuesta Exitosa (200 OK):**
```json
{
  "last_modified": "2026-03-21T16:20:00.000000Z"
}
```

---

## 9. Última Modificación de Documento Específico
`GET /api/documents/{document}/last-modified`

Retorna el timestamp de actualización de un documento mediante su ID.

---

## 10. Última Modificación Global de Clientes
`GET /api/clients/last-modified`

Indica cuándo se modificó por última vez algún registro en la base de datos de clientes (incluyendo registros eliminados suavemente).

---

## 11. Última Modificación de Cliente Específico
`GET /api/clients/{client}/last-modified`

Retorna el timestamp de actualización de un cliente mediante su ID.

---

## 12. Última Modificación Global de Usuarios
`GET /api/users/last-modified`

Timestamp global de la tabla de usuarios, útil para sincronizar listas de contactos o participantes.

---

## 13. Última Modificación de Usuario Específico
`GET /api/users/{user}/last-modified`

Retorna el timestamp de actualización de un usuario específico.

---

## 14. Última Modificación Global de Agendas
`GET /api/agendas/last-modified`

Retorna el timestamp de la última vez que la configuración de agendas (permisos o creación de nuevas agendas) cambió para el usuario.

**Respuesta Exitosa (200 OK):**
```json
{
  "last_modified": "2026-03-21 16:30:00"
}
```

---

## 15. Última Modificación de Agenda Mensual
`GET /api/agenda/{agenda}/last-modified/{month}/{year}`

Obtiene la fecha de última modificación de los eventos contenidos en una agenda para un mes específico.

- **Parámetros de ruta:**
  - `agenda`: ID de la agenda.
  - `month`: Mes (1 a 12).
  - `year`: Año (4 dígitos).

**Respuesta Exitosa (200 OK):**
```json
{
  "last_modified": "2026-03-21 13:44:47"
}
```

---

## 16. Última Modificación Global de Tipos de Evento
`GET /api/event-types/last-modified`

Retorna el timestamp de la última vez que se creó o modificó un tipo de evento.

---

## 17. Última Modificación Global de Plantillas
`GET /api/templates/last-modified`

Retorna el timestamp de la última modificación en la tabla de plantillas de documentos.

---

## 18. Última Modificación Global de Categorías de Plantillas
`GET /api/template-categories/last-modified`

Retorna el timestamp de la última modificación en las categorías de plantillas.

---

## 19. Listar Agendas Accesibles
`GET /api/agendas`

Retorna una lista de todas las agendas a las que el usuario tiene acceso (Agenda Personal y Agendas de Casos).

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Agenda de John Doe",
    "type": "personal",
    "created_at": "...",
    "updated_at": "..."
  },
  {
    "id": 5,
    "name": "Caso: Smith vs. Jones",
    "type": "case",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

---

## 20. Estado de una Agenda Específica
`GET /api/agendas/status/{id}`

Retorna el timestamp `updated_at` de una agenda específica. Útil para verificar si ha habido cambios estructurales o de permisos.

---

## 21. Último Evento Actualizado
`GET /api/agendas/latest-event`

Busca en todas las agendas accesibles y retorna el timestamp del evento que fue modificado más recientemente.

**Respuesta Exitosa (200 OK):**
```json
{
  "last_event_update": "2026-03-21T16:30:00.000000Z"
}
```

---

## 22. Sincronización Descendente de Eventos (Sync Down)
`GET /api/agendas/sync?since={timestamp}`

Obtiene todos los eventos de todas las agendas accesibles que hayan sido creados o modificados después de la fecha proporcionada.

- **Query Params:**
  - `since` (date, requerido): Fecha de corte para la sincronización.

---

## 23. Sincronización Ascendente de Eventos (Sync Up)
`POST /api/agendas/sync`

Permite crear o actualizar múltiples eventos de forma masiva desde un cliente offline.

- **Body (JSON):**
  - `events` (array, requerido): Lista de objetos de evento. Cada objeto debe incluir `title`, `starts_at`, `agenda_id` y opcionalmente `event_type_id` e `id` (si es una actualización).

---

## 24. Todos los Eventos del Mes Actual
`GET /api/agendas/all-events`

Retorna todos los eventos de todas las agendas accesibles para el mes actual y el mes siguiente.

---

## 25. Última Modificación de Todos los Eventos (Mes Específico)
`GET /api/agendas/all-events/last-modified/{month}/{year}`

Retorna el timestamp de la última modificación entre todos los eventos de todas las agendas para un mes y año dados.

---

## 26. Todos los Eventos por Mes y Año
`GET /api/agendas/all-events/{month}/{year}`

Filtra y retorna todos los eventos de todas las agendas para el mes y año especificados.

---

## 27. Eventos de una Agenda (Mes Actual)
`GET /api/agenda/{agenda}`

Retorna los eventos de una agenda específica para el mes actual.

---

## 28. Eventos de una Agenda por Mes y Año
`GET /api/agenda/{agenda}/{month}/{year}`

Retorna los eventos de una agenda específica para el mes y año indicados.

---

## 29. Eventos Filtrados por Tipo
`GET /api/agendas/all-events/type/{eventType}/{month}/{year}`

Retorna todos los eventos de todas las agendas que coincidan con un tipo de evento específico para el mes y año dados.

---

## 31. Listar Casos
`GET /api/cases`

Retorna una lista de todos los casos en los que el usuario es el creador (abogado) o un participante.

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "title": "Sucesión Pérez",
    "lawyer_id": 1,
    "case_type_id": 2,
    "start_date": "2026-01-15",
    "details": "Detalles del caso...",
    "status": "active",
    "nro_expediente": "EXP-12345/26",
    "radicacion_id": 1,
    "created_at": "2026-03-21T10:00:00.000000Z",
    "updated_at": "2026-03-21T10:00:00.000000Z"
  }
]
```

---

## 32. Crear un Caso
`POST /api/cases`

Crea un nuevo caso legal y su agenda asociada.

- **Body (JSON):**
  - `title` (string, requerido): Título descriptivo.
  - `case_type_id` (integer, requerido): ID del tipo de caso.
  - `start_date` (date, requerido, formato Y-m-d): Fecha de inicio.
  - `details` (string, opcional): Detalles adicionales.
  - `nro_expediente` (string, requerido): Número de expediente.
  - `radicacion_id` (integer, requerido): ID de la radicación (juzgado/tribunal).

**Ejemplo de uso:**
```json
{
  "title": "Smith vs. Johnson",
  "case_type_id": 1,
  "start_date": "2026-03-21",
  "details": "Litigio por daños y perjuicios.",
  "nro_expediente": "7890/2026",
  "radicacion_id": 3
}
```

**Respuesta Exitosa (201 Created):**
Retorna un objeto con el `case`, su `agenda` y los timestamps de última modificación actualizados.

---

## 33. Ver Detalle de un Caso
`GET /api/cases/{case}`

Retorna la información detallada de un caso específico.

---

## 34. Actualizar un Caso
`PUT /api/cases/{case}`

Actualiza la información de un caso existente. Soporta detección de conflictos mediante `last_updated_at`.

- **Body (JSON):**
  - Campos opcionales: `title`, `details`, `start_date`, `case_type_id`, `nro_expediente`, `radicacion_id`.
  - `last_updated_at` (ISO8601 date, opcional): Fecha de última actualización conocida por el cliente para evitar sobreescritura de cambios concurrentes.

---

## 35. Eliminar un Caso
`DELETE /api/cases/{case}`

Realiza un borrado lógico (soft delete) del caso.

---

## 36. Listar Clientes
`GET /api/clients`

Retorna un listado paginado de clientes. Soporta búsqueda y filtros.

- **Query Params:**
  - `search` (string, opcional): Filtra por nombre, identificación o email.
  - `type` (string, opcional): `person` o `company`.
  - `status` (string, opcional): `active`, `inactive` o `debtor`.

---

## 37. Crear un Cliente
`POST /api/clients`

Crea un nuevo registro de cliente (persona física o jurídica).

- **Body (JSON):**
  - `first_name` (string, requerido).
  - `last_name` (string, requerido).
  - `identification_number` (string, opcional, único).
  - `email` (email, opcional).
  - `type` (string, opcional): `person` o `company`.

---

## 38. Listar Documentos
`GET /api/documents`

Lista los documentos accesibles para el usuario.

---

## 39. Subir un Documento
`POST /api/documents`

Sube un nuevo archivo al sistema asociado opcionalmente a un caso o evento.

- **Body (Multipart/Form-Data):**
  - `name` (string, requerido): Nombre para el documento.
  - `file` (archivo, requerido): Formatos permitidos: html, txt, json. Máximo 20MB.
  - `suit_case_id` (integer, opcional): ID del caso asociado.
  - `event_id` (integer, opcional): ID del evento asociado.

---

## 40. Versiones de un Documento
`GET /api/documents/{document}/versions`

Lista el historial de versiones de un documento específico, incluyendo quién realizó el cambio y cuándo.

---

## 41. Crear un Vencimiento (Plazo)
`POST /api/vencimientos`

Registra un vencimiento procesal. Si no se asocia a un evento existente, se crea uno automáticamente en la agenda del caso.

- **Body (JSON):**
  - `due_date` (datetime, requerido): Fecha y hora del vencimiento.
  - `suit_case_id` (integer, requerido si no hay event_id).
  - `title` (string, opcional).
  - `priority` (string, opcional): `Normal` o `Urgente`.
  - `notify_at` (datetime, opcional): Fecha para la notificación previa.

---

## 42. Crear un Evento Manual
`POST /api/events`

Crea un evento en una agenda específica.

- **Body (JSON):**
  - `agenda_id` (integer, requerido).
  - `title` (string, requerido).
  - `starts_at` (datetime, requerido).
  - `description` (string, opcional).
  - `is_all_day` (boolean, opcional).

---

## 43. Listar Usuarios
`GET /api/users`

Lista todos los usuarios registrados (útil para asignar participantes a casos).

---

## 44. Crear un Archivo Público
`POST /api/public-files`

Sube un archivo a la sección de archivos públicos para compartir con otros usuarios del sistema o para acceso general.

- **Body (Multipart/Form-Data):**
  - `file` (archivo, requerido): Máximo 100MB.
  - `public_file_catalog_id` (integer, opcional): ID del catálogo donde categorizar el archivo.

---

## 46. Vencimientos por Mes y Año
`GET /api/vencimientos/{month}/{year}`

Obtiene todos los vencimientos que ocurren en el mes y año solicitados, filtrando por las agendas a las que el usuario tiene acceso.

- **Parámetros de ruta:**
  - `month` (integer, 1-12): Mes a consultar.
  - `year` (integer, 4 dígitos): Año a consultar.

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 12,
    "title": "Presentación de recurso",
    "due_date": "2026-04-15 10:00:00",
    "status": "Pendiente",
    "priority": "Normal",
    "event": {
      "id": 100,
      "notifications": []
    }
  }
]
```

---

## 47. Detalle de Vencimiento
`GET /api/vencimientos/{deadline}`

Retorna la información completa de un vencimiento específico, incluyendo su estado calculado (Pendiente, Vencido, Urgente, etc.).

**Respuesta Exitosa (200 OK):**
Objeto completo del recurso `Deadline`.

---

## 48. Actualizar Vencimiento
`PUT /api/vencimientos/{deadline}`

Actualiza campos de un vencimiento como título, descripción, prioridad o fecha.

- **Body (JSON):**
  - `title` (string, opcional).
  - `description` (string, opcional).
  - `priority` (string, opcional): `Normal` o `Urgente`.
  - `due_date` (datetime, opcional).
  - `notify_at` (datetime, opcional).

---

## 49. Eliminar Vencimiento
`DELETE /api/vencimientos/{deadline}`

Elimina un vencimiento de forma lógica.

---

## 50. Completar Vencimiento
`POST /api/vencimientos/{deadline}/completar`

Marca un vencimiento como `Cumplido`. No se puede deshacer esta acción mediante rutas estándar de actualización.

**Respuesta Exitosa (200 OK):**
Objeto del vencimiento con status `Cumplido`.

---

## 51. Prorrogar Vencimiento
`POST /api/vencimientos/{deadline}/prorrogar`

Establece una nueva fecha para un vencimiento que ya se encuentra `Vencido`.

- **Body (JSON):**
  - `due_date` (datetime, requerido): Nueva fecha futura.
  - `priority` (string, opcional).

**Ejemplo de uso:**
```json
{
  "due_date": "2026-05-01 09:00:00",
  "priority": "Normal"
}
```

---

## 52. Listar Casos Abiertos
`GET /api/cases/open`

Retorna únicamente los casos que tienen un estado activo.

---

## 53. Listar Casos Cerrados
`GET /api/cases/closed`

Retorna únicamente los casos que han sido cerrados o finalizados.

---

## 54. Cerrar un Caso
`POST /api/cases/{id}/close`

Finaliza un caso, estableciendo la fecha de cierre (`end_date`) al momento actual.

---

## 55. Reabrir un Caso
`POST /api/cases/{id}/reopen`

Cambia el estado de un caso de `closed` a `active` y limpia la fecha de finalización.

---

## 56. Actualizar Perfil de Usuario
`PUT /api/user/profile`

Permite al usuario autenticado modificar su nombre, apellido, email o contraseña.

- **Body (JSON):**
  - `name`, `last_name`, `email`, `password`.

---

## 57. Subir Foto de Perfil
`POST /api/user/profile-photo`

Carga una imagen para el perfil del usuario.

- **Body (Multipart):**
  - `photo` (archivo): Imagen jpg, jpeg o png.

---

## 58. Buscar Usuarios por Perfil
`GET /api/users/search?q={query}`

Busca usuarios por su tag o nombre completo.

- **Query Params:**
  - `q` (string): Término de búsqueda.

---

## 59. Subir Archivo Multimedia
`POST /api/multimedia`

Sube un archivo de imagen o video y lo asocia opcionalmente a un caso.

- **Body (Multipart):**
  - `file` (archivo): Archivo multimedia.
  - `suit_case_id` (integer, opcional).

---

## 60. Listar Multimedia
`GET /api/multimedia`

Lista de forma paginada todos los archivos multimedia a los que el usuario tiene acceso.

---

## 61. Honorarios por Rango de Fecha
`GET /api/honorarios/by-date-range?from=YYYY-MM-DD&to=YYYY-MM-DD`

Retorna un listado de honorarios profesionales dentro de un rango de fechas específico.

- **Query Params:**
  - `from` (date, requerido): Fecha de inicio (E.g. 2026-01-01).
  - `to` (date, requerido): Fecha de fin (E.g. 2026-12-31).
  - `user_id` (integer, opcional): Filtrar por un usuario específico (Solo Admin).

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "suit_case_id": 5,
      "client_id": 10,
      "user_id": 1,
      "monto": 50000.00,
      "detalles": "Honorarios por defensa en juicio civil",
      "pagado": 20000.00,
      "total_entregas": 20000.00,
      "created_at": "2026-03-21T10:00:00.000000Z",
      "updated_at": "2026-03-21T10:00:00.000000Z"
    }
  ]
}
```

---

## 62. Honorarios de un Caso
`GET /api/suit-cases/{suit_case}/honorarios`

Lista todos los honorarios asociados a un caso legal específico.

---

## 63. Crear Honorario en un Caso
`POST /api/suit-cases/{suit_case}/honorarios`

Registra un nuevo honorario profesional vinculado a un caso y a uno de sus clientes.

- **Body (JSON):**
  - `client_id` (integer, requerido): ID del cliente deudor (debe pertenecer al caso).
  - `monto` (numeric, requerido): Importe total de la acreencia.
  - `detalles` (string, opcional): Descripción o concepto.

**Ejemplo de uso:**
```http
POST /api/suit-cases/5/honorarios HTTP/1.1
Content-Type: application/json

{
  "client_id": 10,
  "monto": 75000,
  "detalles": "Convenio de honorarios cuota litis"
}
```

---

## 64. Honorarios de un Cliente
`GET /api/clients/{client}/honorarios`

Retorna todos los registros de honorarios donde el cliente especificado es el deudor.

---

## 65. Detalle de Honorario
`GET /api/honorarios/{honorario}`

Obtiene la información detallada de un registro de honorario, incluyendo el desglose de entregas/pagos realizados.

---

## 66. Actualizar Honorario
`PUT /api/honorarios/{honorario}`

Permite modificar el monto o los detalles de un honorario existente.

- **Body (JSON):**
  - `monto` (numeric, opcional).
  - `detalles` (string, opcional).

---

## 67. Eliminar Honorario
`DELETE /api/honorarios/{honorario}`

Elimina permanentemente el registro de honorario (si no tiene entregas asociadas, dependiendo de la política).

---

## 68. Listar Entregas de un Honorario
`GET /api/honorarios/{honorario}/entregas`

Retorna el historial de pagos (entregas) realizados para saldar un honorario profesional.

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": 5,
      "honorario_id": 1,
      "tipo_pago_id": 2,
      "monto": 10000.00,
      "nota": "Pago inicial en efectivo",
      "tipo_pago": {
        "id": 2,
        "name": "Efectivo"
      },
      "created_at": "2026-03-21T11:00:00.000000Z"
    }
  ]
}
```

---

## 69. Registrar una Entrega
`POST /api/honorarios/{honorario}/entregas`

Registra un nuevo pago parcial o total sobre un honorario.

- **Body (JSON):**
  - `tipo_pago_id` (integer, requerido): ID del método de pago (Efectivo, Transferencia, etc).
  - `monto` (numeric, requerido): Importe de la entrega.
  - `nota` (string, opcional): Comentario adicional.

**Ejemplo de uso:**
```http
POST /api/honorarios/1/entregas HTTP/1.1
Content-Type: application/json

{
  "tipo_pago_id": 1,
  "monto": 15000,
  "nota": "Transferencia bancaria CBU..."
}
```

---

## 70. Detalle de Entrega
`GET /api/entregas/{entrega}`

Retorna la información de un pago específico.

---

## 71. Actualizar Entrega
`PUT /api/entregas/{entrega}`

Permite corregir el monto, la nota o el tipo de pago de una entrega ya registrada.

---

## 72. Eliminar Entrega
`DELETE /api/entregas/{entrega}`

Elimina un registro de pago. El sistema recalculará automáticamente el saldo `pagado` en el honorario padre.

---

## 73. Gastos por Rango de Fecha
`GET /api/gasto-suit-cases/by-date-range?from=...&to=...`

Retorna los gastos operacionales de casos (fotocopias, diligencias, etc.) incurridos en un periodo.

---

## 74. Gastos de un Caso
`GET /api/suit-cases/{suit_case}/gastos`

Lista todos los gastos cargados a un caso específico.

---

## 75. Registrar Gasto en un Caso
`POST /api/suit-cases/{suit_case}/gastos`

Carga un nuevo gasto a un caso, permitiendo asociarlo a uno o varios clientes de dicho caso.

- **Body (JSON):**
  - `gasto_id` (integer, requerido): ID del tipo de gasto (del catálogo general).
  - `monto` (numeric, requerido): Importe del gasto.
  - `client_ids` (array, opcional): Lista de IDs de clientes que deben cubrir este gasto.
  - `client_id` (integer, opcional): Alternativa simple para un solo cliente.

**Ejemplo de uso:**
```http
POST /api/suit-cases/5/gastos HTTP/1.1
Content-Type: application/json

{
  "gasto_id": 3,
  "monto": 1250.50,
  "client_ids": [10, 11]
}
```

---

## 76. Detalle de Gasto de Caso
`GET /api/gasto-suit-cases/{gasto_suit_case}`

Retorna la información de un gasto específico cargado a un caso, incluyendo a qué clientes fue prorrateado.

---

## 77. Actualizar Gasto de Caso
`PUT /api/gasto-suit-cases/{gasto_suit_case}`

Permite modificar el monto o la asignación de clientes de un gasto.

---

## 78. Eliminar Gasto de Caso
`DELETE /api/gasto-suit-cases/{gasto_suit_case}`

Elimina el registro de gasto del caso.

---

## 79. Última Modificación de Catálogo de Gastos
`GET /api/gastos/last-modified`

Retorna el timestamp de la última vez que se actualizó el catálogo maestro de tipos de gastos.

---

## 80. Listar Catálogo de Gastos
`GET /api/gastos`

Retorna los tipos de gastos disponibles en el sistema (ej: "Tasa de Justicia", "Fotocopias", "Viáticos").

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "nombre": "Tasa de Justicia",
    "descripcion": "Pago de tasas judiciales obligatorias"
  }
]
```

---

## 81. Participantes de un Caso
`GET /api/cases/{id}/participants`

Retorna todos los participantes de un caso específico, incluyendo al dueño (abogado) y a los colaboradores con sus niveles de permiso.

**Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "tag": "jdoe",
    "pivot": {
      "permission_level": "owner"
    }
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "tag": "jsmith",
    "pivot": {
      "permission_level": "editor"
    }
  }
]
```

---

## 82. Agregar Participante a un Caso
`POST /api/cases/{id}/participants`

Añade un nuevo colaborador a un caso legal y le otorga acceso a la agenda del mismo.

- **Body (JSON):**
  - `user_tag` (string, requerido): Tag del usuario a añadir.
  - `permission_level` (string, requerido): Nivel de permiso (ej: `read`, `write`, `admin`).

**Ejemplo de uso:**
```json
{
  "user_tag": "jsmith",
  "permission_level": "editor"
}
```

---

## 83. Quitar Participante de un Caso
`DELETE /api/cases/{id}/participants/{user_id}`

Remueve a un participante de un caso y revoca su acceso a la agenda asociada.

---

## 84. Listar Tipos de Caso
`GET /api/case-types`

Retorna el catálogo de tipos de casos legales configurados en el sistema (ej: Civil, Penal, Laboral).

---

## 85. Crear Tipo de Caso
`POST /api/case-types`

Registra una nueva categoría para clasificar casos.

- **Body (JSON):**
  - `name` (string, requerido): Nombre de la categoría.
  - `description` (string, opcional): Breve descripción.
  - `eventColor` (string, opcional): Color en formato HEX o nombre CSS para eventos asociados.

---

## 86. Listar Tipos de Evento
`GET /api/event-types`

Retorna la lista de tipos de eventos de agenda disponibles (ej: Audiencia, Reunión, Plazo).

---

## 87. Crear Tipo de Evento
`POST /api/event-types`

Añade una nueva categoría de evento al sistema.

- **Body (JSON):**
  - `name` (string, requerido): Nombre del tipo de evento.
  - `color` (string, opcional): Color asociado para la visualización en el calendario.

---

## 88. Listar Notificaciones Pendientes
`GET /api/notifications`

Retorna las notificaciones programadas para el usuario autenticado que aún no han sido procesadas.

---

## 89. Sincronización Descendente de Notificaciones
`GET /api/notifications/sync?since={timestamp}`

Obtiene las notificaciones creadas o modificadas después de una fecha establecida para sincronización con clientes offline.

---

## 90. Sincronización Ascendente de Notificaciones
`POST /api/notifications/sync`

Permite subir cambios masivos en las configuraciones de notificaciones de eventos.

- **Body (JSON):**
  - `notifications` (array, requerido): Lista de objetos con `event_id` y `notify_at`.

---

## 91. Notificaciones hasta Hoy
`GET /api/notifications/until-today`

Retorna todas las notificaciones programadas hasta el final del día actual y las marca como enviadas/procesadas (borrado físico).

---

## 92. Última Modificación Global de Notificaciones
`GET /api/notifications/last-modified`

Retorna el timestamp de la última actualización en la configuración de notificaciones del usuario.

---

## 93. Ver Configuración de Notificación de un Evento
`GET /api/events/{event}/notification`

Retorna la configuración de alerta programada para un evento específico para el usuario actual.

---

## 94. Configurar Notificación para un Evento
`POST /api/events/{event}/notification`

Crea una nueva alerta programada para un evento.

- **Body (JSON):**
  - `notify_at` (datetime, requerido): Fecha y hora en la que se debe disparar la alerta.

---

## 95. Actualizar Notificación de un Evento
`PUT /api/events/{event}/notification`

Modifica la fecha/hora de una alerta ya configurada.

---

## 96. Eliminar Notificación de un Evento
`DELETE /api/events/{event}/notification`

Elimina la configuración de alerta para el evento especificado.

---

## 97. Verificar si un Documento está Bloqueado
`GET /api/documents/{document}/is-locked`

Indica si un documento se encuentra actualmente bajo edición por algún usuario.

**Respuesta Exitosa (200 OK):**
```json
{
  "is_locked": true
}
```

---

## 98. Bloquear Documento para Edición
`POST /api/documents/{document}/lock`

Adquiere un bloqueo exclusivo sobre un documento por un periodo de 5 minutos, evitando conflictos de edición concurrente.

---

## 99. Desbloquear Documento
`DELETE /api/documents/{document}/lock`

Libera el bloqueo de un documento antes de que expire el tiempo de gracia.

---

## 100. Listar Categorías de Plantillas
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

