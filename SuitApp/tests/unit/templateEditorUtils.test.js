import { describe, expect, it } from 'vitest';

import {
    getRequirementNotesForEntity,
} from '../../src/components/Editor/UseTemplateModal.jsx';
import {
    buildEnhancedPreviewHtml,
    buildPreviewHtml,
} from '../../src/components/templates/templateEditorUtils.js';

describe('templateEditorUtils preview helpers', () => {
    it('genera burbujas de preview con corte inline coherente', () => {
        const html = buildPreviewHtml('<p>Actor: #1#</p>');

        expect(html).toContain('display:inline');
        expect(html).toContain('box-decoration-break:clone');
        expect(html).not.toContain('display:inline-flex');
    });

    it('usa el mismo estilo inline en la preview inteligente del modal', () => {
        const html = buildEnhancedPreviewHtml(
            '<p>Actor: #1#</p>',
            [{ id_campo: 1, type: 'clientAddress', title: 'Domicilio', NEntidad: 1 }],
            { 1: '302 Senger Parkways Suite 706 Ricetown, PA 59247-2409' },
            null
        );

        expect(html).toContain('display:inline');
        expect(html).toContain('box-decoration-break:clone');
        expect(html).toContain('302 Senger Parkways Suite 706 Ricetown, PA 59247-2409');
    });

    it('permite personalizar el label vacio por id_campo para el modal de uso', () => {
        const html = buildEnhancedPreviewHtml(
            '<p>Actor: #1# Demandado: #2#</p>',
            [
                { id_campo: 1, type: 'clientCompleteName', title: 'Nombre completo', NEntidad: 1 },
                { id_campo: 2, type: 'clientCompleteName', title: 'Nombre completo', NEntidad: 2 },
            ],
            {},
            null,
            {
                1: 'Cliente Nombre completo 1',
                2: 'Cliente Nombre completo 2',
            }
        );

        expect(html).toContain('Cliente Nombre completo 1');
        expect(html).toContain('Cliente Nombre completo 2');
        expect(html).not.toContain('>Nombre completo<');
    });
});

describe('UseTemplateModal note helpers', () => {
    it('filtra notas por familia y NEntidad, omitiendo null y duplicados', () => {
        const notes = getRequirementNotesForEntity([
            { type: 'clientCompleteName', NEntidad: 1, note: 'Esto se refiere al actor principal.' },
            { type: 'clientAddress', NEntidad: 1, note: 'Esto se refiere al actor principal.' },
            { type: 'clientPhone', NEntidad: 1, note: null },
            { type: 'clientEmail', NEntidad: 1, note: '   ' },
            { type: 'clientCompleteName', NEntidad: 2, note: 'Esto se refiere al codemandante.' },
            { type: 'parteCompleteName', NEntidad: 1, note: 'Esto se refiere a la demandada.' },
        ], 'client', 1);

        expect(notes).toEqual(['Esto se refiere al actor principal.']);
    });
});
