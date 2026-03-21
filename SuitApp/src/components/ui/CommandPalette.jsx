import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Briefcase, Users, FileText, X } from 'lucide-react';
import { useCases } from '../../context/CasesContext';
import { useClients } from '../../context/ClientsContext';
import { useDocuments } from '../../context/DocumentsContext';

export const CommandPalette = ({ onClose }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();
    const { cases = [] } = useCases();
    const { clients = [] } = useClients();
    const { documents = [] } = useDocuments();

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const results = useMemo(() => {
        if (!query.trim()) {
            return [];
        }

        const term = query.trim().toLowerCase();
        const caseMatches = (cases || [])
            .filter((entry) => entry.title?.toLowerCase().includes(term) || entry.details?.toLowerCase().includes(term))
            .slice(0, 5)
            .map((entry) => ({
                id: entry.id,
                path: `/cases/${entry.id}`,
                title: entry.title || `Expediente #${entry.id}`,
                type: 'Caso',
                icon: Briefcase,
            }));
        const clientMatches = (clients || [])
            .filter((client) => {
                const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim().toLowerCase();
                return fullName.includes(term) || (client.identification_number || '').includes(term) || (client.email || '').toLowerCase().includes(term);
            })
            .slice(0, 5)
            .map((client) => ({
                id: client.id,
                path: `/clients/${client.id}`,
                title: `${client.first_name || ''} ${client.last_name || ''}`.trim() || `Cliente #${client.id}`,
                type: 'Cliente',
                icon: Users,
            }));
        const documentMatches = (documents || [])
            .filter((doc) => doc.name?.toLowerCase().includes(term))
            .slice(0, 5)
            .map((doc) => ({
                id: doc.id,
                path: `/documents/edit/${doc.id}`,
                title: doc.name || `Documento #${doc.id}`,
                type: 'Documento',
                icon: FileText,
            }));

        return [...caseMatches, ...clientMatches, ...documentMatches];
    }, [query, cases, clients, documents]);

    const activeIndex = results.length === 0 ? 0 : Math.min(selectedIndex, results.length - 1);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const selected = results[activeIndex];
                if (selected) {
                    onClose();
                    navigate(selected.path);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeIndex, navigate, onClose, results]);

    return (
        <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh]">
            <button
                type="button"
                aria-label="Cerrar busqueda"
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-2xl rounded-2xl border border-(--border-default) bg-(--bg-card) shadow-2xl">
                <div className="flex items-center gap-3 border-b border-(--border-subtle) px-4 py-3">
                    <Search className="h-5 w-5 text-(--text-tertiary)" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder="Buscar casos, clientes o documentos..."
                        className="flex-1 bg-transparent text-(--text-primary) placeholder-(--text-tertiary) outline-none"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-(--text-tertiary) transition-colors hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {query.trim() ? (
                    <div className="max-h-[60vh] overflow-y-auto p-2">
                        {results.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-(--text-secondary)">
                                No se encontraron resultados para "{query}".
                            </div>
                        ) : (
                            results.map((entry, index) => {
                                const Icon = entry.icon;
                                const isActive = index === activeIndex;

                                return (
                                    <button
                                        key={`${entry.type}-${entry.id}`}
                                        className={`flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-(--bg-card-hover)'}`}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        onClick={() => {
                                            onClose();
                                            navigate(entry.path);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-(--text-secondary)'}`} />
                                            <span className={`text-sm font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-(--text-primary)'}`}>
                                                {entry.title}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold uppercase tracking-wider text-(--text-tertiary)">
                                            {entry.type}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="p-8 text-center text-sm text-(--text-secondary)">
                        Escribe para comenzar a buscar...
                    </div>
                )}
            </div>
        </div>
    );
};
