import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { CommandPalette } from '../components/ui/CommandPalette';
import { HotkeysHelpModal } from '../components/ui/HotkeysHelpModal';
import { useHotkeyAction } from '../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';
import { useTheme } from '../context/ThemeContext';
import { useTabs } from '../context/TabsContext';
import { TabBar } from '../components/TabBar/TabBar';
import { TabsContainer } from '../components/TabBar/TabsContainer';

const MainLayout = () => {
    const { toggleTheme } = useTheme();
    const { openTab } = useTabs();

    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    useHotkeyAction(HOTKEY_ACTIONS.OPEN_GLOBAL_SEARCH, () => {
        setIsCommandPaletteOpen(true);
    });

    useHotkeyAction(HOTKEY_ACTIONS.OPEN_HELP_SHORTCUTS, () => {
        setIsHelpModalOpen(true);
    });

    useHotkeyAction(HOTKEY_ACTIONS.OPEN_SETTINGS, () => {
        openTab('/settings');
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

            <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <TabBar />
                <div className="px-8 pt-6 pb-6 flex-1 min-h-0 overflow-hidden flex flex-col">
                    <TabsContainer />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
