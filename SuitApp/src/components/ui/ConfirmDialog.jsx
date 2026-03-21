import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const TYPE_CONFIG = {
    danger: {
        icon: AlertTriangle,
        iconClass: 'text-red-500 bg-red-50',
        titleClass: 'text-gray-900',
        buttonClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    },
    warning: {
        icon: AlertCircle,
        iconClass: 'text-amber-500 bg-amber-50',
        titleClass: 'text-gray-900',
        buttonClass: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400 text-white',
    },
    success: {
        icon: CheckCircle,
        iconClass: 'text-green-500 bg-green-50',
        titleClass: 'text-gray-900',
        buttonClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white',
    },
    info: {
        icon: Info,
        iconClass: 'text-blue-500 bg-blue-50',
        titleClass: 'text-gray-900',
        buttonClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white',
    },
};

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    cancelText = 'Cancelar',
    confirmText = 'Confirmar',
    onCancel,
    onConfirm,
    type = 'danger',
    loading = false
}) {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const Icon = config.icon;

    return (
        <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
            <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 bg-(--bg-overlay) backdrop-blur-sm z-[200] animate-in fade-in" />
                <AlertDialog.Content className="fixed left-[50%] top-[50%] z-[210] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-(--border-subtle) bg-(--bg-card) p-6 shadow-2xl duration-200 sm:rounded-2xl animate-in fade-in zoom-in-95">
                    <div className="flex gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${config.iconClass}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-1 flex flex-col gap-2">
                            <AlertDialog.Title className={`text-lg font-semibold leading-none tracking-tight ${config.titleClass === 'text-gray-900' ? 'text-(--text-primary)' : config.titleClass}`}>
                                {title}
                            </AlertDialog.Title>
                            <AlertDialog.Description className="text-sm text-(--text-secondary)">
                                {description}
                            </AlertDialog.Description>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 border-t border-(--border-subtle) pt-4">
                        <AlertDialog.Cancel disabled={loading} asChild>
                            <button
                                className="mt-2 inline-flex w-full justify-center rounded-lg bg-(--bg-card) px-4 py-2 text-sm font-semibold text-(--text-primary) shadow-sm ring-1 ring-inset ring-(--border-default) hover:bg-(--bg-card-hover) sm:mt-0 sm:w-auto transition-colors disabled:opacity-50"
                                onClick={onCancel}
                            >
                                {cancelText}
                            </button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action disabled={loading} asChild onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}>
                            <button className={`inline-flex w-full justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto transition-all disabled:opacity-50 ${config.buttonClass}`}>
                                {loading ? 'Cargando...' : confirmText}
                            </button>
                        </AlertDialog.Action>
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
}

