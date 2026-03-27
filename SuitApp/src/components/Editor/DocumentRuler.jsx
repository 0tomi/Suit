import React, { useEffect, useState, useRef } from 'react';
import { INDENT_STEP_REM, INDENT_MAX_LEVEL, INDENT_MIN_LEVEL } from './extensions/Indent.js';
import {
    marginToPx,
    pxToMargin,
    getVisualPageMargins,
    setVisualHorizontalMargin,
    getPagePixelSize,
} from './marginsUtils.js';
const DEFAULT_REM_PX = 16;
const PIXELS_PER_LEVEL = INDENT_STEP_REM * DEFAULT_REM_PX;

/** Ancho mínimo del margen derecho al arrastrar (10px). */
const MIN_MARGIN_PX = 10;
const MIN_CONTENT_WIDTH_PX = 160;

const DocumentRuler = ({ editor, margins, onMarginsChange, previewSide = 'odd' }) => {
    const [currentIndentLevel, setCurrentIndentLevel] = useState(0);

    // Drag del marcador de sangría (izquierdo)
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffsetPx, setDragOffsetPx] = useState(0);
    const isDraggingRef = useRef(false);

    // Drag del marcador de margen derecho
    const [isDraggingRight, setIsDraggingRight] = useState(false);
    const [dragRightPx, setDragRightPx] = useState(0); // distancia desde el borde derecho en px
    const isDraggingRightRef = useRef(false);

    // Drag del marcador de margen izquierdo
    const [isDraggingLeftMargin, setIsDraggingLeftMargin] = useState(false);
    const [dragLeftMarginPx, setDragLeftMarginPx] = useState(0);
    const isDraggingLeftMarginRef = useRef(false);

    const rulerRef = useRef(null);

    // Tamaños de márgenes visibles en px derivados del estado de márgenes.
    const unit    = margins?.unit ?? 'pt';
    const visualMargins = getVisualPageMargins(margins, previewSide);
    const { widthPx: rulerWidthPx } = getPagePixelSize(visualMargins);
    const leftPx  = visualMargins ? marginToPx(visualMargins.left, unit) : 48;
    const rightPx = visualMargins ? marginToPx(visualMargins.right, unit) : 48;
    const canDragMargins = !!margins && !!onMarginsChange;

    const effectiveLeftPx = isDraggingLeftMargin ? dragLeftMarginPx : leftPx;
    const effectiveRightPx = isDraggingRight ? dragRightPx : rightPx;

    // El offset base del marcador de sangría = ancho del margen izquierdo visible actual
    const editorPaddingLeft = effectiveLeftPx;

    // ── Sincronización del nivel de sangría desde el editor ──────────────────
    useEffect(() => {
        if (!editor) return;

        const updateIndentFromEditor = () => {
            if (isDraggingRef.current) return;
            if (editor.isActive('paragraph') || editor.isActive('heading')) {
                const attrs = { ...editor.getAttributes('paragraph'), ...editor.getAttributes('heading') };
                setCurrentIndentLevel(Number(attrs.indent) || 0);
            } else {
                setCurrentIndentLevel(0);
            }
        };

        editor.on('transaction', updateIndentFromEditor);
        updateIndentFromEditor();
        return () => editor.off('transaction', updateIndentFromEditor);
    }, [editor]);

    // ── Drag del marcador de sangría (izquierdo) ─────────────────────────────
    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDragging || !rulerRef.current) return;
            const rect = rulerRef.current.getBoundingClientRect();
            let offsetX = e.clientX - rect.left - editorPaddingLeft;
            offsetX = Math.max(0, Math.min(INDENT_MAX_LEVEL * PIXELS_PER_LEVEL, offsetX));
            setDragOffsetPx(offsetX);
        };

        const handlePointerUp = () => {
            if (!isDragging) return;
            let newLevel = Math.round(dragOffsetPx / PIXELS_PER_LEVEL);
            newLevel = Math.max(INDENT_MIN_LEVEL, Math.min(INDENT_MAX_LEVEL, newLevel));
            if (editor) editor.chain().focus().setIndentLevel(newLevel).run();
            setIsDragging(false);
            isDraggingRef.current = false;
            setCurrentIndentLevel(newLevel);
        };

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, dragOffsetPx, editor, editorPaddingLeft]);

    const handlePointerDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        setIsDragging(true);
        isDraggingRef.current = true;
        setDragOffsetPx(currentIndentLevel * PIXELS_PER_LEVEL);
    };

    // ── Drag del marcador de margen derecho ───────────────────────────────────
    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDraggingRight || !rulerRef.current) return;
            const rect = rulerRef.current.getBoundingClientRect();
            const maxRightPx = Math.max(MIN_MARGIN_PX, rect.width - leftPx - MIN_CONTENT_WIDTH_PX);
            const newRightPx = Math.max(MIN_MARGIN_PX, Math.min(maxRightPx, rect.right - e.clientX));
            setDragRightPx(newRightPx);
        };

        const handlePointerUp = () => {
            if (!isDraggingRight) return;
            const newRightValue = pxToMargin(dragRightPx, unit);
            onMarginsChange(setVisualHorizontalMargin(margins, 'right', newRightValue, previewSide));
            setIsDraggingRight(false);
            isDraggingRightRef.current = false;
        };

        if (isDraggingRight) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDraggingRight, dragRightPx, margins, unit, onMarginsChange, previewSide, leftPx]);

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDraggingLeftMargin || !rulerRef.current) return;
            const rect = rulerRef.current.getBoundingClientRect();
            const maxLeftPx = Math.max(MIN_MARGIN_PX, rect.width - rightPx - MIN_CONTENT_WIDTH_PX);
            const newLeftPx = Math.max(MIN_MARGIN_PX, Math.min(maxLeftPx, e.clientX - rect.left));
            setDragLeftMarginPx(newLeftPx);
        };

        const handlePointerUp = () => {
            if (!isDraggingLeftMargin) return;
            const newLeftValue = pxToMargin(dragLeftMarginPx, unit);
            onMarginsChange(setVisualHorizontalMargin(margins, 'left', newLeftValue, previewSide));
            setIsDraggingLeftMargin(false);
            isDraggingLeftMarginRef.current = false;
        };

        if (isDraggingLeftMargin) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDraggingLeftMargin, dragLeftMarginPx, margins, unit, onMarginsChange, previewSide, rightPx]);

    const handleRightPointerDown = (e) => {
        if (e.button !== 0 || !canDragMargins) return;
        e.preventDefault();
        setIsDraggingRight(true);
        isDraggingRightRef.current = true;
        setDragRightPx(rightPx);
    };

    const handleLeftMarginPointerDown = (e) => {
        if (e.button !== 0 || !canDragMargins) return;
        e.preventDefault();
        setIsDraggingLeftMargin(true);
        isDraggingLeftMarginRef.current = true;
        setDragLeftMarginPx(leftPx);
    };

    // ── Posiciones de los marcadores ─────────────────────────────────────────
    const markerLeftPx = (isDragging ? dragOffsetPx : currentIndentLevel * PIXELS_PER_LEVEL) + editorPaddingLeft;
    const leftMarginMarkerPx = effectiveLeftPx;
    const rightMarkerLeftPx = rulerWidthPx - effectiveRightPx;

    // ── Ticks ────────────────────────────────────────────────────────────────
    const renderTicks = () => {
        const ticks = [];
        const tickCount = Math.floor(rulerWidthPx / 10);
        for (let i = 0; i <= tickCount; i++) {
            const isMajor = i % 5 === 0;
            const xPos = i * 10;
            if (xPos >= rulerWidthPx) break;
            ticks.push(
                <div
                    key={i}
                    className={`absolute top-0 w-px bg-gray-300 dark:bg-gray-600 ${isMajor ? 'h-full' : 'h-1/2'}`}
                    style={{ left: `${xPos}px` }}
                />
            );
        }
        return ticks;
    };

    if (!editor) return null;

    return (
        <div className="w-full flex justify-center mt-2 mb-4 select-none">
            <div
                ref={rulerRef}
                className="relative h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm rounded-sm overflow-hidden"
                style={{ width: `${rulerWidthPx}px` }}
            >
                {/* Zona gris izquierda */}
                <div
                    className="absolute top-0 bottom-0 left-0 bg-gray-100 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-600 pointer-events-none"
                    style={{ width: `${effectiveLeftPx}px` }}
                />
                {/* Zona gris derecha */}
                <div
                    className="absolute top-0 bottom-0 right-0 bg-gray-100 dark:bg-gray-900 border-l border-gray-300 dark:border-gray-600 pointer-events-none"
                    style={{ width: `${effectiveRightPx}px` }}
                />

                <div className="absolute inset-0 pointer-events-none opacity-60">
                    {renderTicks()}
                </div>

                {/* Marcador de sangría izquierda (arrastrable) */}
                <div
                    className="absolute left-0 z-20 cursor-grab active:cursor-grabbing transition-colors group flex flex-col items-center"
                    style={{ left: `${markerLeftPx}px`, width: '26px', height: '14px', top: '10px', transform: 'translateX(-50%)' }}
                    onPointerDown={handlePointerDown}
                    title="Sangría"
                >
                    <div className="absolute inset-x-0 top-0 h-px bg-red-500/40 group-hover:bg-red-600 transition-colors" />
                    <div className="mt-auto w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-red-600 dark:border-b-red-400 group-hover:scale-125 transition-transform" />
                    {isDragging && (
                        <div className="absolute bottom-full h-[150vh] w-px bg-red-500/40 border-l border-dashed border-red-400/50 pointer-events-none z-50" />
                    )}
                </div>

                {margins && (
                    <div
                        className="absolute top-0 z-30 flex flex-col items-center cursor-ew-resize hover:bg-blue-50/20 transition-colors group"
                        style={{ left: `${leftMarginMarkerPx}px`, width: '16px', height: '12px', transform: 'translateX(-50%)' }}
                        onPointerDown={handleLeftMarginPointerDown}
                        title={margins.mirrored
                            ? `Margen ${previewSide === 'even' ? 'exterior' : 'interior'}: ${visualMargins.left} ${unit} — arrastre para ajustar`
                            : `Margen izquierdo: ${visualMargins.left} ${unit} — arrastre para ajustar`}
                    >
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-blue-500 dark:border-t-blue-400 mt-0.5 transition-transform group-hover:scale-125" />
                        <div className="absolute top-0 bottom-0 w-px bg-blue-500/60 dark:bg-blue-400/60 group-hover:bg-blue-600" />
                        {isDraggingLeftMargin && (
                            <div className="absolute top-full h-[150vh] w-px bg-blue-500/40 border-l border-dashed border-blue-400/50 pointer-events-none z-50" />
                        )}
                    </div>
                )}

                {/* Indicador de margen derecho.
                    Arrastrable cuando hay márgenes reales y no está espejado.
                    Gris + sin cursor cuando está espejado (indica que no es editable individualmente). */}
                {margins && (
                    <div
                        className="absolute top-0 z-30 flex flex-col items-center group cursor-ew-resize hover:bg-blue-50/20"
                        style={{ left: `${rightMarkerLeftPx}px`, width: '16px', height: '12px', transform: 'translateX(-50%)' }}
                        onPointerDown={handleRightPointerDown}
                        title={margins.mirrored
                            ? `Margen ${previewSide === 'even' ? 'interior' : 'exterior'}: ${visualMargins.right} ${unit} — arrastre para ajustar`
                            : `Margen derecho: ${visualMargins.right} ${unit} — arrastre para ajustar`}
                    >
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] mt-0.5 transition-transform border-t-blue-500 dark:border-t-blue-400 group-hover:scale-125" />
                        <div className="w-px h-full bg-blue-500/40 dark:bg-blue-400/40 group-hover:bg-blue-600" />
                        {isDraggingRight && (
                            <div className="absolute top-full h-[150vh] w-px bg-blue-500/40 border-l border-dashed border-blue-400/50 pointer-events-none z-50" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentRuler;
