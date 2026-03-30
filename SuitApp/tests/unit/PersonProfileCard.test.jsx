import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PersonProfileCard from '../../src/components/people/PersonProfileCard.jsx';

describe('PersonProfileCard', () => {
    it('renderiza badges, secciones y notas compartidas', () => {
        render(
            <PersonProfileCard
                fullName="Ana Pérez"
                badges={[{ label: 'Estado financiero', value: 'Deudor', variant: 'warning' }]}
                sections={[
                    {
                        title: 'Información personal',
                        fields: [
                            { label: 'Nombre completo', value: 'Ana Pérez' },
                            { label: 'Identificación', value: '12345678' },
                        ],
                    },
                ]}
                notes="Notas de prueba"
            />,
        );

        expect(screen.getAllByText('Ana Pérez')).toHaveLength(2);
        expect(screen.getByText(/Estado financiero: Deudor/i)).toBeInTheDocument();
        expect(screen.getByText('Información personal')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Notas de prueba')).toBeInTheDocument();
    });
});
