import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../src/components/Sidebar.jsx';

let authState = { user: { id: 1, role: 'lawyer' }, logout: vi.fn() };
let apiState = { connected: true, setShowSetup: vi.fn() };
let settingsState = { sidebarMode: 'alwaysClosed', sidebarAnimationSpeed: 'x1', pinnedSections: ['agenda', 'deadlines', 'cases'] };
let syncState = { isAnySyncing: false };
let notificationBadgeState = {
    count: 0,
    isOpen: false,
    items: [],
    openModal: vi.fn(),
    closeModal: vi.fn(),
    dismissItem: vi.fn(),
    dismissAll: vi.fn(),
};
let deadlineBadgeState = { badgeColor: null };

vi.mock('../../src/context/AuthContext', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/context/ApiContext', () => ({
    useApi: () => apiState,
}));

vi.mock('../../src/context/SettingsContext', () => ({
    useSettings: () => settingsState,
}));

vi.mock('../../src/context/SyncStatusContext', () => ({
    useSyncStatus: () => syncState,
}));

vi.mock('../../src/hooks/useNotificationBadge', () => ({
    useNotificationBadge: () => notificationBadgeState,
}));

vi.mock('../../src/hooks/useDeadlineBadge', () => ({
    useDeadlineBadge: () => deadlineBadgeState,
}));

vi.mock('../../src/services/missedNotificationService.js', () => ({
    markPastNotificationAsRead: vi.fn(),
}));

vi.mock('../../src/components/Agenda/MissedNotificationsModal', () => ({
    default: () => null,
}));

function renderSidebar(initialPath = '/agenda') {
    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Sidebar />
        </MemoryRouter>
    );
}

describe('Sidebar deadlines badge', () => {
    beforeEach(() => {
        authState = { user: { id: 1, role: 'lawyer' }, logout: vi.fn() };
        apiState = { connected: true, setShowSetup: vi.fn() };
        settingsState = { sidebarMode: 'alwaysClosed', sidebarAnimationSpeed: 'x1', pinnedSections: ['agenda', 'deadlines', 'cases'] };
        syncState = { isAnySyncing: false };
        notificationBadgeState = {
            count: 0,
            isOpen: false,
            items: [],
            openModal: vi.fn(),
            closeModal: vi.fn(),
            dismissItem: vi.fn(),
            dismissAll: vi.fn(),
        };
        deadlineBadgeState = { badgeColor: null };
    });

    it('ancla el badge de vencimientos al item en sidebar colapsado', () => {
        deadlineBadgeState = { badgeColor: 'yellow' };

        renderSidebar();

        expect(screen.getByTestId('sidebar-nav-deadlines')).toHaveClass('relative');
        expect(screen.getByLabelText('Vencimientos urgentes')).toBeInTheDocument();
    });

    it('muestra badge rojo cuando hay vencidos en sidebar expandido', () => {
        settingsState = { sidebarMode: 'alwaysOpen', sidebarAnimationSpeed: 'x1', pinnedSections: ['agenda', 'deadlines', 'cases'] };
        deadlineBadgeState = { badgeColor: 'red' };

        renderSidebar('/deadlines');

        expect(screen.getByLabelText('Vencimientos vencidos')).toBeInTheDocument();
        expect(screen.queryByLabelText('Vencimientos urgentes')).not.toBeInTheDocument();
    });
});
