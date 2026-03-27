import { describe, expect, it } from 'vitest';

import {
    getTemplateRequirementsDiagnostics,
    normalizeTemplateRequirements,
    pickBestTemplateRequirements,
} from '../../src/utils/templateRequirements.js';

describe('templateRequirements utils', () => {
    it('normaliza requisitos aunque la API use id_requisito y NEntidad', () => {
        const normalized = normalizeTemplateRequirements([
            {
                id: 5,
                id_campo: '3',
                id_requisito: 5,
                NEntidad: '3',
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
        ]);

        expect(normalized).toEqual([
            {
                id: 5,
                id_campo: 3,
                requisito_id: 5,
                NEntidad: 3,
                note: null,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
        ]);
    });

    it('prefiere la fuente con mas requisitos cuando el cache local quedo colapsado', () => {
        const cachedRequirements = [
            {
                id: 5,
                id_campo: 3,
                requisito_id: 5,
                NEntidad: 3,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
        ];

        const apiRequirements = [
            {
                id: 5,
                id_campo: 1,
                id_requisito: 5,
                NEntidad: 1,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
            {
                id: 5,
                id_campo: 2,
                id_requisito: 5,
                NEntidad: 2,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
            {
                id: 5,
                id_campo: 3,
                id_requisito: 5,
                NEntidad: 3,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
        ];

        expect(
            pickBestTemplateRequirements(cachedRequirements, apiRequirements)
        ).toEqual([
            {
                id: 5,
                id_campo: 1,
                requisito_id: 5,
                NEntidad: 1,
                note: null,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
            {
                id: 5,
                id_campo: 2,
                requisito_id: 5,
                NEntidad: 2,
                note: null,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
            {
                id: 5,
                id_campo: 3,
                requisito_id: 5,
                NEntidad: 3,
                note: null,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
        ]);
    });

    it('detecta requisitos nulos o incompletos en el payload', () => {
        const diagnostics = getTemplateRequirementsDiagnostics([
            null,
            {
                id_campo: 1,
                id_requisito: null,
                type: null,
                title: 'Nombre del Cliente',
            },
        ], 'Hola #1#');

        expect(diagnostics.receivedCount).toBe(2);
        expect(diagnostics.normalizedCount).toBe(1);
        expect(diagnostics.problematicRequirements).toEqual([
            {
                index: 0,
                issue: 'invalid-entry',
                raw: null,
            },
            {
                index: 1,
                issue: 'missing-fields',
                missingKeys: ['requisito_id', 'type'],
                requirement: {
                    id: null,
                    id_campo: 1,
                    requisito_id: null,
                    NEntidad: 1,
                    note: null,
                    type: null,
                    title: 'Nombre del Cliente',
                },
            },
        ]);
    });

    it('detecta placeholders del contenido sin requisito asociado', () => {
        const diagnostics = getTemplateRequirementsDiagnostics([
            {
                id: 5,
                id_campo: 1,
                id_requisito: 5,
                NEntidad: 1,
                type: 'clientCompleteName',
                title: 'Nombre Completo del Cliente',
            },
        ], 'Actor: #1# Demandado: #2#');

        expect(diagnostics.placeholderIds).toEqual([1, 2]);
        expect(diagnostics.missingFieldIds).toEqual([2]);
    });
});
