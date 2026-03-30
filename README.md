<div align="center">
  <img src="https://raw.githubusercontent.com/0tomi/Suit/SuitApp/SuitAPI/SuitLogo.png" alt="Suit" width="320">

  # Suit

  **Ecosistema de aplicaciones para gestión jurídica con despliegue portable en Windows.**

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

**Suit** está compuesto por **3 aplicaciones** y **1 instalador** que trabajan juntas para ofrecer una solución de escritorio conectada a un servidor local o de red:

- **SuitAPI**: backend y lógica central del sistema.
- **SuitApp**: aplicación de escritorio para el usuario final.
- **SuitApiLauncher**: lanzador para servir la API en Windows.
- **Instalador Inno Setup**: empaquetado y despliegue portable.

## Arquitectura

```text
Usuario final
    │
    ▼
┌───────────────────────┐
│       SuitApp         │
│ Electron + React      │
└──────────┬────────────┘
           │ conexión al servidor
           ▼
┌───────────────────────┐
│       SuitAPI         │
│ Laravel + FrankenPHP  │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│      PostgreSQL       │
└───────────────────────┘

En Windows, SuitApiLauncher levanta FrankenPHP + PostgreSQL
para servir la API de forma automática.
```

## Componentes

| Componente | Función | Stack principal |
|---|---|---|
| **SuitAPI** | Servidor y lógica de negocio | Laravel 12, PHP 8.2+, Sanctum, FrankenPHP, Caddy |
| **SuitApp** | Cliente de escritorio | Electron, React 19, Vite 7, Tailwind 4, Radix UI |
| **SuitApiLauncher** | Orquestación local en Windows | Qt Widgets, C++17 |
| **Instalador** | Empaquetado y despliegue | Inno Setup |

## SuitAPI

**SuitAPI** es el servidor de la aplicación y su núcleo funcional. Centraliza autenticación, datos y reglas de negocio, y está pensada para la máquina del administrador de sistemas del estudio.

### Stack

- **Laravel 12**
- **PHP 8.2+**
- **Laravel Sanctum**
- **FrankenPHP**
- **Caddy**
- **PostgreSQL** en producción
- **SQLite** en desarrollo
- **Pest** para testing

## SuitApp

**SuitApp** es la aplicación de escritorio orientada al usuario final. Está construida para ofrecer una interfaz moderna, conexión automática al servidor y herramientas que le aportan valor propio más allá de consumir la API.

### Stack

- **Electron**
- **React 19**
- **Vite 7**
- **Tailwind CSS 4**
- **Radix UI**
- **better-sqlite3**
- **Playwright** y **Vitest** para testing

### Qué aporta

- Interfaz de escritorio amigable y moderna.
- Sistema de **cacheo eficiente** para reducir consultas a la API.
- **Motor de plantillas** que permite autocompletarlas rápidamente con información provista por el sistema.
- Herramientas adicionales que amplían la experiencia del usuario y justifican su existencia como aplicación separada de la API.

## SuitApiLauncher

**SuitApiLauncher** es la solución para servir la API en Windows de forma automática, evitando configuraciones manuales para el usuario.

### Función

- Levanta el proceso de **FrankenPHP**.
- Levanta el proceso de **PostgreSQL**.
- Permite servir la API Laravel como backend local o de red.

### Stack detectado

- **Qt Widgets**
- **C++17**
- Proyecto `.pro` de Qt

## Instalador con Inno Setup

El instalador resuelve la portabilidad en Windows y prepara el entorno para que las aplicaciones funcionen correctamente.

### Qué hace

- Instala la solución completa.
- Abre los puertos necesarios.
- Instala dependencias del sistema, como **Visual C++ Redistributable**.
- Despliega los binarios y archivos necesarios para ejecutar el sistema.

### Requisitos del paquete de instalación

La carpeta de instalación debe contener:

- El binario de **SuitApiLauncher** con sus dependencias.
- El binario de **PostgreSQL para Windows**.
- El binario de **FrankenPHP para Windows**.
- Dentro de la carpeta de FrankenPHP, la **API Laravel lista para servirse**.

## Desarrollo

### SuitAPI

```bash
cd SuitAPI/SuitAPI
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
composer start
```

> En desarrollo puede usarse **SQLite**.

### SuitApp

```bash
cd SuitApp
npm install
npm run dev:electron
```

### SuitApiLauncher

Compilar con **Qt Creator** o con las herramientas de Qt sobre:

```text
SuitApiLauncher/SuitAPI.pro
```

## Producción en Windows

1. Compilar **SuitApiLauncher**.
2. Incluir binarios de **PostgreSQL** y **FrankenPHP**.
3. Copiar la **SuitAPI** Laravel lista dentro de la estructura esperada.
4. Construir el instalador con **Inno Setup**.
5. Instalar en la máquina servidor.
6. Conectar clientes desde **SuitApp**.

## Licencia

Este proyecto se distribuye bajo licencia **MIT**.
