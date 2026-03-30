import { describe, expect, it } from 'vitest';
import { buildClientCacheRow, extractClientPayload } from '../../src/services/cache/clientCacheRow.js';

describe('clientCacheRow', () => {
    it('extrae el cliente desde payloads envueltos y genera fila de cache', () => {
        const payload = {
            data: {
                id: 15,
                first_name: 'Ana',
                last_name: 'Suarez',
                identification_number: '12345678',
                email: 'ana@example.com',
                type: 'person',
                status: 'active',
                financial_status: 'deudor',
            },
        };

        expect(extractClientPayload(payload)).toEqual(payload.data);

        const row = buildClientCacheRow(payload);
        expect(row).toMatchObject({
            id: 15,
            first_name: 'Ana',
            last_name: 'Suarez',
            identification_number: '12345678',
            email: 'ana@example.com',
            type: 'person',
            status: 'active',
            financial_status: 'deudor',
        });
        expect(JSON.parse(row.data_json)).toMatchObject({
            id: 15,
            first_name: 'Ana',
            last_name: 'Suarez',
            financial_status: 'deudor',
        });
    });

    it('preserva valores previos al construir la fila con respuesta parcial', () => {
        const row = buildClientCacheRow(
            { id: 22, email: 'nuevo@example.com' },
            { id: 22, first_name: 'Lucia', last_name: 'Perez', type: 'company' },
        );

        expect(row).toMatchObject({
            id: 22,
            first_name: 'Lucia',
            last_name: 'Perez',
            email: 'nuevo@example.com',
            type: 'company',
        });
    });
});
