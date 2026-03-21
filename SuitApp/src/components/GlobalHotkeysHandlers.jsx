import { useNavigate } from 'react-router-dom';
import { useHotkeyAction, useHotkeysSystem } from '../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';

export const GlobalHotkeysHandlers = () => {
    const navigate = useNavigate();
    useHotkeysSystem();

    // Navegación
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_AGENDA, () => navigate('/agenda'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_CASES, () => navigate('/cases'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_CLIENTS, () => navigate('/clients'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_DOCUMENTS, () => navigate('/documents'));
    useHotkeyAction(HOTKEY_ACTIONS.NAVIGATE_DEADLINES, () => navigate('/deadlines'));
    useHotkeyAction(HOTKEY_ACTIONS.OPEN_SETTINGS, () => navigate('/settings'));

    // Acciones Globales (Modales o navegación a formularios de creación)
    useHotkeyAction(HOTKEY_ACTIONS.GLOBAL_NEW_CASE, () => {
        // Podríamos abrir el modal si estuviéramos en la página de casos, 
        // o navegar a casos con un estado para abrirlo.
        navigate('/cases', { state: { openNewCaseModal: true, nonce: Date.now() } });
    });

    useHotkeyAction(HOTKEY_ACTIONS.GLOBAL_NEW_EVENT, () => {
        navigate('/agenda', { state: { openNewEventModal: true, nonce: Date.now() } });
    });

    useHotkeyAction(HOTKEY_ACTIONS.GLOBAL_NEW_CLIENT, () => {
        navigate('/clients', { state: { openNewClientModal: true, nonce: Date.now() } });
    });

    return null;
};

export default GlobalHotkeysHandlers;
