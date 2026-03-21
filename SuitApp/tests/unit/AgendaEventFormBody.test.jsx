import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AgendaEventFormBody from '../../src/components/Agenda/AgendaEventFormBody.jsx';

function renderForm(initialTime = '') {
    function Harness() {
        const [formData, setFormData] = useState({
            title: '',
            date: '2026-03-02',
            time: initialTime,
            description: '',
            agendaId: '1',
            eventTypeId: '1',
            notifyEnabled: false,
            notifyMode: 'preset',
            notifyPresetMinutes: 15,
            notifyCustomAmount: '',
            notifyCustomUnit: 'minutes',
            notifyLoading: false,
        });

        return (
            <>
                <AgendaEventFormBody
                    formData={formData}
                    setFormData={setFormData}
                    saving={false}
                    user={{ id: 1, name: 'Ana', tag: 'ana' }}
                    users={[]}
                    eventTypes={[{ id: 1, name: 'Audiencia' }]}
                    personalAgendas={[{ id: 1, user_id: 1, name: 'Personal', suit_case_id: null }]}
                    caseAgendas={[]}
                    inactiveSelectedAgenda={null}
                    onAgendaChange={(agendaId) => setFormData((current) => ({ ...current, agendaId }))}
                    setNotificationEnabled={(notifyEnabled) => setFormData((current) => ({ ...current, notifyEnabled }))}
                    setNotificationMode={(notifyMode) => setFormData((current) => ({ ...current, notifyMode }))}
                    setNotificationPresetMinutes={(notifyPresetMinutes) => setFormData((current) => ({ ...current, notifyPresetMinutes }))}
                    setNotificationCustomAmount={(notifyCustomAmount) => setFormData((current) => ({ ...current, notifyCustomAmount }))}
                    setNotificationCustomUnit={(notifyCustomUnit) => setFormData((current) => ({ ...current, notifyCustomUnit }))}
                />
                <output data-testid="time-value">{formData.time}</output>
            </>
        );
    }

    render(<Harness />);
}

describe('AgendaEventFormBody', () => {
    it('propaga el valor HH:mm desde el input time', () => {
        renderForm();

        fireEvent.change(screen.getByTestId('agenda-event-time-input'), { target: { value: '16:55' } });

        expect(screen.getByTestId('time-value')).toHaveTextContent('16:55');
    });

    it('permite limpiar la hora', () => {
        renderForm('16:55');

        fireEvent.change(screen.getByTestId('agenda-event-time-input'), { target: { value: '' } });

        expect(screen.getByTestId('time-value')).toHaveTextContent('');
    });
});
