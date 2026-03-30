export const INTERFACE_SCALE_DEFAULT = 100;
export const INTERFACE_SCALE_MIN = 50;
export const INTERFACE_SCALE_MAX = 200;
export const INTERFACE_SCALE_STEP = 10;

/**
 * Normaliza la escala de interfaz a un entero válido dentro del rango permitido.
 */
export function normalizeInterfaceScale(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return INTERFACE_SCALE_DEFAULT;

    const rounded = Math.round(parsed);
    if (rounded < INTERFACE_SCALE_MIN) return INTERFACE_SCALE_MIN;
    if (rounded > INTERFACE_SCALE_MAX) return INTERFACE_SCALE_MAX;
    return rounded;
}

/**
 * Convierte el porcentaje persistido a un zoom factor compatible con Electron.
 */
export function interfaceScaleToZoomFactor(value) {
    return normalizeInterfaceScale(value) / 100;
}

/**
 * Desplaza la escala actual usando el paso estándar de la UI.
 */
export function shiftInterfaceScale(value, delta) {
    return normalizeInterfaceScale(normalizeInterfaceScale(value) + delta);
}
