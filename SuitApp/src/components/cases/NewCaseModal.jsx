import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import NewCaseForm from './NewCaseForm';
import { Briefcase, X } from 'lucide-react';

export function NewCaseModal({ open = false, onClose, closeModal, onSuccess }) {
    const isStackedModal = typeof closeModal === 'function';
    const handleClose = closeModal || onClose;

    const footer = (
        <div className="flex w-full justify-center">
            <Button
                type="submit"
                form="new-case-form"
                icon={Briefcase}
                className="px-8"
            >
                Crear Expediente
            </Button>
        </div>
    );

    const formContent = (
        <NewCaseForm
            onSuccess={onSuccess}
            onClose={handleClose}
            showFooter={false}
        />
    );

    if (isStackedModal) {
        return (
            <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-(--border-subtle) bg-(--bg-header) px-6 py-4">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-(--text-primary)">Iniciar Nuevo Caso</h2>
                        <p className="mt-1 text-sm text-(--text-secondary)">Completá la información básica para dar de alta el expediente.</p>
                    </div>
                    <button
                        onClick={handleClose}
                        type="button"
                        className="text-(--text-tertiary) hover:text-red-500 transition-colors p-1 rounded-md hover:bg-(--bg-card-hover)"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {formContent}
                </div>
                <div className="flex justify-center border-t border-(--border-subtle) bg-(--bg-header) px-6 py-4">
                    {footer}
                </div>
            </div>
        );
    }

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="Iniciar Nuevo Caso"
            subtitle="Completá la información básica para dar de alta el expediente del caso."
            maxWidth="max-w-5xl"
            maxHeight="max-h-[95vh]"
            footer={footer}
        >
            {formContent}
        </Modal>
    );
}
