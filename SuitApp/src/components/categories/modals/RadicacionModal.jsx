import { useState } from 'react';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Plus } from 'lucide-react';
import { showAppToast } from '../../ui/show-app-toast.jsx';

/**
 * Modal para crear o editar una Radicación.
 */
export default function RadicacionModal({ open, onClose, onSave, initialData = null }) {
    const [tipo, setTipo] = useState(initialData?.tipo || initialData?.name || initialData?.nombre_lugar || '');
    const [saving, setSaving] = useState(false);
    const [fieldError, setFieldError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tipo.trim()) {
            setFieldError('El tipo de radicación es obligatorio.');
            showAppToast({ title: 'Campo obligatorio', description: 'Completá el tipo de radicación.', variant: 'danger' });
            return;
        }

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
                        Tipo de Radicación <span className="text-red-500">*</span>
                    </label>
                    <input
                        autoFocus
                        type="text"
                        value={tipo}
                        onChange={(e) => { setTipo(e.target.value); if (fieldError) setFieldError(''); }}
                        placeholder="Ej: Provincial, Federal, Administrativo..."
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
                    {initialData ? 'Guardar Cambios' : 'Crear Radicación'}
                </Button>
            </form>
        </Modal>
    );
}
