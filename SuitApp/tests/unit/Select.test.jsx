import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../src/components/ui/Select.jsx';

function SelectHarness() {
    const [value, setValue] = React.useState('1');

    return (
        <Select value={value} onValueChange={setValue}>
            <SelectTrigger aria-label="Seleccionar cliente">
                <SelectValue placeholder="Seleccionar cliente..." />
            </SelectTrigger>
            <SelectContent forceMount>
                <SelectItem value="1">{'Juan'} {'Perez'}</SelectItem>
                <SelectItem value="2">{'Ana'} {'Lopez'}</SelectItem>
            </SelectContent>
        </Select>
    );
}

describe('Select wrapper', () => {
    it('muestra el label visible y no el value bruto cuando el valor ya está seleccionado', async () => {
        render(<SelectHarness />);

        const trigger = screen.getByRole('combobox', { name: 'Seleccionar cliente' });

        await waitFor(() => {
            expect(trigger).toHaveTextContent('Juan Perez');
        });
        expect(trigger).not.toHaveTextContent(/^1$/);
    });
});
