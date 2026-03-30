import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminEditUserModal from '../../src/components/admin/AdminEditUserModal.jsx';

vi.mock('../../src/hotkeys/useHotkeysSystem.js', () => ({
    useHotkeysSystem: () => ({
        suspendAllHotkeysExceptEscape: vi.fn(() => vi.fn()),
    }),
}));

vi.mock('../../src/context/ModalContext.jsx', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useModal: () => ({ modals: [] }),
    };
});

/**
 * Feature: edición de usuarios desde Admin
 * Hipótesis cubiertas:
 * - H1: el modal deriva su estado desde props y descarta borradores al reabrirse.
 * - H2: si cambia el usuario objetivo, el formulario se reinicia con la nueva identidad.
 * - H3: si el admin completa una nueva contraseña válida, el submit envía
 *   sólo `password` junto con los cambios.
 * - H4: si la nueva contraseña es inválida o su confirmación no coincide, el
 *   modal bloquea el submit y expone un error visible.
 *
 * Riesgo cubierto:
 * - Regresión silenciosa del payload enviado por el renderer al endpoint de
 *   edición de usuarios.
 * - Pérdida de validaciones locales que permitiría submits inválidos.
 */

const onClose = vi.fn();
const onEdit = vi.fn();

const baseProps = {
    onClose,
    onEdit,
    editing: false,
};

const buildUser = (overrides = {}) => ({
    id: 1,
    tag: 'user-a',
    name: 'Usuario A',
    role: 'lawyer',
    email: 'usuario-a@test.com',
    ...overrides,
});

describe('AdminEditUserModal', () => {
    beforeEach(() => {
        onClose.mockReset();
        onEdit.mockReset();
    });

    it('carga los datos del usuario al abrirse y descarta borradores al reabrirse', () => {
        const user = buildUser();
        const { rerender } = render(
            <AdminEditUserModal
                {...baseProps}
                open
                user={user}
            />,
        );

        const nameInput = screen.getByLabelText('Nombre *');
        const roleInput = screen.getByLabelText('Rol *');
        const emailInput = screen.getByLabelText('Email (opcional)');
        const tagInput = screen.getByLabelText('Tag *');

        expect(nameInput).toHaveValue('Usuario A');
        expect(roleInput).toHaveValue('lawyer');
        expect(emailInput).toHaveValue('usuario-a@test.com');
        expect(tagInput).toHaveValue('user-a');

        fireEvent.change(nameInput, { target: { value: 'Borrador temporal' } });
        expect(screen.getByLabelText('Nombre *')).toHaveValue('Borrador temporal');

        rerender(
            <AdminEditUserModal
                {...baseProps}
                open={false}
                user={user}
            />,
        );

        rerender(
            <AdminEditUserModal
                {...baseProps}
                open
                user={user}
            />,
        );

        expect(screen.getByLabelText('Nombre *')).toHaveValue('Usuario A');
        expect(screen.getByLabelText('Rol *')).toHaveValue('lawyer');
        expect(screen.getByLabelText('Email (opcional)')).toHaveValue('usuario-a@test.com');
    });

    it('reinicia el formulario cuando cambia el usuario mientras el modal sigue abierto', () => {
        const firstUser = buildUser();
        const secondUser = buildUser({
            id: 2,
            tag: 'user-b',
            name: 'Usuario B',
            role: 'admin',
            email: 'usuario-b@test.com',
        });

        const { rerender } = render(
            <AdminEditUserModal
                {...baseProps}
                open
                user={firstUser}
            />,
        );

        fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Edicion local' } });
        expect(screen.getByLabelText('Nombre *')).toHaveValue('Edicion local');

        rerender(
            <AdminEditUserModal
                {...baseProps}
                open
                user={secondUser}
            />,
        );

        expect(screen.getByLabelText('Nombre *')).toHaveValue('Usuario B');
        expect(screen.getByLabelText('Rol *')).toHaveValue('admin');
        expect(screen.getByLabelText('Email (opcional)')).toHaveValue('usuario-b@test.com');
        expect(screen.getByLabelText('Tag *')).toHaveValue('user-b');
    });

    it('envia password y los demás campos cuando el admin los edita, exceptuando password_confirmation', async () => {
        onEdit.mockResolvedValue(undefined);

        render(
            <AdminEditUserModal
                {...baseProps}
                open
                user={buildUser()}
            />,
        );

        fireEvent.change(screen.getByLabelText('Nueva contraseña (opcional)'), {
            target: { value: 'nuevaClave9' },
        });
        fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), {
            target: { value: 'nuevaClave9' },
        });
        fireEvent.change(screen.getByLabelText('Tag *'), {
            target: { value: 'user-a-updated' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(onEdit).toHaveBeenCalledWith('user-a', {
            password: 'nuevaClave9',
            tag: 'user-a-updated',
        });
    });

    it('bloquea el submit si la confirmacion no coincide con la nueva contraseña', () => {
        render(
            <AdminEditUserModal
                {...baseProps}
                open
                user={buildUser()}
            />,
        );

        fireEvent.change(screen.getByLabelText('Nueva contraseña (opcional)'), {
            target: { value: 'nuevaClave9' },
        });
        fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), {
            target: { value: 'otraClave9' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(onEdit).not.toHaveBeenCalled();
        expect(screen.getByText('La confirmación de la contraseña no coincide.')).toBeVisible();
    });

    it('bloquea el submit si la nueva contraseña no alcanza el minimo requerido', () => {
        render(
            <AdminEditUserModal
                {...baseProps}
                open
                user={buildUser()}
            />,
        );

        fireEvent.change(screen.getByLabelText('Nueva contraseña (opcional)'), {
            target: { value: 'corta' },
        });
        fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), {
            target: { value: 'corta' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(onEdit).not.toHaveBeenCalled();
        expect(screen.getByText('La nueva contraseña debe tener al menos 8 caracteres.')).toBeVisible();
    });
});
