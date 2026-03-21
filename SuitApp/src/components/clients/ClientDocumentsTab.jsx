import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { buildDocumentEditPath } from '../../utils/appRoutes.js';

const ClientDocumentsTab = ({ clientData }) => {
    const navigate = useNavigate();

    return (
        <div className="bg-(--bg-card) rounded-xl shadow-sm border border-(--border-subtle) overflow-hidden animate-in fade-in duration-300">
            <div className="p-4 border-b border-(--border-subtle) flex justify-between items-center bg-(--bg-card-hover)">
                <h3 className="font-semibold text-(--text-primary)">Documentos Asociados</h3>
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                    {clientData.documents?.length || 0} archivos
                </span>
            </div>
            {clientData.documents && clientData.documents.length > 0 ? (
                <ul className="divide-y divide-(--border-subtle)">
                    {clientData.documents
                        .filter(doc => doc.category !== 'multimedia')
                        .map(doc => (
                            <li
                                key={doc.id}
                                className="p-4 hover:bg-(--bg-card-hover) flex justify-between items-center group cursor-pointer transition-colors"
                            onClick={() => navigate(buildDocumentEditPath(doc.id))}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(buildDocumentEditPath(doc.id)); } }}
                            tabIndex={0}
                            role="button"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-(--text-primary) group-hover:text-blue-600 transition-colors">{doc.title}</p>
                                    <p className="text-sm text-(--text-secondary)">{doc.type} • {doc.date}</p>
                                </div>
                            </div>
                            <button className="text-blue-600 hover:underline text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver Documento</button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="m-4">
                    <EmptyState
                        icon={FileText}
                        title="Sin documentos"
                        description="Este cliente no tiene documentos asociados aún."
                    />
                </div>
            )}
        </div>
    );
};

export default ClientDocumentsTab;
