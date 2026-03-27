/**
 * Definiciones de pasos para los tutoriales de cada sección de la app.
 *
 * CONVENCIÓN:
 * - Las imágenes van en: src/assets/tutorials/<seccion>/1.png, 2.png, etc.
 * - Cada sección exporta un array de objetos: { image: string, description: string }[]
 * - Los imports son directos (Vite los procesa con hashing en producción).
 *
 * CÓMO AGREGAR UN NUEVO TUTORIAL:
 * 1. Crear carpeta: src/assets/tutorials/<mi-seccion>/
 * 2. Agregar los screenshots como 1.png, 2.png, etc.
 * 3. Importarlos aquí y exportar el array con sus descripciones.
 * 4. En la página destino, usar el patrón:
 *
 *    import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
 *    import { miSectionSteps } from '../constants/tutorialSteps.js';
 *
 *    // Dentro del componente:
 *    // En el JSX (junto al título):
 *    <SectionTutorialTrigger
 *      steps={miSectionSteps}
 *      ariaLabel="Ver tutorial de la sección"
 *      testId="mi-seccion-tutorial-trigger"
 *    />
 */

// ── Agenda General ────────────────────────────────────────────────────────────
import agenda1 from '../assets/tutorials/Agenda/1.png';
import agenda2 from '../assets/tutorials/Agenda/2.png';
import agenda3 from '../assets/tutorials/Agenda/3.png';
import agenda4 from '../assets/tutorials/Agenda/4.png';
import agenda5 from '../assets/tutorials/Agenda/5.png';
import agenda6 from '../assets/tutorials/Agenda/6.png';
import agenda7 from '../assets/tutorials/Agenda/7.png';
import agenda8 from '../assets/tutorials/Agenda/8.png';
import agenda9 from '../assets/tutorials/Agenda/9.png';
import agenda10 from '../assets/tutorials/Agenda/10.png';
import agenda11 from '../assets/tutorials/Agenda/11.png';
import agenda12 from '../assets/tutorials/Agenda/12.png';
import deadline1 from '../assets/tutorials/Vencimientos/1.png';
import deadline2 from '../assets/tutorials/Vencimientos/2.png';
import deadline3 from '../assets/tutorials/Vencimientos/3.png';
import deadline4 from '../assets/tutorials/Vencimientos/4.png';
import deadline5 from '../assets/tutorials/Vencimientos/5.png';
import deadline6 from '../assets/tutorials/Vencimientos/6.png';
import deadline7 from '../assets/tutorials/Vencimientos/7.png';
import deadline8 from '../assets/tutorials/Vencimientos/8.png';
import caso1 from '../assets/tutorials/caseSection/1.png';
import caso2 from '../assets/tutorials/caseSection/2.png';
import caso3 from '../assets/tutorials/caseSection/3.png';
import caso4 from '../assets/tutorials/caseSection/4.png';
import caso5 from '../assets/tutorials/caseSection/5.png';
import caso6 from '../assets/tutorials/caseSection/6.png';
import caso7 from '../assets/tutorials/caseSection/7.png';
import selectedCase1 from '../assets/tutorials/selectedCase/1.png';
import selectedCase2 from '../assets/tutorials/selectedCase/2.png';
import selectedCase3 from '../assets/tutorials/selectedCase/3.png';
import selectedCase4 from '../assets/tutorials/selectedCase/4.png';
import selectedCase5 from '../assets/tutorials/selectedCase/5.png';
import selectedCase6 from '../assets/tutorials/selectedCase/6.png';
import selectedCase7 from '../assets/tutorials/selectedCase/7.png';
import selectedCase8 from '../assets/tutorials/selectedCase/8.png';
import selectedCase9 from '../assets/tutorials/selectedCase/9.png';
import selectedCase10 from '../assets/tutorials/selectedCase/10.png';
import selectedCase11 from '../assets/tutorials/selectedCase/11.png';
import selectedCase12 from '../assets/tutorials/selectedCase/12.png';
import selectedCase13 from '../assets/tutorials/selectedCase/13.png';

// ── Documentos ──────────────────────────────────────────────────────────────
import doc1 from '../assets/tutorials/Documentos/1.png';
import doc2 from '../assets/tutorials/Documentos/2.png';
import doc3 from '../assets/tutorials/Documentos/3.png';
import doc4 from '../assets/tutorials/Documentos/4.png';
import doc5 from '../assets/tutorials/Documentos/5.png';
import doc6 from '../assets/tutorials/Documentos/6.png';
import doc7 from '../assets/tutorials/Documentos/7.png';
import doc8 from '../assets/tutorials/Documentos/8.png';
import doc9 from '../assets/tutorials/Documentos/9.png';
import documentEditor1 from '../assets/tutorials/documentEditor/1.png';
import documentEditor2 from '../assets/tutorials/documentEditor/2.png';
import documentEditor3 from '../assets/tutorials/documentEditor/3.png';
import documentEditor4 from '../assets/tutorials/documentEditor/4.png';
import documentEditor5 from '../assets/tutorials/documentEditor/5.png';
import documentEditor6 from '../assets/tutorials/documentEditor/6.png';
import documentEditor7 from '../assets/tutorials/documentEditor/7.png';
import documentEditor8 from '../assets/tutorials/documentEditor/8.png';

// ── Estadísticas ─────────────────────────────────────────────────────────────
import reportes1 from '../assets/tutorials/Estadísticas/1.png';
import reportes2 from '../assets/tutorials/Estadísticas/2.png';
import reportes3 from '../assets/tutorials/Estadísticas/3.png';
import reportes4 from '../assets/tutorials/Estadísticas/4.png';

// ── Administración ───────────────────────────────────────────────────────────
import admin1 from '../assets/tutorials/adminpanel/1.png';
import admin2 from '../assets/tutorials/adminpanel/2.png';
import admin3 from '../assets/tutorials/adminpanel/3.png';
import admin4 from '../assets/tutorials/adminpanel/4.png';
import admin5 from '../assets/tutorials/adminpanel/5.png';
import admin6 from '../assets/tutorials/adminpanel/6.png';
import admin7 from '../assets/tutorials/adminpanel/7.png';

// ── Modelos / Plantillas ─────────────────────────────────────────────────────
import template1 from '../assets/tutorials/templates/1.png';
import template2 from '../assets/tutorials/templates/2.png';
import template3 from '../assets/tutorials/templates/3.png';
import template4 from '../assets/tutorials/templates/4.png';
import template5 from '../assets/tutorials/templates/5.png';
import template6 from '../assets/tutorials/templates/6.png';
import template7 from '../assets/tutorials/templates/7.png';
import templateEditor1 from '../assets/tutorials/templates-editor/1.png';
import templateEditor2 from '../assets/tutorials/templates-editor/2.png';
import templateEditor3 from '../assets/tutorials/templates-editor/3.png';
import templateEditor4 from '../assets/tutorials/templates-editor/4.png';
import templateEditor5 from '../assets/tutorials/templates-editor/5.png';
import templateEditor6 from '../assets/tutorials/templates-editor/6.png';
import templateEditor7 from '../assets/tutorials/templates-editor/7.png';
import templateEditor8 from '../assets/tutorials/templates-editor/8.png';
import templateEditor9 from '../assets/tutorials/templates-editor/9.png';


// ── Biblioteca ─────────────────────────────────────────────────────────────
import biblio1 from '../assets/tutorials/Biblioteca/1.png';
import biblio2 from '../assets/tutorials/Biblioteca/2.png';
import biblio3 from '../assets/tutorials/Biblioteca/3.png';
import biblio4 from '../assets/tutorials/Biblioteca/4.png';
import biblio5 from '../assets/tutorials/Biblioteca/5.png';
import biblio6 from '../assets/tutorials/Biblioteca/6.png';
import biblio7 from '../assets/tutorials/Biblioteca/7.png';
import biblio8 from '../assets/tutorials/Biblioteca/8.png';
import biblio9 from '../assets/tutorials/Biblioteca/9.png';
import biblio10 from '../assets/tutorials/Biblioteca/10.png';
import biblio11 from '../assets/tutorials/Biblioteca/11.png';


export const agendaSteps = [
    {
        image: agenda1,
        description: 'Bienvenido a tu Agenda General. Desde aquí podés ver y gestionar todos tus eventos y audiencias en un solo lugar.',
    },
    {
        image: agenda2,
        description: 'El selector de agenda (arriba a la derecha) te permite filtrar los eventos por agenda. Podés elegir tu agenda personal, la de un colega, o ver todas a la vez.',
    },
    {
        image: agenda3,
        description: 'Para crear un evento, hacé click en "Nuevo Evento". Completá el título, la fecha y hora, y elegí a qué agenda pertenece. El caso asociado es opcional.',
    },
    {
        image: agenda4,
        description: 'Al crear un evento podés programar una notificación para recordarlo. El tiempo de aviso predeterminado se puede ajustar en Configuración → Agenda.',
    },
    {
        image: agenda5,
        description: 'Las agendas de caso agrupan los eventos vinculados a un expediente específico. Al asociar un caso al evento, este aparece también en la agenda de ese caso.',
    },
    {
        image: agenda6,
        description: 'Hacé click en cualquier cuadro del calendario para crear un evento directamente en esa fecha. El formulario se abrirá con la fecha preseleccionada.',
    },
    {
        image: agenda7,
        description: 'Para editar un evento, hacé click sobre él en el calendario. Se abrirá el detalle donde podés modificar cualquier campo. Los cambios se sincronizan automáticamente.',
    },
    {
        image: agenda8,
        description: 'El ícono de campana en el detalle del evento te muestra cuándo se enviará la notificación. También podés modificar o agregar una notificación desde ahí.',
    },
    {
        image: agenda9,
        description: 'El panel de notificaciones muestra los avisos programados para tus próximos eventos. Podés descartarlos o ir directamente al evento con un click.',
    },
    {
        image: agenda10,
        description: 'Las flechas laterales te permiten navegar entre meses. El botón "Hoy" te regresa al mes actual en cualquier momento.',
    },
    {
        image: agenda11,
        description: 'Podés alternar entre distintas vistas: mensual, semanal, diaria o por agenda. Usá los botones de la barra superior para elegir la que mejor se adapte a tu flujo.',
    },
    {
        image: agenda12,
        description: 'La vista diaria muestra todos los eventos del día organizados por hora. Ideal para revisar tu agenda sin distracciones y ver los detalles de cada evento.',
    },
];

// ── Vencimientos ──────────────────────────────────────────────────────────────
export const deadlinesSteps = [
    {
        image: deadline1,
        description: 'Bienvenido a Vencimientos. Desde esta sección podés seguir plazos, audiencias y tareas pendientes del estudio en un solo lugar.',
    },
    {
        image: deadline2,
        description: 'Estos cuatro botones grandes son atajos para ver vencimientos clave y, al mismo tiempo, te muestran un resumen útil del estado actual.',
    },
    {
        image: deadline3,
        description: 'En la barra superior podés buscar vencimientos, ordenarlos y filtrarlos por prioridad o por estado según lo que necesites revisar.',
    },
    {
        image: deadline4,
        description: 'Arriba a la derecha elegís el mes que querés revisar y también podés crear un nuevo vencimiento desde el botón principal.',
    },
    {
        image: deadline5,
        description: 'Este es el formulario para crear vencimientos. Sigue la misma lógica que la creación de eventos en Agenda, así que el flujo te va a resultar familiar.',
    },
    {
        image: deadline6,
        description: 'Este listado reúne todos los vencimientos del período. Cada fila usa colores según estado y prioridad, y esos criterios se pueden personalizar desde el menú.',
    },
    {
        image: deadline7,
        description: 'Al hacer click sobre un vencimiento accedés al detalle completo, donde podés revisar la información, editarlo o gestionar sus acciones.',
    },
    {
        image: deadline8,
        description: 'Si tenés vencimientos urgentes o vencidos, la sección te lo avisa también desde su ícono en la barra lateral para que no se te pasen.',
    },
];

export const adminPanelSteps = [
    {
        image: admin1,
        description: 'La pestaña Usuarios muestra el listado completo y te permite ver, editar o eliminar cuentas del sistema.',
    },
    {
        image: admin2,
        description: 'Desde "Dar de alta usuario" podés registrar una cuenta nueva indicando nombre, tag, contraseña, rol y email.',
    },
    {
        image: admin3,
        description: 'En Configuración se ajustan parámetros globales, como los días de urgencia de vencimientos, que impactan en todos los usuarios.',
    },
    {
        image: admin4,
        description: 'La Bitácora administrativa reúne los movimientos guardados en el servidor y ofrece tareas de mantenimiento sobre ese historial.',
    },
    {
        image: admin5,
        description: 'Los filtros de entidad y orden ayudan a encontrar movimientos específicos y a reorganizar rápidamente el listado.',
    },
    {
        image: admin6,
        description: 'Cada registro puede abrirse para ver su detalle completo: actor, acción, entidad afectada y datos almacenados.',
    },
    {
        image: admin7,
        description: 'El panel de mantenimiento permite limpiar movimientos antiguos o vaciar toda la bitácora con acciones reservadas para administradores.',
    },
];

export const templatesSteps = [
    {
        image: template1,
        description: 'La galería reúne todos los modelos disponibles y permite buscarlos o filtrarlos por categoría.',
    },
    {
        image: template2,
        description: 'Desde "Nueva Categoría" podés crear grupos para ordenar mejor tus modelos y encontrarlos más rápido.',
    },
    {
        image: template3,
        description: 'Al crear un modelo podés elegir entre importarlo desde un archivo o empezar uno nuevo desde cero.',
    },
    {
        image: template4,
        description: 'Al importar, definís la palabra clave que se convertirá en campos editables. El soporte de PDFs no es tan completo, especialmente en archivos escaneados o con formato complejo.',
    },
    {
        image: template5,
        description: 'Cada tarjeta te deja abrir una vista previa, editar el modelo o usarlo directamente para generar un documento.',
    },
    {
        image: template6,
        description: 'La vista previa muestra cómo se verá la plantilla y marca los requisitos que después se completarán con datos reales.',
    },
    {
        image: template7,
        description: 'Para usar la plantilla, completá los formularios de la izquierda con lo que requiera el modelo. Cuando un campo se esté cargando, se va a poner de color azul en la vista previa.',
    },
];

export const templateEditorSteps = [
    {
        image: templateEditor1,
        description: 'Este es el editor de modelos. Desde acá armás la plantilla, asignás requisitos y guardás el resultado final.',
    },
    {
        image: templateEditor2,
        description: 'El lienzo central muestra el documento y las burbujas insertadas dentro del texto donde después se reemplazarán datos reales.',
    },
    {
        image: templateEditor3,
        description: 'En el header podés cambiar la categoría, alternar entre Edición y Vista, y guardar el modelo cuando termines.',
    },
    {
        image: templateEditor4,
        description: 'En modo Vista no se puede tocar el texto del documento, pero sí se pueden modificar las burbujas de los campos.',
    },
    {
        image: templateEditor5,
        description: 'Al seleccionar una burbuja aparece un menú rápido para formatearla, navegar entre entidades o quitar el requisito asignado.',
    },
    {
        image: templateEditor6,
        description: 'Cada burbuja corresponde a la entidad por la que luego se reemplazará ese dato, y podés cambiarla arrastrando otro requisito desde el panel derecho.',
    },
    {
        image: templateEditor7,
        description: 'Si el requisito pertenece a una entidad repetible, podés mover la burbuja a la entidad anterior o siguiente con los controles laterales.',
    },
    {
        image: templateEditor8,
        description: 'El número de la burbuja indica a qué instancia de esa entidad está apuntando, por ejemplo Cliente 1 o Cliente 2.',
    },
    {
        image: templateEditor9,
        description: 'En modo Vista el panel de requisitos sigue disponible para revisar campos y reasignar entidades sin desbloquear la edición del texto.',
    },
];

export const documentEditorSteps = [
    {
        image: documentEditor1,
        description: 'El editor de documentos combina el lienzo principal con la barra de formato y el panel lateral para redactar escritos y consultar referencias sin salir de la pantalla.',
    },
    {
        image: documentEditor2,
        description: 'En el header podés volver al listado, cambiar el título del documento y usar las acciones principales para abrir propiedades, exportar a PDF o guardar los cambios.',
    },
    {
        image: documentEditor3,
        description: 'Los botones del header concentran la gestión rápida del documento: propiedades y caso asociado, exportación a PDF y guardado manual cuando necesitás confirmar una versión.',
    },
    {
        image: documentEditor4,
        description: 'La barra de herramientas superior reúne formato de texto, encabezados, alineación, listas, colores, tablas, enlaces y el acceso a la configuración de márgenes.',
    },
    {
        image: documentEditor5,
        description: 'Desde Márgenes podés ajustar tamaño de hoja, unidades, margen espejado, sangría y guardar esa configuración como predeterminada para próximos documentos.',
    },
    {
        image: documentEditor6,
        description: 'El lienzo central representa la hoja real del escrito y muestra reglas visuales para trabajar con los márgenes y la sangría mientras redactás.',
    },
    {
        image: documentEditor7,
        description: 'El panel lateral de herramientas te deja buscar información relacionada con casos, clientes, documentos, usuarios y partes para insertar referencias útiles en el texto.',
    },
    {
        image: documentEditor8,
        description: 'Cuando abrís una referencia, el panel muestra la ficha resumida de esa entidad para copiar datos con contexto sin interrumpir la redacción.',
    },
];

// ── Casos ─────────────────────────────────────────────────────────────────────
export const casosSteps = [
    {
        image: caso1,
        description: 'La vista principal de Casos reúne todos los expedientes del estudio y te deja ver de un vistazo la carátula, el fuero, el dueño, el estado y la última actualización.',
    },
    {
        image: caso2,
        description: 'En la barra superior podés buscar por carátula o dueño y combinar filtros por fuero, estado y criterio de orden para encontrar un expediente más rápido.',
    },
    {
        image: caso3,
        description: 'Desde "Nuevo Caso" se abre el alta de expediente, donde completás la información básica, la radicación judicial, la jurisdicción y el fuero correspondiente.',
    },
    {
        image: caso4,
        description: 'En la parte inferior del formulario podés sumar una descripción inicial, vincular clientes y otras partes, y agregar participantes del estudio con acceso al caso.',
    },
    {
        image: caso5,
        description: 'El selector de orden te permite reorganizar el listado según la última actualización o la fecha de inicio, según el criterio que necesites revisar.',
    },
    {
        image: caso6,
        description: 'Cada fila del listado incluye acciones rápidas. Desde el ícono de reporte podés abrir la ficha ejecutiva del expediente sin salir de la tabla.',
    },
    {
        image: caso7,
        description: 'La previsualización de la ficha ejecutiva resume la información principal del expediente y te permite imprimirla o exportarla en PDF desde el mismo modal.',
    },
];

export const selectedCaseSteps = [
    {
        image: selectedCase1,
        description: 'La pestaña Resumen concentra el estado del expediente, su descripción, los datos principales y un vistazo rápido a próximos eventos, vencimientos y documentos.',
    },
    {
        image: selectedCase2,
        description: 'En la barra superior podés moverte entre las secciones del caso para revisar su cronograma, biblioteca, partes, economía y permisos sin salir del expediente.',
    },
    {
        image: selectedCase3,
        description: 'El resumen también te muestra la información clave del expediente en una sola pantalla para consultar el contexto general antes de trabajar sobre un área puntual.',
    },
    {
        image: selectedCase4,
        description: 'Desde estos botones podés editar el caso, generar su ficha ejecutiva o cerrarlo cuando ya no necesite nuevas gestiones.',
    },
    {
        image: selectedCase5,
        description: 'Editar Caso abre el formulario completo del expediente para actualizar carátula, número, radicación, competencia, fuero, tipos vinculados y descripción.',
    },
    {
        image: selectedCase6,
        description: 'Generar Reporte abre una ficha ejecutiva lista para revisar, imprimir o exportar en PDF con el estado general, clientes, responsables y situación económica.',
    },
    {
        image: selectedCase7,
        description: 'En Cronograma, la vista Calendario reúne los eventos del expediente y te deja crear o revisar audiencias, reuniones y tareas desde la agenda propia del caso.',
    },
    {
        image: selectedCase8,
        description: 'La vista Vencimientos centraliza los plazos del caso con buscador, filtros y ordenamiento para enfocarte en lo urgente o en lo pendiente.',
    },
    {
        image: selectedCase9,
        description: 'En Biblioteca podés administrar los archivos del expediente, buscarlos por nombre, filtrarlos por tipo y subir nuevos documentos o archivos vía QR.',
    },
    {
        image: selectedCase10,
        description: 'La pestaña Partes separa clientes y otras partes procesales para que puedas agregar, revisar o desvincular personas relacionadas con el expediente.',
    },
    {
        image: selectedCase11,
        description: 'En Economía se listan honorarios y gastos del caso, con accesos para registrar nuevos movimientos y seguir quién los cargó y en qué fecha.',
    },
    {
        image: selectedCase12,
        description: 'Cada honorario puede abrir su detalle de entregas para cargar pagos parciales, ver el total entregado y controlar el saldo pendiente.',
    },
    {
        image: selectedCase13,
        description: 'La pestaña Permisos muestra quiénes tienen acceso al expediente y con qué rol, además de permitir compartirlo con otros usuarios del estudio.',
    },
];


// ── Personas (General) ───────────────────────────────────────────────────────
import persona1 from '../assets/tutorials/Personas/1.png';
import persona2 from '../assets/tutorials/Personas/2.png';
import persona3 from '../assets/tutorials/Personas/3.png';
import persona4 from '../assets/tutorials/Personas/4.png';
import persona5 from '../assets/tutorials/Personas/5.png';

export const personasSteps = [
    {
        image: persona1,
        description: 'Bienvenido a la sección de Personas. Aquí podrás gestionar tanto a tus clientes como a otras partes involucradas en tus casos de manera centralizada.',
    },
    {
        image: persona2,
        description: 'En la pestaña de Clientes verás a quienes representás. Podés filtrar el listado por orden alfabético o por fecha de creación para encontrarlos rápidamente.',
    },
    {
        image: persona3,
        description: 'Creá un nuevo registro con el botón "Nuevo Cliente". Completá sus datos básicos, DNI y medios de contacto para tener su ficha siempre a mano.',
    },
    {
        image: persona4,
        description: 'La pestaña de Partes agrupa a otros actores relevantes (abogados, peritos, juzgados), permitiendo un acceso ágil a contactos recurrentes del estudio.',
    },
    {
        image: persona5,
        description: 'Podés crear nuevas partes y asignarles un rol específico. Esto facilita la organización de tu base de contactos según su función legal.',
    },
];

// ── Economía ──────────────────────────────────────────────────────────────────
import economia1 from '../assets/tutorials/Economía/1.png';
import economia2 from '../assets/tutorials/Economía/2.png';
import economia3 from '../assets/tutorials/Economía/3.png';
import economia4 from '../assets/tutorials/Economía/4.png';
import economia5 from '../assets/tutorials/Economía/5.png';

export const economiaSteps = [
    {
        image: economia1,
        description: 'Bienvenido a la Gestión Económica. Aquí podrás llevar el control financiero de todos tus casos, incluyendo honorarios y gastos.',
    },
    {
        image: economia2,
        description: 'En la pestaña de Honorarios podés visualizar lo pactado y lo cobrado en cada expediente. Podés filtrar por rango de fecha, usuarios y más para un control preciso.',
    },
    {
        image: economia3,
        description: 'Registrá nuevos honorarios vinculados a un caso. Podés definir el monto, la fecha y el estado del pago para mantener tu flujo de caja actualizado.',
    },
    {
        image: economia4,
        description: 'La pestaña de Gastos te permite seguir todos los desembolsos realizados. Es fundamental para el recupero de gastos y el balance final del estudio.',
    },
    {
        image: economia5,
        description: 'Cargá nuevos gastos indicando el caso, el concepto y el importe. Esto asegura que ningún costo operativo quede sin registrar.',
    },
];

// ── Categorías ────────────────────────────────────────────────────────────────
import categoria1 from '../assets/tutorials/Categorías/1.png';
import categoria2 from '../assets/tutorials/Categorías/2.png';
import categoria3 from '../assets/tutorials/Categorías/3.png';
import categoria4 from '../assets/tutorials/Categorías/4.png';
import categoria5 from '../assets/tutorials/Categorías/5.png';
import categoria6 from '../assets/tutorials/Categorías/6.png';

export const categoriasSteps = [
    {
        image: categoria1,
        description: 'Bienvenido a Categorías. Desde esta pantalla podés administrar los catálogos judiciales, de agenda y de economía que alimentan distintos formularios de la app.',
    },
    {
        image: categoria2,
        description: 'En Fueros podés buscar, crear, editar o eliminar los fueros disponibles para clasificar un caso al momento de darlo de alta.',
    },
    {
        image: categoria3,
        description: 'En Jurisdicciones se administra cada localidad o ámbito judicial y, desde ahí, también se cargan los juzgados asociados a esa jurisdicción.',
    },
    {
        image: categoria4,
        description: 'Este formulario permite asociar una competencia a una jurisdicción para crear un juzgado, indicando su nombre, el fuero y la radicación correspondiente.',
    },
    {
        image: categoria5,
        description: 'En los Catálogos de Agenda podés definir los tipos de evento que usa el calendario, con su nombre y color para identificarlos rápidamente.',
    },
    {
        image: categoria6,
        description: 'En los Catálogos de Economía podés mantener los tipos de gasto reutilizables para registrar egresos de los casos de forma consistente.',
    },
];

// ── Documentos ──────────────────────────────────────────────────────────────
export const documentosSteps = [
    {
        image: doc1,
        description: 'La vista principal de Documentos reúne todos los escritos del estudio y te deja buscarlos, filtrarlos por caso, abogado, cliente o estado, y ordenarlos según la fecha que necesites revisar.',
    },
    {
        image: doc2,
        description: 'El selector de casos te permite acotar el listado a un expediente concreto, ver documentos personales sin caso o incluir también expedientes finalizados cuando haga falta.',
    },
    {
        image: doc3,
        description: 'Desde la barra superior podés importar un archivo PDF o Word existente, o crear un documento nuevo para empezar a redactarlo desde cero.',
    },
    {
        image: doc4,
        description: 'Cada fila muestra acciones rápidas para abrir el detalle, editar propiedades, entrar al editor o exportar el documento sin salir del listado.',
    },
    {
        image: doc5,
        description: 'El ícono del ojo abre la ficha informativa del documento para consultar su estado, el caso asociado, el autor y la última versión disponible.',
    },
    {
        image: doc6,
        description: 'Desde el detalle también podés abrir el historial de versiones y seguir la trazabilidad del documento sin entrar todavía al editor.',
    },
    {
        image: doc7,
        description: 'El historial lista cada versión guardada, quién la generó y cuándo se creó, con acceso directo para abrir cualquiera en modo lectura.',
    },
    {
        image: doc8,
        description: 'El engranaje abre las propiedades del documento, donde podés renombrarlo, cambiar su estado, revisar el caso asociado o eliminarlo si corresponde.',
    },
    {
        image: doc9,
        description: 'El ícono de descarga exporta el documento a PDF directamente desde la tabla, ideal para compartir una versión lista para presentar o enviar.',
    },
];

// ── Estadísticas ─────────────────────────────────────────────────────────────
export const estadisticasSteps = [
    {
        image: reportes1,
        description: 'Bienvenido al Panel Informativo del Estudio. Aquí encontrarás una visión consolidada y detallada de toda la actividad operativa y financiera.',
    },
    {
        image: reportes2,
        description: 'En la Vista General podrás ver de un vistazo los casos activos, eventos próximos, vencimientos y clientes vinculados, junto con los hitos más urgentes de tu agenda.',
    },
    {
        image: reportes3,
        description: 'El Panorama Económico te ofrece un análisis profundo de la facturación, recaudación y saldos pendientes, permitiéndote comparar el rendimiento mes a mes.',
    },
    {
        image: reportes4,
        description: 'Finalmente, el Ritmo de Actividad muestra el pulso del estudio combinando aperturas con actividad real, para que entiendas mejor el flujo de trabajo a lo largo del año.',
    },
];

// ── Biblioteca ──────────────────────────────────────────────────────────────
export const bibliotecaSteps = [
    {
        image: biblio1,
        description: 'Bienvenido a la Biblioteca Virtual. Desde esta sección podés explorar, compartir y descargar archivos públicos disponibles para todo el estudio.',
    },
    {
        image: biblio2,
        description: 'Los botones principales te permiten organizar el contenido mediante "Catálogos" o "Subir Archivos" directamente a la biblioteca.',
    },
    {
        image: biblio3,
        description: 'Al subir un archivo, podés elegir un catálogo para mantener el orden de la documentación compartida.',
    },
    {
        image: biblio4,
        description: 'También podés gestionar los permisos del archivo, permitiendo que otros colegas puedan modificarlo o eliminarlo si es necesario.',
    },
    {
        image: biblio5,
        description: 'Creá catálogos personalizados para agrupar documentos por temática, tipo de proceso o cualquier criterio organizativo del estudio.',
    },
    {
        image: biblio6,
        description: 'Utilizá la potente barra de búsqueda y los filtros por catálogo o fecha para localizar rápidamente cualquier documento.',
    },
    {
        image: biblio7,
        description: 'La biblioteca soporta la función de "Soltar para subir". Simplemente arrastrá un archivo desde tu computadora hacia la aplicación para iniciar la carga.',
    },
    {
        image: biblio8,
        description: 'Desde la grilla podés descargar archivos directamente o abrir el detalle para ver más información y opciones.',
    },
    {
        image: biblio9,
        description: 'Si tenés permisos, en el detalle del archivo podés renombrarlo, cambiar su catálogo o actualizar sus permisos de acceso.',
    },
    {
        image: biblio10,
        description: 'Compartí archivos fácilmente generando un código QR. Escanealo con un celular para descargar el documento de forma inmediata y sin necesidad de login.',
    },
    {
        image: biblio11,
        description: 'Los filtros rápidos por tipo de archivo te permiten aislar PDFs, documentos de Word, planillas Excel o imágenes con un solo click.',
    },
];

// ── Secciones ───────────────────────────────────────────────────────────────
import secciones1 from '../assets/tutorials/Secciones/1.png';
import secciones2 from '../assets/tutorials/Secciones/2.png';
import secciones3 from '../assets/tutorials/Secciones/3.png';
import secciones4 from '../assets/tutorials/Secciones/4.png';
import secciones5 from '../assets/tutorials/Secciones/5.png';

export const seccionesSteps = [
    {
        image: secciones1,
        description: 'Bienvenido a la sección de Secciones. Desde aquí podés visualizar y acceder rápidamente a todos los módulos y herramientas del sistema en un solo lugar.',
    },
    {
        image: secciones2,
        description: 'Las secciones que ves aquí son las que podés anclar a tu barra lateral. Desde Configuración → Secciones podés elegir cuáles dejar fijas para un acceso más ágil.',
    },
    {
        image: secciones4,
        description: 'El sistema de ventanas trabaja con pestañas en la parte superior. Cada sección que abras puede quedar disponible ahí para que cambies de contexto sin perder lo que estabas haciendo.',
    },
    {
        image: secciones3,
        description: 'Con click derecho sobre una tarjeta de la pantalla Secciones se abre la opción "Abrir en nueva pestaña", que te permite abrir ese módulo aparte dentro de la misma ventana y seguir navegando en paralelo.',
    },
    {
        image: secciones5,
        description: 'Ese mismo acceso rápido también está disponible desde el menú lateral: con click derecho sobre una sección aparece la opción para abrirla en una nueva pestaña y trabajar con varias vistas al mismo tiempo.',
    },
];

// Agrega nuevas secciones aquí siguiendo el mismo patrón.
