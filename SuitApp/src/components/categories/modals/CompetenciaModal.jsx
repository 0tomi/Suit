import { useState } from 'react';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Plus } from 'lucide-react';

/**
 * Modal para crear o editar una Competencia (Fuero).
 * No incluye botón de Cancelar por requerimiento.
 */
export default function CompetenciaModal({ open, onClose, onSave, initialData = null }) {
    const [fuero, setFuero] = useState(initialData?.fuero || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!fuero.trim()) return;

        setSaving(true);
        try {
            await onSave({ fuero: fuero.trim() });
            setFuero('');
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={initialData ? 'Editar Competencia' : 'Nueva Competencia'}
            subtitle="Las competencias (fueros) definen la especialidad de los juzgados."
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                    <label className="mb-2 block text-sm font-semibold text-(--text-secondary)">
                        Nombre de la Competencia / Fuero
                    </label>
                    <input
                        autoFocus
                        type="text"
                        value={fuero}
                        onChange={(e) => setFuero(e.target.value)}
                        placeholder="Ej: Civil y Comercial, Laboral, Familia..."
                        className="w-full h-11 rounded-xl border border-(--border-default) bg-(--bg-input) px-4 text-sm text-(--text-primary) shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
                        required
                    />
                </div>

                <Button
                    type="submit"
                    icon={Plus}
                    isLoading={saving}
                    className="w-full h-11 justify-center shadow-lg shadow-blue-500/10"
                >
                    {initialData ? 'Guardar Cambios' : 'Crear Competencia'}
                </Button>
            </form>
        </Modal>
    );
}
