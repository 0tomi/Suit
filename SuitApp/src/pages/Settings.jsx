import { createElement, useState, useCallback, useEffect, useMemo } from 'react';
import * as Select from '@radix-ui/react-select';
import { Settings as SettingsIcon, Sun, Moon, Calendar, Briefcase, UserCircle, Camera, Save, ChevronDown, Check, Clock, LayoutGrid, Keyboard, LogOut, Library, FileText, Minus, Plus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../context/ApiContext';
import { useEvents } from '../context/EventsContext.jsx';
import { useCases } from '../context/CasesContext.jsx';
import { useUsers } from '../context/UsersContext.jsx';
import { updateProfile, getProfilePhotoUrl } from '../services/profileService';
import { showAppToast } from '../components/ui/show-app-toast';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { useProfileFormState } from '../hooks/useProfileFormState.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import NotificationConfigSection from '../components/Agenda/NotificationConfigSection.jsx';
import { NOTIFICATION_MINUTES_LIMITS } from '../components/Agenda/notificationConfig.js';
import { clampNotificationMinutes, fromMinutes, toMinutes } from '../utils/notificationTimeFormat.js';
import { ALL_AGENDAS_VIEW } from '../utils/agenda/defaultAgendaView.js';
import { splitVisibleAgendas } from '../utils/agenda/visibleAgendas.js';
import { getPersonalAgendaLabel } from '../utils/agenda/personalAgendaLabel.js';
import SideMenuPageLayout from '../components/ui/SideMenuPageLayout.jsx';
import SettingsCacheResetRow from '../components/settings/SettingsCacheResetRow.jsx';
import SectionsPanel from '../components/settings/SectionsPanel.jsx';
import HotkeysSettingsPanel from '../components/settings/HotkeysSettingsPanel.jsx';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../components/ui/Tooltip.jsx';
import TemplateCapitalizationPanel from '../components/settings/TemplateCapitalizationPanel.jsx';
import { INTERFACE_SCALE_MAX, INTERFACE_SCALE_MIN, INTERFACE_SCALE_STEP, shiftInterfaceScale } from '../utils/interfaceScale.js';

const CATEGORIES = [
    { id: 'perfil', label: 'Perfil', icon: UserCircle },
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'secciones', label: 'Secciones', icon: LayoutGrid },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'vencimientos', label: 'Vencimientos', icon: Clock },
    { id: 'biblioteca', label: 'Biblioteca', icon: Library },
    { id: 'plantillas', label: 'Plantillas', icon: FileText },
    { id: 'hotkeys', label: 'Atajos', icon: Keyboard },
];


const SIDEBAR_BEHAVIOR_OPTIONS = [
    { id: 'sidebar-mode-option-hover', value: 'hover', label: 'Abrir al pasar el mouse' },
    { id: 'sidebar-mode-option-click', value: 'click', label: 'Abrir al clickear icono' },
    { id: 'sidebar-mode-option-always-open', value: 'alwaysOpen', label: 'Mantener siempre abierto' },
    { id: 'sidebar-mode-option-always-closed', value: 'alwaysClosed', label: 'Mantener siempre cerrado' },
];

const SIDEBAR_ANIMATION_SPEED_OPTIONS = [
    { id: 'sidebar-animation-speed-option-x1', value: 'x1', label: 'x1 (Normal)' },
    { id: 'sidebar-animation-speed-option-x0-5', value: 'x0.5', label: 'x0.5 (Rápida)' },
    { id: 'sidebar-animation-speed-option-x0', value: 'x0', label: 'x0 (Sin animación)' },
];

const AGENDA_COLOR_MODE_OPTIONS = [
    { id: 'color-mode-event-type', value: 'eventType', label: 'Por Tipo de Evento', icon: Calendar },
    { id: 'color-mode-case-type', value: 'caseType', label: 'Por Tipo de Caso', icon: Briefcase },
];

const SectionTitle = ({ children }) => (
    <h2 className="text-xl font-semibold text-(--text-primary) mb-6">{children}</h2>
);

const SettingRow = ({ label, description, children }) => (
    <div className="flex items-start justify-between gap-6 py-5 border-b border-(--border-default) last:border-b-0">
        <div className="flex-1">
            <p className="font-medium text-(--text-primary)">{label}</p>
            {description && (
                <p className="text-sm text-(--text-secondary) mt-0.5">{description}</p>
            )}
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

const Toggle = ({ checked, onChange, id }) => (
    <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
    >
        <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'
                }`}
        />
    </button>
);

const SettingsSelect = ({ id, value, onValueChange, options, placeholder = 'Seleccionar opción' }) => (
    <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger
            id={id}
            className="inline-flex min-w-[280px] max-w-[320px] items-center justify-between gap-2 rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) outline-none transition-colors hover:border-(--border-subtle) focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={placeholder}
        >
            <Select.Value placeholder={placeholder} />
            <Select.Icon>
                <ChevronDown className="h-4 w-4 text-(--text-secondary)" />
            </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
            <Select.Content className="z-50 min-w-[280px] overflow-hidden rounded-lg border border-(--border-default) bg-(--bg-card) shadow-lg">
                <Select.Viewport className="p-1">
                    {options.map((option) => (
                        <Select.Item
                            key={option.value}
                            id={option.id}
                            value={option.value}
                            className="relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-sm text-(--text-primary) outline-none transition-colors data-[highlighted]:bg-blue-500/10 data-[highlighted]:text-blue-600 dark:data-[highlighted]:text-blue-400"
                        >
                            <Select.ItemText>
                                <span className="inline-flex items-center gap-2">
                                    {option.icon ? createElement(option.icon, { className: 'h-4 w-4' }) : null}
                                    <span>{option.label}</span>
                                </span>
                            </Select.ItemText>
                            <Select.ItemIndicator className="absolute left-2 inline-flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Check className="h-4 w-4" />
                            </Select.ItemIndicator>
                        </Select.Item>
                    ))}
                </Select.Viewport>
            </Select.Content>
        </Select.Portal>
    </Select.Root>
);

function buildNotificationUiState(minutes) {
    if (minutes == null) {
        return {
            mode: 'preset',
            presetMinutes: null,
            customAmount: '',
            customUnit: 'minutes',
        };
    }

    if (minutes === 15 || minutes === 60 || minutes === 1440) {
        return {
            mode: 'preset',
            presetMinutes: minutes,
            customAmount: '',
            customUnit: 'minutes',
        };
    }

    const custom = fromMinutes(minutes);
    return {
        mode: 'custom',
        presetMinutes: 15,
        customAmount: custom.amount,
        customUnit: custom.unit,
    };
}

/**
 * Editor de escala global de la interfaz con ingreso manual y pasos rápidos.
 */
const InterfaceScaleControl = () => {
    const { interfaceScale, setInterfaceScale } = useSettings();
    const [draftValue, setDraftValue] = useState(() => String(interfaceScale));

    useEffect(() => {
        setDraftValue(String(interfaceScale));
    }, [interfaceScale]);

    const commitDraft = useCallback((value) => {
        if (!String(value).trim()) {
            setDraftValue(String(interfaceScale));
            return;
        }

        setInterfaceScale(value);
    }, [interfaceScale, setInterfaceScale]);

    const handleChange = useCallback((event) => {
        const nextValue = event.target.value.replace(/\D/g, '').slice(0, 3);
        setDraftValue(nextValue);
    }, []);

    const handleStep = useCallback((delta) => {
        const nextScale = shiftInterfaceScale(interfaceScale, delta);
        setInterfaceScale(nextScale);
    }, [interfaceScale, setInterfaceScale]);

    return (
        <div className="inline-flex items-center rounded-lg border border-(--border-default) bg-(--bg-card) shadow-sm h-9 w-[130px]">
            <button
                type="button"
                aria-label="Reducir escala de la interfaz"
                onClick={() => handleStep(-INTERFACE_SCALE_STEP)}
                disabled={interfaceScale <= INTERFACE_SCALE_MIN}
                className="flex items-center justify-center flex-none w-9 h-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-card-hover) disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-lg"
            >
                <Minus className="h-4 w-4" />
            </button>
            <div className="relative flex items-center flex-1 h-full border-x border-(--border-default) bg-(--bg-input)">
                <input
                    id="settings-interface-scale-input"
                    type="text"
                    inputMode="numeric"
                    value={draftValue}
                    onChange={handleChange}
                    onBlur={() => commitDraft(draftValue)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            commitDraft(draftValue);
                            event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                            setDraftValue(String(interfaceScale));
                            event.currentTarget.blur();
                        }
                    }}
                    className="w-full h-full border-0 bg-transparent p-0 pb-[1px] text-center text-sm font-medium text-(--text-primary) outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 pr-3"
                    aria-label="Escala de la interfaz"
                />
                <span className="absolute right-2 top-[50%] -translate-y-[50%] text-[11px] font-semibold text-(--text-secondary) pointer-events-none select-none">%</span>
            </div>
            <button
                type="button"
                aria-label="Aumentar escala de la interfaz"
                onClick={() => handleStep(INTERFACE_SCALE_STEP)}
                disabled={interfaceScale >= INTERFACE_SCALE_MAX}
                className="flex items-center justify-center flex-none w-9 h-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-card-hover) disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-lg"
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    );
};

const GeneralSection = () => {
    const { isDark, toggleTheme } = useTheme();
    const {
        sidebarMode,
        setSidebarMode,
        sidebarAnimationSpeed,
        setSidebarAnimationSpeed,
        showTutorials,
        setShowTutorials,
        tablePageAnimationsEnabled,
        setTablePageAnimationsEnabled,
        restoreTabs,
        setRestoreTabs,
    } = useSettings();

    return (
        <div>
            <SectionTitle>General</SectionTitle>
            <SettingRow
                label="Modo Oscuro"
                description="Cambia la apariencia de la aplicación entre tema claro y oscuro."
            >
                <div className="flex items-center gap-3">
                    <Sun className="h-4 w-4 text-(--text-secondary)" />
                    <Toggle id="toggle-dark-mode" checked={isDark} onChange={() => toggleTheme()} />
                    <Moon className="h-4 w-4 text-(--text-secondary)" />
                </div>
            </SettingRow>
            <SettingRow
                label="Escala de la interfaz"
                description="Ajusta el tamaño general de la app."
            >
                <InterfaceScaleControl />
            </SettingRow>
            <SettingRow
                label="Comportamiento del sidebar"
                description="Define cuándo se expande o se mantiene colapsado el menú lateral."
            >
                <SettingsSelect
                    id="sidebar-mode-select-trigger"
                    value={sidebarMode}
                    onValueChange={setSidebarMode}
                    options={SIDEBAR_BEHAVIOR_OPTIONS}
                    placeholder="Elegir comportamiento"
                />
            </SettingRow>
            <SettingRow
                label="Velocidad de animación del sidebar"
                description="Controla la velocidad de apertura/cierre o desactiva la animación."
            >
                <SettingsSelect
                    id="sidebar-animation-speed-select-trigger"
                    value={sidebarAnimationSpeed}
                    onValueChange={setSidebarAnimationSpeed}
                    options={SIDEBAR_ANIMATION_SPEED_OPTIONS}
                    placeholder="Elegir velocidad"
                />
            </SettingRow>
            <SettingRow
                label="Mostrar tutoriales"
                description="Muestra un ícono de ayuda junto al título de cada sección para abrir su tutorial."
            >
                <Toggle
                    id="toggle-show-tutorials"
                    checked={Boolean(showTutorials)}
                    onChange={setShowTutorials}
                />
            </SettingRow>
            <SettingRow
                label="Animación de páginas en tablas"
                description="Aplica una transición suave al avanzar o retroceder entre páginas de resultados."
            >
                <Toggle
                    id="toggle-table-animations"
                    checked={Boolean(tablePageAnimationsEnabled)}
                    onChange={setTablePageAnimationsEnabled}
                />
            </SettingRow>
            <SettingRow
                label="Restaurar pestañas al iniciar"
                description="Al abrir la aplicación, retoma las pestañas que tenías abiertas en la sesión anterior."
            >
                <Toggle
                    id="toggle-restore-tabs"
                    checked={Boolean(restoreTabs)}
                    onChange={setRestoreTabs}
                />
            </SettingRow>
            <SettingsCacheResetRow />
        </div>
    );
};

const AgendaSection = () => {
    const { user } = useAuth();
    const { agendas = [] } = useEvents();
    const { cases = [] } = useCases();
    const { users = [] } = useUsers();
    const {
        defaultAgendaView,
        setDefaultAgendaView,
        agendaColorMode,
        setAgendaColorMode,
        personalEventColor,
        setPersonalEventColor,
        defaultEventNotificationMinutes,
        setDefaultEventNotificationMinutes,
        lastEventNotificationMinutes,
    } = useSettings();
    const { personalAgendas, caseAgendas } = useMemo(
        () => splitVisibleAgendas(agendas, cases),
        [agendas, cases],
    );
    const usersById = useMemo(
        () => new Map((users || []).map((entry) => [String(entry.id), entry])),
        [users],
    );
    const agendaViewOptions = useMemo(() => {
        const options = [
            { id: 'agenda-default-option-all', value: ALL_AGENDAS_VIEW, label: 'Todas las agendas', icon: Calendar },
        ];

        personalAgendas.forEach((agenda) => {
            options.push({
                id: `agenda-default-option-personal-${agenda.id}`,
                value: String(agenda.id),
                label: getPersonalAgendaLabel({
                    agenda,
                    currentUser: user,
                    usersById,
                }),
                icon: UserCircle,
            });
        });

        caseAgendas.forEach((agenda) => {
            options.push({
                id: `agenda-default-option-case-${agenda.id}`,
                value: String(agenda.id),
                label: agenda?.name ? agenda.name.replace(/^Agenda:\s*/i, '') : `Agenda #${agenda.id}`,
                icon: Briefcase,
            });
        });

        return options;
    }, [personalAgendas, caseAgendas, user, usersById]);
    const selectedDefaultAgendaValue = useMemo(() => {
        if (agendaViewOptions.some((option) => option.value === String(defaultAgendaView))) {
            return String(defaultAgendaView);
        }
        return ALL_AGENDAS_VIEW;
    }, [agendaViewOptions, defaultAgendaView]);
    const [notificationConfig, setNotificationConfig] = useState(() => buildNotificationUiState(defaultEventNotificationMinutes));
    const [notificationError, setNotificationError] = useState('');

    const applyDefaultNotificationMinutes = useCallback((minutes) => {
        if (minutes == null) {
            setDefaultEventNotificationMinutes(null);
            setNotificationError('');
            return true;
        }

        const clamped = clampNotificationMinutes(minutes);
        if (clamped == null || clamped < NOTIFICATION_MINUTES_LIMITS.min || clamped > NOTIFICATION_MINUTES_LIMITS.max) {
            setNotificationError(`Debe estar entre ${NOTIFICATION_MINUTES_LIMITS.min} y ${NOTIFICATION_MINUTES_LIMITS.max} minutos.`);
            return false;
        }

        setDefaultEventNotificationMinutes(clamped);
        setNotificationError('');
        return true;
    }, [setDefaultEventNotificationMinutes]);

    const handleNotificationModeChange = useCallback((mode) => {
        if (mode === 'custom') {
            const seedMinutes = clampNotificationMinutes(defaultEventNotificationMinutes ?? lastEventNotificationMinutes ?? 15);
            const seed = fromMinutes(seedMinutes);
            setNotificationConfig({
                mode: 'custom',
                presetMinutes: 15,
                customAmount: seed.amount,
                customUnit: seed.unit,
            });
            applyDefaultNotificationMinutes(seedMinutes);
            return;
        }

        setNotificationConfig((prev) => ({ ...prev, mode: 'preset' }));
    }, [applyDefaultNotificationMinutes, defaultEventNotificationMinutes, lastEventNotificationMinutes]);

    const handleNotificationPresetChange = useCallback((minutes) => {
        if (minutes == null) {
            setNotificationConfig({
                mode: 'preset',
                presetMinutes: null,
                customAmount: '',
                customUnit: 'minutes',
            });
            applyDefaultNotificationMinutes(null);
            return;
        }

        setNotificationConfig({
            mode: 'preset',
            presetMinutes: Number(minutes),
            customAmount: '',
            customUnit: 'minutes',
        });
        applyDefaultNotificationMinutes(Number(minutes));
    }, [applyDefaultNotificationMinutes]);

    const handleCustomAmountChange = useCallback((amount) => {
        setNotificationConfig((prev) => ({ ...prev, customAmount: amount }));
        const minutes = toMinutes(amount, notificationConfig.customUnit);
        if (minutes == null) {
            setNotificationError('Debe ser un numero mayor a 0.');
            return;
        }
        applyDefaultNotificationMinutes(minutes);
    }, [applyDefaultNotificationMinutes, notificationConfig.customUnit]);

    const handleCustomUnitChange = useCallback((unit) => {
        setNotificationConfig((prev) => ({ ...prev, customUnit: unit }));
        const minutes = toMinutes(notificationConfig.customAmount, unit);
        if (minutes == null) {
            setNotificationError('Debe ser un numero mayor a 0.');
            return;
        }
        applyDefaultNotificationMinutes(minutes);
    }, [applyDefaultNotificationMinutes, notificationConfig.customAmount]);

    return (
        <div>
            <SectionTitle>Agenda</SectionTitle>
            <SettingRow
                label="Agenda visualizada por defecto"
                description="Selecciona la agenda inicial al abrir la aplicación."
            >
                <SettingsSelect
                    id="default-agenda-view-select-trigger"
                    value={selectedDefaultAgendaValue}
                    onValueChange={setDefaultAgendaView}
                    options={agendaViewOptions}
                    placeholder="Elegir agenda"
                />
            </SettingRow>
            <SettingRow
                label="Colorización de eventos"
                description="Define el criterio para colorear los eventos en el calendario."
            >
                <SettingsSelect
                    id="agenda-color-mode-select-trigger"
                    value={agendaColorMode}
                    onValueChange={setAgendaColorMode}
                    options={AGENDA_COLOR_MODE_OPTIONS}
                    placeholder="Elegir criterio"
                />
            </SettingRow>

            <div className="mt-6">
                <SettingRow
                    label="Notificacion predeterminada al crear un evento"
                    description="Define el recordatorio inicial para nuevos eventos. Puedes elegir No, presets o un valor personalizado."
                >
                    <div className="w-[320px]">
                        <NotificationConfigSection
                            title="Recordatorio predeterminado"
                            enabled
                            mode={notificationConfig.mode}
                            presetMinutes={notificationConfig.presetMinutes}
                            customAmount={notificationConfig.customAmount}
                            customUnit={notificationConfig.customUnit}
                            onModeChange={handleNotificationModeChange}
                            onPresetMinutesChange={handleNotificationPresetChange}
                            onCustomAmountChange={handleCustomAmountChange}
                            onCustomUnitChange={handleCustomUnitChange}
                            allowOffOption
                            showToggle={false}
                            error={notificationError}
                        />
                    </div>
                </SettingRow>

                <SettingRow
                    label="Color de eventos personales"
                    description="Color usado para eventos sin caso asociado (asuntos personales, recordatorios propios, etc.)."
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-lg border border-(--border-default) shadow-sm"
                            style={{ backgroundColor: personalEventColor }}
                        />
                        <input
                            id="personal-event-color-picker"
                            type="color"
                            value={personalEventColor}
                            onChange={(e) => setPersonalEventColor(e.target.value)}
                            className="w-10 h-10 rounded-lg border border-(--border-default) cursor-pointer p-0.5 bg-(--bg-card) appearance-none"
                            title="Elegir color"
                        />
                        <button
                            type="button"
                            onClick={() => setPersonalEventColor('#3b82f6')}
                            className="text-xs text-(--text-secondary) hover:text-(--text-primary) underline underline-offset-2 transition-colors"
                        >
                            Restablecer
                        </button>
                    </div>
                </SettingRow>
            </div>
        </div>
    );
};

const SectionsSection = () => (
    <SectionsPanel
        headingTag="h2"
        titleClassName="text-xl font-semibold text-(--text-primary)"
        descriptionClassName="text-sm text-(--text-secondary) mb-6"
        headerClassName="mb-3"
        dense={true}
    />
);

const ProfileSection = () => {
    const { user, updateUser, logout } = useAuth();
    const { apiHost, apiPort } = useApi();
    const { openDialog, dialogProps } = useConfirmDialog();
    const apiBase = (apiHost && apiPort) ? `http://${apiHost}:${apiPort}/api` : null;

    const {
        name, setName,
        lastName, setLastName,
        email, setEmail,
        password, setPassword,
        saving, setSaving,
        syncUser,
    } = useProfileFormState(user);

    const photoUrl = getProfilePhotoUrl(user?.profile_photo_path, apiBase);
    const initials = [user?.name, user?.last_name]
        .filter(Boolean).map(s => s.charAt(0).toUpperCase()).join('')
        || (user?.tag || 'U').charAt(0).toUpperCase();

    // Sincroniza el formulario con el usuario en un único dispatch → 1 re-render.
    useEffect(() => {
        syncUser(user);
    }, [user, syncUser]);



    const handleSave = async () => {
        if (!name.trim()) {
            showAppToast({ title: 'El nombre no puede estar vacío', variant: 'danger' });
            return;
        }

        if (password && password.length < 8) {
            showAppToast({ title: 'La nueva contraseña debe tener al menos 8 caracteres', variant: 'danger' });
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                last_name: lastName.trim() || null,
                email: email.trim() || null,
            };
            if (password) {
                payload.password = password;
            }
            const result = await updateProfile(payload);
            if (result.ok) {
                await updateUser(result.user);
                setPassword('');
                showAppToast({
                    title: 'Perfil actualizado',
                    description: password ? 'Los datos y la contraseña se guardaron correctamente.' : 'Los datos se guardaron correctamente.',
                    variant: 'success'
                });
            } else {
                showAppToast({ title: 'Error al guardar', description: result.error, variant: 'danger' });
            }
        } catch {
            showAppToast({ title: 'Error inesperado', variant: 'danger' });
        } finally {
            setSaving(false);
        }
    };

    const handleLogoutClick = () => {
        openDialog({
            title: 'Cerrar sesión',
            desc: '¿Estás seguro de que deseas cerrar tu sesión en la aplicación?',
            type: 'danger',
            confirmText: 'Cerrar sesión',
            onConfirm: async () => {
                await logout();
            },
        });
    };

    return (
        <div>
            <SectionTitle>Perfil</SectionTitle>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 mb-8">
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-3xl border-4 border-(--border-default) shadow-md">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{initials}</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    disabled
                                    className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-not-allowed"
                                >
                                    <Camera className="w-6 h-6 text-white" />
                                </button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>En desarrollo</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <p className="text-sm text-(--text-secondary)">Foto de perfil</p>
            </div>

            {/* Campos */}
            <SettingRow label="Nombre" description="Tu nombre visible en la aplicación.">
                <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre"
                    className="px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-48"
                />
            </SettingRow>

            <SettingRow label="Apellido" description="Opcional. Se usa para las iniciales del avatar.">
                <input
                    type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    placeholder="Apellido"
                    className="px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-48"
                />
            </SettingRow>

            <SettingRow label="Correo electrónico" description="Tu dirección de correo (debe ser única).">
                <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@dominio.com"
                    className="px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-48"
                />
            </SettingRow>

            <SettingRow label="Nueva contraseña" description="Déjalo vacío para no cambiarla. Mínimo 8 caracteres.">
                <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nueva contraseña..."
                    className="px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-48"
                />
            </SettingRow>

            <SettingRow label="Tag" description="Identificador de usuario. No se puede modificar.">
                <input
                    type="text" value={user?.tag || ''} readOnly
                    className="px-3 py-2 border border-(--border-subtle) rounded-lg bg-(--bg-card-hover) text-(--text-tertiary) text-sm w-48 cursor-not-allowed"
                />
            </SettingRow>

            <div className="flex justify-between items-center mt-6">
                <Button
                    onClick={handleLogoutClick}
                    variant="danger"
                    icon={LogOut}
                >
                    Cerrar sesión
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    isLoading={saving}
                    icon={Save}
                >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
            </div>
            <ConfirmDialog {...dialogProps} />
        </div>
    );
};



/** Color labels and their setting keys */
const DEADLINE_COLOR_LABELS = [
    { key: 'pendingNormal', label: 'Pendiente Normal', defaultColor: null, description: 'Sin tinte (fondo del tema)' },
    { key: 'pendingUrgent', label: 'Pendiente Urgente', defaultColor: '#f97316', description: 'Naranja' },
    { key: 'completed', label: 'Cumplido', defaultColor: '#9ca3af', description: 'Gris' },
    { key: 'postponedNormal', label: 'Prorrogado Normal', defaultColor: '#3b82f6', description: 'Azul' },
    { key: 'postponedUrgent', label: 'Prorrogado Urgente', defaultColor: '#f97316', description: 'Naranja' },
    { key: 'overdue', label: 'Vencido', defaultColor: '#ef4444', description: 'Rojo' },
];

const VencimientosSection = () => {
    const { deadlineColors, setDeadlineColors, urgentBlinkOnEntry, setUrgentBlinkOnEntry } = useSettings();

    const handleColorChange = (key, value) => {
        setDeadlineColors({ [key]: value === '' ? null : value });
    };

    const handleReset = (key, defaultColor) => {
        setDeadlineColors({ [key]: defaultColor });
    };

    return (
        <div>
            <SectionTitle>Vencimientos</SectionTitle>

            <SettingRow
                label="Parpadeo de vencimientos urgentes"
                description="Al entrar a la sección, las filas con prioridad Urgente parpadean en rojo durante 2 segundos."
            >
                <Toggle
                    id="urgent-blink-toggle"
                    checked={urgentBlinkOnEntry ?? true}
                    onChange={setUrgentBlinkOnEntry}
                />
            </SettingRow>

            <div className="mt-6">
                <p className="font-medium text-(--text-primary) mb-1">Colores por estado</p>
                <p className="text-sm text-(--text-secondary) mb-4">
                    Personaliza el color de fondo de cada categoría de vencimiento en la tabla.
                </p>
                <div className="space-y-3">
                    {DEADLINE_COLOR_LABELS.map(({ key, label, defaultColor, description }) => {
                        const currentColor = deadlineColors?.[key] ?? defaultColor;
                        return (
                            <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-(--border-subtle) last:border-b-0">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-(--text-primary)">{label}</p>
                                    <p className="text-xs text-(--text-secondary)">{description}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div
                                        className="w-7 h-7 rounded-md border border-(--border-default) shadow-sm"
                                        style={{ backgroundColor: currentColor ?? 'transparent' }}
                                    />
                                    {currentColor ? (
                                        <input
                                            type="color"
                                            value={currentColor}
                                            onChange={(e) => handleColorChange(key, e.target.value)}
                                            className="w-9 h-9 rounded-lg border border-(--border-default) cursor-pointer p-0.5 bg-(--bg-card) appearance-none"
                                            title={`Color para ${label}`}
                                        />
                                    ) : (
                                        <span className="text-xs text-(--text-tertiary) italic">Sin tinte</span>
                                    )}
                                    {currentColor !== defaultColor && (
                                        <button
                                            type="button"
                                            onClick={() => handleReset(key, defaultColor)}
                                            className="text-xs text-(--text-secondary) hover:text-(--text-primary) underline underline-offset-2 transition-colors"
                                        >
                                            Restablecer
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const BibliotecaSection = () => {
    const {
        libraryNewBadgeEnabled,
        setLibraryNewBadgeEnabled,
        libraryNewBadgeColor,
        setLibraryNewBadgeColor,
        libraryJumpAnimationEnabled,
        setLibraryJumpAnimationEnabled,
    } = useSettings();

    return (
        <div>
            <SectionTitle>Biblioteca</SectionTitle>
            <SettingRow
                label="Mostrar badge de 'Nuevo'"
                description="Muestra una etiqueta visual en los archivos que han sido agregados o modificados recientemente."
            >
                <Toggle
                    id="toggle-library-new-badge"
                    checked={libraryNewBadgeEnabled}
                    onChange={setLibraryNewBadgeEnabled}
                />
            </SettingRow>

            <SettingRow
                label="Color del badge 'Nuevo'"
                description="Personaliza el color de la etiqueta de notificación para archivos nuevos."
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-lg border border-(--border-default) shadow-sm"
                        style={{ backgroundColor: libraryNewBadgeColor }}
                    />
                    <input
                        id="library-new-badge-color-picker"
                        type="color"
                        value={libraryNewBadgeColor}
                        onChange={(e) => setLibraryNewBadgeColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-(--border-default) cursor-pointer p-0.5 bg-(--bg-card) appearance-none"
                    />
                    <button
                        type="button"
                        onClick={() => setLibraryNewBadgeColor('#f97316')}
                        className="text-xs text-(--text-secondary) hover:text-(--text-primary) underline underline-offset-2 transition-colors"
                    >
                        Restablecer
                    </button>
                </div>
            </SettingRow>

            <SettingRow
                label="Animación de salto"
                description="Los archivos nuevos o modificados realizarán un pequeño 'salto' al aparecer para llamar la atención."
            >
                <Toggle
                    id="toggle-library-jump-animation"
                    checked={libraryJumpAnimationEnabled}
                    onChange={setLibraryJumpAnimationEnabled}
                />
            </SettingRow>
        </div>
    );
};

const PlantillasSection = () => (
    <div>
        <SectionTitle>Plantillas</SectionTitle>
        <TemplateCapitalizationPanel />
    </div>
);

const SECTION_COMPONENTS = {
    perfil: ProfileSection,
    general: GeneralSection,
    secciones: SectionsSection,
    agenda: AgendaSection,
    vencimientos: VencimientosSection,
    biblioteca: BibliotecaSection,
    plantillas: PlantillasSection,
    hotkeys: HotkeysSettingsPanel,
};

const Settings = () => {
    const [activeCategory, setActiveCategory] = useState('perfil');
    const ActiveSection = SECTION_COMPONENTS[activeCategory];

    return (
        <SideMenuPageLayout
            title="Configuración"
            description="Personalizá la experiencia de la aplicación en este dispositivo."
            icon={SettingsIcon}
            sections={CATEGORIES}
            activeSection={activeCategory}
            onSectionChange={setActiveCategory}
            sectionIdPrefix="settings-tab"
            maxWidthClass="max-w-5xl"
        >
            <ActiveSection />
        </SideMenuPageLayout>
    );
};

export default Settings;
