import React, { useCallback, useRef, useState } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { Briefcase, ChevronRight, Search } from 'lucide-react';
import CaseTools from './DraftingTools/CaseTools';
import GeneralTools from './DraftingTools/GeneralTools';
import { useModal } from '../../context/ModalContext.jsx';
import DocumentPreviewModal from './DocumentPreviewModal';
import MediaPreviewModal from './MediaPreviewModal';

const COLLAPSED_WIDTH = 72;
const DEFAULT_PANEL_WIDTH = 340;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 560;

const DraftingToolsSidebar = ({ caseId }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
    const isResizing = useRef(false);
    const { openModal } = useModal();

    // Mantiene el panel como un sidebar real, permitiendo redimensionarlo sin
    // sacar el foco del editor ni romper el flujo principal de escritura.
    const handleResize = useCallback((event) => {
        if (!isResizing.current) return;
        const newWidth = window.innerWidth - event.clientX;
        if (newWidth >= MIN_PANEL_WIDTH && newWidth <= MAX_PANEL_WIDTH) {
            setPanelWidth(newWidth);
        }
    }, []);

    const stopResizing = useCallback(function stopResizingHandler() {
        isResizing.current = false;
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', stopResizingHandler);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, [handleResize]);

    const startResizing = useCallback((event) => {
        event.preventDefault();
        isResizing.current = true;
        window.addEventListener('mousemove', handleResize);
        window.addEventListener('mouseup', stopResizing);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }, [handleResize, stopResizing]);

    const handlePreviewDocument = (document) => {
        openModal(DocumentPreviewModal, { document });
    };

    const handlePreviewMedia = (item) => {
        openModal(MediaPreviewModal, { item });
    };

    return (
        <aside
            data-expanded={isExpanded ? 'true' : 'false'}
            className="relative flex h-full shrink-0 overflow-hidden border-l border-(--border-default) bg-(--bg-card)"
            style={{
                width: isExpanded ? `${panelWidth}px` : `${COLLAPSED_WIDTH}px`,
                transitionProperty: 'width',
                transitionDuration: '280ms',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
        >
            {isExpanded && (
                <div
                    className="absolute inset-y-0 left-0 z-20 w-1 cursor-col-resize"
                    onMouseDown={startResizing}
                >
                    <div className="mx-auto h-full w-px bg-(--border-default) transition-colors hover:bg-blue-400" />
                </div>
            )}

            {!isExpanded ? (
                <div className="flex h-full w-full flex-col items-center bg-(--bg-card) px-2 py-4">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-(--border-default) bg-white text-(--text-secondary) shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                        title="Abrir herramientas para redacción"
                        aria-label="Abrir herramientas para redacción"
                    >
                        <Search size={19} />
                    </button>

                    <div className="mt-4 flex flex-1 flex-col items-center">
                        <div className="h-10 w-px bg-(--border-default)" />
                        <span className="mt-4 rotate-180 [writing-mode:vertical-rl] text-[10px] font-semibold uppercase tracking-[0.32em] text-(--text-tertiary)">
                            Redacción
                        </span>
                    </div>
                </div>
            ) : (
                <div className="flex h-full min-h-0 w-full flex-col">
                    <div className="flex shrink-0 items-start justify-between border-b border-(--border-default) bg-(--bg-card) px-5 py-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-blue-600">
                                <Search size={15} />
                                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-600/80">
                                    Panel lateral
                                </span>
                            </div>
                            <h3 className="mt-2 text-sm font-semibold text-(--text-primary)">
                                Herramientas para redacción
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(false)}
                            className="rounded-xl border border-(--border-default) bg-white p-2 text-(--text-tertiary) transition-colors hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
                            title="Contraer herramientas"
                            aria-label="Contraer herramientas"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="shrink-0 border-b border-(--border-default) px-4 py-4">
                        <div className={`rounded-2xl border px-3 py-3 ${caseId
                            ? 'border-blue-200 bg-blue-50/80'
                            : 'border-amber-200 bg-amber-50/80'
                        }`}>
                            <div className="flex items-center gap-2">
                                {caseId ? (
                                    <Briefcase size={14} className="text-blue-600" />
                                ) : (
                                    <Search size={14} className="text-amber-600" />
                                )}
                                <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${caseId ? 'text-blue-700' : 'text-amber-700'}`}>
                                    {caseId ? `Contexto del caso #${caseId}` : 'Sin caso vinculado'}
                                </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-(--text-secondary)">
                                {caseId
                                    ? 'Explorá documentos, personas, eventos y recursos del caso sin salir del editor.'
                                    : 'Usá búsquedas generales para insertar referencias mientras el documento sigue sin caso asociado.'}
                            </p>
                        </div>
                    </div>

                    {/* El contenido conserva scroll propio para no desplazar el editor. */}
                    <ScrollArea.Root className="flex-1 min-h-0 bg-(--bg-card)">
                        <ScrollArea.Viewport className="h-full w-full [&>div]:!block">
                            {caseId ? (
                                <CaseTools
                                    caseId={caseId}
                                    onPreviewDocument={handlePreviewDocument}
                                    onPreviewMedia={handlePreviewMedia}
                                />
                            ) : (
                                <GeneralTools onPreviewDocument={handlePreviewDocument} />
                            )}
                        </ScrollArea.Viewport>
                        <ScrollArea.Scrollbar
                            className="ScrollAreaScrollbar"
                            orientation="vertical"
                        >
                            <ScrollArea.Thumb className="ScrollAreaThumb" />
                        </ScrollArea.Scrollbar>
                        <ScrollArea.Corner className="ScrollAreaCorner" />
                    </ScrollArea.Root>
                </div>
            )}
        </aside>
    );
};

export default DraftingToolsSidebar;
