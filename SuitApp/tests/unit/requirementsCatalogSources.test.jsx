import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../src/context/CaseTypesContext.jsx', () => ({
    useCaseTypes: vi.fn(),
}));

vi.mock('../../src/context/RadicacionesContext.jsx', () => ({
    useRadicaciones: vi.fn(),
}));

vi.mock('../../src/context/JurisdiccionesContext.jsx', () => ({
    useJurisdicciones: vi.fn(),
}));

vi.mock('../../src/context/CompetenciasContext.jsx', () => ({
    useCompetencias: vi.fn(),
}));

vi.mock('../../src/context/DependenciasJudicialesContext.jsx', () => ({
    useDependenciasJudiciales: vi.fn(),
}));

vi.mock('../../src/context/EventsContext.jsx', () => ({
    useEvents: vi.fn(),
}));

vi.mock('../../src/context/EventTypesContext.jsx', () => ({
    useEventTypes: vi.fn(),
}));

vi.mock('../../src/components/ui/Label.jsx', () => ({
    Label: ({ children }) => <label>{children}</label>,
}));

vi.mock('../../src/components/ui/Select.jsx', () => ({
    Select: ({ children }) => <div>{children}</div>,
    SelectTrigger: ({ children }) => <div>{children}</div>,
    SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
    SelectContent: ({ children }) => <div>{children}</div>,
    SelectItem: ({ children, value }) => <div data-testid="select-item" data-value={String(value)}>{children}</div>,
}));

vi.mock('../../src/components/ui/FilterAutosuggest.jsx', () => ({
    default: ({ options = [] }) => (
        <div>
            {options.map((option) => (
                <div key={option.value} data-testid="autosuggest-option">
                    {option.label}
                </div>
            ))}
        </div>
    ),
}));

import { useCaseTypes } from '../../src/context/CaseTypesContext.jsx';
import { useRadicaciones } from '../../src/context/RadicacionesContext.jsx';
import { useJurisdicciones } from '../../src/context/JurisdiccionesContext.jsx';
import { useCompetencias } from '../../src/context/CompetenciasContext.jsx';
import { useDependenciasJudiciales } from '../../src/context/DependenciasJudicialesContext.jsx';
import { useEvents } from '../../src/context/EventsContext.jsx';
import { useEventTypes } from '../../src/context/EventTypesContext.jsx';
import { CaseSubEntitiesSearch } from '../../src/components/requirements/CaseSubEntitiesSearch.jsx';
import { EventSearch } from '../../src/components/requirements/EventSearch.jsx';

describe('requirements catalog sources', () => {
    beforeEach(() => {
        useCaseTypes.mockReturnValue({ data: [], initialized: true });
        useRadicaciones.mockReturnValue({ data: [], initialized: true });
        useJurisdicciones.mockReturnValue({ data: [], initialized: true });
        useCompetencias.mockReturnValue({ data: [], initialized: true });
        useDependenciasJudiciales.mockReturnValue({ data: [], initialized: true });
        useEvents.mockReturnValue({ agendas: [], initialized: true });
        useEventTypes.mockReturnValue({ data: [], initialized: true });
    });

    it('muestra juzgados desde data sin depender de una radicación seleccionada', () => {
        useDependenciasJudiciales.mockReturnValue({
            data: [
                { id: 1, nombre_juzgado: 'Juzgado Civil N° 1' },
                { id: 2, nombre_juzgado: 'Juzgado Laboral N° 2' },
            ],
            initialized: true,
        });

        render(
            <CaseSubEntitiesSearch
                values={{ dependencia: null }}
                onChange={() => {}}
                onFocus={() => {}}
                onBlur={() => {}}
                show={{ caseType: false, radicacion: false, jurisdiccion: false, competencia: false, dependencia: true }}
            />
        );

        expect(screen.getByText('Juzgado Civil N° 1')).toBeInTheDocument();
        expect(screen.getByText('Juzgado Laboral N° 2')).toBeInTheDocument();
    });

    it('muestra competencias y radicaciones desde data del catálogo', () => {
        useRadicaciones.mockReturnValue({
            data: [{ id: 7, name: 'Federal' }],
            initialized: true,
        });
        useCompetencias.mockReturnValue({
            data: [{ id: 3, fuero: 'Civil' }],
            initialized: true,
        });

        render(
            <CaseSubEntitiesSearch
                values={{ radicacion: null, competencia: null }}
                onChange={() => {}}
                onFocus={() => {}}
                onBlur={() => {}}
                show={{ caseType: false, radicacion: true, jurisdiccion: false, competencia: true, dependencia: false }}
            />
        );

        expect(screen.getByText('Federal')).toBeInTheDocument();
        expect(screen.getByText('Civil')).toBeInTheDocument();
    });

    it('usa data para poblar filtros de fuero y tipo de evento', () => {
        useCaseTypes.mockReturnValue({
            data: [{ id: 9, name: 'Laboral' }],
            initialized: true,
        });
        useEventTypes.mockReturnValue({
            data: [{ id: 4, name: 'Audiencia' }],
            initialized: true,
        });

        render(
            <EventSearch
                value={null}
                onChange={() => {}}
                onFocus={() => {}}
                onBlur={() => {}}
            />
        );

        expect(screen.getByText('Laboral')).toBeInTheDocument();
        expect(screen.getByText('Audiencia')).toBeInTheDocument();
    });
});
