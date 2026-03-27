import { Calendar, Clock, Users, Briefcase, FileText, LayoutTemplate, Shield, Landmark, Tag, BarChart3, Library } from 'lucide-react';

/**
 * Registro centralizado de todas las secciones navegables de la aplicación.
 * Fuente única de verdad usada tanto por Sidebar.jsx como por la página Sections.jsx.
 *
 * Cada sección define:
 *   - key:         Identificador único (también usado como clave en pinnedSections)
 *   - path:        Ruta React Router
 *   - label:       Nombre visible en UI
 *   - description: Texto descriptivo para las cards de la página Secciones
 *   - icon:        Componente de ícono Lucide
 *   - testId:      data-testid del NavLink en el sidebar (para E2E)
 *   - adminOnly:   Si true, solo visible para usuarios con role === 'admin'
 */
export const SECTIONS_REGISTRY = [
    {
        key: 'agenda',
        path: '/agenda',
        label: 'Agenda',
        description: 'Calendario de eventos y recordatorios del estudio.',
        icon: Calendar,
        testId: 'sidebar-nav-agenda',
        adminOnly: false,
    },
    {
        key: 'deadlines',
        path: '/deadlines',
        label: 'Vencimientos',
        description: 'Seguimiento de vencimientos judiciales y alertas de urgencia.',
        icon: Clock,
        testId: 'sidebar-nav-deadlines',
        adminOnly: false,
    },
    {
        key: 'people',
        path: '/people',
        label: 'Personas',
        description: 'Directorio de clientes y partes del estudio.',
        icon: Users,
        testId: 'sidebar-nav-people',
        adminOnly: false,
    },
    {
        key: 'economia',
        path: '/economia',
        label: 'Economía',
        description: 'Gestión operativa de honorarios, entregas y gastos de los casos.',
        icon: Landmark,
        testId: 'sidebar-nav-economia',
        adminOnly: false,
    },
    {
        key: 'categorias',
        path: '/categorias',
        label: 'Categorías',
        description: 'Catálogos de Casos, Agenda y Economía centralizados en una sola sección.',
        icon: Tag,
        testId: 'sidebar-nav-categorias',
        adminOnly: false,
    },
    {
        key: 'cases',
        path: '/cases',
        label: 'Casos',
        description: 'Expedientes judiciales, seguimiento de causas activas y archivadas.',
        icon: Briefcase,
        testId: 'sidebar-nav-cases',
        adminOnly: false,
    },
    {
        key: 'documents',
        path: '/documents',
        label: 'Documentos',
        description: 'Repositorio de documentos generados y gestionados en el estudio.',
        icon: FileText,
        testId: 'sidebar-nav-documents',
        adminOnly: false,
    },
    {
        key: 'templates',
        path: '/templates',
        label: 'Modelos',
        description: 'Plantillas reutilizables para la redacción de documentos legales.',
        icon: LayoutTemplate,
        testId: 'sidebar-nav-templates',
        adminOnly: false,
    },
    {
        key: 'biblioteca',
        path: '/biblioteca',
        label: 'Biblioteca',
        description: 'Repositorio público de archivos y catálogos.',
        icon: Library,
        testId: 'sidebar-nav-biblioteca',
        adminOnly: false,
    },
    {
        key: 'reports',
        path: '/reports',
        label: 'Estadísticas',
        description: 'Panel operativo y económico del estudio.',
        icon: BarChart3,
        testId: 'sidebar-nav-reports',
        adminOnly: true,
    },
    {
        key: 'admin',
        path: '/admin',
        label: 'Panel Admin',
        description: 'Administración de usuarios y configuración global del sistema.',
        icon: Shield,
        testId: 'sidebar-nav-admin',
        adminOnly: true,
    },
];

/**
 * Secciones ancladas al sidebar en el primer uso (mínimo indispensable).
 * El resto quedan disponibles para anclar desde la página Secciones.
 */
export const DEFAULT_PINNED_SECTIONS = ['agenda', 'deadlines', 'cases', 'reports'];
