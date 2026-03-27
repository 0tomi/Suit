import React, { useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModal, ManagedModalIdContext } from '../../context/ModalContext.jsx';
import { useHotkeysSystem } from '../../hotkeys/useHotkeysSystem.js';

/**
 * Componente UI reutilizable para Modales estándar y Formularios emergentes.
 */
export const Modal = ({
    open,
    onClose,
    title,
    subtitle = '',
    children,
    footer,
    footerAlignment = 'justify-center',
    maxWidth = 'max-w-2xl',
    maxHeight = 'max-h-[90vh]',
    bodyClassName = '',
    noOverlay = false,
    closeOnOutsideClick = true,
}) => {
    const { modals = [] } = useModal() || {};
    const { suspendAllHotkeysExceptEscape } = useHotkeysSystem();
    const managedModalId = useContext(ManagedModalIdContext);
    const overlayPointerStartedRef = useRef(false);

    // Lógica de visibilidad para apilado de modales:
    // 1. Si es un modal gestionado (dentro de ModalContext), se oculta si no es el superior.
    // 2. Si es un modal local (fuera del contexto gestionado), se oculta si hay algún modal gestionado encima.
    const isTop = modals.length > 0 && modals[modals.length - 1].id === managedModalId;
    const shouldHide = managedModalId 
        ? !isTop 
        : modals.length > 0;

    const handleOverlayMouseDown = (event) => {
        overlayPointerStartedRef.current = event.target === event.currentTarget;
    };

    const handleOverlayClick = (event) => {
        const shouldClose = overlayPointerStartedRef.current && event.target === event.currentTarget;
        overlayPointerStartedRef.current = false;
        if (!shouldClose) return;
        if (closeOnOutsideClick) onClose();
    };

    useEffect(() => {
        if (!open || shouldHide) return;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (closeOnOutsideClick) onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, shouldHide, closeOnOutsideClick, onClose]);

    useEffect(() => {
        if (!open || shouldHide) return undefined;
        return suspendAllHotkeysExceptEscape();
    }, [open, shouldHide, suspendAllHotkeysExceptEscape]);

    if (!open) return null;

    const modalContent = (
        <div
            className={`bg-(--bg-card) rounded-xl shadow-2xl ${maxWidth} w-full ${maxHeight} overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 ${shouldHide ? 'hidden' : ''}`}
        >
            <div className="px-6 py-4 border-b border-(--border-subtle) flex justify-between gap-4 bg-(--bg-header) shrink-0">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-(--text-primary)">{title}</h2>
                    {subtitle ? (
                        <p className="mt-1 text-sm text-(--text-secondary)">{subtitle}</p>
                    ) : null}
                </div>
                <button
                    onClick={onClose}
                    type="button"
                    className="text-(--text-tertiary) hover:text-red-500 transition-colors p-1 rounded-md hover:bg-(--bg-card-hover)"
                >
                    <X size={20} />
                </button>
            </div>

            <div className={`w-full p-6 overflow-y-auto ${bodyClassName}`.trim()}>
                {children}
            </div>

            {footer && (
                <div className={`px-6 py-4 bg-(--bg-header) flex gap-3 ${footerAlignment} border-t border-(--border-subtle) shrink-0`}>
                    {footer}
                </div>
            )}

        </div>
    );

    if (noOverlay) return modalContent;

    // Renderizamos el overlay en document.body via portal para garantizar
    // que fixed inset-0 cubra el viewport completo sin importar el contexto
    // CSS del árbol padre (overflow, transform, etc.).
    return createPortal(
        <div
            className={`fixed inset-0 bg-(--bg-overlay) backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 ${shouldHide ? 'hidden' : ''}`}
            onMouseDown={handleOverlayMouseDown}
            onClick={handleOverlayClick}
        >
            {modalContent}
        </div>,
        document.body
    );
};
