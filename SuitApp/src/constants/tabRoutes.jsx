/**
 * tabRoutes.jsx
 *
 * Define:
 *   1. getPathMeta(path) — devuelve { label, icon } para cualquier ruta de la app.
 *      Usado por TabsContext para derivar el label/icon de cada pestaña.
 *
 *   2. TAB_INTERNAL_ROUTES — configuración de rutas para el MemoryRouter interno de
 *      cada pestaña (espejo de las rutas que antes vivían en App.jsx).
 *      Usado por TabContent para renderizar el componente correcto según la URL interna.
 */

import { lazy } from 'react';
import {
    Calendar, Clock, Users, Briefcase, FileText,
    LayoutTemplate, Shield, Landmark, Tag, BarChart3,
    Library, Settings, LayoutGrid,
} from 'lucide-react';
import { SECTIONS_REGISTRY } from './sectionsRegistry.js';

// ---------------------------------------------------------------------------
// Componentes de página (lazy) — mismos que App.jsx
// ---------------------------------------------------------------------------
const Agenda       = lazy(() => import('../pages/Agenda'));
const Cases        = lazy(() => import('../pages/Cases'));
const CaseDetail   = lazy(() => import('../pages/CaseDetail'));
const People       = lazy(() => import('../pages/People'));
const ClientDetail = lazy(() => import('../pages/ClientDetail'));
const Economia     = lazy(() => import('../pages/Economia'));
const Categories   = lazy(() => import('../pages/Categories'));
const Biblioteca   = lazy(() => import('../pages/Biblioteca'));
const Deadlines    = lazy(() => import('../pages/Deadlines'));
const DeadlineDetail = lazy(() => import('../pages/DeadlineDetail'));
const Documents    = lazy(() => import('../pages/Documents'));
const DocumentEditor = lazy(() => import('../pages/DocumentEditor'));
const TemplateGallery = lazy(() => import('../pages/TemplateGallery'));
const TemplateEditor  = lazy(() => import('../pages/TemplateEditor'));
const AdminPanel   = lazy(() => import('../pages/AdminPanel'));
const SettingsPage = lazy(() => import('../pages/Settings'));
const Reports      = lazy(() => import('../pages/Reports'));
const Sections     = lazy(() => import('../pages/Sections'));

// Providers exclusivos de /biblioteca
import { PublicFileCatalogsProvider } from '../context/PublicFileCatalogsContext';
import { PublicFilesProvider }        from '../context/PublicFilesContext';

/**
 * Wrapper de Biblioteca con sus providers propios.
 * Estos providers son lazy-load de datos de Biblioteca y no forman parte
 * del árbol global de AppProviders.
 */
function BibliotecaWithProviders() {
    return (
        <PublicFileCatalogsProvider>
            <PublicFilesProvider>
                <Biblioteca />
            </PublicFilesProvider>
        </PublicFileCatalogsProvider>
    );
}

// ---------------------------------------------------------------------------
// Lookup de metadata por path — incluye secciones extra fuera del SECTIONS_REGISTRY
// ---------------------------------------------------------------------------
const EXTRA_PATH_META = [
    { pathPrefix: '/settings', label: 'Ajustes',   icon: Settings  },
    { pathPrefix: '/admin',    label: 'Admin',      icon: Shield    },
    { pathPrefix: '/sections', label: 'Secciones',  icon: LayoutGrid },
];

/**
 * Devuelve { label, icon } para el path dado.
 * Prioriza coincidencias más largas (más específicas) del SECTIONS_REGISTRY.
 * Fallback a EXTRA_PATH_META, luego a valores genéricos.
 *
 * @param {string} path
 * @returns {{ label: string, icon: React.ComponentType | null }}
 */
export function getPathMeta(path) {
    if (!path) return { label: 'Nueva pestaña', icon: null };

    // Buscar en SECTIONS_REGISTRY ordenando por longitud desc para preferir coincidencias específicas
    const registryMatch = [...SECTIONS_REGISTRY]
        .sort((a, b) => b.path.length - a.path.length)
        .find(s => path === s.path || path.startsWith(s.path + '/'));

    if (registryMatch) return { label: registryMatch.label, icon: registryMatch.icon };

    // Extras (settings, admin, sections — que no están en el SECTIONS_REGISTRY)
    const extraMatch = EXTRA_PATH_META.find(e => path === e.pathPrefix || path.startsWith(e.pathPrefix + '/'));
    if (extraMatch) return { label: extraMatch.label, icon: extraMatch.icon };

    return { label: 'Nueva pestaña', icon: null };
}

// ---------------------------------------------------------------------------
// Rutas internas para el MemoryRouter de cada tab
// ---------------------------------------------------------------------------

/**
 * Mapa plano de rutas → componente para el MemoryRouter interno.
 * El orden importa: rutas más específicas primero (ej: /cases/:id antes que /cases).
 *
 * Cada entrada:
 *   path      — patrón de ruta (soporta parámetros tipo :id)
 *   component — componente React a renderizar
 */
export const TAB_INTERNAL_ROUTES = [
    { path: '/agenda',               component: Agenda              },
    { path: '/cases/:id',            component: CaseDetail          },
    { path: '/cases',                component: Cases               },
    { path: '/people/:id',           component: ClientDetail        },
    { path: '/people',               component: People              },
    { path: '/economia',             component: Economia            },
    { path: '/categorias',           component: Categories          },
    { path: '/biblioteca',           component: BibliotecaWithProviders },
    { path: '/deadlines/:id',        component: DeadlineDetail      },
    { path: '/deadlines',            component: Deadlines           },
    { path: '/documents/new',        component: DocumentEditor      },
    { path: '/documents/edit/:id',   component: DocumentEditor      },
    { path: '/documents',            component: Documents           },
    { path: '/templates/new',        component: TemplateEditor      },
    { path: '/templates/edit/:id',   component: TemplateEditor      },
    { path: '/templates',            component: TemplateGallery     },
    { path: '/admin',                component: AdminPanel          },
    { path: '/settings',             component: SettingsPage        },
    { path: '/reports',              component: Reports             },
    { path: '/sections',             component: Sections            },
];
