/**
 * TemplatePlaceholderView.jsx — React NodeView para los campos de plantilla.
 *
 * Renderiza un nodo TemplatePlaceholder como una burbuja/chip inline.
 *
 * Hover (ambos modos): muestra un panel flotante con ← N → para cambiar NEntidad y X para
 * eliminar el nodo (modo edición) o desasignar el requisito (modo vista).
 * Click en burbuja vacía + requisito activo en panel → asigna (modo vista y edición).
 * Drag & drop desde RequirementsPanel → asigna el requisito al campo.
 *
 * Navegación por teclado (modo vista):
 * - Después de asignar un requisito, el chip recibe foco automáticamente.
 * - ←/→ navegan al chip anterior/siguiente en orden de documento.
 * - ↑/↓ navegan al chip más cercano en la línea superior/inferior.
 * - Enter (en chip vacío): activa el input de búsqueda del popover.
 * - Escape (en input de búsqueda): devuelve el foco al chip.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { X, ChevronLeft, ChevronRight, Bold, Italic, Strikethrough, Link2, Link2Off, StickyNote, Search } from 'lucide-react';
import { useRequisitos } from '../../../context/RequisitosContext.jsx';
import { getRequisitoLabel } from '../../../constants/requisitoLabels.js';
import { getRequirementSections } from '../../templates/requirementsSearchUtils.js';

// ─── Paleta de colores por NEntidad ──────────────────────────────────────────
// 5 colores distintos; NEntidad ≥ 6 usa el fallback slate.
const NENTIDAD_COLORS = {
    1: { filled: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700' },
    2: { filled: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700' },
    3: { filled: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700' },
    4: { filled: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700' },
    5: { filled: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700' },
};
const NENTIDAD_FALLBACK = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-600';

function getFilledClasses(NEntidad) {
    return NENTIDAD_COLORS[NEntidad]?.filled ?? NENTIDAD_FALLBACK;
}

// ─── Estilos de botones — misma estética que el BubbleMenu del editor ─────────
const BTN = 'p-1.5 rounded-lg transition-colors focus:outline-none text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100';
const BTN_DISABLED = 'p-1.5 rounded-lg opacity-30 cursor-not-allowed text-gray-400 dark:text-gray-600';
const BTN_RED = 'p-1.5 rounded-lg transition-colors focus:outline-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40';

const TemplatePlaceholderView = ({ node, updateAttributes, deleteNode, editor, getPos }) => {
    const { fieldId, requisitoId, requisitoTitle, NEntidad = 1, note } = node.attrs;
    const [isDragOver, setIsDragOver] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    // true mientras este chip es el "activo" por navegación de teclado (no mouse)
    const [isFocusedByKeyboard, setIsFocusedByKeyboard] = useState(false);
    // true mientras el input de búsqueda dentro del popover tiene el foco
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [noteValue, setNoteValue] = useState(note ?? '');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSearchIndex, setActiveSearchIndex] = useState(0);
    const { requisitos = [] } = useRequisitos();
    const chipRef = useRef(null);
    const searchInputRef = useRef(null);
    const resultRefs = useRef([]);

    // El chip muestra su panel cuando está hovered, tiene foco de teclado,
    // o el input de búsqueda está activo. Esto evita que el panel se cierre
    // cuando el foco pasa del chip al input de búsqueda.
    const isActive = isHovered || isFocusedByKeyboard || isSearchFocused;

    /** Estilos dinámicos basados en marcas del nodo (bold, italic, color, etc.). */
    const getDynamicStyles = () => {
        const styles = {};
        if (!node.marks) return styles;
        node.marks.forEach((mark) => {
            if (mark.type.name === 'bold') styles.fontWeight = 'bold';
            if (mark.type.name === 'italic') styles.fontStyle = 'italic';
            if (mark.type.name === 'underline') styles.textDecoration = styles.textDecoration ? `${styles.textDecoration} underline` : 'underline';
            if (mark.type.name === 'strike') styles.textDecoration = styles.textDecoration ? `${styles.textDecoration} line-through` : 'line-through';
            if (mark.type.name === 'textStyle') {
                if (mark.attrs.color) styles.color = mark.attrs.color;
                if (mark.attrs.fontFamily) styles.fontFamily = mark.attrs.fontFamily;
                if (mark.attrs.fontSize) styles.fontSize = mark.attrs.fontSize;
            }
        });
        return styles;
    };

    const dynamicStyles = getDynamicStyles();
    const hasBold = dynamicStyles.fontWeight === 'bold';
    const isEditable = editor.isEditable;
    const isFilled = Boolean(requisitoId);
    const canDecrease = (NEntidad ?? 1) > 1;
    const requirementSections = useMemo(
        () => getRequirementSections(requisitos, searchTerm),
        [requisitos, searchTerm]
    );
    const visibleRequirements = useMemo(
        () => requirementSections.flatMap((section) => section.items),
        [requirementSections]
    );
    const activeRequirement = visibleRequirements[activeSearchIndex] ?? null;

    // Auto-foco al input de búsqueda solo en hover de mouse.
    // Cuando el chip llega por teclado (isFocusedByKeyboard), el input NO roba el foco
    // para que las flechas sigan controlando la navegación entre chips.
    useEffect(() => {
        if (!isHovered || isFilled || isFocusedByKeyboard) return undefined;

        const frameId = requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });

        return () => cancelAnimationFrame(frameId);
    }, [isHovered, isFilled, isFocusedByKeyboard]);

    useEffect(() => {
        const activeNode = resultRefs.current[activeSearchIndex];
        activeNode?.scrollIntoView({ block: 'nearest' });
    }, [activeSearchIndex]);

    // ─── Detección de marcas activas ──────────────────────────────────────────
    const hasItalic = node.marks?.some((m) => m.type.name === 'italic') ?? false;
    const hasStrike = node.marks?.some((m) => m.type.name === 'strike') ?? false;
    const hasLink   = node.marks?.some((m) => m.type.name === 'link')   ?? false;

    /**
     * Aplica o quita una marca directamente sobre el rango del nodo (pos…pos+nodeSize).
     * Más fiable que pasar por selección TipTap porque el foco no interfiere.
     */
    const toggleMarkAt = (markName) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        const { tr, schema } = editor.state;
        const markType = schema.marks[markName];
        if (!markType) return;
        const active = node.marks?.some((m) => m.type.name === markName);
        editor.view.dispatch(
            active
                ? tr.removeMark(pos, pos + node.nodeSize, markType)
                : tr.addMark(pos, pos + node.nodeSize, markType.create()),
        );
    };

    /** Gestiona el enlace: pide URL, aplica o quita la marca link. */
    const handleLink = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        const { tr, schema } = editor.state;
        const markType = schema.marks.link;
        if (!markType) return;
        const existing = node.marks?.find((m) => m.type.name === 'link');
        const url = window.prompt('URL del enlace:', existing?.attrs?.href || '');
        if (url === null) return;
        if (url === '') {
            editor.view.dispatch(tr.removeMark(pos, pos + node.nodeSize, markType));
        } else {
            const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
            editor.view.dispatch(tr.addMark(pos, pos + node.nodeSize, markType.create({ href })));
        }
    };

    /** Acepta drops del RequirementsPanel y asigna el requisito. */
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        try {
            const data = JSON.parse(e.dataTransfer.getData('requisito'));
            if (data?.id) updateAttributes({ requisitoId: data.id, requisitoTitle: data.title });
        } catch { /* datos inválidos */ }
    };

    /**
     * X — eliminar o desasignar:
     *   - Edit: elimina el nodo del documento
     *   - Vista: borra el assignment (burbuja queda vacía)
     */
    const handleRemove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isEditable) deleteNode();
        else updateAttributes({ requisitoId: null, requisitoTitle: null });
    };

    /** Click en burbuja vacía: delega al RequirementsPanel para asignar el requisito activo. */
    const handleClick = (e) => {
        if (!isFilled) {
            const customEvent = new CustomEvent('template-placeholder-click', {
                bubbles: true,
                detail: { fieldId, updateAttributes },
            });
            e.currentTarget.dispatchEvent(customEvent);
        }
    };

    const handleNEntidadDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (canDecrease) updateAttributes({ NEntidad: NEntidad - 1 });
    };

    const handleNEntidadUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateAttributes({ NEntidad: (NEntidad ?? 1) + 1 });
    };

    /**
     * Navega al chip más cercano en la dirección indicada (left/right/up/down).
     * - left/right: orden DOM (anterior / siguiente placeholder en el documento).
     * - up/down: busca el chip con menor "score" combinando distancia vertical y horizontal;
     *   así el salto sube/baja de línea priorizando la proximidad horizontal.
     */
    const navigateToPlaceholder = useCallback((direction) => {
        const allChips = Array.from(document.querySelectorAll('[data-field-id]'));
        const current = chipRef.current;
        if (!current || allChips.length === 0) return;

        const currentIdx = allChips.indexOf(current);
        if (currentIdx === -1) return;

        if (direction === 'left' || direction === 'right') {
            const targetIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
            if (targetIdx >= 0 && targetIdx < allChips.length) {
                allChips[targetIdx].focus();
            }
            return;
        }

        // Navegación vertical: buscar el chip en la línea más cercana arriba/abajo
        const currentRect = current.getBoundingClientRect();
        const currentCenterX = currentRect.left + currentRect.width / 2;
        const currentCenterY = currentRect.top + currentRect.height / 2;
        const lineThreshold = currentRect.height * 0.5;

        let bestChip = null;
        let bestScore = Infinity;

        allChips.forEach((chip) => {
            if (chip === current) return;
            const rect = chip.getBoundingClientRect();
            const chipCenterY = rect.top + rect.height / 2;

            // Filtrar chips que no estén en la dirección correcta
            if (direction === 'up' && chipCenterY >= currentCenterY - lineThreshold) return;
            if (direction === 'down' && chipCenterY <= currentCenterY + lineThreshold) return;

            // Score: prioriza cercanía vertical, luego horizontal
            const vertDist = Math.abs(chipCenterY - currentCenterY);
            const horizDist = Math.abs(rect.left + rect.width / 2 - currentCenterX);
            const score = vertDist + horizDist * 0.3;

            if (score < bestScore) {
                bestScore = score;
                bestChip = chip;
            }
        });

        bestChip?.focus();
    }, []);

    /**
     * Maneja las teclas cuando el chip tiene el foco (modo vista, !isEditable).
     * Flechas: navegan entre chips. Enter (vacío): enfoca el input de búsqueda. Escape: quita foco.
     * stopPropagation evita que TipTap o el navegador capturen las flechas.
     */
    const handleChipKeyDown = useCallback((e) => {
        if (isEditable) return; // Solo en modo vista

        const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'];
        if (!navKeys.includes(e.key)) return;

        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
            chipRef.current?.blur();
            return;
        }

        if (e.key === 'Enter' && !isFilled) {
            // Activar el input de búsqueda para asignar el requisito
            searchInputRef.current?.focus();
            return;
        }

        const dir = e.key.replace('Arrow', '').toLowerCase();
        navigateToPlaceholder(dir);
    }, [isEditable, isFilled, navigateToPlaceholder]);

    const handleHoverStart = () => {
        setIsHovered(true);
        resultRefs.current = [];
        setActiveSearchIndex(0);
    };

    const handleHoverEnd = () => {
        setIsHovered(false);
        setSearchTerm('');
        setActiveSearchIndex(0);
    };

    const assignRequirement = (requisito) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateAttributes({
            requisitoId: requisito.id,
            requisitoTitle: getRequisitoLabel(requisito.type),
        });
        setSearchTerm('');
        setActiveSearchIndex(0);
        setIsHovered(false);
        setIsSearchFocused(false);
        // Después de asignar, mantener el foco en el chip para navegación por teclado
        if (!isEditable) {
            requestAnimationFrame(() => {
                setIsFocusedByKeyboard(true);
                chipRef.current?.focus();
            });
        }
    };

    const handleSearchKeyDown = (e) => {
        // Escape desde el input devuelve el foco al chip (sin asignar)
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setIsSearchFocused(false);
            requestAnimationFrame(() => {
                setIsFocusedByKeyboard(true);
                chipRef.current?.focus();
            });
            return;
        }

        if (e.key === 'ArrowDown') {
            if (visibleRequirements.length === 0) return;
            e.preventDefault();
            e.stopPropagation();
            setActiveSearchIndex((current) => (
                current >= visibleRequirements.length - 1 ? 0 : current + 1
            ));
            return;
        }

        if (e.key === 'ArrowUp') {
            if (visibleRequirements.length === 0) return;
            e.preventDefault();
            e.stopPropagation();
            setActiveSearchIndex((current) => (
                current <= 0 ? visibleRequirements.length - 1 : current - 1
            ));
            return;
        }

        if (e.key !== 'Enter' || !activeRequirement) return;

        e.preventDefault();
        e.stopPropagation();
        updateAttributes({
            requisitoId: activeRequirement.id,
            requisitoTitle: getRequisitoLabel(activeRequirement.type),
        });
        setSearchTerm('');
        setActiveSearchIndex(0);
        setIsHovered(false);
        setIsSearchFocused(false);
        // Después de asignar con Enter, mantener el foco en el chip
        if (!isEditable) {
            requestAnimationFrame(() => {
                setIsFocusedByKeyboard(true);
                chipRef.current?.focus();
            });
        }
    };

    // ─── Chip styles ──────────────────────────────────────────────────────────
    const baseClasses = `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs align-middle select-none transition-all mx-0.5 ${hasBold ? 'font-bold' : 'font-medium'}`;
    const emptyClasses = 'bg-amber-50 text-amber-600 border border-dashed border-amber-400/60 dark:bg-amber-950/30 dark:text-amber-500 dark:border-amber-700';
    const dragOverClasses = 'ring-2 ring-blue-500 ring-offset-1 bg-blue-100 dark:bg-blue-900/60';
    // Ring visible cuando el chip tiene foco de teclado (sin hover de mouse)
    const keyboardFocusClasses = isFocusedByKeyboard && !isHovered
        ? 'ring-2 ring-blue-500 ring-offset-1'
        : '';

    const chipClasses = [
        baseClasses,
        isFilled ? `${getFilledClasses(NEntidad)} border` : emptyClasses,
        isDragOver ? dragOverClasses : keyboardFocusClasses,
    ].join(' ');

    const chipLabel = isFilled ? `${requisitoTitle} ${NEntidad ?? 1}` : `Campo #${fieldId}`;

    // ─── Panel flotante ────────────────────────────────────────────────────────
    // position:absolute saca los controles del flujo inline — el chip no cambia de ancho.
    // paddingBottom crea un puente invisible entre el chip y el panel para que onMouseLeave
    // no dispare al mover el cursor hacia los botones.
    const floatingStyle = {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        paddingBottom: '4px',
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
        zIndex: 50,
    };

    const searchPopoverStyle = {
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        paddingTop: '6px',
        pointerEvents: 'auto',
        zIndex: 50,
    };

    return (
        <NodeViewWrapper as="span" style={{ display: 'inline' }}>
            <span
                ref={chipRef}
                className={chipClasses}
                style={{ ...dynamicStyles, position: 'relative' }}
                // En modo vista, el chip es focusable para navegación por teclado.
                // tabIndex=-1 en edición para no interferir con el flujo normal de TipTap.
                tabIndex={!isEditable ? 0 : -1}
                onMouseEnter={handleHoverStart}
                onMouseLeave={handleHoverEnd}
                onFocus={() => { if (!isEditable) setIsFocusedByKeyboard(true); }}
                onBlur={(e) => {
                    // Mantener estado activo si el foco pasó al input de búsqueda o botones del panel
                    const relatedTarget = e.relatedTarget;
                    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
                    setIsFocusedByKeyboard(false);
                }}
                onKeyDown={handleChipKeyDown}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={handleClick}
                data-field-id={fieldId}
                title={isFilled
                    ? `Campo #${fieldId}: ${requisitoTitle} (entidad ${NEntidad ?? 1})`
                    : `Campo #${fieldId} — sin asignar`}
                contentEditable={false}
            >
                <span className="pointer-events-none">{chipLabel}</span>

                {/* Panel unificado: hover de mouse O foco de teclado, misma estética que BubbleMenu */}
                {(isActive || isNoteOpen) && (
                    <>
                    <span contentEditable={false} style={floatingStyle}>
                        {/* Panel de nota: aparece encima del panel de controles cuando isNoteOpen */}
                        {isNoteOpen && (
                            <span
                                style={{ display: 'block', marginBottom: '4px' }}
                            >
                                <span className="flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 gap-1.5" style={{ minWidth: '220px' }}>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide select-none px-1">
                                        Nota del campo
                                    </span>
                                    <textarea
                                        className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                                        rows={3}
                                        placeholder="Escribí una nota para orientar al usuario..."
                                        value={noteValue}
                                        onChange={(e) => setNoteValue(e.target.value)}
                                        onBlur={() => updateAttributes({ note: noteValue.trim() || null })}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                    />
                                </span>
                            </span>
                        )}

                        <span className="flex items-center bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1 gap-0.5">

                            {/* Formato: Negrita */}
                            <button
                                type="button"
                                className={`p-1.5 rounded-lg transition-colors focus:outline-none ${hasBold ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}
                                onClick={toggleMarkAt('bold')}
                                title="Negrita"
                            >
                                <Bold size={14} />
                            </button>

                            {/* Formato: Cursiva */}
                            <button
                                type="button"
                                className={`p-1.5 rounded-lg transition-colors focus:outline-none ${hasItalic ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}
                                onClick={toggleMarkAt('italic')}
                                title="Cursiva"
                            >
                                <Italic size={14} />
                            </button>

                            {/* Formato: Tachado */}
                            <button
                                type="button"
                                className={`p-1.5 rounded-lg transition-colors focus:outline-none ${hasStrike ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}
                                onClick={toggleMarkAt('strike')}
                                title="Tachado"
                            >
                                <Strikethrough size={14} />
                            </button>

                            {/* Formato: Enlace */}
                            <button
                                type="button"
                                className={`p-1.5 rounded-lg transition-colors focus:outline-none ${hasLink ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}
                                onClick={handleLink}
                                title={hasLink ? 'Editar enlace' : 'Insertar enlace'}
                            >
                                <Link2 size={14} />
                            </button>
                            {hasLink && (
                                <button
                                    type="button"
                                    className="p-1.5 rounded-lg transition-colors focus:outline-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40"
                                    onClick={toggleMarkAt('link')}
                                    title="Quitar enlace"
                                >
                                    <Link2Off size={14} />
                                </button>
                            )}

                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 self-center mx-0.5" />

                            {/* Nota del campo */}
                            <button
                                type="button"
                                className={`p-1.5 rounded-lg transition-colors focus:outline-none ${
                                    isNoteOpen
                                        ? 'bg-amber-500 text-white shadow-md'
                                        : note
                                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsNoteOpen((o) => !o); }}
                                title="Sumar nota"
                            >
                                <StickyNote size={14} />
                            </button>

                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 self-center mx-0.5" />

                            {/* ← NEntidad anterior */}
                            <button
                                type="button"
                                className={canDecrease ? BTN : BTN_DISABLED}
                                onClick={handleNEntidadDown}
                                disabled={!canDecrease}
                                title="Entidad anterior"
                            >
                                <ChevronLeft size={14} />
                            </button>

                            {/* Indicador numérico */}
                            <span className="px-1 min-w-[1.25rem] text-center text-xs font-semibold text-gray-500 dark:text-gray-400 select-none">
                                {NEntidad ?? 1}
                            </span>

                            {/* → NEntidad siguiente */}
                            <button
                                type="button"
                                className={BTN}
                                onClick={handleNEntidadUp}
                                title="Siguiente entidad"
                            >
                                <ChevronRight size={14} />
                            </button>

                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 self-center mx-0.5" />

                            {/* X — eliminar nodo (edición) o desasignar requisito (vista) */}
                            <button
                                type="button"
                                className={BTN_RED}
                                onClick={handleRemove}
                                title={isEditable ? 'Eliminar campo' : 'Quitar requisito asignado'}
                            >
                                <X size={14} />
                            </button>
                        </span>
                    </span>
                    {!isFilled && (
                        <span contentEditable={false} style={searchPopoverStyle}>
                            <span
                                className="flex w-[20rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <span className="border-b border-gray-100 p-2 dark:border-gray-700">
                                    <span className="relative block">
                                        <Search
                                            size={14}
                                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                                        />
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => {
                                                resultRefs.current = [];
                                                setSearchTerm(e.target.value);
                                                setActiveSearchIndex(0);
                                            }}
                                            onFocus={() => setIsSearchFocused(true)}
                                            onBlur={() => setIsSearchFocused(false)}
                                            onKeyDown={handleSearchKeyDown}
                                            placeholder="Buscar requisito..."
                                            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                                        />
                                    </span>
                                </span>

                                <span className="max-h-[11.5rem] overflow-y-auto py-1">
                                    {requirementSections.length === 0 ? (
                                        <span className="block px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                                            No se encontraron requisitos.
                                        </span>
                                    ) : (
                                        requirementSections.map((section) => (
                                            <span key={section.key} className="mb-1 block">
                                                <span className="flex items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                    <span>{section.label}</span>
                                                    <span className="ml-auto text-[10px]">{section.items.length}</span>
                                                </span>
                                                <span className="block px-1">
                                                    {section.items.map((requisito) => (
                                                        <button
                                                            key={requisito.id}
                                                            ref={(node) => {
                                                                const globalIndex = visibleRequirements.findIndex((item) => item.id === requisito.id);
                                                                if (globalIndex >= 0) resultRefs.current[globalIndex] = node;
                                                            }}
                                                            type="button"
                                                            onClick={assignRequirement(requisito)}
                                                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                                                                activeRequirement?.id === requisito.id
                                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                                            }`}
                                                            title={`Tipo: ${requisito.type}`}
                                                        >
                                                            <span className="min-w-0 flex-1 truncate">
                                                                {getRequisitoLabel(requisito.type)}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </span>
                                            </span>
                                        ))
                                    )}
                                </span>
                            </span>
                        </span>
                    )}
                    </>
                )}
            </span>
        </NodeViewWrapper>
    );
};

export default TemplatePlaceholderView;
