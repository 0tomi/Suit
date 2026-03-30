import { useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { FileCard } from './FileCard';

export const BibliotecaGrid = ({
    files,
    hasMore,
    onLoadMore,
    onDownload,
    onOpenInfo,
    onOpenUploadModal,
    onMarkAsSeen,
    onDelete,
    onGenerateQr,
    deleteLoading,
    loadingMore = false,
    isNew, // Nuevo prop: puede ser booleano o función (file) => boolean
}) => {
    const scrollContainerRef = useRef(null);
    const observerTarget = useRef(null);

    useEffect(() => {
        if (!hasMore || !onLoadMore || loadingMore) return;

        const currentTarget = observerTarget.current;
        const currentRoot = scrollContainerRef.current;
        if (!currentTarget || !currentRoot) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    observer.unobserve(entries[0].target);
                    onLoadMore();
                }
            },
            {
                root: currentRoot,
                threshold: 0.1,
            }
        );

        observer.observe(currentTarget);

        return () => {
            observer.disconnect();
        };
    }, [hasMore, loadingMore, onLoadMore]);

    if (files.length === 0) {
        return (
            <EmptyState
                icon={FileText}
                title="No hay archivos para mostrar"
                description="No se encontraron archivos en este catálogo o con los filtros actuales."
                actionLabel="Subir primer archivo"
                onAction={onOpenUploadModal}
            />
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div
                ref={scrollContainerRef}
                className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 content-start overflow-y-auto pr-2 pb-4 flex-1"
            >
                {files.map((file) => {
                    // Si isNew es una funcion, la ejecutamos. Si es booleano, lo usamos.
                    // Si no viene, usamos file.is_new original.
                    const fileIsNew = typeof isNew === 'function' ? isNew(file) : (isNew ?? file.is_new);
                    return (
                        <FileCard
                            key={file.id}
                            file={{ ...file, is_new: fileIsNew }}
                            onDownload={onDownload}
                            onOpenInfo={onOpenInfo}
                            onMarkAsSeen={onMarkAsSeen}
                            onDelete={onDelete}
                            onGenerateQr={onGenerateQr}
                            deleteLoading={deleteLoading}
                        />
                    );
                })}
                
                {/* Div invisible al final para disparar el infinite scroll */}
                {hasMore && (
                    <div 
                        ref={observerTarget} 
                        className="col-span-full h-12 flex justify-center items-center text-(--text-tertiary) text-sm"
                    >
                        Cargando más archivos...
                    </div>
                )}
            </div>
        </div>
    );
};
