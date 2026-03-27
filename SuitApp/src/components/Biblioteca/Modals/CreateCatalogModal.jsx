import { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export const CreateCatalogModal = ({
    open,
    loading,
    onClose,
    onCreate,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        await onCreate({ name: name.trim(), description: description.trim() || null });
        if (!loading) {
            setName('');
            setDescription('');
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Crear Catálogo"
            maxWidth="max-w-xl"
            footer={(
                <Button
                    type="submit"
                    form="create-catalog-form"
                    disabled={loading || !name.trim()}
                    isLoading={loading}
                >
                    Crear
                </Button>
            )}
        >
            <form id="create-catalog-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="catalog-name" className="block text-sm font-medium text-(--text-secondary) mb-1">
                        Nombre *
                    </label>
                    <input
                        id="catalog-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Acuerdos, Documentación Clientes"
                        autoFocus
                    />
                </div>
                <div>
                    <label htmlFor="catalog-desc" className="block text-sm font-medium text-(--text-secondary) mb-1">
                        Descripción (Opcional)
                    </label>
                    <textarea
                        id="catalog-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24 resize-y"
                        placeholder="Una breve descripción del uso de este catálogo"
                    />
                </div>
            </form>
        </Modal>
    );
};
