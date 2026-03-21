/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';

const ModalContext = createContext();
export const ManagedModalIdContext = createContext(null);
const MotionDiv = m.div;

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
    const [modals, setModals] = useState([]);
    const modalCounterRef = useRef(0);

    const openModal = useCallback((Component, props = {}, options = {}) => {
        modalCounterRef.current += 1;
        const id = `modal-${modalCounterRef.current}`;
        const newModal = { id, Component, props, options };
        setModals(prev => [...prev, newModal]);
        return id;
    }, []);

    const closeModal = useCallback((id) => {
        setModals(prev => {
            if (id) {
                return prev.filter(m => m.id !== id);
            }
            // If no id, close the top-most modal
            return prev.slice(0, prev.length - 1);
        });
    }, []);
    
    const contextValue = { modals, openModal, closeModal };

    return (
        <ModalContext.Provider value={contextValue}>
            <LazyMotion features={domAnimation}>
                {children}
                <AnimatePresence>
                    {modals.map((modal, index) => {
                    const { id, Component, props, options } = modal;
                    const isTop = index === modals.length - 1;
                    const isNestedModal = index > 0;
                    const zIndexBase = 50 + (index * 10);
                    
                    // Solo el modal superior (el último en el stack) es visible.
                    // Esto cumple con el requerimiento de que el anterior desaparezca.
                    const isVisible = isTop;

                    // Si es el modal superior, usamos el overlay estándar para opacar el fondo
                    // de la aplicación (ya que el modal anterior, que tenía el overlay, ahora está oculto).
                    const overlayClass = options?.overlayClass
                        ?? (isVisible ? 'bg-(--bg-overlay) backdrop-blur-sm' : 'bg-transparent');
                    const handleOverlayClick = (event) => {
                        if (event.target !== event.currentTarget) return;
                        closeModal(id);
                    };

                        return (
                            <MotionDiv
                                key={id}
                                className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClass} ${!isVisible ? 'hidden' : ''}`}
                                style={{ zIndex: zIndexBase }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={handleOverlayClick}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        closeModal(id);
                                    }
                                }}
                            >
                                <ManagedModalIdContext.Provider value={id}>
                                    <div role="dialog" aria-modal="true">
                                        <Component
                                            {...props}
                                            open
                                            onClose={() => closeModal(id)}
                                            isNestedModal={isNestedModal}
                                            modalId={id}
                                            closeModal={() => closeModal(id)}
                                        />
                                    </div>
                                </ManagedModalIdContext.Provider>
                            </MotionDiv>
                        );
                    })}
                </AnimatePresence>
            </LazyMotion>
        </ModalContext.Provider>
    );
};
