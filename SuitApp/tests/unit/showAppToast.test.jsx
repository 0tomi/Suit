import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const showMock = vi.fn();

vi.mock('sileo', () => ({
    sileo: {
        show: (...args) => showMock(...args),
    },
}));

import { showAppToast } from '../../src/components/ui/show-app-toast.jsx';

describe('showAppToast', () => {
    it('propaga position, icon e id hacia sileo.show', () => {
        const icon = <span>bell</span>;

        showAppToast({
            id: 'notif-1',
            title: 'Recordatorio',
            description: 'Tienes un evento',
            variant: 'info',
            duration: 5000,
            position: 'top-right',
            icon,
        });

        expect(showMock).toHaveBeenCalledWith(expect.objectContaining({
            id: 'notif-1',
            title: 'Recordatorio',
            description: 'Tienes un evento',
            type: 'info',
            duration: 5000,
            position: 'top-right',
            icon,
        }));
    });
});
