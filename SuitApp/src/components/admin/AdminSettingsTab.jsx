import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
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
        <div className="flex items-center justify-between gap-6 rounded-lg border border-(--border-default) bg-(--bg-card) p-5 shadow-sm">
            <div className="flex-1 min-w-0">
                <p className="font-medium text-(--text-primary)">{label}</p>
                <p className="mt-0.5 text-sm text-(--text-secondary)">{description}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-20 rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-center text-sm font-semibold text-(--text-primary) focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button
                    variant="primary"
                    icon={Save}
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                >
                    {saving ? 'Guardando...' : 'Guardar'}
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

    useEffect(() => {
        getSettings()
            .then(setSettings)
            .finally(() => setLoading(false));
    }, []);

    /** Actualiza el valor local tras un guardado exitoso sin recargar todo. */
    const handleSaved = useCallback((key, newValue) => {
        setSettings((prev) =>
            prev.map((s) => (s.key === key ? { ...s, value: newValue } : s))
        );
    }, []);

    const urgencySetting = settings.find((s) => s.key === 'deadline_urgency_days');

    return (
        <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-sm text-amber-800">
                    Los cambios aquí afectan el comportamiento global del sistema para todos los usuarios.
                </p>
            </div>

            <section>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Vencimientos</h4>
                <div className="space-y-3">
                    {loading ? (
                        <div className="rounded-lg border border-(--border-default) bg-(--bg-card) p-5 text-sm text-(--text-tertiary)">Cargando configuración...</div>
                    ) : urgencySetting ? (
                        <SettingNumberRow
                            label="Días de urgencia"
                            description="Días restantes antes del vencimiento a partir de los cuales la prioridad se eleva automáticamente a Urgente."
                            settingKey="deadline_urgency_days"
                            currentValue={urgencySetting.value}
                            onSaved={handleSaved}
                        />
                    ) : (
                        <div className="rounded-lg border border-(--border-default) bg-(--bg-card) p-5 text-sm text-(--text-tertiary)">No se encontró la configuración.</div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AdminSettingsTab;
