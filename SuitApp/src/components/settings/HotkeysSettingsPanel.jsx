import { useMemo, useState } from 'react';
import { RotateCcw, Keyboard } from 'lucide-react';
import { useHotkeysSystem } from '../../hotkeys/useHotkeysSystem';
import { showAppToast } from '../ui/show-app-toast.jsx';

const SCOPE_LABELS = {
    global: 'Global',
    clientes: 'Clientes',
    casos: 'Casos',
    agenda: 'Agenda',
    documentos: 'Documentos',
    sistema: 'Sistema',
};

const normalizeRecordKey = (key) => {
    if (key === ' ') return 'space';
    if (key === 'escape') return 'esc';
    if (key === '+') return '+';
    return key;
};

const HotkeyRecorder = ({ value, hotkeyId, allHotkeys, onChange }) => {
    const [recording, setRecording] = useState(false);

    const handleKeyDown = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const modifiers = [];
        if (event.ctrlKey || event.metaKey) modifiers.push('mod');
        if (event.shiftKey) modifiers.push('shift');
        if (event.altKey) modifiers.push('alt');

        const key = event.key.toLowerCase();
        if (['control', 'shift', 'alt', 'meta', 'os'].includes(key)) {
            return;
        }

        if ((key === 'backspace' || key === 'delete') && modifiers.length === 0) {
            setRecording(false);
            onChange('');
            return;
        }

        const canonicalKey = normalizeRecordKey(key);
        const combo = [...modifiers, canonicalKey].join('+');

        const collision = allHotkeys.find((hotkey) => hotkey.id !== hotkeyId && hotkey.keys === combo);
        if (collision) {
            setRecording(false);
            showAppToast({
                title: 'Atajo en uso',
                description: `La combinacion "${combo}" ya esta asignada a "${collision.desc}".`,
                variant: 'warning',
            });
            return;
        }

        setRecording(false);
        onChange(combo);
    };

    return (
        <button
            type="button"
            className={`w-[200px] shrink-0 rounded-lg border px-3 py-2 text-center text-sm font-medium uppercase tracking-wide outline-none transition-colors 
                ${recording
                    ? 'border-blue-500 bg-blue-50/50 text-blue-700 ring-2 ring-blue-500/50 dark:bg-blue-500/20 dark:text-blue-300'
                    : 'border-(--border-default) bg-(--bg-input) text-(--text-secondary) hover:border-(--border-subtle) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-blue-500/50'
                }`}
            onClick={() => setRecording(true)}
            onKeyDown={recording ? handleKeyDown : undefined}
            onBlur={() => setRecording(false)}
        >
            {recording ? 'Presiona teclas...' : (value ? value.replace(/mod/g, 'Ctrl').toUpperCase() : 'Ninguno')}
        </button>

    );
};

export const HotkeysSettingsPanel = () => {
    const { hotkeysConfig, updateHotkey, resetHotkeys, isEnabled, toggleHotkeys } = useHotkeysSystem();

    const groupedHotkeys = useMemo(() => {
        return hotkeysConfig.reduce((acc, hotkey) => {
            const scope = hotkey.scope || 'global';
            if (!acc[scope]) acc[scope] = [];
            acc[scope].push(hotkey);
            return acc;
        }, {});
    }, [hotkeysConfig]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-(--border-default) bg-(--bg-card) p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-(--text-primary)">Atajos personalizables</h3>
                    <p className="text-sm text-(--text-secondary)">Ajusta cada combinacion segun tus preferencias para agilizar tareas juridicas frecuentes.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={toggleHotkeys}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${isEnabled ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-500/20' : 'border-(--border-subtle) text-(--text-secondary)'}`}
                        style={isEnabled ? { color: '#000000' } : {}}
                    >
                        <Keyboard className={`h-4 w-4 ${isEnabled ? 'text-black' : ''}`} />
                        <span className={isEnabled ? 'text-black' : ''}>
                            {isEnabled ? 'Atajos activos' : 'Atajos deshabilitados'}
                        </span>
                    </button>



                    <button
                        type="button"
                        onClick={resetHotkeys}
                        className="inline-flex items-center gap-2 rounded-lg border border-(--border-default) px-3 py-2 text-sm text-(--text-primary) transition-colors hover:bg-(--bg-card-hover)"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Restablecer
                    </button>
                </div>
            </div>

            <div className="space-y-5">
                {Object.entries(groupedHotkeys).map(([scope, items]) => (
                    <div key={scope} className="overflow-hidden rounded-2xl border border-(--border-default) shadow-sm">
                        <div className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-4 py-2 text-sm font-semibold uppercase tracking-wide text-(--text-tertiary)">
                            {SCOPE_LABELS[scope] || scope}
                        </div>
                        <div className="divide-y divide-(--border-subtle)">
                            {items.map((hotkey) => (
                                <div key={hotkey.id} className="flex items-center justify-between gap-4 px-4 py-3">
                                    <p className="font-medium text-(--text-primary)">{hotkey.desc}</p>
                                    <HotkeyRecorder
                                        value={hotkey.keys}
                                        hotkeyId={hotkey.id}
                                        allHotkeys={hotkeysConfig}
                                        onChange={(newKeys) => updateHotkey(hotkey.id, newKeys)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HotkeysSettingsPanel;
