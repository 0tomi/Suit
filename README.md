<div align="center">
  <img src="https://raw.githubusercontent.com/0tomi/Suit/SuitApp/SuitAPI/SuitLogo.png" alt="Suit" width="320">

  # Suit

  **Suite de escritorio + servidor para gestión jurídica, con despliegue portable en Windows.**

  <p>
    <img alt="Laravel" src="https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel&logoColor=white">
    <img alt="Electron" src="https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white">
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
    <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white">
    <img alt="Qt" src="https://img.shields.io/badge/Qt-C%2B%2B-41CD52?logo=qt&logoColor=white">
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Production-4169E1?logo=postgresql&logoColor=white">
    <img alt="FrankenPHP" src="https://img.shields.io/badge/FrankenPHP-Caddy-0A7EA4?logo=caddy&logoColor=white">
    <img alt="License" src="https://img.shields.io/badge/License-MIT-blue.svg">
  </p>
</div>

---

## Qué es Suit

**Suit** no es una sola app: es un ecosistema compuesto por **3 aplicaciones** y **1 instalador** que trabajan juntas para ofrecer una experiencia de escritorio conectada a un servidor local o de red.

La idea es simple:

- **SuitAPI** es el cerebro.
- **SuitApp** es la cara visible para el usuario final.
- **SuitApiLauncher** hace que correr el backend en Windows no sea una ceremonia satánica.
- **Inno Setup** empaqueta todo para que la instalación sea replicable y portable.

---

## Arquitectura general

```text
┌─────────────────────────────────────────────────────────────────┐
│                           SUIT ECOSYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

   Usuario final
        │
        ▼
┌───────────────────────┐
│       SuitApp         │
│ Electron + React      │
│ Interfaz de escritorio│
└──────────┬────────────┘
           │ conexión al servidor
           ▼
┌───────────────────────┐
│       SuitAPI         │
│ Laravel + FrankenPHP  │
│ API / lógica central  │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│      PostgreSQL       │
│   Persistencia prod   │
└───────────────────────┘

En Windows, SuitApiLauncher se encarga de levantar
FrankenPHP + PostgreSQL para servir la API.
```

---

## Componentes del repositorio

| Componente | Rol | Stack principal |
|---|---|---|
| **SuitAPI** | Backend y lógica central del sistema | Laravel 12, PHP 8.2+, Sanctum, FrankenPHP, Caddy |
| **SuitApp** | Aplicación de escritorio para usuario final | Electron, React 19, Vite 7, Tailwind 4, Radix UI |
| **SuitApiLauncher** | Lanzador del backend en Windows | Qt Widgets + C++17 |
| **Instalador** | Empaquetado y despliegue en Windows | Inno Setup |

---

## 1) SuitAPI

Backend principal del ecosistema. Está pensado para correr como **servidor del estudio**, centralizando datos, lógica de negocio y atención de clientes de escritorio.

### Stack

- **Laravel 12**
- **PHP 8.2+**
- **Laravel Sanctum**
- **FrankenPHP** como runtime de PHP
- **Caddy** como servidor embebido a través de FrankenPHP
- **PostgreSQL** en producción
- **SQLite** en desarrollo
- **Pest** para testing

### Enfoque

- En **producción**, la API está preparada para trabajar con **PostgreSQL**.
- En **desarrollo**, puede levantarse con **SQLite**, lo que simplifica bastante el setup local.
- Es el punto central del sistema: autenticación, datos, reglas de negocio y coordinación general.

### Scripts detectados

```bash
composer setup
composer dev
composer start
composer test
```

### Estructura relevante

```text
SuitAPI/
├── SuitAPI/        # Proyecto Laravel
├── docs/
├── README.md
└── SuitLogo.png
```

---

## 2) SuitApp

Aplicación de escritorio orientada al **usuario final**. Busca ofrecer una interfaz moderna, amigable y operativa, con conexión automática al servidor.

### Stack

- **Electron**
- **React 19**
- **Vite 7**
- **Tailwind CSS 4**
- **Radix UI**
- **better-sqlite3**
- **Playwright** y **Vitest** para testing

### Qué aporta

- Interfaz desktop moderna.
- Integración con proceso principal de Electron.
- Tooling actual para desarrollo rápido.
- Suite de tests E2E y unitarios ya montada.

### Scripts detectados

```bash
npm run dev
npm run dev:electron
npm run build
npm run build:electron
npm run build:electron:win
npm run test
npm run test:unit
npm run test:e2e
```

### Estructura relevante

```text
SuitApp/
├── electron/
├── public/
├── scripts/
├── src/
├── tests/
├── package.json
└── vite.config.js
```

---

## 3) SuitApiLauncher

Aplicación de escritorio en **Qt/C++** creada para resolver el problema concreto de servir la API en Windows sin obligar al usuario a tocar consola, servicios o configuraciones manuales.

### Rol

- Levanta el proceso de **FrankenPHP**.
- Levanta el proceso de **PostgreSQL**.
- Permite servir la API de Laravel de forma más automática.
- Funciona como pieza de orquestación local para instalaciones Windows.

### Stack detectado

- **Qt Widgets**
- **C++17**
- Proyecto `.pro` clásico de Qt

### Estructura relevante

```text
SuitApiLauncher/
├── main.cpp
├── mainwindow.cpp / .ui
├── configmanager.*
├── envparser.*
├── phpiniparser.*
├── caddyfileparser.*
├── SuitAPI.pro
└── SuitLogo.png
```

Sí, el nombre `SuitAPI.pro` dentro de `SuitApiLauncher` es medio traicionero. Qt no ayuda, solo observa y juzga.

---

## 4) Instalador con Inno Setup

El instalador es la capa que hace viable la **portabilidad real en Windows**.

### Qué resuelve

- Instalación de la solución completa.
- Apertura de los puertos necesarios.
- Instalación de dependencias del sistema, como **Visual C++ Redistributable**.
- Despliegue coordinado de launcher, backend y binarios requeridos.

### Requisitos para armar el paquete de instalación

Para que el instalador funcione correctamente, debe existir una carpeta que contenga:

- El binario de **SuitApiLauncher** junto con sus dependencias.
- El binario de **PostgreSQL para Windows**.
- El binario de **FrankenPHP para Windows**.
- Dentro de la carpeta de FrankenPHP, la **API Laravel lista para servirse**.

En otras palabras: el instalador no hace magia. Hace packaging bien hecho, que es bastante mejor.

---

## Flujo de despliegue esperado

### Desarrollo

#### SuitAPI

```bash
cd SuitAPI/SuitAPI
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
composer start
```

> En desarrollo puede usarse **SQLite**.

#### SuitApp

```bash
cd SuitApp
npm install
npm run dev:electron
```

#### SuitApiLauncher

Compilar con **Qt Creator** o usando las herramientas de Qt sobre el archivo:

```text
SuitApiLauncher/SuitAPI.pro
```

### Producción en Windows

1. Preparar **SuitApiLauncher** compilado.
2. Incluir binarios de **PostgreSQL** y **FrankenPHP**.
3. Copiar la **SuitAPI Laravel** ya lista dentro del árbol esperado.
4. Construir el instalador con **Inno Setup**.
5. Instalar en la máquina servidor.
6. Conectar clientes desde **SuitApp**.

---

## Estructura del repositorio

```text
Suit/
├── SuitAPI/
│   ├── SuitAPI/
│   ├── docs/
│   └── SuitLogo.png
├── SuitApiLauncher/
│   ├── docs/
│   ├── SuitAPI.pro
│   └── *.cpp / *.h / *.ui
├── SuitApp/
│   ├── electron/
│   ├── src/
│   ├── tests/
│   └── package.json
├── docs/
├── LICENSE
└── README.md
```

---

## Tecnologías principales

### Backend

- Laravel
- PHP
- Sanctum
- FrankenPHP
- Caddy
- PostgreSQL
- SQLite

### Desktop

- Electron
- React
- Vite
- Tailwind CSS
- Radix UI

### Windows / Infra local

- Qt Widgets
- C++
- Inno Setup

---

## Casos de uso que cubre esta arquitectura

- **Servidor local del estudio** con backend centralizado.
- **Clientes de escritorio** conectados automáticamente.
- **Distribución en Windows** sin exigir instalación manual de stack web completo.
- **Separación clara** entre interfaz de usuario, servidor y orquestación local.

---

## Público objetivo de cada pieza

| Pieza | Pensada para |
|---|---|
| **SuitAPI** | Administrador de sistemas / máquina servidor |
| **SuitApp** | Usuario final |
| **SuitApiLauncher** | Instalación y operación técnica en Windows |
| **Instalador** | Despliegue portable y repetible |

---

## Estado actual del repo

Este repositorio agrupa varias piezas del sistema en un solo lugar, lo que permite trabajar sobre:

- backend,
- cliente de escritorio,
- utilidades de despliegue,
- y documentación.

Es, básicamente, un mono-repo con esteroides moderados.

---

## Licencia

Este proyecto se distribuye bajo licencia **MIT**.

---

## Créditos

En el README interno de la API figuran como creadores:

- Valentino Pettinato
- Tomás Schlotahuer

---

<div align="center">
  <sub>Hecho para que la instalación en Windows no dependa de rezarle a tres servicios, dos variables de entorno y una fase lunar.</sub>
</div>
