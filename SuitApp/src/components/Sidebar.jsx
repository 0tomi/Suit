import { useMemo, useState } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronsLeft,
    ChevronsRight,
    Settings,
    Server,
    RefreshCw,
    Bell,
    LayoutGrid,
} from 'lucide-react';
import { SECTIONS_REGISTRY } from '../constants/sectionsRegistry.js';
import suitLogo from '../assets/SuitLogo.png';
import suitLogoCompacto from '../assets/SuitLogoCompacto.png';

import { useAuth } from '../context/AuthContext';
import { useApi } from '../context/ApiContext';
import { useSettings } from '../context/SettingsContext';
import { useSyncStatus } from '../context/SyncStatusContext';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { useDeadlineBadge } from '../hooks/useDeadlineBadge';
import MissedNotificationsModal from './Agenda/MissedNotificationsModal';
import { markPastNotificationAsRead } from '../services/missedNotificationService.js';
import { createLogger } from '../services/logService.js';
const logger = createLogger('component:sidebar');


const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { connected, setShowSetup } = useApi();
    const { isAnySyncing: syncing } = useSyncStatus();
    const { sidebarMode, sidebarAnimationSpeed, pinnedSections } = useSettings();
    const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
    const [isClickExpanded, setIsClickExpanded] = useState(false);

    const {
        count: missedCount,
        isOpen: missedOpen,
        items: missedItems,
        openModal: openMissedModal,
        closeModal: closeMissedModal,
        dismissItem: dismissMissedItem,
        dismissAll: dismissAllMissed,
    } = useNotificationBadge();

    const { badgeColor: deadlineBadgeColor } = useDeadlineBadge();

    const handleOpenMissedEvent = async (eventId, notifyAt) => {
        await markPastNotificationAsRead(eventId, notifyAt).catch((err) => {
            // Side effect secundario: la navegación al evento ya se completó
            void logger.warn('no se pudo marcar la notificacion pasada como leida', err);
        });
        closeMissedModal();
        navigate('/agenda', {
            state: {
                highlightedEventId: eventId,
                notificationNonce: Date.now(),
            },
        });
    };

    const isExpanded = useMemo(() => {
        if (sidebarMode === 'alwaysOpen') return true;
        if (sidebarMode === 'alwaysClosed') return false;
        if (sidebarMode === 'click') return isClickExpanded;
        return isHoveringSidebar;
    }, [sidebarMode, isClickExpanded, isHoveringSidebar]);

    const animationDurationMs = useMemo(() => {
        if (sidebarAnimationSpeed === 'x0.5') return 220;
        if (sidebarAnimationSpeed === 'x0') return 0;
        return 420;
    }, [sidebarAnimationSpeed]);
    const isSettingsArea = location.pathname.startsWith('/settings');

    const textAnimationStyle = useMemo(() => ({
        transitionProperty: 'max-width, opacity, transform',
        transitionDuration: `${animationDurationMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: isExpanded && animationDurationMs > 0 ? `${Math.round(animationDurationMs * 0.18)}ms` : '0ms',
    }), [animationDurationMs, isExpanded]);

    // navItems derivado del registro global filtrado por secciones ancladas y rol de usuario.
    // El orden del registro se preserva para un sidebar estable independientemente del orden de pinning.
    const navItems = useMemo(() => {
        return SECTIONS_REGISTRY
            .filter((s) => {
                if (s.adminOnly && user?.role !== 'admin') return false;
                return pinnedSections.includes(s.key);
            })
            .map((s) => ({
                ...s,
                dotColor: s.key === 'deadlines' ? deadlineBadgeColor : undefined,
            }));
    }, [pinnedSections, user?.role, deadlineBadgeColor]);

    return (
        <>
            <aside
                id="app-sidebar"
                data-expanded={isExpanded ? 'true' : 'false'}
                data-animation-speed={sidebarAnimationSpeed}
                className={`bg-slate-900 text-white flex flex-col h-screen shadow-2xl overflow-hidden ${isExpanded ? 'w-64' : 'w-16'}`}
                style={{
                    transitionProperty: 'width',
                    transitionDuration: `${animationDurationMs}ms`,
                    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                onMouseEnter={() => setIsHoveringSidebar(true)}
                onMouseLeave={() => setIsHoveringSidebar(false)}
            >
                <div className={`py-4 border-b border-slate-800 flex items-center ${isExpanded ? 'px-5 gap-3' : 'px-2 justify-center'}`}>
                    {isExpanded ? (
                        <>
                            {/* Logo SUIT con blend mode para fondo blanco invisible */}
                            <img
                                src={suitLogo}
                                alt="Suit"
                                className="h-10 w-auto"
                                style={{
                                    mixBlendMode: 'screen',
                                    filter: 'invert(1) hue-rotate(180deg) brightness(1.1)',
                                    transform: 'scale(2)',
                                    transformOrigin: 'left center',
                                    marginLeft: '-10px',
                                }}
                            />
                        </>
                    ) : (
                        <img
                            src={suitLogoCompacto}
                            alt="SuitAPP"
                            className="h-8 w-8 object-contain"
                        />
                    )}

                    {isExpanded && (
                        <button
                            onClick={() => setShowSetup(true)}
                            className="relative text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 ml-auto mr-2 mt-1"
                            title={connected ? 'Servidor conectado' : 'Sin conexión'}
                            aria-label={connected ? 'Servidor conectado' : 'Sin conexión'}
                        >
                            <Server className="h-6 w-6" />
                            <span className={`rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} w-2.5 h-2.5`} />
                        </button>
                    )}
                </div>

                <div className="flex-1 min-h-0 flex flex-col relative">
                    {/* Las secciones ancladas scrollean de forma independiente para no mover el bloque inferior. */}
                    <ScrollArea.Root className="ScrollAreaRoot flex-1 min-h-0">
                        <ScrollArea.Viewport className="ScrollAreaViewport [&>div]:!block" data-testid="sidebar-sections-scroll">
                            <nav
                                className={`py-6 space-y-2 ${isExpanded ? 'px-3' : 'px-2'}`}
                            >
                                {/* Acceso directo a la gestión de secciones (Opción Híbrida) */}
                                <NavLink
                                    to="/sections"
                                    data-testid="sidebar-nav-sections-manager"
                                    title="Gestionar Secciones"
                                    aria-label="Gestionar Secciones"
                                    className={({ isActive }) =>
                                        `relative flex items-center rounded-xl transition-colors group ${isExpanded ? 'gap-3 px-4 py-3' : 'justify-center px-2 py-3'} ${isActive
                                            ? 'bg-blue-600 shadow-lg text-white'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`
                                    }
                                >
                                    <LayoutGrid className="h-6 w-6" />
                                    <span
                                        className="font-medium text-lg flex-1 whitespace-nowrap overflow-hidden"
                                        style={{
                                            ...textAnimationStyle,
                                            maxWidth: isExpanded ? '220px' : '0px',
                                            opacity: isExpanded ? 1 : 0,
                                            transform: isExpanded ? 'translateX(0)' : 'translateX(-6px)',
                                        }}
                                    >
                                        Secciones
                                    </span>
                                </NavLink>

                                {/* Divisor sutil después del gestor de secciones */}
                                <div className={`h-px bg-slate-800 mx-4 my-2 ${!isExpanded && 'hidden'}`} />

                                {navItems.map((item) => {
                                    const isActive = location.pathname.startsWith(item.path) || (item.path === '/agenda' && location.pathname === '/');
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            data-testid={item.testId}
                                            title={item.label}
                                            aria-label={`Ir a ${item.label}`}
                                            className={({ isActive: routeActive }) =>
                                                `relative flex items-center rounded-xl transition-colors group ${isExpanded ? 'gap-3 px-4 py-3' : 'justify-center px-2 py-3'} ${routeActive || isActive
                                                    ? 'bg-blue-600 shadow-lg text-white'
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                }`
                                            }
                                        >
                                            <item.icon className="h-6 w-6" />
                                            <span
                                                className="font-medium text-lg flex-1 whitespace-nowrap overflow-hidden"
                                                style={{
                                                    ...textAnimationStyle,
                                                    maxWidth: isExpanded ? '220px' : '0px',
                                                    opacity: isExpanded ? 1 : 0,
                                                    transform: isExpanded ? 'translateX(0)' : 'translateX(-6px)',
                                                }}
                                            >
                                                {item.label}
                                            </span>
                                            {item.dotColor && isExpanded && (
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: item.dotColor === 'red' ? '#ef4444' : '#eab308' }}
                                                    aria-label={item.dotColor === 'red' ? 'Vencimientos vencidos' : 'Vencimientos urgentes'}
                                                />
                                            )}
                                            {item.dotColor && !isExpanded && (
                                                <span
                                                    className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full"
                                                    style={{ backgroundColor: item.dotColor === 'red' ? '#ef4444' : '#eab308' }}
                                                    aria-label={item.dotColor === 'red' ? 'Vencimientos vencidos' : 'Vencimientos urgentes'}
                                                />
                                            )}
                                            {syncing && isActive && isExpanded && !item.badge && (
                                                <RefreshCw className="h-4 w-4 animate-spin text-blue-200" />
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </nav>
                        </ScrollArea.Viewport>
                        <ScrollArea.Scrollbar 
                            className="ScrollAreaScrollbar z-20" 
                            orientation="vertical"
                        >
                            <ScrollArea.Thumb className="ScrollAreaThumb" />
                        </ScrollArea.Scrollbar>
                        <ScrollArea.Corner className="ScrollAreaCorner" />
                    </ScrollArea.Root>

                    <div className={`shrink-0 border-t border-slate-800 space-y-2 relative z-10 sidebar-footer-gradient ${isExpanded ? 'p-4' : 'p-2'}`}>
                        {sidebarMode === 'click' && (
                            <button
                                id="sidebar-click-toggle"
                                type="button"
                                onClick={() => setIsClickExpanded((prev) => !prev)}
                                className={`w-full rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm ${isExpanded ? 'flex items-center space-x-3 px-4 py-2.5' : 'flex justify-center py-2.5'}`}
                                title={isExpanded ? 'Contraer sidebar' : 'Expandir sidebar'}
                                aria-label={isExpanded ? 'Contraer sidebar' : 'Expandir sidebar'}
                            >
                                {isExpanded ? (
                                    <>
                                        <ChevronsLeft className="h-5 w-5" />
                                        <span
                                            className="flex-1 text-left truncate whitespace-nowrap overflow-hidden"
                                            style={{
                                                ...textAnimationStyle,
                                                maxWidth: isExpanded ? '220px' : '0px',
                                                opacity: isExpanded ? 1 : 0,
                                                transform: isExpanded ? 'translateX(0)' : 'translateX(-6px)',
                                            }}
                                        >
                                            Contraer
                                        </span>
                                    </>
                                ) : (
                                    <ChevronsRight className="h-5 w-5" />
                                )}
                            </button>
                        )}

                        <button
                            id="sidebar-missed-button"
                            onClick={openMissedModal}
                            className={`relative w-full rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm ${isExpanded ? 'flex items-center space-x-3 px-4 py-2.5' : 'flex justify-center py-2.5'}`}
                            title="Notificaciones pasadas"
                            aria-label="Notificaciones pasadas"
                        >
                            <Bell className="h-5 w-5" />
                            <span
                                className="flex-1 text-left truncate whitespace-nowrap overflow-hidden"
                                style={{
                                    ...textAnimationStyle,
                                    maxWidth: isExpanded ? '220px' : '0px',
                                    opacity: isExpanded ? 1 : 0,
                                    transform: isExpanded ? 'translateX(0)' : 'translateX(-6px)',
                                }}
                            >
                                Recordatorios
                            </span>
                            {missedCount > 0 && isExpanded && (
                                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold leading-none" data-testid="sidebar-bell-badge-expanded">
                                    {missedCount > 99 ? '99+' : missedCount}
                                </span>
                            )}
                            {missedCount > 0 && !isExpanded && (
                                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none flex items-center justify-center" data-testid="sidebar-bell-badge-collapsed">
                                    {missedCount > 99 ? '99+' : missedCount}
                                </span>
                            )}
                        </button>

                        <NavLink
                            to="/settings"
                            data-testid="sidebar-nav-settings"
                            title="Ajustes"
                            aria-label="Ajustes"
                            className={() =>
                                `w-full rounded-xl transition-colors text-sm ${isExpanded ? 'flex items-center space-x-3 px-4 py-2.5' : 'flex justify-center py-2.5'} ${isSettingsArea
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`
                            }
                        >
                            <Settings className="h-5 w-5" />
                            <span
                                className="flex-1 text-left truncate whitespace-nowrap overflow-hidden"
                                style={{
                                    ...textAnimationStyle,
                                    maxWidth: isExpanded ? '220px' : '0px',
                                    opacity: isExpanded ? 1 : 0,
                                    transform: isExpanded ? 'translateX(0)' : 'translateX(-6px)',
                                }}
                            >
                                Ajustes
                            </span>
                        </NavLink>
                    </div>

                </div>
            </aside>

            <MissedNotificationsModal
                open={missedOpen}
                items={missedItems}
                onClose={closeMissedModal}
                onOpenEvent={handleOpenMissedEvent}
                onDismissItem={dismissMissedItem}
                onDismissAll={dismissAllMissed}
            />
        </>
    );
};

export default Sidebar;
