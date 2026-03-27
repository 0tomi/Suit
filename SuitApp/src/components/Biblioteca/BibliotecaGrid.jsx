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
    isNew, // Nuevo prop: puede ser booleano o función (file) => boolean
}) => {
    const observerTarget = useRef(null);

    useEffect(() => {
        if (!hasMore || !onLoadMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onLoadMore();
                }
            },
            { threshold: 0.1 } // Se ejecuta cuando el 10% del div entra en vista
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMore, onLoadMore]);

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
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 content-start overflow-y-auto pr-2 pb-4 flex-1">
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
                        {/* Se puede poner un spinner aquí, pero la carga es instantánea desde sqlite */}
                        Cargando más archivos...
                    </div>
                )}
            </div>
        </div>
    );
};
