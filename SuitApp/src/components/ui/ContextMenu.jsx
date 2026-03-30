import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ContextMenu — menú flotante que aparece en la posición del cursor.
 *
 * Uso:
 *   const { contextMenu, handleContextMenu } = useContextMenu();
 *   <div onContextMenu={handleContextMenu(items)}>...</div>
 *   <ContextMenu {...contextMenu} />
 *
 * O con el componente directo:
 *   <ContextMenuTrigger items={[{ label, icon, onClick }]}>
 *     <SomeChild />
 *   </ContextMenuTrigger>
 */

// ---------------------------------------------------------------------------
// Componente base — renderizado en portal sobre todo el documento
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   x: number,
 *   y: number,
 *   items: Array<{ label: string, icon?: React.ComponentType, onClick: () => void, disabled?: boolean }>,
 *   onClose: () => void
 * }} props
 */
export function ContextMenu({ x, y, items, onClose }) {
    const menuRef = useRef(null);
    const [position, setPosition] = useState({ x, y });

    // Ajustar posición si el menú se sale de la pantalla
    useEffect(() => {
        if (!menuRef.current) return;
        const frameId = window.requestAnimationFrame(() => {
            if (!menuRef.current) return;
            const rect = menuRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            setPosition({
                x: x + rect.width > vw ? vw - rect.width - 8 : x,
                y: y + rect.height > vh ? vh - rect.height - 8 : y,
            });
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [x, y]);

    // Cerrar al hacer clic fuera o presionar Escape
    useEffect(() => {
        const handleClick = () => onClose();
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            className={[
                'fixed z-[9999] min-w-[180px] py-1.5',
                'bg-(--bg-card) border border-(--border-default)',
                'rounded-xl shadow-xl backdrop-blur-sm',
                'animate-in fade-in-0 zoom-in-95 duration-100',
            ].join(' ')}
            style={{ left: position.x, top: position.y }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {items.map((item, i) => {
                if (item.separator) {
                    return <div key={i} className="my-1 border-t border-(--border-default)" />;
                }
                const Icon = item.icon;
                return (
                    <button
                        key={i}
                        role="menuitem"
                        disabled={item.disabled}
                        onClick={() => { item.onClick(); onClose(); }}
                        className={[
                            'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left',
                            'text-(--text-primary) transition-colors',
                            item.disabled
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-(--bg-hover) cursor-pointer',
                        ].join(' ')}
                    >
                        {Icon && <Icon className="h-4 w-4 text-(--text-secondary) shrink-0" />}
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && (
                            <span className="text-xs text-(--text-secondary) ml-2">{item.shortcut}</span>
                        )}
                    </button>
                );
            })}
        </div>,
        document.body
    );
}

// ---------------------------------------------------------------------------
// Hook useContextMenu — gestiona estado del menú contextual
// ---------------------------------------------------------------------------

/**
 * Devuelve:
 *   - contextMenuState: { visible, x, y, items } — pasar como props a <ContextMenu>
 *   - openContextMenu(e, items): llama desde onContextMenu
 *   - closeContextMenu()
 *
 * Ejemplo:
 *   const { contextMenuState, openContextMenu, closeContextMenu } = useContextMenu();
 *   ...
 *   <div onContextMenu={(e) => openContextMenu(e, myItems)}>...</div>
 *   {contextMenuState.visible && <ContextMenu {...contextMenuState} onClose={closeContextMenu} />}
 */
export function useContextMenu() {
    const [contextMenuState, setContextMenuState] = useState({ visible: false, x: 0, y: 0, items: [] });

    const openContextMenu = (e, items) => {
        e.preventDefault();
        setContextMenuState({ visible: true, x: e.clientX, y: e.clientY, items });
    };

    const closeContextMenu = () => setContextMenuState(s => ({ ...s, visible: false }));

    return { contextMenuState, openContextMenu, closeContextMenu };
}

// ---------------------------------------------------------------------------
// ContextMenuTrigger — wrapper declarativo (alternativa al hook)
// ---------------------------------------------------------------------------

/**
 * Wrappea children y muestra el menú contextual al hacer right-click.
 *
 * @param {{ items: ContextMenuItem[], children: React.ReactNode }} props
 */
export function ContextMenuTrigger({ items, children }) {
    const { contextMenuState, openContextMenu, closeContextMenu } = useContextMenu();

    return (
        <>
            <div
                onContextMenu={(e) => openContextMenu(e, items)}
                className="contents"
            >
                {children}
            </div>
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
