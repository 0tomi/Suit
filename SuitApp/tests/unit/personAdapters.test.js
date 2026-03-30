import { describe, expect, it } from 'vitest';
import {
    buildClientApiPayload,
    buildParteApiPayload,
    buildPersonFormStateFromParte,
} from '../../src/services/personAdapters.js';

describe('personAdapters', () => {
    it('construye el payload de cliente sin campos vacíos', () => {
        expect(buildClientApiPayload({
            first_name: ' Ana ',
            last_name: ' Pérez ',
            identification_number: '12345678',
            email: 'ana@example.com',
            phone: '1234',
            address: ' Mitre 123 ',
            type: 'person',
            gender: 'f',
            notes: '',
        })).toEqual({
            first_name: 'Ana',
            last_name: 'Pérez',
            identification_number: '12345678',
            email: 'ana@example.com',
            phone: '1234',
            address: 'Mitre 123',
            type: 'person',
            gender: 'F',
        });
    });

    it('adapta el formulario compartido al contrato extendido de partes', () => {
        expect(buildParteApiPayload({
            first_name: 'Laura',
            last_name: 'Suárez',
            identification_number: '27111222',
            email: 'laura@example.com',
            phone: '351123123',
            address: 'San Martín 400',
            gender: 'x',
            notes: 'Perito de oficio',
            rol_id: '8',
            estado: 'activo',
        })).toEqual({
            nombre: 'Laura',
            apellido: 'Suárez',
            identificacion: '27111222',
            email: 'laura@example.com',
            telefono: '351123123',
            direccion: 'San Martín 400',
            genero: 'X',
            notas: 'Perito de oficio',
            rol_id: 8,
        });
    });

    it('normaliza una parte al estado base del formulario compartido', () => {
        expect(buildPersonFormStateFromParte({
            nombre: 'Sofía',
            apellido: 'Díaz',
            identificacion: '30111222',
            email: 'sofia@example.com',
            telefono: '4567',
            direccion: 'Belgrano 10',
            genero: 'F',
            notas: 'Testigo',
            rol_id: 4,
        })).toMatchObject({
            first_name: 'Sofía',
            last_name: 'Díaz',
            identification_number: '30111222',
            email: 'sofia@example.com',
            phone: '4567',
            address: 'Belgrano 10',
            gender: 'F',
            notes: 'Testigo',
            rol_id: '4',
        });
    });
});
