import { describe, expect, it } from 'vitest';
import {
    getCaseParticipantPermissionLabel,
    isCaseOwnerParticipant,
} from '../../src/utils/caseParticipantPermissionLabel.js';

describe('caseParticipantPermissionLabel', () => {
    it('detecta al dueño por owner_tag del caso', () => {
        const participant = {
            user_id: 8,
            permission_level: 'read',
            user: { id: 8, tag: 'owner-tag' },
        };
        const caseData = {
            id: 12,
            owner_tag: 'owner-tag',
        };

        expect(isCaseOwnerParticipant(participant, caseData)).toBe(true);
        expect(getCaseParticipantPermissionLabel(participant, caseData)).toBe('Dueño');
    });

    it('mantiene las etiquetas normales para participantes no dueños', () => {
        const participant = {
            user_id: 4,
            permission_level: 'write',
            user: { id: 4, tag: 'writer-user' },
        };
        const caseData = {
            id: 20,
            owner_tag: 'owner-user',
        };

        expect(isCaseOwnerParticipant(participant, caseData)).toBe(false);
        expect(getCaseParticipantPermissionLabel(participant, caseData)).toBe('Escritura');
    });
});
