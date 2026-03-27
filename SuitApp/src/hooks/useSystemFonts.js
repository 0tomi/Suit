import { useState, useEffect } from 'react';

// Fuentes de fallback en caso de que la enumeración del SO falle o retorne vacío.
const FALLBACK_FONTS = [
    'Arial',
    'Courier New',
    'Georgia',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
];

/**
 * Carga las fuentes instaladas en el sistema operativo vía IPC.
 * El proceso main resuelve el listado de forma cross-platform.
 * Retorna { fonts: string[], loading: boolean }.
 * Se cachea en memoria para no repetir la llamada IPC en cada montaje del toolbar.
 */
let cachedFonts = null;

export function useSystemFonts() {
    const [fonts, setFonts] = useState(cachedFonts ?? []);
    const [loading, setLoading] = useState(cachedFonts === null);

    useEffect(() => {
        if (cachedFonts !== null) return;

        window.electronAPI?.system?.getFonts()
            .then((result) => {
                const resolved = result?.length ? result : FALLBACK_FONTS;
                cachedFonts = resolved;
                setFonts(resolved);
            })
            .catch(() => {
                cachedFonts = FALLBACK_FONTS;
                setFonts(FALLBACK_FONTS);
            })
            .finally(() => setLoading(false));
    }, []);

    return { fonts, loading };
}
