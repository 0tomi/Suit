import { describe, expect, it } from 'vitest';
import { getPersonalAgendaLabel } from '../../src/utils/agenda/personalAgendaLabel.js';

describe('getPersonalAgendaLabel', () => {
    it('marca la agenda del usuario actual', () => {
        const label = getPersonalAgendaLabel({
            agenda: { id: 1, user_id: 7 },
            currentUser: { id: 7, tag: '#ADMIN' },
            usersById: new Map(),
        });

        expect(label).toBe('Tu agenda (#ADMIN)');
    });

    it('usa datos del owner desde usersById para agendas de terceros', () => {
        const label = getPersonalAgendaLabel({
            agenda: { id: 2, user_id: 9 },
            currentUser: { id: 7, tag: '#ADMIN' },
            usersById: new Map([['9', { id: 9, name: 'Maria Perez', tag: '#LAW9' }]]),
        });

        expect(label).toBe('Maria Perez (#LAW9)');
    });

    it('usa fallback por user_id cuando no hay datos de usuario', () => {
        const label = getPersonalAgendaLabel({
            agenda: { id: 3, user_id: 25 },
            currentUser: { id: 7, tag: '#ADMIN' },
            usersById: new Map(),
        });

        expect(label).toBe('Usuario #25');
    });
});
