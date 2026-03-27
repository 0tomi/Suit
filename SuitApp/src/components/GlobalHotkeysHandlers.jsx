import { useHotkeyAction, useHotkeysSystem } from '../hotkeys/useHotkeysSystem';
import { useSettings } from '../context/SettingsContext';
import { useTabs } from '../context/TabsContext';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';

export const GlobalHotkeysHandlers = () => {
    const { openTab, tabs, activateTab, activeTab, goInTab } = useTabs();
    useHotkeysSystem();

    // Navegación de secciones: navega en la pestaña activa
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_AGENDA,    () => openTab('/agenda'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_CASES,     () => openTab('/cases'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_PEOPLE,    () => openTab('/people'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_DOCUMENTS, () => openTab('/documents'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_DEADLINES, () => openTab('/deadlines'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_SECTIONS,  () => openTab('/sections'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_BIBLIOTECA,() => openTab('/biblioteca'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_ECONOMIA,  () => openTab('/economia'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_TEMPLATES, () => openTab('/templates'));
    useHotkeyAction(HOTKEY_ACTIONS.OPEN_SETTINGS,      () => openTab('/settings'));

    // Ir atrás en el historial del tab activo
    useHotkeyAction(HOTKEY_ACTIONS.GO_BACK, () => {
        if (activeTab) goInTab(activeTab.id, -1);
    });

    // Saltar a tab por índice
    useHotkeyAction(HOTKEY_ACTIONS.TAB_GOTO_1, () => { if (tabs[0]) activateTab(tabs[0].id); });
    useHotkeyAction(HOTKEY_ACTIONS.TAB_GOTO_2, () => { if (tabs[1]) activateTab(tabs[1].id); });
    useHotkeyAction(HOTKEY_ACTIONS.TAB_GOTO_3, () => { if (tabs[2]) activateTab(tabs[2].id); });
    useHotkeyAction(HOTKEY_ACTIONS.TAB_GOTO_4, () => { if (tabs[3]) activateTab(tabs[3].id); });
    useHotkeyAction(HOTKEY_ACTIONS.TAB_GOTO_5, () => { if (tabs[4]) activateTab(tabs[4].id); });

    // Acciones globales: navega en tab activo y pasa estado via sessionStorage
    // para cruzar el límite del MemoryRouter
    useHotkeyAction(HOTKEY_ACTIONS.GLOBAL_NEW_CASE, () => {
        try { sessionStorage.setItem('tab_state', JSON.stringify({ openNewCaseModal: true, nonce: Date.now() })); } catch { /* ignorar */ }
        openTab('/cases');
    });

    useHotkeyAction(HOTKEY_ACTIONS.GLOBAL_NEW_EVENT, () => {
        try { sessionStorage.setItem('tab_state', JSON.stringify({ openNewEventModal: true, nonce: Date.now() })); } catch { /* ignorar */ }
        openTab('/agenda');
    });

    useHotkeyAction(HOTKEY_ACTIONS.GLOBAL_NEW_CLIENT, () => {
        try { sessionStorage.setItem('tab_state', JSON.stringify({ openNewClientModal: true, nonce: Date.now() })); } catch { /* ignorar */ }
        openTab('/people');
    });

    const { toggleSidebarMode } = useSettings();
    useHotkeyAction(HOTKEY_ACTIONS.TOGGLE_SIDEBAR, () => toggleSidebarMode());

    return null;
};

export default GlobalHotkeysHandlers;
