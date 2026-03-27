import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange, className = '' }) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    if (totalPages <= 1) return null;

    return (
        <div className={`flex items-center justify-between px-4 py-3 bg-(--bg-card) border-t border-(--border-subtle) sm:px-6 ${className}`}>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-(--text-secondary)">
                        Mostrando <span className="font-medium text-(--text-primary)">{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}</span> a <span className="font-medium text-(--text-primary)">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span className="font-medium text-(--text-primary)">{totalItems}</span> resultados
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="rounded-r-none border border-(--border-default) px-2 py-2"
                        >
                            <span className="sr-only">Anterior</span>
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </Button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-(--border-default) bg-(--bg-card-hover) text-sm font-medium text-(--text-primary)">
                            Página {currentPage} de {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="rounded-l-none border border-(--border-default) px-2 py-2"
                        >
                            <span className="sr-only">Siguiente</span>
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </Button>
                    </nav>
                </div>
            </div>
        </div>
    );
};
