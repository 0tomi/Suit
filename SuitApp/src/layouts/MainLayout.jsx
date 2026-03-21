import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { CommandPalette } from '../components/ui/CommandPalette';
import { HotkeysHelpModal } from '../components/ui/HotkeysHelpModal';
import { useHotkeyAction } from '../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';
import { useTheme } from '../context/ThemeContext';

const MainLayout = () => {
    const navigate = useNavigate();
    const { toggleTheme } = useTheme();

    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    useHotkeyAction(HOTKEY_ACTIONS.OPEN_GLOBAL_SEARCH, () => {
        setIsCommandPaletteOpen(true);
    });

    useHotkeyAction(HOTKEY_ACTIONS.OPEN_HELP_SHORTCUTS, () => {
        setIsHelpModalOpen(true);
    });

    useHotkeyAction(HOTKEY_ACTIONS.OPEN_SETTINGS, () => {
        navigate('/settings');
    });

    useHotkeyAction(HOTKEY_ACTIONS.TOGGLE_THEME, () => {
        toggleTheme();
    });

    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => {
        window.location.reload();
    });

    useHotkeyAction(HOTKEY_ACTIONS.ESCAPE_CURRENT, () => {
        setIsCommandPaletteOpen(false);
        setIsHelpModalOpen(false);
    });

    return (
        <div className="flex h-screen bg-(--bg-page) overflow-hidden">
            <Sidebar />
            {isCommandPaletteOpen ? (
                <CommandPalette onClose={() => setIsCommandPaletteOpen(false)} />
            ) : null}
            <HotkeysHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
            <main className="flex-1 overflow-auto">
                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
