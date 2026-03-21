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
import caso1 from '../assets/tutorials/Casos/1.png';
import caso2 from '../assets/tutorials/Casos/2.png';
import caso3 from '../assets/tutorials/Casos/3.png';
import caso4 from '../assets/tutorials/Casos/4.png';
import caso5 from '../assets/tutorials/Casos/5.png';
import caso6 from '../assets/tutorials/Casos/6.png';
import caso7 from '../assets/tutorials/Casos/7.png';
import caso8 from '../assets/tutorials/Casos/8.png';
import caso9 from '../assets/tutorials/Casos/9.png';
import caso10 from '../assets/tutorials/Casos/10.png';
import cliente1 from '../assets/tutorials/Clientes/1.png';
import cliente2 from '../assets/tutorials/Clientes/2.png';
import cliente3 from '../assets/tutorials/Clientes/3.png';
import cliente4 from '../assets/tutorials/Clientes/4.png';

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

// ── Casos ─────────────────────────────────────────────────────────────────────
export const casosSteps = [
    {
        image: caso1,
        description: 'Bienvenido a la Gestión de Casos. Desde aquí podrás ver y gestionar todos tus casos desde un solo lugar. Además de ver información breve y el estado del caso.',
    },
    {
        image: caso2,
        description: 'Para crear un caso, hacé click en "Nuevo Caso". Completá el título del caso, el tipo de caso, fecha de inicio y un resumen/descripción del caso.',
    },
    {
        image: caso3,
        description: 'Al crear el caso podé vincular las partes correspondientes al caso y asignarle un rol a cada una. Además pueden incluirse documentos vinculados al caso.',
    },
    {
        image: caso4,
        description: 'Los casos pueden filtrarse de 3 maneras diferentes: por tipo, por estado y por fecha de actualización.',
    },
    {
        image: caso5,
        description: 'Al seleccionar un caso particular, tendremos acceso al resumen, a las partes que lo componen, documentos vinculados, agenda del caso, vencimientos y los permisos. Además contamos con un botón para cerrar el caso.',
    },
    {
        image: caso6,
        description: 'Vemos el estado del caso de una manera más detallada.',
    },
    {
        image: caso7,
        description: 'Al igual que en la agenda general, dentro de la agenda propia de cada caso podemos crear eventos propios para ese caso particular.',
    },
    {
        image: caso8,
        description: 'Dentro de la sección Permisos vemos a los usuarios que tienen acceso y pueden colaborar en el caso, así como el botón de compartir.',
    },
    {
        image: caso9,
        description: 'El cual despliega este formulario para agregar participantes al caso y darle el nivel de permiso que consideremos apropiado.',
    },
    {
        image: caso10,
        description: 'Cada parte cuenta con el botón de eliminar para ser desvinculada del caso si se requiere.',
    },
];

// ── Clientes ──────────────────────────────────────────────────────────────────
export const clientesSteps = [
    {
        image: cliente1,
        description: 'Bienvendio a la Gestión de Clientes. Desde aquí podrás ver tus clientes y gestionar sus datos.',
    },
    {
        image: cliente2,
        description: 'Para agregar un cliente, hacé click en "Nuevo Cliente". Completá el nombre, apellido, dni, tipo y datos de contacto.',
    },
    {
        image: cliente3,
        description: 'Podemos filtrar nuestros clientes por fecha de creacion y por oden alfabético.',
    },
    {
        image: cliente4,
        description: 'Al seleccionar un cliente, tendremos una vista mas detallada de la informacion, asi como acceso a editar la misma y/o ver la documentacion relacionada con el cliente.',
    },
];

// Agrega nuevas secciones aquí siguiendo el mismo patrón.
