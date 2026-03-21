# Manual de usuario — SuitAPI Consola

## ¿Qué es SuitAPI Consola?

SuitAPI Consola es una aplicación de escritorio que inicia y administra el stack de servidores necesario para ejecutar SuitAPI: la base de datos PostgreSQL y el servidor web FrankenPHP (que incluye la aplicación Laravel y el servicio de descubrimiento UDP). Todo el stack arranca automáticamente al abrir la aplicación.

---

## Ventana principal

Al abrir la aplicación, la ventana muestra una consola de texto donde aparece en tiempo real la salida de todos los procesos. En la parte inferior hay una fila de botones para controlar los servidores.

### Barra de menú

En la parte superior hay tres opciones:

| Opción | Acción |
|---|---|
| **Botones Default** | Muestra los botones de uso diario |
| **Botones Dev** | Muestra los botones de desarrollo |
| **Configuracion** | Abre el diálogo de configuración |

### Botones Default

Son los botones de uso habitual.

**Arrancar servidor**
Inicia PostgreSQL y, una vez que está listo, lanza el servidor HTTP y el servicio de descubrimiento UDP. La consola muestra el progreso paso a paso.

**Parar servidor**
Detiene el servicio UDP, luego el servidor HTTP, y finalmente PostgreSQL de forma limpia.

**Reiniciar servidor**
Equivale a parar y volver a arrancar. Útil cuando se necesita aplicar cambios en el servidor.

**Cerrar servidor**
Detiene todos los servicios y cierra la aplicación por completo.

---

## Bandeja del sistema (system tray)

La aplicación se minimiza a la bandeja del sistema en lugar de cerrarse cuando se hace clic en la X de la ventana. El ícono en la bandeja tiene un menú contextual con tres opciones:

- **Abrir launcher** — muestra la ventana si estaba oculta
- **Ocultar launcher** — minimiza la ventana a la bandeja
- **Salir** — detiene todos los servicios y cierra la aplicación

Hacer doble clic sobre el ícono también muestra la ventana.

> **Importante:** la única forma de cerrar la aplicación por completo es usando **Salir** desde la bandeja o el botón **Cerrar servidor**.

---

## Botones Dev

Para acceder a estos botones, seleccionar **Botones Dev** en la barra de menú.

| Botón | Qué hace |
|---|---|
| **Correr migraciones** | Ejecuta `php artisan migrate --force` sobre la base de datos |
| **Iniciar servidor UDP** | Inicia el servicio de descubrimiento si estaba apagado |
| **Apagar servidor UDP** | Detiene únicamente el servicio de descubrimiento |
| **Reiniciar API** | Detiene y vuelve a iniciar solo el servidor HTTP (sin tocar PostgreSQL) |
| **Reiniciar BD** | Detiene y vuelve a iniciar solo PostgreSQL (sin tocar la API) |
| **Limpiar datos viejos** | Ejecuta el comando de limpieza de archivos eliminados de Laravel inmediatamente |

---

## Configuración

Acceder desde **Configuracion** en la barra de menú. El diálogo tiene dos pestañas: **Backup** y **Server**.

### Pestaña Backup

#### Intervalo de backups

Define cada cuánto tiempo se crea un backup automático de la base de datos. Se elige un número y una unidad de tiempo (Minutos, Horas, Días, Semanas o Meses). El valor por defecto es cada 2 horas.

> El timer de backup sigue corriendo mientras la aplicación esté abierta. Si se cierra y se vuelve a abrir, el timer retoma desde donde quedó: si faltaban 30 minutos para el próximo backup, el siguiente se hará a los 30 minutos de reiniciar, no a las 2 horas.

Al cambiar el intervalo y presionar **OK**, la aplicación preguntará si se desea reiniciar el período desde cero o continuar con el tiempo que faltaba.

#### Rotación de backups

Indica cuántos archivos de backup se guardan en disco. Cuando se alcanza el límite y se va a crear uno nuevo, el más antiguo se elimina automáticamente. El valor por defecto es 5 backups.

#### Crear backup ahora

Crea un backup inmediatamente, fuera del ciclo automático. Guarda los cambios del diálogo, dispara el backup y cierra la ventana de configuración para que se pueda ver el progreso en la consola.

#### Recuperar backup

Abre un segundo diálogo que lista todos los backups disponibles ordenados por fecha. Hay tres opciones:

- **Cancelar** — cierra sin hacer nada
- **Elegir seleccionado** — restaura el backup marcado en la lista
- **Elegir más nuevo** — restaura automáticamente el backup más reciente

> **Atención:** la restauración reemplaza la base de datos actual con la del backup elegido. La aplicación detiene el servidor HTTP y el UDP antes de restaurar, y los vuelve a iniciar al terminar. PostgreSQL debe estar corriendo durante este proceso.

---

### Pestaña Server

> Si los archivos de configuración del servidor (`.env` y `Caddyfile`) no se encuentran en la ubicación esperada, esta pestaña aparecerá deshabilitada y se mostrará un aviso indicando qué archivos faltan.

#### TLS

**Activar TLS interno** — habilita o deshabilita el cifrado TLS en el servidor. Al activarlo se agrega la directiva `tls internal` al Caddyfile, lo que permite usar HTTPS con un certificado autofirmado local.

#### Servidor

- **Hostname** — nombre o dirección del host que publicará el servidor. Si se deja vacío, Caddy usa la IP local de la máquina automáticamente.
- **Puerto** — puerto en el que escucha el servidor HTTP. Se actualiza tanto en el Caddyfile como en la variable `APP_PORT` del archivo `.env`. El valor por defecto es `8443`.

#### Base de datos

Configura las credenciales que usa la aplicación Laravel para conectarse a PostgreSQL. Los cambios se escriben directamente en el archivo `.env`.

| Campo | Variable en .env |
|---|---|
| Host | `DB_HOST` |
| Puerto | `DB_PORT` |
| Base de datos | `DB_DATABASE` |
| Usuario | `DB_USERNAME` |
| Contraseña | `DB_PASSWORD` |

#### Limpieza de archivos

- **Días de antigüedad** — archivos eliminados con más días que este valor serán candidatos a limpieza. Corresponde a `FILE_CLEANUP_DAYS` en el `.env`. El valor por defecto es 30 días.
- **Intervalo de limpieza** — cada cuánto tiempo se ejecuta la limpieza automática (mismas unidades que el intervalo de backup). El valor por defecto es cada 1 semana.

---

## Archivos generados por la aplicación

La aplicación guarda sus datos en la carpeta de datos de usuario del sistema:

| Contenido | Ubicación |
|---|---|
| Log de PostgreSQL | `%AppData%\SuitApiLauncher\logs\postgres.log` |
| Configuración | `%AppData%\SuitApiLauncher\SuitAPI\config.ini` |
| Backups | `%AppData%\SuitApiLauncher\SuitAPI\backups\` |

Los archivos de backup tienen el formato `backup_YYYYMMDD_HHmmss.dump`.

---

## Consola de eventos

Todos los mensajes en la consola tienen un prefijo que indica su origen:

| Prefijo | Origen |
|---|---|
| `[DB]` | PostgreSQL |
| `[DB ERR]` | Error de PostgreSQL |
| `[API]` | Servidor HTTP (FrankenPHP) |
| `[API ERR]` | Error del servidor HTTP |
| `[UDP]` | Servicio de descubrimiento |
| `[UDP ERR]` | Error del servicio de descubrimiento |
| `[MIGRATIONS]` | Migraciones de Laravel |
| `[BACKUP]` | Proceso de backup |
| `[BACKUP ERR]` | Error durante el backup |
| `[RESTORE]` | Proceso de restauración |
| `[RESTORE ERR]` | Error durante la restauración |
| `[LIMPIEZA]` | Limpieza de archivos |
| `[TRAY]` | Bandeja del sistema |
