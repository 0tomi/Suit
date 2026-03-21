import { useMemo, useState, useCallback } from 'react';
import { Search, Loader2, UserPlus, Check, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';

const EMPTY_ITEMS = [];

/**
 * Componente genérico para seleccionar personas (clientes o partes) y vincularlas a un caso.
 * Proporciona una lista con búsqueda, multi-selección y una opción para crear un nuevo registro.
 */
export default function AddCasePersonModal({
    open = true, 
    onClose,
    title,
    subtitle,
    items = EMPTY_ITEMS, // Array de { id, label, sublabel, data }
    onSelect,
    onCreateNew,
    createNewText = 'Crear nuevo',
    createNewIcon: CreateNewIcon = UserPlus,
    linkingId = null, 
    placeholder = 'Buscar...',
    emptyMessage = 'No se encontraron resultados.',
    noOverlay = false,
    multiSelect = false,
    confirmText = 'Vincular seleccionados',
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);

    const filteredItems = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return items;
        
        return items.filter(item => {
            const label = (item.label || '').toLowerCase();
            const sublabel = (item.sublabel || '').toLowerCase();
            return label.includes(normalized) || sublabel.includes(normalized);
        });
    }, [items, searchTerm]);

    const toggleItem = useCallback((item) => {
        if (linkingId) return;

        if (!multiSelect) {
            onSelect?.(item.data || item);
            return;
        }

        setSelectedItems(prev => {
            const isSelected = prev.some(si => String(si.id) === String(item.id));
            if (isSelected) {
                return prev.filter(si => String(si.id) !== String(item.id));
            }
            return [...prev, item];
        });
    }, [linkingId, multiSelect, onSelect]);

    const handleConfirm = useCallback(() => {
        selectedItems.forEach(item => {
            onSelect?.(item.data || item);
        });
        onClose();
    }, [onSelect, selectedItems, onClose]);

    const footer = (
        <div className="flex w-full items-center justify-center gap-4">
            {multiSelect ? (
                <>
                    <Button 
                        variant="ghost" 
                        onClick={onCreateNew} 
                        icon={CreateNewIcon}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                        {createNewText}
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={handleConfirm}
                        disabled={selectedItems.length === 0 || !!linkingId}
                        icon={Plus}
                        className="min-w-[200px]"
                    >
                        {confirmText}
                    </Button>
                </>
            ) : (
                <Button 
                    variant="ghost" 
                    onClick={onCreateNew} 
                    icon={CreateNewIcon}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                    {createNewText}
                </Button>
            )}
        </div>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            subtitle={subtitle}
            maxWidth="max-w-xl"
            noOverlay={noOverlay}
            footer={footer}
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                        <Input
                            placeholder={placeholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    {multiSelect && selectedItems.length > 0 && (
                        <div className="flex items-center gap-2 px-1">
                            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-medium text-blue-600">
                                {selectedItems.length} seleccionado(s) para vincular
                            </span>
                        </div>
                    )}
                </div>

                <div className="max-h-80 min-h-[180px] overflow-y-auto rounded-xl border border-(--border-default) bg-(--bg-page)">
                    {filteredItems.length > 0 ? (
                        <div className="divide-y divide-(--border-default)">
                            {filteredItems.map((item) => {
                                const isLinking = linkingId && String(linkingId) === String(item.id);
                                const isSelected = selectedItems.some(si => String(si.id) === String(item.id));

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        disabled={!!linkingId}
                                        onClick={() => toggleItem(item)}
                                        className={`flex w-full items-center justify-between p-4 text-left transition-all ${
                                            isSelected ? 'bg-blue-50/70 border-l-4 border-blue-500' : 'hover:bg-(--bg-card-hover)'
                                        }`}
                                    >
                                        <div className="min-w-0 pr-4">
                                            <p className={`font-semibold transition-colors ${isSelected ? 'text-blue-700' : 'text-(--text-primary)'}`}>
                                                {item.label}
                                            </p>
                                            {item.sublabel && (
                                                <p className="mt-0.5 text-xs text-(--text-tertiary)">
                                                    {item.sublabel}
                                                </p>
                                            )}
                                        </div>
                                        <div className="shrink-0">
                                            {isLinking ? (
                                                <Loader2 size={18} className="animate-spin text-blue-500" />
                                            ) : isSelected ? (
                                                <div className="bg-blue-600 text-white rounded-full p-0.5">
                                                    <Check size={16} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <Plus size={18} className="text-(--text-tertiary) group-hover:text-blue-500 transition-colors" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-(--text-tertiary)">
                            <Search className="mb-2 h-10 w-10 opacity-20" />
                            <p className="text-sm">{emptyMessage}</p>
                            {searchTerm && (
                                <p className="text-xs mt-1 text-(--text-tertiary) opacity-70">
                                    Probá con otros términos o cargá uno nuevo desde el botón inferior.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
