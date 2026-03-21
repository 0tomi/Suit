import { describe, expect, it } from 'vitest';

import { getCaseStatusLabel, isCaseClosed } from '../../src/utils/caseStatus.js';

describe('caseStatus', () => {
    it('traduce active a Activo', () => {
        expect(getCaseStatusLabel({ status: 'active' })).toBe('Activo');
    });

    it('marca como Finalizado cuando el caso tiene fecha de cierre', () => {
        expect(getCaseStatusLabel({ status: 'active', end_date: '2026-03-13' })).toBe('Finalizado');
        expect(isCaseClosed({ end_date: '2026-03-13' })).toBe(true);
    });

    it('conserva estados desconocidos sin romper la UI', () => {
        expect(getCaseStatusLabel({ status: 'Pendiente' })).toBe('Pendiente');
        expect(isCaseClosed({ status: 'Pendiente' })).toBe(false);
    });
});
