import { X } from 'lucide-react';
import { useHotkeysSystem } from '../../hotkeys/useHotkeysSystem';

const formatKeys = (keys) => (
    keys.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
);

export const HotkeysHelpModal = ({ isOpen, onClose }) => {
    const { hotkeysConfig, currentScope } = useHotkeysSystem();

    if (!isOpen) return null;

    const visibleHotkeys = hotkeysConfig.filter(
        (hotkey) => hotkey.scope === 'global' || hotkey.scope === currentScope,
    );
    const handleOverlayClick = (event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 z-[95] flex items-center justify-center bg-(--bg-overlay) backdrop-blur-sm px-4 py-8"
            onClick={handleOverlayClick}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onClose();
                }
            }}
        >
            <div 
                className="w-full max-w-3xl rounded-2xl border border-(--border-default) bg-(--bg-card) shadow-2xl"
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between border-b border-(--border-subtle) px-6 py-4">
                    <div>
                        <h2 className="text-xl font-semibold text-(--text-primary)">Atajos disponibles</h2>
                        <p className="text-sm text-(--text-secondary)">Mostrando atajos globales y del contexto “{currentScope}”.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-(--text-tertiary) transition-colors hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto p-6">
                    <div className="grid gap-3">
                        {visibleHotkeys.map((hotkey) => (
                            <div key={hotkey.id} className="flex flex-col gap-1 rounded-xl border border-(--border-subtle) p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-medium text-(--text-primary)">{hotkey.desc}</p>
                                    <p className="text-xs uppercase tracking-wide text-(--text-tertiary)">{hotkey.scope}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formatKeys(hotkey.keys).map((combo) => (
                                        <kbd
                                            key={`${hotkey.id}-${combo}`}
                                            className="rounded border border-(--border-default) bg-(--bg-card-hover) px-2 py-1 font-mono text-xs text-(--text-secondary)"
                                        >
                                            {combo.toUpperCase()}
                                        </kbd>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {visibleHotkeys.length === 0 && (
                            <div className="rounded-xl border border-dashed border-(--border-subtle) px-4 py-6 text-center text-sm text-(--text-secondary)">
                                No hay atajos definidos para este contexto.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HotkeysHelpModal;
