/**
 * MarginsModal.jsx — Modal de configuración de márgenes de página.
 *
 * Solo exporta el componente React (requerimiento de react-refresh/Fast Refresh).
 * Las constantes y funciones utilitarias viven en marginsUtils.js.
 */
import React from 'react';
import { X } from 'lucide-react';
import {
    UNIT_STEP, UNIT_LABELS, ARG_JUDICIAL_PRESET,
    convertMarginValue, marginsStorageKey,
    saveMarginPreference, loadMarginPreference,
    DEFAULT_MARGINS, normalizeMargins,
} from './marginsUtils.js';
import { PAGE_FORMATS } from './pageLayoutUtils.js';
import { INDENT_MAX_LEVEL, INDENT_MIN_LEVEL } from './extensions/Indent.js';

/**
 * Modal de configuración de márgenes con soporte de unidades (pt/mm/cm),
 * modo espejado (PJN judicial), y opción de recordar la configuración.
 */
const MarginsModal = ({ open, onClose, margins, onSave, userId, indentLevel = 0, onIndentChange }) => {
    const [localMargins, setLocalMargins] = React.useState(normalizeMargins(margins || DEFAULT_MARGINS));
    const [localIndentLevel, setLocalIndentLevel] = React.useState(indentLevel);
    // "Recordar" persiste los márgenes para el próximo documento
    const [remember, setRemember] = React.useState(false);

    React.useEffect(() => {
        if (open && margins) setLocalMargins(normalizeMargins(margins));
        if (open) setLocalIndentLevel(indentLevel);
        // Inicializar "Recordar" si ya hay una preferencia guardada
        if (open && userId) {
            setRemember(!!loadMarginPreference(userId));
        }
    }, [open, margins, userId, indentLevel]);

    if (!open) return null;

    const isMirrored = localMargins.mirrored;

    const handleInputChange = (field, value) => {
        setLocalMargins(prev => ({
            ...prev,
            [field]: value === '' ? '' : parseFloat(value)
        }));
    };

    const handleIndentChange = (value) => {
        const parsedValue = value === '' ? '' : Number.parseInt(value, 10);
        if (parsedValue === '') {
            setLocalIndentLevel('');
            return;
        }

        const clampedValue = Math.max(INDENT_MIN_LEVEL, Math.min(INDENT_MAX_LEVEL, Number.isNaN(parsedValue) ? INDENT_MIN_LEVEL : parsedValue));
        setLocalIndentLevel(clampedValue);
    };

    /** Convierte todos los valores al cambiar la unidad, preservando la medida física. */
    const handleUnitChange = (newUnit) => {
        setLocalMargins(prev => ({
            top:      convertMarginValue(prev.top,    prev.unit, newUnit),
            bottom:   convertMarginValue(prev.bottom, prev.unit, newUnit),
            left:     convertMarginValue(prev.left,   prev.unit, newUnit),
            right:    convertMarginValue(prev.right,  prev.unit, newUnit),
            unit:     newUnit,
            mirrored: prev.mirrored,
            pageFormat: prev.pageFormat,
        }));
    };

    /**
     * Activa/desactiva el modo espejado.
     * Al activarlo aplica automáticamente el preset PJN convertido a la unidad actual.
     */
    const handleToggleMirrored = () => {
        setLocalMargins(prev => {
            if (prev.mirrored) {
                return { ...prev, mirrored: false };
            }
            const unit = prev.unit;
            return {
                top:      convertMarginValue(ARG_JUDICIAL_PRESET.top,    ARG_JUDICIAL_PRESET.unit, unit),
                bottom:   convertMarginValue(ARG_JUDICIAL_PRESET.bottom,  ARG_JUDICIAL_PRESET.unit, unit),
                left:     convertMarginValue(ARG_JUDICIAL_PRESET.left,    ARG_JUDICIAL_PRESET.unit, unit),
                right:    convertMarginValue(ARG_JUDICIAL_PRESET.right,   ARG_JUDICIAL_PRESET.unit, unit),
                unit,
                mirrored: true,
                pageFormat: prev.pageFormat,
            };
        });
    };

    const handleSave = () => {
        if (remember && userId) {
            saveMarginPreference(userId, localMargins);
        } else if (!remember && userId) {
            try { localStorage.removeItem(marginsStorageKey(userId)); } catch { /* noop */ }
        }
        onSave(localMargins);
        if (typeof onIndentChange === 'function' && localIndentLevel !== '') {
            onIndentChange(localIndentLevel);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800 animate-in zoom-in-95 duration-200">
                <div className="mb-4 flex items-center justify-between border-b pb-4 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-(--text-primary)">Márgenes de página</h2>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-(--text-tertiary)" />
                    </button>
                </div>

                {/* Selector de unidad */}
                <div className="mb-4 flex items-center gap-3">
                    <span className="text-xs font-semibold text-(--text-tertiary) uppercase tracking-wider whitespace-nowrap">Unidad:</span>
                    <select
                        value={localMargins.unit}
                        onChange={(e) => handleUnitChange(e.target.value)}
                        className="flex-1 rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-1.5 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {Object.entries(UNIT_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                        ))}
                    </select>
                </div>

                <div className="mb-4 flex items-center gap-3">
                    <span className="text-xs font-semibold text-(--text-tertiary) uppercase tracking-wider whitespace-nowrap">Hoja:</span>
                    <select
                        value={localMargins.pageFormat}
                        onChange={(e) => setLocalMargins((prev) => ({ ...prev, pageFormat: e.target.value }))}
                        className="flex-1 rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-1.5 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {Object.entries(PAGE_FORMATS).map(([value, config]) => (
                            <option key={value} value={value}>{config.label}</option>
                        ))}
                    </select>
                </div>

                {/* Toggle margen espejado */}
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-(--border-default)">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-(--text-primary)">Margen espejado</span>
                            <span className="text-xs text-(--text-tertiary)">
                                {isMirrored ? 'Interior/Exterior — doble cara (PJN aplicado)' : 'Para impresión a doble cara'}
                            </span>
                        </div>
                        <button
                            onClick={handleToggleMirrored}
                            className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isMirrored ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <div className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isMirrored ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Campos de márgenes */}
                {isMirrored ? (
                    <div className="mb-4 space-y-3">
                        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                Márgenes horizontales
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { dir: 'left',  label: 'Interior', hint: 'encuadernación' },
                                    { dir: 'right', label: 'Exterior', hint: 'borde externo'  },
                                ].map(({ dir, label, hint }) => (
                                    <div key={dir} className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                            {label}
                                        </label>
                                        <span className="text-[10px] text-(--text-tertiary) -mt-0.5">{hint}</span>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min="0"
                                                step={UNIT_STEP[localMargins.unit]}
                                                value={localMargins[dir]}
                                                onChange={(e) => handleInputChange(dir, e.target.value)}
                                                className="flex-1 w-0 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                            <span className="text-xs font-medium text-(--text-tertiary) w-6 text-center shrink-0">
                                                {localMargins.unit}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl border border-(--border-default) bg-(--bg-card) p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--text-tertiary)">
                                Márgenes verticales
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { dir: 'top',    label: 'Superior' },
                                    { dir: 'bottom', label: 'Inferior' },
                                ].map(({ dir, label }) => (
                                    <div key={dir} className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-(--text-tertiary)">
                                            {label}
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min="0"
                                                step={UNIT_STEP[localMargins.unit]}
                                                value={localMargins[dir]}
                                                onChange={(e) => handleInputChange(dir, e.target.value)}
                                                className="flex-1 w-0 rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                            <span className="text-xs font-medium text-(--text-tertiary) w-6 text-center shrink-0">
                                                {localMargins.unit}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {['top', 'bottom', 'left', 'right'].map((dir) => (
                            <div key={dir} className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold uppercase tracking-wider text-(--text-tertiary)">
                                    {{ top: 'Superior', bottom: 'Inferior', left: 'Izquierdo', right: 'Derecho' }[dir]}
                                </label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        step={UNIT_STEP[localMargins.unit]}
                                        value={localMargins[dir]}
                                        onChange={(e) => handleInputChange(dir, e.target.value)}
                                        className="flex-1 w-0 rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                    <span className="text-xs font-medium text-(--text-tertiary) w-6 text-center shrink-0">
                                        {localMargins.unit}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mb-4 rounded-xl border border-(--border-default) bg-(--bg-card) p-3">
                    <div className="mb-2 flex flex-col">
                        <span className="text-xs font-semibold uppercase tracking-wider text-(--text-tertiary)">Sangría</span>
                        <span className="text-[10px] text-(--text-tertiary)">Ajusta la sangría del párrafo/selección actual.</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={INDENT_MIN_LEVEL}
                            max={INDENT_MAX_LEVEL}
                            step="1"
                            value={localIndentLevel}
                            onChange={(e) => handleIndentChange(e.target.value)}
                            className="w-24 rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                        <span className="text-xs font-medium text-(--text-tertiary)">niveles ({INDENT_MIN_LEVEL} a {INDENT_MAX_LEVEL})</span>
                    </div>
                </div>

                {/* Recordar configuración */}
                <label className="mb-5 flex cursor-pointer items-center gap-3 rounded-xl border border-(--border-default) px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors select-none">
                    <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-4 w-4 rounded border-(--border-default) accent-blue-600"
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-(--text-primary)">Recordar para próximos documentos</span>
                        <span className="text-xs text-(--text-tertiary)">Se usará como configuración predeterminada</span>
                    </div>
                </label>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-(--text-secondary) hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-(--border-default)"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MarginsModal;
