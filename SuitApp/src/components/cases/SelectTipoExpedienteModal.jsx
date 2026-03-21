import { useState, useMemo } from 'react';
import { useTipoExpedientes } from '../../context/TipoExpedientesContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Search, Check, Plus } from 'lucide-react';

const EMPTY_IDS = [];

/**
 * Modal para vincular tipos de expediente a un caso, filtrados por fuero.
 */
export function SelectTipoExpedienteModal({ closeModal, onSelected, caseTypeId, caseTypeName, alreadySelectedIds = EMPTY_IDS }) {
    const { tipo_expedientes: tipos = [] } = useTipoExpedientes();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const hasCaseTypeSelected = Boolean(caseTypeId);

    const filteredTipos = useMemo(() => {
        const tiposByCaseType = hasCaseTypeSelected
            ? tipos.filter((tipo) => String(tipo.case_type_id || '') === String(caseTypeId))
            : [];

        if (!normalizedSearch) return tiposByCaseType;

        return tiposByCaseType.filter((tipo) =>
            (tipo.title || '').toLowerCase().includes(normalizedSearch)
        );
    }, [caseTypeId, hasCaseTypeSelected, normalizedSearch, tipos]);

    const toggleItem = (tipo) => {
        setSelectedItems(prev => {
            const isSelected = prev.some(item => String(item.id) === String(tipo.id));
            if (isSelected) {
                return prev.filter(item => String(item.id) !== String(tipo.id));
            }
            return [...prev, tipo];
        });
    };

    const handleAdd = () => {
        selectedItems.forEach(item => onSelected(item));
        closeModal();
    };

    return (
        <Modal
            open={true}
            onClose={closeModal}
            title="Vincular Tipos de Expediente"
            subtitle={hasCaseTypeSelected
                ? `Elegí uno o más tipos del fuero ${caseTypeName || 'seleccionado'}.`
                : 'Primero seleccioná un fuero para filtrar los tipos.'}
            maxWidth="max-w-xl"
            noOverlay={true}
            footer={
                <div className="flex w-full justify-center">
                    <Button 
                        variant="primary" 
                        onClick={handleAdd} 
                        disabled={selectedItems.length === 0}
                        icon={Plus}
                        className="min-w-[200px]"
                    >
                        Vincular seleccionados
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                        <input
                            placeholder="Buscar por título..."
                            disabled={!hasCaseTypeSelected}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-(--border-subtle) rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-(--bg-input) text-(--text-primary)"
                        />
                    </div>
                    {selectedItems.length > 0 && (
                        <div className="flex items-center gap-2 px-1">
                            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-medium text-blue-600">
                                {selectedItems.length} tipo(s) seleccionado(s) para vincular
                            </span>
                        </div>
                    )}
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border border-(--border-subtle) bg-(--bg-card-hover)/30">
                    <ul className="divide-y divide-(--border-subtle)">
                        {filteredTipos.length > 0 ? (
                            filteredTipos.map(tipo => {
                                const isSelected = selectedItems.some(item => String(item.id) === String(tipo.id));
                                const isAlreadyLinked = alreadySelectedIds.some(id => String(id) === String(tipo.id));

                                return (
                                    <li key={tipo.id}>
                                        <button
                                            type="button"
                                            disabled={isAlreadyLinked}
                                            onClick={() => toggleItem(tipo)}
                                            className={`w-full text-left p-4 transition-colors group flex items-center justify-between ${
                                                isSelected ? 'bg-blue-50/50' : 'hover:bg-white'
                                            } ${isAlreadyLinked ? 'opacity-50 grayscale' : ''}`}
                                        >
                                            <div className="min-w-0 pr-4">
                                                <p className={`font-medium transition-colors ${
                                                    isSelected ? 'text-blue-700' : 'text-(--text-primary)'
                                                }`}>
                                                    {tipo.title}
                                                </p>
                                                {isAlreadyLinked && (
                                                    <p className="text-xs text-amber-600 font-medium">Ya vinculado a este caso</p>
                                                )}
                                            </div>
                                            {isSelected && <Check className="h-5 w-5 text-blue-600" />}
                                            {!isSelected && !isAlreadyLinked && <Plus className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />}
                                        </button>
                                    </li>
                                );
                            })
                        ) : (
                            <li className="p-8 text-center text-(--text-secondary) italic">
                                {hasCaseTypeSelected
                                    ? 'No hay tipos disponibles para este fuero.'
                                    : 'Seleccioná un fuero en el formulario principal.'}
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </Modal>
    );
}
