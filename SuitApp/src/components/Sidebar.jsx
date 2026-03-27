import { useMemo, useState, useCallback } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import {
    ChevronsLeft,
    ChevronsRight,
    Settings,
    Server,
    RefreshCw,
    Bell,
    LayoutGrid,
    ExternalLink,
} from 'lucide-react';
import { SECTIONS_REGISTRY } from '../constants/sectionsRegistry.js';
import suitLogo from '../assets/SuitLogo.png';
import suitLogoCompacto from '../assets/SuitLogoCompacto.png';

import { useAuth } from '../context/AuthContext';
import { useApi } from '../context/ApiContext';
import { useSettings } from '../context/SettingsContext';
import { useSyncStatus } from '../context/SyncStatusContext';
import { useTabs } from '../context/TabsContext';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { useDeadlineBadge } from '../hooks/useDeadlineBadge';
import MissedNotificationsModal from './Agenda/MissedNotificationsModal';
import { markPastNotificationAsRead } from '../services/missedNotificationService.js';
import { ContextMenu, useContextMenu } from './ui/ContextMenu.jsx';
import { createLogger } from '../services/logService.js';
const logger = createLogger('component:sidebar');


const Sidebar = () => {
    const { user } = useAuth();
    const { connected, setShowSetup } = useApi();
    const { isAnySyncing: syncing } = useSyncStatus();
    const { sidebarMode, sidebarAnimationSpeed, pinnedSections } = useSettings();
    const { openTab, openInNewTab, activeTab } = useTabs();
    const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
    const [isClickExpanded, setIsClickExpanded] = useState(false);

    // Estado del menú contextual (compartido para todo el sidebar)
    const { contextMenuState, openContextMenu, closeContextMenu } = useContextMenu();

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
            void logger.warn('no se pudo marcar la notificacion pasada como leida', err);
        });
        closeMissedModal();
        openTab('/agenda');
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

    const textAnimationStyle = useMemo(() => ({
        transitionProperty: 'max-width, opacity, transform',
        transitionDuration: `${animationDurationMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: isExpanded && animationDurationMs > 0 ? `${Math.round(animationDurationMs * 0.18)}ms` : '0ms',
    }), [animationDurationMs, isExpanded]);

    // navItems derivado del registro global filtrado por secciones ancladas y rol de usuario
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

    /**
     * Determina si un ítem del sidebar está "activo" comparando con el path
     * de la pestaña activa actual.
     */
    const isPathActive = useCallback((path) => {
        const current = activeTab?.currentPath ?? '';
        return current === path || current.startsWith(path + '/') || (path === '/agenda' && current === '/');
    }, [activeTab?.currentPath]);

    /**
     * Genera los ítems del menú contextual para una ruta del sidebar.
     */
    const buildContextItems = useCallback((path) => [
        {
            label: 'Abrir en nueva pestaña',
            icon: ExternalLink,
            onClick: () => openInNewTab(path),
        },
    ], [openInNewTab]);

    // Clases compartidas para los botones de navegación del sidebar
    const navBtnBase = `relative flex items-center rounded-xl transition-colors group ${isExpanded ? 'gap-3 px-4 py-3' : 'justify-center px-2 py-3'}`;
    const navBtnActive = 'bg-blue-600 shadow-lg text-white';
    const navBtnInactive = 'text-slate-400 hover:bg-slate-800 hover:text-white';
    const isSettingsActive = isPathActive('/settings');

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
                    <ScrollArea.Root className="ScrollAreaRoot flex-1 min-h-0">
                        <ScrollArea.Viewport className="ScrollAreaViewport [&>div]:!block" data-testid="sidebar-sections-scroll">
                            <nav
                                className={`py-6 space-y-2 ${isExpanded ? 'px-3' : 'px-2'}`}
                            >
                                {/* Acceso a gestión de secciones */}
                                <button
                                    data-testid="sidebar-nav-sections-manager"
                                    title="Gestionar Secciones"
                                    aria-label="Gestionar Secciones"
                                    onClick={() => openTab('/sections')}
                                    onContextMenu={(e) => openContextMenu(e, buildContextItems('/sections'))}
                                    className={`w-full ${navBtnBase} ${isPathActive('/sections') ? navBtnActive : navBtnInactive}`}
                                >
                                    <LayoutGrid className="h-6 w-6" />
                                    <span
                                        className="font-medium text-lg flex-1 whitespace-nowrap overflow-hidden text-left"
                                        style={{
                                            ...textAnimationStyle,
                                            maxWidth: isExpanded ? '220px' : '0px',
                                            opacity: isExpanded ? 1 : 0,
                                            transform: isExpanded ? 'translateX(0)' : 'translateX(-6px)',
                                        }}
                                    >
                                        Secciones
                                    </span>
                                </button>

                                {/* Divisor sutil después del gestor de secciones */}
                                <div className={`h-px bg-slate-800 mx-4 my-2 ${!isExpanded && 'hidden'}`} />

                                {navItems.map((item) => {
                                    const active = isPathActive(item.path);
                                    return (
                                        <button
                                            key={item.path}
                                            data-testid={item.testId}
                                            title={item.label}
                                            aria-label={`Ir a ${item.label}`}
                                            onClick={() => openTab(item.path)}
                                            onContextMenu={(e) => openContextMenu(e, buildContextItems(item.path))}
                                            className={`w-full ${navBtnBase} ${active ? navBtnActive : navBtnInactive}`}
                                        >
                                            <item.icon className="h-6 w-6" />
                                            <span
                                                className="font-medium text-lg flex-1 whitespace-nowrap overflow-hidden text-left"
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
                                            {syncing && active && isExpanded && !item.badge && (
                                                <RefreshCw className="h-4 w-4 animate-spin text-blue-200" />
                                            )}
                                        </button>
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

                    <div className={`shrink-0 border-t border-slate-800 space-y-2 relative z-10 sidebar-footer-gradient ${isExpanded ? 'px-3 py-4' : 'px-2 py-2'}`}>
                        {sidebarMode === 'click' && (
                            <button
                                id="sidebar-click-toggle"
                                type="button"
                                onClick={() => setIsClickExpanded((prev) => !prev)}
                                className={`w-full rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors ${isExpanded ? 'flex items-center gap-3 px-4 py-3' : 'flex justify-center py-3'}`}
                                title={isExpanded ? 'Contraer sidebar' : 'Expandir sidebar'}
                                aria-label={isExpanded ? 'Contraer sidebar' : 'Expandir sidebar'}
                            >
                                {isExpanded ? (
                                    <>
                                        <ChevronsLeft className="h-6 w-6" />
                                        <span
                                            className="font-medium text-lg flex-1 text-left whitespace-nowrap overflow-hidden"
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
                                    <ChevronsRight className="h-6 w-6" />
                                )}
                            </button>
                        )}

                        <button
                            id="sidebar-missed-button"
                            onClick={openMissedModal}
                            className={`relative w-full rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors p-0 ${isExpanded ? 'flex items-center gap-3 px-4 py-3' : 'flex justify-center py-3'}`}
                            title="Notificaciones pasadas"
                            aria-label="Notificaciones pasadas"
                        >
                            <Bell className="h-6 w-6" />
                            <span
                                className="font-medium text-lg flex-1 text-left whitespace-nowrap overflow-hidden"
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

                        <button
                            data-testid="sidebar-nav-settings"
                            title="Ajustes"
                            aria-label="Ajustes"
                            onClick={() => openTab('/settings')}
                            onContextMenu={(e) => openContextMenu(e, buildContextItems('/settings'))}
                            className={`relative w-full rounded-xl transition-colors ${isExpanded ? 'flex items-center gap-3 px-4 py-3' : 'flex justify-center py-3'} ${isSettingsActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        >
                            <Settings className="h-6 w-6" />
                            <span
                                className="font-medium text-lg flex-1 text-left whitespace-nowrap overflow-hidden"
                                style={{
                                    ...textAnimationStyle,
                                    maxWidth: isExpanded ? '220px' : '0px',
                                    opacity: isExpanded ? 1 : 0,
                                    transform: isExpanded ? 'translateX(0)' : 'translateX(-6px)',
                                }}
                            >
                                Ajustes
                            </span>
                        </button>
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

            {/* Menú contextual compartido del sidebar */}
            {contextMenuState.visible && (
                <ContextMenu
                    x={contextMenuState.x}
                    y={contextMenuState.y}
                    items={contextMenuState.items}
                    onClose={closeContextMenu}
                />
            )}
        </>
    );
};

export default Sidebar;
