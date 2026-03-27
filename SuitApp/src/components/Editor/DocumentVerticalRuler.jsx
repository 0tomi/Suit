import React, { useEffect, useState, useRef } from 'react';
import { SPACING_STEP_REM, SPACING_MAX_LEVEL, SPACING_MIN_LEVEL } from './extensions/VerticalSpacing.js';
import { marginToPx, pxToMargin, getPagePixelSize } from './marginsUtils.js';

const DEFAULT_REM_PX = 16;
const PIXELS_PER_LEVEL = SPACING_STEP_REM * DEFAULT_REM_PX;
const MIN_MARGIN_PX = 10;
const MIN_CONTENT_HEIGHT_PX = 200;

const DocumentVerticalRuler = ({ editor, margins, onMarginsChange }) => {
    const [currentSpacingLevel, setCurrentSpacingLevel] = useState(0);

    // Drag del marcador de espaciado (superior)
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffsetPx, setDragOffsetPx] = useState(0);
    const isDraggingRef = useRef(false);

    // Drag del marcador de margen inferior
    const [isDraggingBottom, setIsDraggingBottom] = useState(false);
    const [dragBottomPx, setDragBottomPx] = useState(0);
    const isDraggingBottomRef = useRef(false);

    // Drag del marcador de margen superior
    const [isDraggingTopMargin, setIsDraggingTopMargin] = useState(false);
    const [dragTopMarginPx, setDragTopMarginPx] = useState(0);
    const isDraggingTopMarginRef = useRef(false);

    const rulerRef = useRef(null);

    const unit     = margins?.unit ?? 'pt';
    const { heightPx: rulerHeightPx } = getPagePixelSize(margins);
    const topPx    = margins ? marginToPx(margins.top,    unit) : 48;
    const bottomPx = margins ? marginToPx(margins.bottom, unit) : 48;
    const canDragMargins = !!margins && !!onMarginsChange;

    const effectiveTopPx = isDraggingTopMargin ? dragTopMarginPx : topPx;
    const editorPaddingTop = effectiveTopPx;

    // ── Sincronización del nivel de espaciado desde el editor ────────────────
    useEffect(() => {
        if (!editor) return;
        const updateSpacingFromEditor = () => {
            if (isDraggingRef.current) return;
            if (editor.isActive('paragraph') || editor.isActive('heading')) {
                const attrs = { ...editor.getAttributes('paragraph'), ...editor.getAttributes('heading') };
                setCurrentSpacingLevel(Number(attrs.spacingTop) || 0);
            } else {
                setCurrentSpacingLevel(0);
            }
        };
        editor.on('transaction', updateSpacingFromEditor);
        updateSpacingFromEditor();
        return () => editor.off('transaction', updateSpacingFromEditor);
    }, [editor]);

    // ── Drag del marcador de espaciado (superior) ────────────────────────────
    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDragging || !rulerRef.current) return;
            const rect = rulerRef.current.getBoundingClientRect();
            let offsetY = e.clientY - rect.top - editorPaddingTop;
            offsetY = Math.max(0, Math.min(SPACING_MAX_LEVEL * PIXELS_PER_LEVEL, offsetY));
            setDragOffsetPx(offsetY);
        };
        const handlePointerUp = () => {
            if (!isDragging) return;
            let newLevel = Math.round(dragOffsetPx / PIXELS_PER_LEVEL);
            newLevel = Math.max(SPACING_MIN_LEVEL, Math.min(SPACING_MAX_LEVEL, newLevel));
            if (editor) editor.chain().focus().setVerticalSpacing(newLevel).run();
            setIsDragging(false);
            isDraggingRef.current = false;
            setCurrentSpacingLevel(newLevel);
        };
        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, dragOffsetPx, editor, editorPaddingTop]);

    const handlePointerDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        setIsDragging(true);
        isDraggingRef.current = true;
        setDragOffsetPx(currentSpacingLevel * PIXELS_PER_LEVEL);
    };

    // ── Drag del marcador de margen inferior ─────────────────────────────────
    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDraggingBottom || !rulerRef.current) return;
            const rect = rulerRef.current.getBoundingClientRect();
            const maxBottomPx = Math.max(MIN_MARGIN_PX, rect.height - topPx - MIN_CONTENT_HEIGHT_PX);
            const newBottomPx = Math.max(MIN_MARGIN_PX, Math.min(maxBottomPx, rect.bottom - e.clientY));
            setDragBottomPx(newBottomPx);
        };
        const handlePointerUp = () => {
            if (!isDraggingBottom) return;
            const newBottomValue = pxToMargin(dragBottomPx, unit);
            onMarginsChange({ ...margins, bottom: newBottomValue });
            setIsDraggingBottom(false);
            isDraggingBottomRef.current = false;
        };
        if (isDraggingBottom) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDraggingBottom, dragBottomPx, margins, unit, onMarginsChange, topPx]);

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDraggingTopMargin || !rulerRef.current) return;
            const rect = rulerRef.current.getBoundingClientRect();
            const maxTopPx = Math.max(MIN_MARGIN_PX, rect.height - bottomPx - MIN_CONTENT_HEIGHT_PX);
            const newTopPx = Math.max(MIN_MARGIN_PX, Math.min(maxTopPx, e.clientY - rect.top));
            setDragTopMarginPx(newTopPx);
        };

        const handlePointerUp = () => {
            if (!isDraggingTopMargin) return;
            const newTopValue = pxToMargin(dragTopMarginPx, unit);
            onMarginsChange({ ...margins, top: newTopValue });
            setIsDraggingTopMargin(false);
            isDraggingTopMarginRef.current = false;
        };

        if (isDraggingTopMargin) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDraggingTopMargin, dragTopMarginPx, margins, unit, onMarginsChange, bottomPx]);

    const handleBottomPointerDown = (e) => {
        if (e.button !== 0 || !canDragMargins) return;
        e.preventDefault();
        setIsDraggingBottom(true);
        isDraggingBottomRef.current = true;
        setDragBottomPx(bottomPx);
    };

    const handleTopMarginPointerDown = (e) => {
        if (e.button !== 0 || !canDragMargins) return;
        e.preventDefault();
        setIsDraggingTopMargin(true);
        isDraggingTopMarginRef.current = true;
        setDragTopMarginPx(topPx);
    };

    // ── Posiciones de los marcadores ─────────────────────────────────────────
    const markerTopPx = (isDragging ? dragOffsetPx : currentSpacingLevel * PIXELS_PER_LEVEL) + editorPaddingTop;
    const effectiveBottomPx = isDraggingBottom ? dragBottomPx : bottomPx;
    const bottomMarkerTopPx = rulerHeightPx - effectiveBottomPx;

    // ── Ticks ────────────────────────────────────────────────────────────────
    const renderTicks = () => {
        const ticks = [];
        const usableHeight = rulerHeightPx - editorPaddingTop;
        const tickCount = Math.floor(usableHeight / 10);
        for (let i = 0; i <= tickCount; i++) {
            const isMajor = i % 5 === 0;
            const yPos = editorPaddingTop + (i * 10);
            if (yPos > rulerHeightPx) break;
            ticks.push(
                <div
                    key={i}
                    className={`absolute left-0 h-px bg-gray-300 dark:bg-gray-600 ${isMajor ? 'w-4' : 'w-2'}`}
                    style={{ top: `${yPos}px`, left: '4px' }}
                />
            );
        }
        return ticks;
    };

    if (!editor) return null;

    return (
        <div className="absolute top-0 bottom-0 right-full z-30 select-none pointer-events-none pr-[15px]">
            <div
                ref={rulerRef}
                className="relative bg-white dark:bg-gray-800 border-y border-l border-gray-200 dark:border-gray-600 shadow-sm rounded-l-md pointer-events-auto overflow-hidden"
                style={{ height: `${rulerHeightPx}px`, width: '24px' }}
            >
                {/* Zona gris superior */}
                <div
                    className="absolute top-0 left-0 right-0 bg-gray-100 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-600 pointer-events-none"
                    style={{ height: `${effectiveTopPx}px` }}
                />

                {/* Zona gris inferior */}
                {margins && (
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-gray-100 dark:bg-gray-900 border-t border-gray-300 dark:border-gray-600 pointer-events-none"
                        style={{ height: `${effectiveBottomPx}px` }}
                    />
                )}

                <div className="absolute inset-0 pointer-events-none opacity-60">
                    {renderTicks()}
                </div>

                {margins && (
                    <div
                        className="absolute left-0 right-0 z-20 flex flex-row items-center justify-start group cursor-ns-resize hover:bg-gray-50/10"
                        style={{ top: `${effectiveTopPx}px`, height: '12px', transform: 'translateY(-50%)' }}
                        onPointerDown={handleTopMarginPointerDown}
                        title={`Margen superior: ${margins.top} ${unit} — arrastre para ajustar`}
                    >
                        <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[7px] border-l-blue-500 dark:border-l-blue-400 ml-0.5 transition-transform group-hover:scale-125" />
                        <div className="h-px w-full bg-blue-500/40 dark:bg-blue-400/40 group-hover:bg-blue-600" />
                        {isDraggingTopMargin && (
                            <div className="absolute left-full w-[80vw] h-px bg-blue-500/40 border-t border-dashed border-blue-400/50 pointer-events-none z-50" />
                        )}
                    </div>
                )}

                {/* Marcador de espaciado superior (arrastrable) */}
                <div
                    className="absolute left-0 right-0 z-20 cursor-grab active:cursor-grabbing group flex flex-row items-center justify-start"
                    style={{ top: `${markerTopPx}px`, height: '32px', transform: 'translateY(-50%)' }}
                    onPointerDown={handlePointerDown}
                    title="Arrastre para cambiar el espaciado superior del párrafo"
                >
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-blue-600 dark:border-l-blue-400 ml-0.5 group-hover:scale-125 transition-transform" />
                    <div className="h-px w-full bg-blue-500/30 group-hover:bg-blue-600 transition-colors" />
                    {isDragging && (
                        <div className="absolute left-full w-[80vw] h-px bg-blue-500/40 border-t border-dashed border-blue-400/50 pointer-events-none z-50" />
                    )}
                </div>

                {/* Marcador de margen inferior.
                    Arrastrable cuando hay márgenes reales y no está espejado.
                    Gris + sin cursor cuando está espejado. */}
                {margins && (
                    <div
                        className="absolute left-0 right-0 z-20 flex flex-row items-center justify-start group cursor-ns-resize hover:bg-gray-50/10"
                        style={{ top: `${bottomMarkerTopPx}px`, height: '12px', transform: 'translateY(-50%)' }}
                        onPointerDown={handleBottomPointerDown}
                        title={`Margen inferior: ${margins.bottom} ${unit} — arrastre para ajustar`}
                    >
                        <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[7px] ml-0.5 transition-transform border-l-blue-500 dark:border-l-blue-400 group-hover:scale-125" />
                        <div className="h-px w-full bg-blue-500/40 dark:bg-blue-400/40 group-hover:bg-blue-600" />
                        {isDraggingBottom && (
                            <div className="absolute left-full w-[80vw] h-px bg-blue-500/40 border-t border-dashed border-blue-400/50 pointer-events-none z-50" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentVerticalRuler;
