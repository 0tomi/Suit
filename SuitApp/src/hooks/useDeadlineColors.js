import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { DEADLINE_COLOR_DEFAULTS, resolveDeadlineColorKey } from '../utils/deadlineColorDefaults';

/**
 * Hook que devuelve una función para obtener el estilo visual de cada vencimiento
 * según su estado y prioridad. Los colores base son personalizables desde Configuración.
 *
 * @returns {{ getDeadlineStyle: (deadline) => { backgroundColor: string|null, borderLeftColor: string|null } }}
 */
export function useDeadlineColors() {
    const { deadlineColors } = useSettings();

    // Merge de defaults + overrides del usuario
    const colors = useMemo(
        () => ({ ...DEADLINE_COLOR_DEFAULTS, ...deadlineColors }),
        [deadlineColors]
    );

    /**
     * Retorna el estilo inline para una fila de vencimiento.
     * Usa el color con opacidad del 15% como fondo para no opacar el texto.
     * Si el color es null (pendingNormal), no aplica fondo.
     */
    const getDeadlineStyle = useMemo(() => (deadline) => {
        const key = resolveDeadlineColorKey(deadline);
        const hex = colors[key];
        if (!hex) return {};

        // Convertir hex a rgba con opacidad baja para el fondo de la fila
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        return {
            backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
            borderLeft: `3px solid ${hex}`,
        };
    }, [colors]);

    return { getDeadlineStyle, colors };
}
