import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FilterAutosuggest from '../../src/components/ui/FilterAutosuggest.jsx';

const options = [
    { value: '', label: '— Ninguno (agenda personal)' },
    { value: '12', label: 'Caso Alfa' },
    { value: '24', label: 'Caso Beta' },
];

function renderAutosuggest(initialValue = '') {
    function Harness() {
        const [value, setValue] = useState(initialValue);

        return (
            <FilterAutosuggest
                label="Caso asociado"
                placeholder="Buscar caso..."
                value={value}
                options={options}
                onChange={setValue}
                onClear={() => setValue('')}
                emptyMessage="No se encontraron casos"
            />
        );
    }

    render(<Harness />);
}

describe('FilterAutosuggest', () => {
    it('muestra otras opciones al abrir con un valor ya seleccionado', () => {
        renderAutosuggest('');

        fireEvent.focus(screen.getByLabelText('Caso asociado'));

        expect(screen.getByRole('button', { name: 'Caso Alfa' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Caso Beta' })).toBeInTheDocument();
    });

    it('mantiene el filtrado cuando el usuario escribe una búsqueda nueva', () => {
        renderAutosuggest('');

        const input = screen.getByLabelText('Caso asociado');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'beta' } });

        expect(screen.getByRole('button', { name: 'Caso Beta' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Caso Alfa' })).not.toBeInTheDocument();
    });

    it('selecciona el texto actual al enfocar un valor elegido para permitir buscar enseguida', () => {
        renderAutosuggest('12');

        const input = screen.getByLabelText('Caso asociado');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'beta' } });

        expect(screen.getByRole('button', { name: 'Caso Beta' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Caso Alfa' })).not.toBeInTheDocument();
    });
});
