import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Save, Settings, ShieldCheck, Info, HelpCircle } from 'lucide-react';
import { getSettings, updateSetting } from '../../services/adminService.js';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { Button } from '../ui/Button.jsx';

/**
 * Muestra un control numérico para una setting individual.
 * Permite editar el valor y guardarlo contra la API.
 */
function SettingNumberRow({ label, description, settingKey, currentValue, onSaved }) {
    const [value, setValue] = useState(String(currentValue ?? ''));
    const [saving, setSaving] = useState(false);

    // Sincroniza si el valor externo cambia (ej: recarga de settings)
    useEffect(() => {
        setValue(String(currentValue ?? ''));
    }, [currentValue]);

    const isDirty = value !== String(currentValue ?? '');

    const handleSave = useCallback(async () => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0) {
            showAppToast({ title: 'Valor inválido', description: 'Ingresá un número entero mayor o igual a 0.', variant: 'danger' });
            return;
        }
        setSaving(true);
        try {
            const res = await updateSetting(settingKey, String(num));
            if (!res.ok) throw new Error(res.data?.message || 'No se pudo guardar la configuración.');
            showAppToast({ title: 'Configuración guardada', variant: 'success' });
            onSaved(settingKey, String(num));
        } catch (err) {
            showAppToast({ title: 'Error', description: err.message, variant: 'danger' });
        } finally {
            setSaving(false);
        }
    }, [value, settingKey, onSaved]);

    return (
        <div className="flex items-center justify-between gap-6 rounded-xl border border-(--border-default) bg-(--bg-card) p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-(--text-primary)">{label}</p>
                <p className="mt-1 text-sm text-(--text-secondary) leading-relaxed">{description}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-24 rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-center text-sm font-bold text-(--text-primary) focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button
                    variant="primary"
                    icon={Save}
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                    className="min-w-[110px]"
                >
                    {saving ? 'Guardando' : 'Guardar'}
                </Button>
            </div>
        </div>
    );
}

/**
 * Tab de configuración del sistema en el panel admin.
 * Carga las settings desde la API y permite editarlas.
 */
const AdminSettingsTab = () => {
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const loadSettings = async () => {
            setLoading(true);
            setLoadError('');

            try {
                const loadedSettings = await getSettings();
                if (cancelled) return;
                setSettings(loadedSettings);
            } catch (error) {
                if (cancelled) return;
                setSettings([]);
                setLoadError(error?.message || 'No se pudieron cargar las configuraciones del sistema.');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadSettings();

        return () => {
            cancelled = true;
        };
    }, []);

    /** Actualiza el valor local tras un guardado exitoso sin recargar todo. */
    const handleSaved = useCallback((key, newValue) => {
        setSettings((prev) => {
            const exists = prev.some((setting) => setting.key === key);
            if (exists) {
                return prev.map((setting) => (setting.key === key ? { ...setting, value: newValue } : setting));
            }

            return [...prev, { key, value: newValue, description: '' }];
        });
    }, []);

    /**
     * Busca la configuración por una lista de claves posibles.
     * Si el sistema retorna una clave histórica, la seguimos aceptando.
     */
    const findSettingByKeys = useCallback((keys) => {
        for (const key of keys) {
            const found = settings.find((setting) => setting.key === key);
            if (found) return found;
        }
        return null;
    }, [settings]);

    const urgencySettingRaw = findSettingByKeys([
        'deadline_urgency_days',
        'deadlines_urgency_days',
        'deadline_urgent_days',
    ]);

    const clientMorosoSettingRaw = findSettingByKeys([
        'client_moroso_threshold_days',
        'client_overdue_threshold_days',
    ]);

    const urgencySetting = {
        key: urgencySettingRaw?.key || 'deadline_urgency_days',
        value: urgencySettingRaw?.value || '3',
        existsInSystem: Boolean(urgencySettingRaw),
    };

    const clientMorosoSetting = {
        key: clientMorosoSettingRaw?.key || 'client_moroso_threshold_days',
        value: clientMorosoSettingRaw?.value || '30',
        existsInSystem: Boolean(clientMorosoSettingRaw),
    };

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-2xl border border-(--border-default) bg-(--bg-card)">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
                    <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />
                </div>
                <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                            <Settings className="h-3.5 w-3.5" />
                            Configuración Global
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold text-(--text-primary)">Ajustes del Sistema</h2>
                        <p className="mt-2 text-sm text-(--text-secondary)">
                            Gestiona parámetros que afectan el comportamiento de todos los usuarios de la firma.
                        </p>
                    </div>
                </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/5">
                        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Advertencia de privilegios</p>
                            <p className="text-sm text-amber-800 dark:text-amber-300/80 leading-relaxed">
                                Los cambios aquí afectan el comportamiento global del sistema. Procedé con precaución ya que impactará en la visualización de todos los usuarios.
                            </p>
                        </div>
                    </div>

                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="h-4 w-1 rounded-full bg-blue-500" />
                            <h4 className="text-sm font-bold uppercase tracking-widest text-(--text-secondary)">Vencimientos</h4>
                        </div>
                        
                        <div className="space-y-3">
                            {loading ? (
                                <div className="rounded-xl border border-(--border-default) bg-(--bg-card) p-8 text-center text-sm text-(--text-tertiary) animate-pulse">
                                    Cargando configuración...
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {loadError ? (
                                        <div className="rounded-xl border border-(--border-default) bg-red-50 p-5 text-sm text-red-700">
                                            {loadError}
                                        </div>
                                    ) : null}

                                    <div className="space-y-3">
                                        <SettingNumberRow
                                            label="Días de urgencia"
                                            description={urgencySetting.existsInSystem
                                                ? 'Define cuántos días antes de un vencimiento se lo marcará como urgente.'
                                                : 'Define cuántos días antes de un vencimiento se lo marcará como urgente. Si esta opción aún no existe, se crea al guardar.'}
                                            settingKey={urgencySetting.key}
                                            currentValue={urgencySetting.value}
                                            onSaved={handleSaved}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1 pt-2">
                                            <div className="h-3 w-1 rounded-full bg-emerald-500" />
                                            <h5 className="text-xs font-bold uppercase tracking-wider text-(--text-secondary)">Clientes</h5>
                                        </div>

                                        <SettingNumberRow
                                            label="Días para estado moroso"
                                            description={clientMorosoSetting.existsInSystem
                                                ? 'Define desde cuántos días sin entrega un cliente pasa a estado moroso.'
                                                : 'Define desde cuántos días sin entrega un cliente pasa a estado moroso. Si esta opción aún no existe, se crea al guardar.'}
                                            settingKey={clientMorosoSetting.key}
                                            currentValue={clientMorosoSetting.value}
                                            onSaved={handleSaved}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-(--border-default) bg-(--bg-card) p-5 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-blue-500" />
                            <h3 className="text-lg font-semibold text-(--text-primary)">Información</h3>
                        </div>
                        <p className="mt-3 text-sm text-(--text-secondary) leading-relaxed">
                            Estas configuraciones se sincronizan automáticamente con el Sistema central. Una vez guardado un valor, se aplicará la próxima vez que los usuarios actualicen la aplicación.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-(--border-default) bg-(--bg-card) p-5 shadow-sm">
                        <div className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                            <h3 className="text-lg font-semibold text-(--text-primary)">Ayuda</h3>
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-(--text-secondary)">
                            <li className="flex gap-2">
                                <span className="font-bold text-blue-500">•</span>
                                <span>Los días de urgencia afectan el color de las alertas en la agenda.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-blue-500">•</span>
                                <span>Los días de morosidad determinan cuándo un cliente pasa a estado moroso.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-blue-500">•</span>
                                <span>Valores mayores a 30 días pueden saturar el panel de notificaciones.</span>
                            </li>
                        </ul>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default AdminSettingsTab;
