import { useState, useMemo, useRef } from 'react';
import { Loader2, Upload } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { usePublicFiles } from '../context/PublicFilesContext';
import { usePublicFileCatalogs } from '../context/PublicFileCatalogsContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

import { BibliotecaHeader } from '../components/Biblioteca/BibliotecaHeader';
import { BibliotecaFilters } from '../components/Biblioteca/BibliotecaFilters';
import { BibliotecaGrid } from '../components/Biblioteca/BibliotecaGrid';
import { UploadFileModal } from '../components/Biblioteca/Modals/UploadFileModal';
import { CreateCatalogModal } from '../components/Biblioteca/Modals/CreateCatalogModal';
import { FileInfoModal } from '../components/Biblioteca/Modals/RenameFileModal';
import { QrCodeModal } from '../components/Biblioteca/Modals/QrCodeModal';

import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { showAppToast } from '../components/ui/show-app-toast';
import { createCatalog } from '../services/publicFileCatalogService';
import { generateLink } from '../services/publicFileService';

const Biblioteca = () => {
    const { user } = useAuth();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    
    // Contexts
    const {
        getFilesForCatalog,
        initialized: filesInitialized,
        syncing: syncingFiles,
        refreshData: refreshPublicFiles,
        uploadFile,
        renameFile,
        deleteFile,
        downloadFile,
        markAsSeen
    } = usePublicFiles();

    const {
        public_file_catalogs: catalogs,
        initialized: catalogsInitialized,
        syncing: syncingCatalogs,
        refreshPublicFileCatalogs
    } = usePublicFileCatalogs();

    const isRefreshing = syncingFiles || syncingCatalogs;
    const isLoading = (!filesInitialized || !catalogsInitialized);

    // Modal states
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [createCatalogModalOpen, setCreateCatalogModalOpen] = useState(false);
    const [infoModalOpen, setInfoModalOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [draggedFile, setDraggedFile] = useState(null);

    // Filter & Sort States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCatalog, setActiveCatalog] = useState('all'); 
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [selectedExtensions, setSelectedExtensions] = useState([]);
    const [page, setPage] = useState(1);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrData, setQrData] = useState(null);

    // Filter catalogs option
    const catalogOptions = useMemo(() => {
        return [
            { id: 'all', name: 'Todos' },
            ...catalogs
        ];
    }, [catalogs]);


    // Data fetching adaptado para Scroll Infinito
    // En lugar de traer una página específica, traemos todos los elementos hasta la página actual
    const { total } = useMemo(() => {
        const idParam = activeCatalog === 'all' ? null : activeCatalog;
        // Obtenemos los elementos de 1 hasta `page * 20`
        return getFilesForCatalog(idParam, 1, page * 20);
    }, [getFilesForCatalog, activeCatalog, page]);

    // Filtering & Sorting locally
    const displayFiles = useMemo(() => {
        let result = [];
        const term = searchTerm.toLowerCase().trim();
        const idParam = activeCatalog === 'all' ? null : activeCatalog;

        // Si tenemos búsqueda o filtros de extensión, obtenemos todos los archivos del catálogo (o global)
        // para filtrar y ordenar localmente de forma precisa.
        const isAdvancedFiltering = term !== '' || selectedExtensions.length > 0;
        const { data: sourceData } = getFilesForCatalog(idParam, 1, isAdvancedFiltering ? 9999 : page * 20);
        result = [...sourceData];

        // 1. Filtrado por término de búsqueda
        if (term) {
            result = result.filter(f => f.name.toLowerCase().includes(term));
        }

        // 2. Filtrado por extensiones
        if (selectedExtensions.length > 0) {
            result = result.filter(file => {
                const name = (file.name || '').toLowerCase();
                const mime = (file.mime_type || '').toLowerCase();
                
                return selectedExtensions.some(extGroup => {
                    if (extGroup === 'pdf') return name.endsWith('.pdf') || mime.includes('pdf');
                    if (extGroup === 'word') return name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('word');
                    if (extGroup === 'excel') return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || mime.includes('excel') || mime.includes('spreadsheet');
                    if (extGroup === 'powerpoint') return name.endsWith('.pptx') || name.endsWith('.ppt') || name.endsWith('.odp') || mime.includes('presentation') || mime.includes('powerpoint');
                    if (extGroup === 'image') return mime.includes('image/');
                    if (extGroup === 'text') return name.endsWith('.txt') || name.endsWith('.md') || mime.includes('text/');
                    return false;
                });
            });
        }

        // 3. Ordenamiento
        result.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'created_at') {
                comparison = new Date(a.created_at) - new Date(b.created_at);
            } else if (sortBy === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortBy === 'size') {
                comparison = a.size - b.size;
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

        // 4. Paginado local si es avanzado (si no, el slice ya viene del limit de getFilesForCatalog)
        if (isAdvancedFiltering) {
            return result.slice(0, page * 20);
        }

        return result;
    }, [getFilesForCatalog, activeCatalog, page, searchTerm, selectedExtensions, sortBy, sortOrder]);

    const hasMore = searchTerm.trim() || selectedExtensions.length > 0 ? false : displayFiles.length < total;

    // Handlers
    const handleDownload = async (file) => {
        const result = await downloadFile(file.id, file.name);
        if (result && !result.saved && result.error) {
            showAppToast({
                title: 'Error al descargar',
                description: result.error,
                variant: 'danger'
            });
        } else if (result && result.saved) {
            // Optional success toast
        }
    };

    const handleOpenInfo = (file) => {
        setSelectedFile(file);
        setInfoModalOpen(true);
    };

    const handleGenerateQr = async (file) => {
        try {
            const res = await generateLink(file.id);
            if (res.signed_url) {
                setQrData(res);
                setSelectedFile(file);
                setQrModalOpen(true);
            }
        } catch (error) {
            const message = error.message?.includes('422') || error.message?.includes('403')
                ? 'No tenes permisos para realizar esta accion.'
                : 'No se pudo generar el enlace QR.';
            showAppToast({
                title: 'Error',
                description: message,
                variant: 'danger'
            });
        }
    };

    const handleRenameSubmit = async ({ id, name, catalogId }) => {
        const result = await renameFile(id, name, catalogId);
        if (!result.ok) {
            if (result.status === 403) throw new Error('No tienes permiso para modificar este archivo.');
            throw new Error('Ocurrió un error inesperado al modificar.');
        }
        showAppToast({ title: 'Archivo actualizado', variant: 'success' });
    };

    const handleDeleteRequest = (file) => {
        openDialog({
            title: '¿Eliminar archivo?',
            desc: `Se eliminará permanentemente "${file.name}". Esta acción no se puede deshacer.`,
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await deleteFile(file.id);
                    if (!result.ok) {
                        if (result.status === 403) throw new Error('No tienes permiso para eliminar este archivo.');
                        throw new Error('Error al eliminar archivo.');
                    }
                    showAppToast({ title: 'Archivo eliminado', variant: 'success' });
                    setInfoModalOpen(false);
                    closeDialog();
                } catch (error) {
                    showAppToast({
                        title: 'Error',
                        description: error.message,
                        variant: 'danger'
                    });
                } finally {
                    setDialogLoading(false);
                }
            }
        });
    };

    const handleUploadSubmit = async (formData) => {
        setModalLoading(true);
        try {
            const result = await uploadFile(formData);
            if (!result.ok) throw new Error('Error al subir el archivo.');
            showAppToast({ title: 'Archivo subido correctamente', variant: 'success' });
            setUploadModalOpen(false);
        } finally {
            setModalLoading(false);
        }
    };

    const handleCreateCatalog = async (data) => {
        setModalLoading(true);
        try {
            const result = await createCatalog(data);
            if (!result.ok) {
                if (result.status === 422) throw new Error('El nombre de este catálogo ya existe.');
                throw new Error('Error al crear catálogo.');
            }
            await refreshPublicFileCatalogs();
            showAppToast({ title: 'Catálogo creado', variant: 'success' });
            setCreateCatalogModalOpen(false);
        } catch (error) {
            showAppToast({
                title: 'No se pudo crear',
                description: error.message,
                variant: 'danger'
            });
        } finally {
            setModalLoading(false);
        }
    };

    // Drag & Drop handlers
    const dragCounter = useRef(0);

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadModalOpen) return; // Si ya hay un modal abierto, no mostramos el overlay de página
        
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setDragActive(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadModalOpen) return;

        dragCounter.current--;
        if (dragCounter.current <= 0) {
            setDragActive(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadModalOpen) return;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadModalOpen) return;
        
        setDragActive(false);
        dragCounter.current = 0;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            setDraggedFile(file);
            setUploadModalOpen(true);
        }
    };

    const handleCloseUploadModal = () => {
        setUploadModalOpen(false);
        setDraggedFile(null);
    };

    const handleCloseUploadModalAfterQr = () => {
        void refreshPublicFiles();
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center p-6 bg-(--bg-page)">
                <div className="flex flex-col items-center gap-3 text-(--text-secondary)">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-sm">Cargando biblioteca...</span>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="relative flex flex-col h-screen bg-(--bg-page) p-6 space-y-6 overflow-hidden"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {dragActive && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-blue-600/10 backdrop-blur-[2px] border-4 border-dashed border-blue-500 m-4 rounded-3xl animate-in fade-in zoom-in duration-200 pointer-events-none">
                    <div className="bg-(--bg-card) p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-blue-500/20">
                        <div className="p-4 bg-blue-500/10 rounded-full animate-bounce">
                            <Upload className="h-12 w-12 text-blue-600" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-(--text-primary)">Soltá el archivo aquí</h3>
                            <p className="text-(--text-secondary)">Para subirlo a la biblioteca virtual</p>
                        </div>
                    </div>
                </div>
            )}

            <BibliotecaHeader
                isRefreshing={isRefreshing}
                canCreateCatalog={user?.role === 'admin'}
                onOpenCatalogModal={() => setCreateCatalogModalOpen(true)}
                onOpenUploadModal={() => setUploadModalOpen(true)}
            />

            <BibliotecaFilters
                searchTerm={searchTerm}
                onSearchChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                }}
                catalogOptions={catalogOptions}
                activeCatalog={activeCatalog}
                onSelectCatalog={(id) => {
                    setActiveCatalog(id);
                    setPage(1);
                }}
                sortBy={sortBy}
                onSortByChange={(val) => {
                    setSortBy(val);
                    setPage(1);
                }}
                sortOrder={sortOrder}
                onSortOrderChange={(val) => {
                    setSortOrder(val);
                    setPage(1);
                }}
                selectedExtensions={selectedExtensions}
                onExtensionChange={(exts) => {
                    setSelectedExtensions(exts);
                    setPage(1);
                }}
                resultCount={displayFiles.length}
            />

            <BibliotecaGrid
                files={displayFiles}
                hasMore={hasMore}
                onLoadMore={() => setPage((prev) => prev + 1)}
                onDownload={handleDownload}
                onOpenInfo={handleOpenInfo}
                onOpenUploadModal={() => setUploadModalOpen(true)}
                onMarkAsSeen={markAsSeen}
                onGenerateQr={handleGenerateQr}
            />

            <UploadFileModal
                open={uploadModalOpen}
                catalogs={catalogs}
                loading={modalLoading}
                onClose={handleCloseUploadModal}
                onCloseAfterQrFlow={handleCloseUploadModalAfterQr}
                onUpload={handleUploadSubmit}
                initialFile={draggedFile}
            />

            {user?.role === 'admin' && (
                <CreateCatalogModal
                    open={createCatalogModalOpen}
                    loading={modalLoading}
                    onClose={() => setCreateCatalogModalOpen(false)}
                    onCreate={handleCreateCatalog}
                />
            )}

            <FileInfoModal
                open={infoModalOpen}
                file={selectedFile}
                catalogs={catalogs}
                onClose={() => setInfoModalOpen(false)}
                onRename={handleRenameSubmit}
                onDelete={handleDeleteRequest}
            />

            <QrCodeModal
                open={qrModalOpen}
                onClose={() => setQrModalOpen(false)}
                signedData={qrData}
                file={selectedFile}
            />

            <ConfirmDialog {...dialogProps} />
        </div>
    );
};

export default Biblioteca;
