import { useEffect, useRef, useState } from 'react';

/**
 * Debounced autosave hook para el editor de documentos.
 *
 * Dispara `onSave` automáticamente después de `delayMs` milisegundos
 * de inactividad (sin cambios en `content`). Solo guarda cuando el
 * usuario tiene el lock activo (`isEditing`) y hay cambios pendientes
 * (`isDirty`). No guarda documentos nuevos sin ID.
 *
 * @param {Object} params
 * @param {boolean} params.isEditing   - El usuario tiene el lock de edición
 * @param {boolean} params.isDirty     - Hay cambios sin guardar
 * @param {boolean} params.hasId       - El documento ya existe (tiene ID)
 * @param {string}  params.content     - Contenido actual (cambia en cada keystroke)
 * @param {Function} params.onSave     - Función de guardado (async)
 * @param {number}  [params.delayMs]   - Tiempo de inactividad antes de guardar (default 30s)
 * @returns {{ lastAutoSavedAt: Date|null }}
 */
const useAutosave = ({ isEditing, isDirty, hasId, content, onSave, delayMs = 30_000 }) => {
    const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);
    // Ref estable para onSave: evita que el timer se cancele cada vez que el
    // componente padre re-renderiza con una nueva referencia de función.
    const onSaveRef = useRef(onSave);
    useEffect(() => { onSaveRef.current = onSave; });

    useEffect(() => {
        // Solo programar autoguardado si hay condiciones mínimas
        if (!isEditing || !isDirty || !hasId) return;

        const timer = setTimeout(async () => {
            await onSaveRef.current();
            setLastAutoSavedAt(new Date());
        }, delayMs);

        return () => clearTimeout(timer);
        // `content` como dependencia: el timer se reinicia en cada keystroke,
        // garantizando que el guardado ocurre tras 30s de inactividad real.
    }, [content, isEditing, isDirty, hasId, delayMs]);

    return { lastAutoSavedAt };
};

export default useAutosave;
