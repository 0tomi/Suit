/**
 * RequirementsPanel.jsx — Panel lateral de requisitos para el editor de plantillas.
 *
 * Muestra los requisitos del catálogo agrupados por categoría.
 * Los items son arrastrables (HTML5 drag-and-drop nativo) hacia las burbujas del editor.
 * También soporta "selección por clic": clic en un requisito lo activa, y un clic
 * subsecuente en una burbuja vacía del documento lo asigna.
 *
 * El nombre de cada requisito se obtiene del mapa de traducción `requisitoLabels.js`
 * en lugar del `title` de la BD (que puede estar en inglés o vacío).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, GripVertical, CheckCircle2, Search, X, Plus } from 'lucide-react';
import { useRequisitos } from '../../context/RequisitosContext.jsx';
import { getRequisitoLabel } from '../../constants/requisitoLabels.js';
import { countAssignedFields } from './templateEditorUtils.js';
import { getRequirementSections } from './requirementsSearchUtils.js';

const RequirementsPanel = ({ editor, isEditing = false, onInsertRequirement }) => {
    const { requisitos, initialized } = useRequisitos();
    // Requisito seleccionado por clic (alternativa al drag-and-drop)
    const [activeRequisito, setActiveRequisito] = useState(null);
    // Categorías colapsadas/expandidas
    const [collapsed, setCollapsed] = useState({});
    const [stats, setStats] = useState({ assigned: 0, total: 0 });
    const [searchTerm, setSearchTerm] = useState('');

    // Actualizar stats cuando cambia el contenido del editor
    useEffect(() => {
        if (!editor) return;

        const updateStats = () => setStats(countAssignedFields(editor));
        updateStats();

        editor.on('update', updateStats);
        return () => editor.off('update', updateStats);
    }, [editor]);

    // Escuchar clic en burbujas vacías del documento para asignar el requisito activo
    useEffect(() => {
        if (!editor) return;

        const handlePlaceholderClick = (e) => {
            if (!activeRequisito) return;

            const { updateAttributes } = e.detail;
            updateAttributes({
                requisitoId: activeRequisito.id,
                requisitoTitle: getRequisitoLabel(activeRequisito.type),
            });
            setActiveRequisito(null);
        };

        // El evento se dispara desde TemplatePlaceholderView y burbujea hasta el DOM
        document.addEventListener('template-placeholder-click', handlePlaceholderClick);
        return () => document.removeEventListener('template-placeholder-click', handlePlaceholderClick);
    }, [activeRequisito, editor]);

    // Construir mapa de requisitos por tipo para asignación rápida en el panel
    const requirementSections = useMemo(
        () => getRequirementSections(requisitos, searchTerm),
        [requisitos, searchTerm]
    );

    const toggleCategory = (key) => {
        setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDragStart = (e, requisito) => {
        const title = getRequisitoLabel(requisito.type);

        e.dataTransfer.setData(
            'requisito',
            JSON.stringify({ id: requisito.id, type: requisito.type, title })
        );
        e.dataTransfer.effectAllowed = 'copy';

        // Crear una burbuja temporal como imagen de arrastre.
        // Debe estar en el DOM cuando se llama setDragImage; se elimina en el siguiente frame.
        const ghost = document.createElement('span');
        ghost.textContent = title;
        ghost.style.cssText = [
            'position:fixed', 'top:-9999px', 'left:-9999px',
            'display:inline-flex', 'align-items:center',
            'padding:4px 10px',
            'border-radius:9999px',
            'background:#eff6ff',
            'border:1.5px solid #93c5fd',
            'color:#1d4ed8',
            'font-size:13px',
            'font-weight:500',
            'font-family:inherit',
            'white-space:nowrap',
            'pointer-events:none',
        ].join(';');
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
        requestAnimationFrame(() => ghost.remove());
    };

    const handleRequisiteClick = (requisito) => {
        // Toggle: si ya está activo lo deselecciona
        setActiveRequisito((prev) =>
            prev?.id === requisito.id ? null : requisito
        );
    };

    if (!initialized) {
        return (
            <aside className="flex h-full flex-col border-l border-(--border-default) bg-(--bg-card) w-[300px] min-w-[260px]">
                <div className="flex h-full items-center justify-center text-(--text-tertiary) text-sm">
                    Cargando requisitos...
                </div>
            </aside>
        );
    }

    return (
        <aside className="flex flex-col border-l border-(--border-default) bg-(--bg-card) w-full h-full min-h-0">
            {/* Header */}
            <div className="flex flex-col border-b border-(--border-subtle)">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div>
                        <h3 className="text-lg font-semibold text-(--text-primary)">Requisitos</h3>
                        <p className="text-base text-(--text-tertiary) mt-0.5">
                            Arrastrá o hacé clic para asignar
                        </p>
                    </div>
                    {stats.total > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-base font-medium ${
                            stats.assigned === stats.total
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                            {stats.assigned}/{stats.total}
                        </span>
                    )}
                </div>

                {/* Buscador y Botón de insertar */}
                <div className="px-4 pb-3 flex flex-col gap-2">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                            <Search size={14} className="text-(--text-tertiary) group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar requisito..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-(--bg-input) border border-(--border-default) focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg py-2 pl-8 pr-8 text-base text-(--text-primary) placeholder-(--text-tertiary) outline-none transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {isEditing && (
                        <button
                            onClick={onInsertRequirement}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-700/50 px-3 py-2 text-base font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                            <Plus size={16} />
                            Insertar requisito
                        </button>
                    )}
                </div>
            </div>

            {/* Indicador de requisito activo (seleccionado por clic) */}
            {activeRequisito && (
                <div className="mx-3 mt-2 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-700 px-3 py-2 text-base">
                    <p className="text-blue-700 dark:text-blue-300 font-medium">
                        Hacé clic en un campo vacío para asignar:
                    </p>
                    <p className="text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                        {getRequisitoLabel(activeRequisito.type)}
                    </p>
                    <button
                        type="button"
                        onClick={() => setActiveRequisito(null)}
                        className="mt-1 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 underline"
                    >
                        Cancelar
                    </button>
                </div>
            )}

            {/* Lista de requisitos por categoría */}
            <div className="flex-1 overflow-y-auto py-2">
                {requirementSections.map((category) => {
                    const items = category.items;
                    // Si hay búsqueda activa, expandir automáticamente
                    const isCollapsed = !searchTerm.trim() && collapsed[category.key];

                    return (
                        <div key={category.key} className="mb-1">
                            {/* Cabecera de categoría */}
                            <button
                                type="button"
                                onClick={() => toggleCategory(category.key)}
                                className="flex w-full items-center gap-1.5 px-4 py-1.5 text-left hover:bg-(--bg-card-hover) transition-colors"
                            >
                                {isCollapsed
                                    ? <ChevronRight size={13} className="text-(--text-tertiary) shrink-0" />
                                    : <ChevronDown size={13} className="text-(--text-tertiary) shrink-0" />
                                }
                                <span className="text-sm font-semibold uppercase tracking-wider text-(--text-secondary)">
                                    {category.label}
                                </span>
                                <span className="ml-auto text-[12px] text-(--text-tertiary)">
                                    {items.length}
                                </span>
                            </button>

                            {/* Items de la categoría */}
                            {!isCollapsed && (
                                <ul className="px-2 pb-1">
                                    {items.map((requisito) => {
                                        const label = getRequisitoLabel(requisito.type);
                                        const isActive = activeRequisito?.id === requisito.id;

                                        return (
                                            <li key={requisito.id}>
                                                <div
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, requisito)}
                                                    onClick={() => handleRequisiteClick(requisito)}
                                                    className={`group flex cursor-grab items-center gap-2 rounded-lg px-2 py-2 text-base transition-colors active:cursor-grabbing ${
                                                        isActive
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-400'
                                                            : 'text-(--text-primary) hover:bg-(--bg-input)'
                                                    }`}
                                                    title={`Tipo: ${requisito.type}`}
                                                >
                                                    <GripVertical
                                                        size={14}
                                                        className="shrink-0 text-(--text-tertiary) group-hover:text-(--text-secondary)"
                                                    />
                                                    <span className="flex-1 truncate">{label}</span>
                                                    {isActive && (
                                                        <CheckCircle2 size={14} className="shrink-0 text-blue-500" />
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer con resumen */}
            {stats.total > 0 && (
                <div className="border-t border-(--border-subtle) px-4 py-3">
                    <p className="text-base text-(--text-secondary)">
                        {stats.assigned === stats.total
                            ? `Todos los campos asignados (${stats.total})`
                            : `${stats.total - stats.assigned} campo${stats.total - stats.assigned !== 1 ? 's' : ''} sin asignar`
                        }
                    </p>
                </div>
            )}
        </aside>
    );
};

export default RequirementsPanel;
