import { describe, expect, it } from 'vitest';
import {
    buildRequisitosByType,
    getRequirementSections,
} from '../../src/components/templates/requirementsSearchUtils.js';

describe('requirementsSearchUtils', () => {
    const requisitos = [
        { id: 1, type: 'clientName' },
        { id: 2, type: 'caseTitle' },
        { id: 3, type: 'eventName' },
    ];

    it('indexa requisitos por type', () => {
        const map = buildRequisitosByType(requisitos);

        expect(map.get('clientName')).toEqual({ id: 1, type: 'clientName' });
        expect(map.get('missing')).toBeUndefined();
    });

    it('agrupa y filtra respetando el orden definido por categorías', () => {
        const sections = getRequirementSections(requisitos, 'car');

        expect(sections).toHaveLength(1);
        expect(sections[0].key).toBe('caso');
        expect(sections[0].items).toEqual([{ id: 2, type: 'caseTitle' }]);
    });
});
