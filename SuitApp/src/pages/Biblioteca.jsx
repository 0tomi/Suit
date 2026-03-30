import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { usePublicFiles } from '../context/PublicFilesContext';
import { usePublicFileCatalogs } from '../context/PublicFileCatalogsContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { usePageFocus } from '../hooks/usePageFocus.js';

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
import { generateLink, getFilesForCatalog, getPublicFilesPage } from '../services/publicFileService';
import { createLogger } from '../services/logService.js';

const logger = createLogger('biblioteca-page');

function getPublicFileErrorMessage(result, fallbackMessage) {
    if (typeof result?.error === 'string' && result.error) return result.error;
    if (typeof result?.data?.message === 'string' && result.data.message) return result.data.message;
    return fallbackMessage;
}

function normalizePaginatedFilesPayload(payload) {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) {
        void logger.error('invalid public files payload: missing data array', { payload });
        throw new Error('La API devolvió una paginación inválida para Biblioteca.');
    }

    const metaSource = payload.meta && typeof payload.meta === 'object'
        ? payload.meta
        : payload;

    const currentPage = Number(metaSource.current_page);
    const lastPage = Number(metaSource.last_page);
    const total = Number(metaSource.total);

    const isValidPagination =
        Number.isInteger(currentPage)
        && Number.isInteger(lastPage)
        && Number.isInteger(total)
        && currentPage >= 0
        && lastPage >= 0
        && total >= 0;

    if (!isValidPagination) {
        void logger.error('invalid public files pagination payload', { payload, metaSource });
        throw new Error('La API devolvió una paginación inválida para Biblioteca.');
    }

    return {
        data: payload.data,
        current_page: currentPage,
        last_page: lastPage,
        total,
        has_next_page: payload.links?.next != null,
    };
}

function mergeFilesById(currentFiles, nextFiles) {
    const fileMap = new Map(currentFiles.map((file) => [String(file.id), file]));

    for (const file of nextFiles) {
        fileMap.set(String(file.id), file);
    }

    return Array.from(fileMap.values());
}

function decorateFilesForCurrentUser(files, user) {
    const isAdmin = user?.role === 'admin';
    const currentUserId = user?.id ?? null;

    return files.map((file) => ({
        ...file,
        is_owner_or_admin: isAdmin || String(file.user_id) === String(currentUserId),
    }));
}

const Biblioteca = () => {
    const { user } = useAuth();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    const {
        uploadFile,
        renameFile,
        deleteFile,
        downloadFile,
        markAsSeen,
    } = usePublicFiles();

    const {
        public_file_catalogs: catalogs,
        initialized: catalogsInitialized,
        syncing: syncingCatalogs,
        refreshPublicFileCatalogs,
    } = usePublicFileCatalogs();

    const [files, setFiles] = useState([]);
    const [filesInitialized, setFilesInitialized] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshingFiles, setRefreshingFiles] = useState(false);
    const [pagination, setPagination] = useState({
        currentPage: 0,
        lastPage: 1,
        total: 0,
        hasNextPage: false,
    });

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
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrData, setQrData] = useState(null);

    const requestIdRef = useRef(0);
    const filesInitializedRef = useRef(false);

    const catalogOptions = useMemo(() => {
        return [
            { id: 'all', name: 'Todos' },
            ...catalogs,
        ];
    }, [catalogs]);

    useEffect(() => {
        filesInitializedRef.current = filesInitialized;
    }, [filesInitialized]);

    const fetchFilesPage = useCallback(async ({ pageToLoad = 1, replace = false } = {}) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        if (pageToLoad === 1) {
            if (!filesInitializedRef.current) {
                setLoadingFiles(true);
            } else {
                setRefreshingFiles(true);
            }
        } else {
            setLoadingMore(true);
        }

        try {
            const result = activeCatalog === 'all'
                ? await getPublicFilesPage(pageToLoad)
                : await getFilesForCatalog(activeCatalog, pageToLoad);

            if (!result.ok) {
                throw new Error(getPublicFileErrorMessage(result, 'No se pudo cargar la Biblioteca.'));
            }

            const payload = normalizePaginatedFilesPayload(result.data);

            if (requestIdRef.current !== requestId) {
                return;
            }

            const decoratedFiles = decorateFilesForCurrentUser(payload.data, user);

            setFiles((currentFiles) => (replace ? decoratedFiles : mergeFilesById(currentFiles, decoratedFiles)));
            setPagination({
                currentPage: payload.current_page,
                lastPage: payload.last_page,
                total: payload.total,
                hasNextPage: payload.has_next_page,
            });
            setFilesInitialized(true);
        } catch (error) {
            if (requestIdRef.current !== requestId) {
                return;
            }

            void logger.error('fetch public files page failed', {
                activeCatalog,
                pageToLoad,
                error: error?.message || String(error),
            });

            setFilesInitialized(true);
            showAppToast({
                title: 'No se pudo cargar la biblioteca',
                description: error.message || 'Ocurrió un error inesperado.',
                variant: 'danger',
            });
        } finally {
            if (requestIdRef.current === requestId) {
                setLoadingFiles(false);
                setLoadingMore(false);
                setRefreshingFiles(false);
            }
        }
    }, [activeCatalog, user]);

    const refreshFiles = useCallback(async () => {
        await fetchFilesPage({ pageToLoad: 1, replace: true });
    }, [fetchFilesPage]);

    const refreshBiblioteca = useCallback(async () => {
        try {
            await Promise.all([
                refreshPublicFileCatalogs(),
                refreshFiles(),
            ]);
        } catch (error) {
            void logger.error('refresh biblioteca failed', {
                error: error?.message || String(error),
            });
        }
    }, [refreshFiles, refreshPublicFileCatalogs]);

    useEffect(() => {
        void refreshFiles();
    }, [refreshFiles]);

    usePageFocus({ onFocus: refreshBiblioteca });

    useEffect(() => {
        const handleWindowFocus = () => {
            void refreshBiblioteca();
        };

        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, [refreshBiblioteca]);

    const displayFiles = useMemo(() => {
        let result = [...files];
        const term = searchTerm.toLowerCase().trim();

        if (term) {
            result = result.filter((file) => (file.name || '').toLowerCase().includes(term));
        }

        if (selectedExtensions.length > 0) {
            result = result.filter((file) => {
                const name = (file.name || '').toLowerCase();
                const mime = (file.mime_type || '').toLowerCase();

                return selectedExtensions.some((extGroup) => {
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

        result.sort((left, right) => {
            let comparison = 0;

            if (sortBy === 'created_at') {
                comparison = new Date(left.created_at) - new Date(right.created_at);
            } else if (sortBy === 'name') {
                comparison = (left.name || '').localeCompare(right.name || '');
            } else if (sortBy === 'size') {
                comparison = Number(left.size || 0) - Number(right.size || 0);
            }

            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return result;
    }, [files, searchTerm, selectedExtensions, sortBy, sortOrder]);

    const hasMore = pagination.hasNextPage && pagination.currentPage < pagination.lastPage;
    const isRefreshing = syncingCatalogs || refreshingFiles;
    const isLoading = !filesInitialized || !catalogsInitialized || loadingFiles;

    const handleLoadMore = useCallback(() => {
        if (loadingFiles || loadingMore || refreshingFiles || !hasMore) return;
        void fetchFilesPage({ pageToLoad: pagination.currentPage + 1, replace: false });
    }, [fetchFilesPage, hasMore, loadingFiles, loadingMore, pagination.currentPage, refreshingFiles]);

    const handleDownload = async (file) => {
        const result = await downloadFile(file.id, file.name);
        if (result && !result.saved && result.error) {
            showAppToast({
                title: 'Error al descargar',
                description: result.error,
                variant: 'danger',
            });
        }
    };

    const handleOpenInfo = (file) => {
        setSelectedFile(file);
        setInfoModalOpen(true);
    };

    const handleGenerateQr = async (file) => {
        try {
            const result = await generateLink(file.id);
            if (result.signed_url) {
                setQrData(result);
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
                variant: 'danger',
            });
        }
    };

    const handleRenameSubmit = async ({ id, name, catalogId }) => {
        const result = await renameFile(id, catalogId == null ? { name } : {
            name,
            public_file_catalog_id: catalogId,
        });

        if (!result.ok) {
            if (result.status === 403) throw new Error('No tienes permiso para modificar este archivo.');
            throw new Error(getPublicFileErrorMessage(result, 'Ocurrió un error inesperado al modificar.'));
        }

        showAppToast({ title: 'Archivo actualizado', variant: 'success' });
        await refreshFiles();
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
                        throw new Error(getPublicFileErrorMessage(result, 'Error al eliminar archivo.'));
                    }

                    setFiles((currentFiles) => currentFiles.filter((currentFile) => String(currentFile.id) !== String(file.id)));
                    setPagination((current) => ({
                        ...current,
                        total: Math.max(0, current.total - 1),
                    }));

                    showAppToast({ title: 'Archivo eliminado', variant: 'success' });
                    setInfoModalOpen(false);
                    closeDialog();
                } catch (error) {
                    showAppToast({
                        title: 'Error',
                        description: error.message,
                        variant: 'danger',
                    });
                } finally {
                    setDialogLoading(false);
                }
            },
        });
    };

    const handleUploadSubmit = async (formData, permissionsToApply = []) => {
        setModalLoading(true);
        try {
            const result = await uploadFile(formData, permissionsToApply);
            if (!result.ok) {
                throw new Error(getPublicFileErrorMessage(result, 'Error al subir el archivo.'));
            }

            showAppToast({ title: 'Archivo subido correctamente', variant: 'success' });
            setUploadModalOpen(false);
            await refreshFiles();
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
                throw new Error(getPublicFileErrorMessage(result, 'Error al crear catálogo.'));
            }

            await refreshPublicFileCatalogs();
            showAppToast({ title: 'Catálogo creado', variant: 'success' });
            setCreateCatalogModalOpen(false);
        } catch (error) {
            showAppToast({
                title: 'No se pudo crear',
                description: error.message,
                variant: 'danger',
            });
        } finally {
            setModalLoading(false);
        }
    };

    const dragCounter = useRef(0);

    const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (uploadModalOpen) return;

        dragCounter.current += 1;
        if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
            setDragActive(true);
        }
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (uploadModalOpen) return;

        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
            setDragActive(false);
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (uploadModalOpen) return;
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (uploadModalOpen) return;

        setDragActive(false);
        dragCounter.current = 0;

        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            setDraggedFile(event.dataTransfer.files[0]);
            setUploadModalOpen(true);
        }
    };

    const handleCloseUploadModal = () => {
        setUploadModalOpen(false);
        setDraggedFile(null);
    };

    const handleCloseUploadModalAfterQr = () => {
        void refreshFiles();
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-(--bg-page)">
                <div className="flex flex-col items-center gap-3 text-(--text-secondary)">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-sm">Cargando biblioteca...</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="relative flex flex-col h-full min-h-0 bg-(--bg-page) space-y-6 overflow-hidden"
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
                onRefresh={refreshBiblioteca}
            />

            <BibliotecaFilters
                searchTerm={searchTerm}
                onSearchChange={(event) => setSearchTerm(event.target.value)}
                catalogOptions={catalogOptions}
                activeCatalog={activeCatalog}
                onSelectCatalog={(catalogId) => {
                    setActiveCatalog(catalogId);
                    setFiles([]);
                    setFilesInitialized(false);
                    setPagination({ currentPage: 0, lastPage: 1, total: 0, hasNextPage: false });
                }}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                selectedExtensions={selectedExtensions}
                onExtensionChange={setSelectedExtensions}
                resultCount={displayFiles.length}
            />

            <BibliotecaGrid
                files={displayFiles}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                onDownload={handleDownload}
                onOpenInfo={handleOpenInfo}
                onOpenUploadModal={() => setUploadModalOpen(true)}
                onMarkAsSeen={markAsSeen}
                onGenerateQr={handleGenerateQr}
                loadingMore={loadingMore}
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
