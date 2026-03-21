import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Trash2 } from 'lucide-react';

const AgendaEventDeleteDialog = ({ saving, handleDelete }) => {
    return (
        <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
                <button
                    disabled={saving}
                    className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                    <Trash2 size={16} /> Eliminar
                </button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-in fade-in" />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-[70] w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                    <AlertDialog.Title className="text-lg font-bold text-gray-900 mb-2">
                        ¿Eliminar evento?
                    </AlertDialog.Title>
                    <AlertDialog.Description className="text-sm text-gray-500 mb-6">
                        Esta acción es irreversible y el evento será borrado de la aplicación.
                    </AlertDialog.Description>
                    <div className="flex justify-end gap-3">
                        <AlertDialog.Cancel asChild>
                            <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
                                Cancelar
                            </button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action asChild>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Sí, eliminar
                            </button>
                        </AlertDialog.Action>
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
};

export default AgendaEventDeleteDialog;
