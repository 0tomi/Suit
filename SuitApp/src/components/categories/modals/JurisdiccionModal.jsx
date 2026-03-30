import { useEffect, useState } from 'react';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Plus } from 'lucide-react';
import { showAppToast } from '../../ui/show-app-toast.jsx';

/**
 * Modal para crear o editar una Jurisdicción.
 * No incluye botón de Cancelar por requerimiento.
 */
export default function JurisdiccionModal({ open, onClose, onSave, initialData = null }) {
    const [nombre, setNombre] = useState(initialData?.nombre || '');
    const [saving, setSaving] = useState(false);
    const [fieldError, setFieldError] = useState('');

    useEffect(() => {
        if (!open) {
            setSaving(false);
            setFieldError('');
            return;
        }

        setNombre(initialData?.nombre || '');
        setFieldError('');
        setSaving(false);
    }, [initialData, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) {
            setFieldError('El nombre de la jurisdicción es obligatorio.');
            showAppToast({ title: 'Campo obligatorio', description: 'Completá el nombre de la jurisdicción.', variant: 'danger' });
            return;
        }

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
                        Nombre de la Jurisdicción <span className="text-red-500">*</span>
                    </label>
                    <input
                        autoFocus
                        type="text"
                        value={nombre}
                        onChange={(e) => { setNombre(e.target.value); if (fieldError) setFieldError(''); }}
                        placeholder="Ej: Paraná, Concordia, Federal..."
                        className={`w-full h-11 rounded-xl border bg-(--bg-input) px-4 text-sm text-(--text-primary) shadow-sm focus:ring-2 focus:outline-none transition-all ${
                            fieldError
                                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
                                : 'border-(--border-default) focus:border-blue-500 focus:ring-blue-500/10'
                        }`}
                        required
                    />
                    {fieldError && <p className="mt-1.5 text-xs text-red-500">{fieldError}</p>}
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
