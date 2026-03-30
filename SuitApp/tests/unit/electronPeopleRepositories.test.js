import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildClientCacheRow } = require('../../electron/clientsRepository.cjs');
const { buildParteCacheRow } = require('../../electron/partesRepository.cjs');

describe('electron people repositories', () => {
    it('persiste financial_status en la fila de clientes', () => {
        const row = buildClientCacheRow({
            id: 7,
            first_name: 'Ana',
            last_name: 'Paz',
            financial_status: 'moroso',
        });

        expect(row).toMatchObject({
            id: 7,
            first_name: 'Ana',
            last_name: 'Paz',
            financial_status: 'moroso',
        });
        expect(JSON.parse(row.data_json)).toMatchObject({
            id: 7,
            financial_status: 'moroso',
        });
    });

    it('preserva el contrato ampliado de partes al hidratar respuestas parciales', () => {
        const row = buildParteCacheRow(
            { id: 9, email: 'nuevo@example.com', estado: 'activo' },
            {
                id: 9,
                nombre: 'Luis',
                apellido: 'Ramos',
                identificacion: '20444555',
                direccion: 'Colón 12',
                genero: 'M',
                notas: 'Perito',
                rol_id: 3,
                created_at: '2026-03-01 10:00:00',
            },
        );

        expect(row).toMatchObject({
            id: 9,
            nombre: 'Luis',
            apellido: 'Ramos',
            identificacion: '20444555',
            email: 'nuevo@example.com',
            direccion: 'Colón 12',
            genero: 'M',
            estado: 'activo',
            notas: 'Perito',
            rol_id: 3,
            created_at: '2026-03-01 10:00:00',
        });
    });
});
