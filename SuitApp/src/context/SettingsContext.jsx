/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { NOTIFICATION_MINUTES_LIMITS } from '../components/Agenda/notificationConfig.js';
import { clampNotificationMinutes } from '../utils/notificationTimeFormat.js';
import { normalizeAgendaColorMode } from '../utils/agendaColor/normalizeAgendaColorMode.js';
import { ALL_AGENDAS_VIEW, normalizeDefaultAgendaView } from '../utils/agenda/defaultAgendaView.js';
import { createLogger } from '../services/logService.js';
import { useAuth } from './AuthContext.jsx';
import { DEFAULT_PINNED_SECTIONS } from '../constants/sectionsRegistry.js';
import { DEFAULT_TEMPLATE_CAPITALIZATION } from '../utils/templateCapitalization.js';

const SettingsContext = createContext(null);

const LEGACY_STORAGE_KEY = 'suit-settings';
const logger = createLogger('settings-context');

const defaultSettings = {
    defaultAgendaView: ALL_AGENDAS_VIEW, // 'ALL' | agendaId string
    agendaColorMode: 'eventType', // 'eventType' | 'caseType'
    personalEventColor: '#3b82f6', // color por defecto para eventos sin caso asociado
    sidebarMode: 'hover', // 'hover' | 'click' | 'alwaysOpen' | 'alwaysClosed'
    sidebarAnimationSpeed: 'x1', // 'x1' | 'x0.5' | 'x0'
    defaultEventNotificationMinutes: null, // null = no notificar por defecto
    lastEventNotificationMinutes: 15,
    // Colores por estado/prioridad de vencimientos (null = usar color de fondo del tema)
    deadlineColors: {
        pendingNormal: null,        // Pendiente Normal: fondo por defecto
        pendingUrgent: '#f97316',   // Pendiente Urgente: naranja
        completed: '#9ca3af',       // Cumplido: gris
        postponedNormal: '#3b82f6', // Prorrogado Normal: azul
        postponedUrgent: '#f97316', // Prorrogado Urgente: naranja
        overdue: '#ef4444',         // Vencido: rojo
    },
    urgentBlinkOnEntry: true,   // Parpadeo rojo en vencimientos urgentes al entrar a la sección
    showTutorials: true,        // Mostrar icono de tutorial en cada sección
    pinnedSections: DEFAULT_PINNED_SECTIONS, // Secciones ancladas al sidebar
    // Biblioteca de archivos públicos
    libraryNewBadgeEnabled: true,
    libraryNewBadgeColor: '#f97316',
    libraryJumpAnimationEnabled: true,
    tablePageAnimationsEnabled: true,
    // Configuración de capitalización del motor de plantillas
    templateCapitalization: DEFAULT_TEMPLATE_CAPITALIZATION,
    // Tratamiento formal de cliente: incluir Sr./Sra. en nombre completo y apellido
    templateClientTreatment: true,
    // Restaurar las pestañas abiertas al iniciar la aplicación
    restoreTabs: true,
};

function ensurePinnedSections(nextPinnedSections) {
    const normalized = Array.isArray(nextPinnedSections) ? nextPinnedSections.filter(Boolean) : [];
    if (normalized.includes('reports')) return normalized;
    return ['reports', ...normalized];
}

function getSettingsStorageKey(userId) {
    if (userId == null) return `${LEGACY_STORAGE_KEY}:anon`;
    return `${LEGACY_STORAGE_KEY}:user:${String(userId)}`;
}

function parseSettings(raw) {
    if (!raw) return defaultSettings;
    const parsed = { ...defaultSettings, ...JSON.parse(raw) };
    return {
        ...parsed,
        defaultAgendaView: normalizeDefaultAgendaView(parsed.defaultAgendaView),
        agendaColorMode: normalizeAgendaColorMode(parsed.agendaColorMode),
        pinnedSections: ensurePinnedSections(parsed.pinnedSections),
    };
}

function loadSettings(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const normalized = parseSettings(raw);
            const parsed = JSON.parse(raw);
            if (
                normalized.agendaColorMode !== parsed.agendaColorMode
                || normalized.defaultAgendaView !== parsed.defaultAgendaView
            ) {
                saveSettings(storageKey, normalized);
            }
            return normalized;
        }

        // Migracion compatible: toma la clave global antigua solo una vez
        // para el primer usuario que inicie sesion luego de actualizar.
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!legacyRaw) return defaultSettings;

        const migrated = parseSettings(legacyRaw);
        saveSettings(storageKey, migrated);
        localStorage.removeItem(LEGACY_STORAGE_KEY);

        return migrated;
    } catch (error) {
        void logger.warn('No se pudieron restaurar settings persistidos; se usaran defaults', {
            storageKey,
            error,
        });
        return defaultSettings;
    }
}

function saveSettings(storageKey, settings) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (error) {
        void logger.warn('No se pudieron persistir settings en localStorage', {
            storageKey,
            error,
        });
    }
}

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider');
    return ctx;
};

export const SettingsProvider = ({ children }) => {
    const { user } = useAuth();
    const storageKey = useMemo(() => getSettingsStorageKey(user?.id ?? null), [user?.id]);
    const [settings, setSettingsState] = useState(() => loadSettings(storageKey));

    useEffect(() => {
        setSettingsState(loadSettings(storageKey));
    }, [storageKey]);

    const updateSettings = useCallback((patch) => {
        setSettingsState((prev) => {
            const next = { ...prev, ...patch };
            saveSettings(storageKey, next);
            return next;
        });
    }, [storageKey]);

    const setAgendaColorMode = useCallback((mode) => {
        updateSettings({ agendaColorMode: normalizeAgendaColorMode(mode) });
    }, [updateSettings]);

    const setDefaultAgendaView = useCallback((value) => {
        updateSettings({ defaultAgendaView: normalizeDefaultAgendaView(value) });
    }, [updateSettings]);

    const setPersonalEventColor = useCallback((color) => {
        updateSettings({ personalEventColor: color });
    }, [updateSettings]);

    const setSidebarMode = useCallback((mode) => {
        updateSettings({ sidebarMode: mode });
    }, [updateSettings]);

    const setSidebarAnimationSpeed = useCallback((speed) => {
        updateSettings({ sidebarAnimationSpeed: speed });
    }, [updateSettings]);

    const setDefaultEventNotificationMinutes = useCallback((minutes) => {
        if (minutes == null) {
            updateSettings({ defaultEventNotificationMinutes: null });
            return;
        }

        const clamped = clampNotificationMinutes(minutes, NOTIFICATION_MINUTES_LIMITS);
        if (clamped == null) return;
        updateSettings({ defaultEventNotificationMinutes: clamped });
    }, [updateSettings]);

    const setLastEventNotificationMinutes = useCallback((minutes) => {
        const clamped = clampNotificationMinutes(minutes, NOTIFICATION_MINUTES_LIMITS);
        if (clamped == null) return;
        updateSettings({ lastEventNotificationMinutes: clamped });
    }, [updateSettings]);

    const setUrgentBlinkOnEntry = useCallback((enabled) => {
        updateSettings({ urgentBlinkOnEntry: Boolean(enabled) });
    }, [updateSettings]);

    /** Actualiza uno o más colores de vencimientos. Recibe un objeto parcial. */
    const setDeadlineColors = useCallback((colorPatch) => {
        updateSettings({
            deadlineColors: { ...settings.deadlineColors, ...colorPatch },
        });
    }, [updateSettings, settings.deadlineColors]);

    const setShowTutorials = useCallback((enabled) => {
        updateSettings({ showTutorials: Boolean(enabled) });
    }, [updateSettings]);

    /** Alterna el estado anclado de una sección en el sidebar. */
    const togglePinnedSection = useCallback((key) => {
        updateSettings({
            pinnedSections: settings.pinnedSections.includes(key)
                ? settings.pinnedSections.filter((k) => k !== key)
                : [...settings.pinnedSections, key],
        });
    }, [updateSettings, settings.pinnedSections]);

    const setLibraryNewBadgeEnabled = useCallback((enabled) => {
        updateSettings({ libraryNewBadgeEnabled: Boolean(enabled) });
    }, [updateSettings]);

    const setLibraryNewBadgeColor = useCallback((color) => {
        updateSettings({ libraryNewBadgeColor: color });
    }, [updateSettings]);

    const setLibraryJumpAnimationEnabled = useCallback((enabled) => {
        updateSettings({ libraryJumpAnimationEnabled: Boolean(enabled) });
    }, [updateSettings]);

    const setTablePageAnimationsEnabled = useCallback((enabled) => {
        updateSettings({ tablePageAnimationsEnabled: Boolean(enabled) });
    }, [updateSettings]);

    const setTemplateClientTreatment = useCallback((enabled) => {
        updateSettings({ templateClientTreatment: Boolean(enabled) });
    }, [updateSettings]);

    const setRestoreTabs = useCallback((enabled) => {
        updateSettings({ restoreTabs: Boolean(enabled) });
    }, [updateSettings]);

    /**
     * Actualiza la configuración de capitalización del motor de plantillas.
     * Acepta un parche parcial: { mode } o { fields: { [type]: boolean } }.
     */
    const setTemplateCapitalization = useCallback((patch) => {
        updateSettings({
            templateCapitalization: {
                ...settings.templateCapitalization,
                ...patch,
                // Merge parcial de fields para no pisar los otros toggles
                fields: patch.fields
                    ? { ...settings.templateCapitalization.fields, ...patch.fields }
                    : settings.templateCapitalization.fields,
            },
        });
    }, [updateSettings, settings.templateCapitalization]);

    const value = useMemo(() => ({
        defaultAgendaView: settings.defaultAgendaView,
        setDefaultAgendaView,
        agendaColorMode: settings.agendaColorMode,
        setAgendaColorMode,
        personalEventColor: settings.personalEventColor,
        setPersonalEventColor,
        sidebarMode: settings.sidebarMode,
        setSidebarMode,
        sidebarAnimationSpeed: settings.sidebarAnimationSpeed,
        setSidebarAnimationSpeed,
        defaultEventNotificationMinutes: settings.defaultEventNotificationMinutes,
        setDefaultEventNotificationMinutes,
        lastEventNotificationMinutes: settings.lastEventNotificationMinutes,
        setLastEventNotificationMinutes,
        deadlineColors: settings.deadlineColors,
        setDeadlineColors,
        urgentBlinkOnEntry: settings.urgentBlinkOnEntry,
        setUrgentBlinkOnEntry,
        showTutorials: settings.showTutorials,
        setShowTutorials,
        pinnedSections: settings.pinnedSections,
        togglePinnedSection,
        libraryNewBadgeEnabled: settings.libraryNewBadgeEnabled,
        setLibraryNewBadgeEnabled,
        libraryNewBadgeColor: settings.libraryNewBadgeColor,
        setLibraryNewBadgeColor,
        libraryJumpAnimationEnabled: settings.libraryJumpAnimationEnabled,
        setLibraryJumpAnimationEnabled,
        tablePageAnimationsEnabled: settings.tablePageAnimationsEnabled,
        setTablePageAnimationsEnabled,
        templateCapitalization: settings.templateCapitalization,
        setTemplateCapitalization,
        templateClientTreatment: settings.templateClientTreatment ?? true,
        setTemplateClientTreatment,
        restoreTabs: settings.restoreTabs ?? true,
        setRestoreTabs,
    }), [
        settings.defaultAgendaView,
        settings.agendaColorMode,
        settings.personalEventColor,
        settings.sidebarMode,
        settings.sidebarAnimationSpeed,
        settings.defaultEventNotificationMinutes,
        settings.lastEventNotificationMinutes,
        settings.deadlineColors,
        settings.urgentBlinkOnEntry,
        settings.showTutorials,
        settings.pinnedSections,
        settings.libraryNewBadgeEnabled,
        settings.libraryNewBadgeColor,
        settings.libraryJumpAnimationEnabled,
        settings.tablePageAnimationsEnabled,
        setDefaultAgendaView,
        setAgendaColorMode,
        setPersonalEventColor,
        setSidebarMode,
        setSidebarAnimationSpeed,
        setDefaultEventNotificationMinutes,
        setLastEventNotificationMinutes,
        setDeadlineColors,
        setUrgentBlinkOnEntry,
        setShowTutorials,
        togglePinnedSection,
        setLibraryNewBadgeEnabled,
        setLibraryNewBadgeColor,
        setLibraryJumpAnimationEnabled,
        setTablePageAnimationsEnabled,
        settings.templateCapitalization,
        setTemplateCapitalization,
        settings.templateClientTreatment,
        setTemplateClientTreatment,
        settings.restoreTabs,
        setRestoreTabs,
    ]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export default SettingsContext;
