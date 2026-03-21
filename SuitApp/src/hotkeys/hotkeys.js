export const HOTKEY_STORAGE_KEY = 'custom-hotkeys-config';

export const HOTKEY_ACTIONS = {
    OPEN_GLOBAL_SEARCH: 'hotkey:open-global-search',
    NEW_ITEM_CONTEXTUAL: 'hotkey:new-item-contextual',
    REFRESH_MODULE: 'hotkey:refresh-module',
    ESCAPE_CURRENT: 'hotkey:escape-current',
    PRINT_CURRENT: 'hotkey:print-current',
    TOGGLE_THEME: 'hotkey:toggle-theme',
    OPEN_SETTINGS: 'hotkey:open-settings',
    CLEAR_CACHE: 'hotkey:clear-cache',
    NEW_CLIENT: 'hotkey:new-client',
    EDIT_CLIENT: 'hotkey:edit-client',
    OPEN_CLIENT_DETAIL: 'hotkey:open-client-detail',
    DELETE_CLIENT: 'hotkey:delete-client',
    NEW_CASE: 'hotkey:new-case',
    NEW_MOVEMENT: 'hotkey:new-movement',
    OPEN_CASE_DETAIL: 'hotkey:open-case-detail',
    REOPEN_CASE: 'hotkey:reopen-case',
    NEW_DOCUMENT: 'hotkey:new-document',
    SAVE_DOCUMENT: 'hotkey:save-document',
    SAVE_DOCUMENT_AS_NEW_VERSION: 'hotkey:save-document-as-new-version',
    SEARCH_IN_DOCUMENT: 'hotkey:search-in-document',
    TOGGLE_FULLSCREEN: 'hotkey:toggle-fullscreen',
    OPEN_TEMPLATE_SELECTOR: 'hotkey:open-template-selector',
    INSERT_BLOCK: 'hotkey:insert-block',
    OPEN_HELP_SHORTCUTS: 'hotkey:open-help-shortcuts',
    NAVIGATE_AGENDA: 'hotkey:navigate-agenda',
    NAVIGATE_CASES: 'hotkey:navigate-cases',
    NAVIGATE_CLIENTS: 'hotkey:navigate-clients',
    NAVIGATE_DOCUMENTS: 'hotkey:navigate-documents',
    NAVIGATE_DEADLINES: 'hotkey:navigate-deadlines',
    GLOBAL_NEW_CASE: 'hotkey:global-new-case',
    GLOBAL_NEW_EVENT: 'hotkey:global-new-event',
    GLOBAL_NEW_CLIENT: 'hotkey:global-new-client',
};

export const DEFAULT_HOTKEYS_CONFIG = [
    { id: 'global-search', keys: 'mod+k', action: HOTKEY_ACTIONS.OPEN_GLOBAL_SEARCH, desc: 'Abrir buscador global', scope: 'global' },
    { id: 'global-refresh', keys: 'f5', action: HOTKEY_ACTIONS.REFRESH_MODULE, desc: 'Actualizar vista actual', scope: 'global' },
    { id: 'global-escape', keys: 'esc', action: HOTKEY_ACTIONS.ESCAPE_CURRENT, desc: 'Cerrar modal o cancelar acción', scope: 'global' },
    { id: 'global-print', keys: 'mod+p', action: HOTKEY_ACTIONS.PRINT_CURRENT, desc: 'Imprimir documento actual', scope: 'global' },
    { id: 'global-open-settings', keys: 'mod+,', action: HOTKEY_ACTIONS.OPEN_SETTINGS, desc: 'Abrir configuración', scope: 'global' },
    { id: 'global-help-shortcuts', keys: 'mod+/', action: HOTKEY_ACTIONS.OPEN_HELP_SHORTCUTS, desc: 'Abrir ayuda de atajos', scope: 'global' },
    { id: 'global-toggle-theme', keys: 'mod+shift+l', action: HOTKEY_ACTIONS.TOGGLE_THEME, desc: 'Alternar tema claro/oscuro', scope: 'global' },
    { id: 'nav-agenda', keys: 'mod+shift+a', action: HOTKEY_ACTIONS.NAVIGATE_AGENDA, desc: 'Ir a Agenda', scope: 'global' },
    { id: 'nav-cases', keys: 'mod+shift+c', action: HOTKEY_ACTIONS.NAVIGATE_CASES, desc: 'Ir a Expedientes', scope: 'global' },
    { id: 'nav-clients', keys: 'mod+shift+p', action: HOTKEY_ACTIONS.NAVIGATE_CLIENTS, desc: 'Ir a Clientes', scope: 'global' },
    { id: 'nav-documents', keys: 'mod+shift+d', action: HOTKEY_ACTIONS.NAVIGATE_DOCUMENTS, desc: 'Ir a Escritos', scope: 'global' },
    { id: 'nav-deadlines', keys: 'mod+shift+v', action: HOTKEY_ACTIONS.NAVIGATE_DEADLINES, desc: 'Ir a Vencimientos', scope: 'global' },
    { id: 'global-new-case', keys: 'mod+alt+c', action: HOTKEY_ACTIONS.GLOBAL_NEW_CASE, desc: 'Nuevo Expediente (Global)', scope: 'global' },
    { id: 'global-new-event', keys: 'mod+alt+e', action: HOTKEY_ACTIONS.GLOBAL_NEW_EVENT, desc: 'Nueva Actuación (Global)', scope: 'global' },
    { id: 'global-new-client', keys: 'mod+alt+p', action: HOTKEY_ACTIONS.GLOBAL_NEW_CLIENT, desc: 'Nuevo Cliente (Global)', scope: 'global' },
    { id: 'clients-new', keys: 'f2', action: HOTKEY_ACTIONS.NEW_CLIENT, desc: 'Crear nuevo cliente', scope: 'clientes' },
    { id: 'clients-edit', keys: 'mod+e', action: HOTKEY_ACTIONS.EDIT_CLIENT, desc: 'Editar cliente seleccionado', scope: 'clientes' },
    { id: 'clients-open-detail', keys: 'enter', action: HOTKEY_ACTIONS.OPEN_CLIENT_DETAIL, desc: 'Abrir detalle del cliente', scope: 'clientes' },
    { id: 'clients-delete', keys: 'mod+del', action: HOTKEY_ACTIONS.DELETE_CLIENT, desc: 'Eliminar cliente seleccionado', scope: 'clientes' },
    { id: 'cases-new', keys: 'f2', action: HOTKEY_ACTIONS.NEW_CASE, desc: 'Crear nuevo expediente', scope: 'casos' },
    { id: 'cases-new-movement', keys: 'f7', action: HOTKEY_ACTIONS.NEW_MOVEMENT, desc: 'Agregar movimiento al expediente', scope: 'casos' },
    { id: 'cases-open-detail', keys: 'f4', action: HOTKEY_ACTIONS.OPEN_CASE_DETAIL, desc: 'Abrir detalle del expediente', scope: 'casos' },
    { id: 'cases-reopen', keys: 'mod+shift+r', action: HOTKEY_ACTIONS.REOPEN_CASE, desc: 'Reabrir expediente archivado', scope: 'casos' },
    { id: 'agenda-new', keys: 'mod+n', action: HOTKEY_ACTIONS.NEW_ITEM_CONTEXTUAL, desc: 'Crear nueva actuación en agenda', scope: 'agenda' },
    { id: 'documents-new', keys: 'mod+n', action: HOTKEY_ACTIONS.NEW_DOCUMENT, desc: 'Crear nuevo escrito', scope: 'documentos' },
    { id: 'documents-save', keys: 'mod+s', action: HOTKEY_ACTIONS.SAVE_DOCUMENT, desc: 'Guardar escrito actual', scope: 'documentos' },
    { id: 'documents-save-version', keys: 'mod+shift+s', action: HOTKEY_ACTIONS.SAVE_DOCUMENT_AS_NEW_VERSION, desc: 'Guardar nueva versión de escrito', scope: 'documentos' },
    { id: 'documents-search', keys: 'mod+f', action: HOTKEY_ACTIONS.SEARCH_IN_DOCUMENT, desc: 'Buscar dentro del escrito', scope: 'documentos' },
    { id: 'documents-fullscreen', keys: 'f11', action: HOTKEY_ACTIONS.TOGGLE_FULLSCREEN, desc: 'Alternar pantalla completa', scope: 'documentos' },
    { id: 'documents-templates', keys: 'mod+alt+t', action: HOTKEY_ACTIONS.OPEN_TEMPLATE_SELECTOR, desc: 'Abrir selector de plantillas', scope: 'documentos' },
    { id: 'documents-insert-block', keys: 'mod+enter', action: HOTKEY_ACTIONS.INSERT_BLOCK, desc: 'Insertar bloque jurídico', scope: 'documentos' },
    { id: 'system-clear-cache', keys: 'mod+shift+c', action: HOTKEY_ACTIONS.CLEAR_CACHE, desc: 'Limpiar caché local', scope: 'sistema' },
];

const hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeReadStorage = () => {
    if (!hasLocalStorage) return {};
    try {
        const stored = localStorage.getItem(HOTKEY_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

export const getCustomHotkeysConfig = () => {
    const customById = safeReadStorage();
    return DEFAULT_HOTKEYS_CONFIG.map((config) => {
        const customKeys = customById[config.id];
        return customKeys ? { ...config, keys: customKeys } : config;
    });
};

export const saveCustomHotkey = (id, newKeys) => {
    if (!hasLocalStorage) return;
    const configById = safeReadStorage();
    configById[id] = newKeys;
    try {
        localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(configById));
    } catch {
        /* ignore storage errors */
    }
};

export const resetCustomHotkeysConfig = () => {
    if (!hasLocalStorage) return;
    try {
        localStorage.removeItem(HOTKEY_STORAGE_KEY);
    } catch {
        /* ignore storage errors */
    }
};
