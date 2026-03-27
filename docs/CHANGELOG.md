# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### VERSION 1.2.0 - Sistema de Ventanas y Correcciones en Templates

Esta actualización incorpora una nueva forma de trabajo con múltiples vistas dentro de la aplicación y corrige problemas detectados en el módulo de templates para mejorar la estabilidad del flujo documental.

#### 🪟 Sistema de Ventanas:
*   **Pestañas Superiores**: Se implementó un sistema de ventanas internas con pestañas para mantener abiertas varias secciones al mismo tiempo dentro de la aplicación.
*   **Cambio Rápido de Contexto**: Ahora es posible alternar entre módulos abiertos sin perder el estado de navegación de cada vista.
*   **Abrir en Nueva Pestaña**: Se agregó la acción `Abrir en nueva pestaña` mediante click derecho sobre secciones disponibles tanto en la pantalla Secciones como en el menú lateral.

#### 🛠️ Correcciones en Templates:
*   **Ajustes de Estabilidad**: Se corrigieron bugs en el flujo de templates para reducir errores durante la edición y uso de modelos.
*   **Mejoras de Consistencia**: Se ajustaron comportamientos del módulo para que la experiencia de trabajo con plantillas sea más predecible.

---

### VERSION 1.1.0 - Plantillas e Inteligencia Documental

Esta actualización introduce un potente sistema de gestión de modelos jurídicos que permite automatizar la redacción de documentos mediante el cruce de datos de expedientes y clientes.

#### 📄 Automatización de Modelos:
*   **Plantillas Autocompletables**: Creación de modelos con variables dinámicas que se rellenan automáticamente consultando la base de datos de SuitApp.
*   **Importación Inteligente**: Soporte para importar documentos existentes desde **Microsoft Word (.docx)** o **PDF**, convirtiéndolos automáticamente en plantillas editables.
*   **Asociación a Casos**: Los documentos generados pueden guardarse y asociarse directamente a expedientes específicos para mantener un historial centralizado.
*   **Relleno Guiado**: Nuevo modal interactivo que solicita los datos necesarios y previsualiza el resultado final antes de generar el documento.

#### 🛠️ Herramientas de Edición:
*   **Exportación a PDF**: Generador nativo de PDF que respeta el formato, tipografías y márgenes configurados en el editor.
*   **Gestión de Márgenes**: Control preciso de márgenes (pt/cm) con persistencia por perfil de usuario.
*   **Toolbar Optimizado**: Rediseño de la barra de herramientas del editor, agrupando funciones de alineación, sangrías e inserciones para un flujo de trabajo más rápido.
*   **Acceso Rápido**: Nuevo atajo de teclado global (tecla **M**) para saltar instantáneamente a la Galería de Modelos.

#### 🔧 Mejoras de Interfaz:
*   **Panel de Requisitos**: El panel lateral de edición de modelos ahora cuenta con scroll independiente y tamaño ajustable, permitiendo trabajar en documentos extensos sin perder el contexto visual.
*   **Bitácora Administrativa**: Nueva sección en el Panel de Administración para consultar movimientos del sistema, filtrarlos por tipo y revisar el detalle de cada registro desde una vista dedicada.
*   **Mantenimiento de Bitácora**: Se incorporaron acciones administrativas para conservar solo los movimientos recientes o vaciar la bitácora completa cuando sea necesario.

---

### VERSION 1.0.0


**SuitApp** es una solución integral de escritorio diseñada para transformar la gestión operativa de estudios jurídicos. Construida sobre una arquitectura moderna que prioriza el rendimiento y la confiabilidad, la aplicación ofrece una experiencia fluida tanto online como offline.

#### Tecnologías principales:
*   **Core**: [Electron](https://www.electronjs.org/) para una experiencia de escritorio nativa y multiplataforma.
*   **Frontend**: [React](https://reactjs.org/) con [Vite](https://vitejs.dev/) para una interfaz de usuario reactiva y de alto rendimiento.
*   **Base de Datos Local**: [SQLite](https://www.sqlite.org/) (vía `better-sqlite3`) actuando como una robusta capa de persistencia y caché.
*   **Backend**: Integración con una API REST potente desarrollada en [Laravel](https://laravel.com/).
*   **Componentes de UI**: Basados en primitives de [Radix UI](https://www.radix-ui.com/) para garantizar accesibilidad y consistencia.

#### Sistema de Caché Inteligente:
SuitApp implementa un avanzado sistema de caché sectorizado en SQLite. Este mecanismo minimiza drásticamente las llamadas al servidor, permitiendo:
*   **Cargas instantáneas**: Los datos se sirven desde el almacenamiento local mientras se sincronizan en segundo plano.
*   **Trabajo Offline**: Capacidad de consultar y modificar información sin conexión activa a internet, con una cola de "Outbox" que sincroniza los cambios pendientes una vez se restaura la conectividad.
*   **Sincronización Incremental**: Uso de estrategias basadas en `last-modified` para descargar únicamente los datos que han cambiado desde la última sesión.

#### Funcionalidades Destacadas:
*   **Gestión de Expedientes y Casos**: Control detallado de causas judiciales, estados y movimientos.
*   **Agenda Avanzada**: Calendario inteligente con sincronización por meses y recordatorios de audiencias/vencimientos.
*   **Base de Datos de Clientes**: Repositorio centralizado con historial de interacciones y documentación asociada.
*   **Biblioteca Digital**: Sistema de archivos públicos con categorización por catálogos, permisos granulares y generación de enlaces vía QR para acceso rápido desde dispositivos móviles.
*   **Módulo Económico**: Gestión de honorarios, entregas y gastos asociados a cada caso.
*   **Notificaciones en Tiempo Real**: Alertas nativas del sistema para eventos críticos y actualizaciones de equipo.
*   **Perfiles Multiusuario**: Soporte para múltiples perfiles con persistencia independiente de configuraciones y tokens.
