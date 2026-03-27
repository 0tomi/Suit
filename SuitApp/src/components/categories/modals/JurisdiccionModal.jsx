import { useState } from 'react';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Plus } from 'lucide-react';

/**
 * Modal para crear o editar una Jurisdicción.
 * No incluye botón de Cancelar por requerimiento.
 */
export default function JurisdiccionModal({ open, onClose, onSave, initialData = null }) {
    const [nombre, setNombre] = useState(initialData?.nombre || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;

        setSaving(true);
        try {
            await onSave({ nombre: nombre.trim() });
            setNombre('');
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={initialData ? 'Editar Jurisdicción' : 'Nueva Jurisdicción'}
            subtitle="Las jurisdicciones permiten agrupar juzgados por zona o competencia territorial."
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                    <label className="mb-2 block text-sm font-semibold text-(--text-secondary)">
                        Nombre de la Jurisdicción
                    </label>
                    <input
                        autoFocus
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej: Paraná, Concordia, Federal..."
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
                    {initialData ? 'Guardar Cambios' : 'Crear Jurisdicción'}
                </Button>
            </form>
        </Modal>
    );
}
