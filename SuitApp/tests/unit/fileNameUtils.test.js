import { describe, expect, it } from 'vitest';
import { getBaseNameWithoutExtension } from '../../src/utils/fileNameUtils.js';

describe('fileNameUtils', () => {
    it('quita la extensión de archivos con ruta unix', () => {
        expect(getBaseNameWithoutExtension('/tmp/Escrito inicial.docx')).toBe('Escrito inicial');
    });

    it('quita la extensión de archivos con ruta windows', () => {
        expect(getBaseNameWithoutExtension('C:\\docs\\demanda final.pdf')).toBe('demanda final');
    });

    it('preserva nombres sin extensión', () => {
        expect(getBaseNameWithoutExtension('/tmp/documento')).toBe('documento');
    });

    it('preserva archivos ocultos que solo tienen punto inicial', () => {
        expect(getBaseNameWithoutExtension('/tmp/.env')).toBe('.env');
    });

    it('quita solo la última extensión cuando hay varias', () => {
        expect(getBaseNameWithoutExtension('/tmp/contrato.v2.docx')).toBe('contrato.v2');
    });
});
