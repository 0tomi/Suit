import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VersionHistoryPanel from '../../src/components/Editor/VersionHistoryPanel.jsx';

describe('VersionHistoryPanel', () => {
    it('renderiza versiones y delega la apertura de la seleccionada', () => {
        const onOpenVersion = vi.fn();

        render(
            <VersionHistoryPanel
                versions={[
                    {
                        id: 11,
                        version_number: 3,
                        created_at: '2026-03-12T14:30:00.000Z',
                        creator: { name: 'Ana' },
                    },
                ]}
                loading={false}
                error=""
                activeVersionId={11}
                onOpenVersion={onOpenVersion}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText('v3')).toBeInTheDocument();
        expect(screen.getByText('Ana')).toBeInTheDocument();
        expect(screen.getByText('Abierta actualmente')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
        expect(onOpenVersion).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));
    });

    it('usa el usuario que modificó la versión cuando el backend no envía creator', () => {
        render(
            <VersionHistoryPanel
                versions={[
                    {
                        id: 21,
                        version_number: 4,
                        updated_at: '2026-03-13T18:10:00.000Z',
                        modified_by_user: { name: 'Bruno Diaz' },
                    },
                    {
                        id: 22,
                        version_number: 5,
                        updated_at: '2026-03-13T18:12:00.000Z',
                        editor_name: 'Marta López',
                    },
                ]}
                loading={false}
                error=""
                onOpenVersion={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText('Bruno Diaz')).toBeInTheDocument();
        expect(screen.getByText('Marta López')).toBeInTheDocument();
    });

    it('resuelve creator cuando la API lo devuelve anidado en data', () => {
        render(
            <VersionHistoryPanel
                versions={[
                    {
                        id: 23,
                        version_number: 6,
                        created_at: '2026-03-13T19:00:00.000Z',
                        creator: {
                            data: {
                                name: 'Laura Campos',
                            },
                        },
                    },
                ]}
                loading={false}
                error=""
                onOpenVersion={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText('Laura Campos')).toBeInTheDocument();
    });
});
