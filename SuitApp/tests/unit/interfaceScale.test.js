import { describe, expect, it } from 'vitest';
import {
    INTERFACE_SCALE_DEFAULT,
    INTERFACE_SCALE_MAX,
    INTERFACE_SCALE_MIN,
    INTERFACE_SCALE_STEP,
    interfaceScaleToZoomFactor,
    normalizeInterfaceScale,
    shiftInterfaceScale,
} from '../../src/utils/interfaceScale.js';

describe('interfaceScale utils', () => {
    it('normaliza valores inválidos al default', () => {
        expect(normalizeInterfaceScale(undefined)).toBe(INTERFACE_SCALE_DEFAULT);
        expect(normalizeInterfaceScale('abc')).toBe(INTERFACE_SCALE_DEFAULT);
    });

    it('respeta los límites mínimo y máximo', () => {
        expect(normalizeInterfaceScale(INTERFACE_SCALE_MIN - 25)).toBe(INTERFACE_SCALE_MIN);
        expect(normalizeInterfaceScale(INTERFACE_SCALE_MAX + 25)).toBe(INTERFACE_SCALE_MAX);
    });

    it('convierte el porcentaje a zoomFactor de Electron', () => {
        expect(interfaceScaleToZoomFactor(100)).toBe(1);
        expect(interfaceScaleToZoomFactor(125)).toBe(1.25);
    });

    it('mueve la escala usando el paso configurado', () => {
        expect(shiftInterfaceScale(100, INTERFACE_SCALE_STEP)).toBe(110);
        expect(shiftInterfaceScale(100, -INTERFACE_SCALE_STEP)).toBe(90);
    });
});
