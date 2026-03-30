import { describe, expect, it } from 'vitest';

import {
    getRequirementNotesForEntity,
} from '../../src/components/Editor/useTemplateModalUtils.js';
import {
    buildEnhancedPreviewHtml,
    buildPreviewHtml,
} from '../../src/components/templates/templateEditorUtils.js';

function parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

describe('templateEditorUtils preview helpers', () => {
    it('genera burbujas de preview con corte inline coherente', () => {
        const html = buildPreviewHtml('<p>Actor: #1#</p>');

        expect(html).toContain('display:inline');
        expect(html).toContain('box-decoration-break:clone');
        expect(html).not.toContain('display:inline-flex');
    });

    it('preserva la estructura textual basica y elimina elementos no textuales', () => {
        const html = buildPreviewHtml(`
            <h2 style="font-size: 40px; color: red;">Demanda</h2>
            <p><strong>Actor:</strong> #1#</p>
            <ul><li>Hecho uno</li><li>Hecho dos</li></ul>
            <img src="x" alt="Imagen" />
            <script>alert("x")</script>
        `);

        const doc = parseHtml(html);

        expect(doc.querySelector('h2')).not.toBeNull();
        expect(doc.querySelector('strong')).not.toBeNull();
        expect(doc.querySelectorAll('li')).toHaveLength(2);
        expect(doc.querySelector('img')).toBeNull();
        expect(doc.querySelector('script')).toBeNull();
        expect(html).toContain('font-size:36px');
        expect(html).toContain('Requisito');
    });

    it('normaliza tablas y placeholders sin perder el formato inline permitido', () => {
        const html = buildPreviewHtml(`
            <table>
                <tr>
                    <th style="text-align:center">Campo</th>
                    <td><em>#1#</em></td>
                </tr>
            </table>
        `);

        const doc = parseHtml(html);

        expect(doc.querySelector('table')).not.toBeNull();
        expect(doc.querySelector('th')).not.toBeNull();
        expect(doc.querySelector('td em span')).not.toBeNull();
        expect(html).toContain('text-align:center');
        expect(html).toContain('border-collapse:collapse');
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

    it('mantiene la estructura del html en la preview inteligente y respeta el foco actual', () => {
        const html = buildEnhancedPreviewHtml(
            '<p><strong>Actor:</strong> #1#</p><table><tr><td>#2#</td></tr></table>',
            [
                { id_campo: 1, type: 'clientCompleteName', title: 'Nombre completo', NEntidad: 1 },
                { id_campo: 2, type: 'eventName', title: 'Evento', NEntidad: 1 },
            ],
            { 1: 'Juan Perez' },
            { family: 'event', nEntidad: 1 }
        );

        const doc = parseHtml(html);

        expect(doc.querySelector('strong')).not.toBeNull();
        expect(doc.querySelector('table')).not.toBeNull();
        expect(html).toContain('Juan Perez');
        expect(html).toContain('box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);');
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
