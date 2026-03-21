import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getColorResolutionReasonCount,
    logColorResolutionFallback,
    resetColorResolutionDiagnostics,
} from '../../src/utils/agendaColor/colorResolutionDiagnostics.js';

describe('agendaColorDiagnostics', () => {
    beforeEach(() => {
        resetColorResolutionDiagnostics();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('registra warnings y acumula contador por reason', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const firstPayload = {
            eventId: 50,
            mode: 'caseType',
            reason: 'case_not_found',
        };
        const secondPayload = {
            eventId: 51,
            mode: 'caseType',
            reason: 'case_not_found',
        };

        logColorResolutionFallback(firstPayload);
        logColorResolutionFallback(secondPayload);

        expect(warnSpy).toHaveBeenCalledTimes(2);
        expect(getColorResolutionReasonCount('case_not_found')).toBe(2);
    });
});
