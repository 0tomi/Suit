import { useState } from 'react';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Plus } from 'lucide-react';

/**
 * Modal para crear o editar una Radicación.
 */
export default function RadicacionModal({ open, onClose, onSave, initialData = null }) {
    const [tipo, setTipo] = useState(initialData?.tipo || initialData?.name || initialData?.nombre_lugar || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tipo.trim()) return;

        setSaving(true);
        try {
            await onSave({ tipo: tipo.trim() });
            setTipo('');
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={initialData ? 'Editar Radicación' : 'Nueva Radicación'}
            subtitle="Las radicaciones representan el tipo de instancia o fuero mayor (ej: Provincial, Federal)."
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                    <label className="mb-2 block text-sm font-semibold text-(--text-secondary)">
                        Tipo de Radicación
                    </label>
                    <input
                        autoFocus
                        type="text"
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        placeholder="Ej: Provincial, Federal, Administrativo..."
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
                    {initialData ? 'Guardar Cambios' : 'Crear Radicación'}
                </Button>
            </form>
        </Modal>
    );
}
