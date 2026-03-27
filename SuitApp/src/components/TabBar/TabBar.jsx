import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTabs } from '../../context/TabsContext';
import { useContextMenu, ContextMenu } from '../ui/ContextMenu';

/**
 * TabBar — barra de pestañas en la parte superior del área de contenido.
 *
 * Solo se renderiza cuando hay más de una pestaña abierta.
 * Diseño: fondo del sidebar (slate-900) con tabs que emergen hacia el contenido.
 * Right-click sobre cualquier tab abre un menú contextual con opciones de cierre.
 */
export function TabBar() {
    const { tabs, activeTabId, activateTab, closeTab, closeAllTabs } = useTabs();
    const [closeAllDialogOpen, setCloseAllDialogOpen] = useState(false);

    // Cierra todas las pestañas y deja solo /agenda
    const handleCloseAll = () => {
        closeAllTabs();
        setCloseAllDialogOpen(false);
    };

    // No mostrar si hay solo una pestaña
    if (tabs.length <= 1) return null;

    return (
        <>
            <div
                className="flex items-end gap-0.5 px-2 pt-1.5 shrink-0 overflow-x-auto"
                style={{
                    background: 'var(--tabbar-bg, rgb(15 23 42))',
                    borderBottom: '1px solid var(--border-default)',
                    scrollbarWidth: 'none',
                }}
                role="tablist"
                aria-label="Pestañas abiertas"
            >
                {tabs.map(tab => (
                    <Tab
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === activeTabId}
                        onActivate={() => activateTab(tab.id)}
                        onClose={() => closeTab(tab.id)}
                        onCloseAll={() => setCloseAllDialogOpen(true)}
                        canClose={tabs.length > 1}
                    />
                ))}
            </div>

            {/* AlertDialog de confirmación para "Cerrar todas las pestañas" */}
            <AlertDialog.Root open={closeAllDialogOpen} onOpenChange={setCloseAllDialogOpen}>
                <AlertDialog.Portal>
                    <AlertDialog.Overlay
                        className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm animate-in fade-in-0"
                    />
                    <AlertDialog.Content
                        className={[
                            'fixed z-[10001] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                            'w-full max-w-md bg-(--bg-card) border border-(--border-default)',
                            'rounded-2xl shadow-2xl p-6 space-y-4',
                            'animate-in fade-in-0 zoom-in-95 duration-200',
                        ].join(' ')}
                    >
                        <AlertDialog.Title className="text-base font-semibold text-(--text-primary)">
                            ¿Cerrar todas las pestañas?
                        </AlertDialog.Title>
                        <AlertDialog.Description className="text-sm text-(--text-secondary)">
                            Se cerrarán todas las pestañas abiertas y la aplicación volverá a la agenda.
                            Esta acción no se puede deshacer.
                        </AlertDialog.Description>
                        <div className="flex justify-end gap-2 pt-2">
                            <AlertDialog.Cancel asChild>
                                <button className="px-4 py-2 text-sm rounded-lg border border-(--border-default) text-(--text-primary) hover:bg-(--bg-hover) transition-colors">
                                    Cancelar
                                </button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action asChild>
                                <button
                                    onClick={handleCloseAll}
                                    className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
                                >
                                    Cerrar todas
                                </button>
                            </AlertDialog.Action>
                        </div>
                    </AlertDialog.Content>
                </AlertDialog.Portal>
            </AlertDialog.Root>
        </>
    );
}

// ---------------------------------------------------------------------------
// Tab individual
// ---------------------------------------------------------------------------

function Tab({ tab, isActive, onActivate, onClose, onCloseAll, canClose }) {
    const Icon = tab.icon;
    const buttonRef = useRef(null);
    const { contextMenuState, openContextMenu, closeContextMenu } = useContextMenu();

    const handleClose = (e) => {
        e.stopPropagation();
        onClose();
    };

    // Middle click cierra la pestaña
    const handleMouseDown = (e) => {
        if (e.button === 1) {
            e.preventDefault();
            onClose();
        }
    };

    // Menú contextual con opciones de cierre
    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e, [
            {
                label: 'Cerrar pestaña',
                icon: X,
                onClick: onClose,
                disabled: !canClose,
            },
            { separator: true },
            {
                label: 'Cerrar todas las pestañas',
                onClick: onCloseAll,
            },
        ]);
    };

    return (
        <>
            <button
                ref={buttonRef}
                role="tab"
                aria-selected={isActive}
                onClick={onActivate}
                onMouseDown={handleMouseDown}
                onContextMenu={handleContextMenu}
                title={tab.label}
                className={[
                    'group relative flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-sm font-medium',
                    'transition-colors duration-150 shrink-0 max-w-[180px] min-w-[80px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    isActive
                        ? 'bg-(--bg-page) text-(--text-primary) shadow-[0_-1px_0_0_var(--border-default),_1px_0_0_0_var(--border-default),_-1px_0_0_0_var(--border-default)]'
                        : 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                ].join(' ')}
                style={isActive ? {
                    // La pestaña activa "sube" visualmente sobre el borde inferior de la barra
                    marginBottom: '-1px',
                    borderBottom: '1px solid var(--bg-page)',
                } : {}}
            >
                {/* Icono de la sección */}
                {Icon && (
                    <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`}
                    />
                )}

                {/* Label — truncado */}
                <span className="truncate flex-1 text-left">
                    {tab.label}
                </span>

                {/* Botón cerrar — solo si hay más de 1 tab */}
                {canClose && (
                    <span
                        role="button"
                        tabIndex={-1}
                        aria-label={`Cerrar pestaña ${tab.label}`}
                        onClick={handleClose}
                        className={[
                            'flex items-center justify-center h-4 w-4 rounded shrink-0',
                            'opacity-0 group-hover:opacity-100 transition-opacity',
                            isActive ? 'opacity-60 hover:opacity-100' : '',
                            'hover:bg-slate-600 hover:text-white',
                        ].join(' ')}
                    >
                        <X className="h-3 w-3" />
                    </span>
                )}
            </button>

            {/* Menú contextual del tab */}
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
}
