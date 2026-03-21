### Version 1.0.2
## Public Files - Catálogos y Sistema de Permisos
Se ha expandido el soporte de archivos públicos añadiendo una capa de organización y control de acceso granular.

1.  **Catálogos de Archivos (`public_file_catalogs`)**: Permite agrupar archivos. Se incluye el catálogo "General" por defecto, el cual está protegido contra eliminación.
2.  **Sistema de Permisos (`public_file_permissions`)**: Los propietarios de archivos ahora pueden conceder permisos de `update` y `delete` a otros usuarios específicos.
3.  **Protección de Datos**: Al eliminar un catálogo (excepto el "General"), todos los archivos asociados se reasignan automáticamente al catálogo "General" para evitar la pérdida de organización o huerfanía de datos.
4.  **Integridad**: Si al crear un archivo no se especifica un catálogo, el sistema le asigna automáticamente la categoría "General".

---
### Version 1.0.1
## Bugfix: Vulnerabilidad de Permisos de Lectura
Se ha corregido un problema de seguridad donde los usuarios con nivel de permiso `read` en un caso podían realizar operaciones de escritura (crear, editar, borrar) en Archivos, Multimedia, Honorarios y Gastos del caso. 
Ahora se valida correctamente el nivel de permiso a través de un Gate centralizado `case-write` que delega la autorización a la política del caso.

---
### Version 1.0.0
## Modificacion del endpoint de Cases - LastModified
Ahora devuelve la ultima fecha de actualizacion de cada objeto que comprende el caso, con esto logramos optimizar el uso de cache.
Se implementa tambien un endpoint de SyncDown, para que al encontrarse discrepancias, se le de una fecha a la API, y esta traiga todas las modificaciones dadas esa fecha concreta.

### Version 0.9.9

## Base de Datos - Restricciones de Unicidad
Se ha aplicado una restricción de unicidad (`UNIQUE`) al campo `titulo` en las siguientes tablas para evitar registros duplicados con el mismo nombre:

1.  **Roles (`roles`)**: El campo `titulo` ahora es único. No se pueden crear dos roles con el mismo nombre.
2.  **Tipos de Pago (`tipo_pagos`)**: El campo `titulo` ahora es único.
3.  **Categorías de Gastos (`gastos`)**: El campo `titulo` ahora es único.

## Migraciones Aplicadas
- `2026_03_18_040918_add_unique_to_roles_titulo.php`
- `2026_03_18_040918_add_unique_to_tipo_pagos_titulo.php`
- `2026_03_18_040919_add_unique_to_gastos_titulo.php`

## Catálogos Profesionales - Tipos de Caso y Expediente
Se ha simplificado y actualizado la lista de tipos de casos y sus correspondientes tipos de expedientes.

#### 1. Tipos de Caso (`case-types`)
Los tipos de casos base ahora son:
- Penal
- Civil
- Familia
- Laboral
- Comercial
- Administrativo

**Endpoint:** `GET /api/case-types`

#### 2. Tipos de Expediente (`tipo-expedientes`)
Cada tipo de caso tiene una lista específica de tipos de expediente. Además, cada categoría incluye procedimientos generales como "Principal", "Incidente", "Medida Cautelar" y "Beneficio de Litigar sin Gastos".

**Endpoints:**
- `GET /api/tipo-expedientes`: Lista todos los tipos de expediente.
- `GET /api/case-types/{case_type_id}/tipo-expedientes`: Lista los tipos de expediente filtrados por el ID del tipo de caso.

#### 3. Radicaciones (`radicaciones`)
Se ha ampliado el catálogo de radicaciones para incluir juzgados genéricos y más de 80 localidades de la provincia de Entre Ríos (incluyendo municipios y juntas de gobierno).

**Endpoint:** `GET /api/radicaciones`
