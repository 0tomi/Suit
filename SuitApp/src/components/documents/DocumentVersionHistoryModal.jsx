import { useCallback, useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import VersionHistoryPanel from '../Editor/VersionHistoryPanel.jsx';
import { getDocumentVersionsCached } from '../../services/documentVersionCacheService.js';
import { buildDocumentVersionPath } from '../../utils/appRoutes.js';
import { createLogger } from '../../services/logService.js';

const logger = createLogger('component:document-version-history-modal');

export default function DocumentVersionHistoryModal({
    open,
    onClose,
    documentData,
}) {
    const navigate = useNavigate();
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [versions, setVersions] = useState([]);

    const loadHistory = useCallback(async () => {
        if (!documentData?.id) return;

        setHistoryLoading(true);
        setHistoryError('');
        try {
            const nextVersions = await getDocumentVersionsCached(documentData.id);
            setVersions(nextVersions);
        } catch (error) {
            void logger.error('No se pudo cargar historial de versiones', error);
            setHistoryError(error?.message || 'No se pudo cargar el historial de versiones.');
        } finally {
            setHistoryLoading(false);
        }
    }, [documentData?.id]);

    useEffect(() => {
        if (!open) return;
        setVersions([]);
        setHistoryError('');
        void loadHistory();
    }, [loadHistory, open]);

    const handleOpenVersion = useCallback((version) => {
        if (!documentData?.id || !version?.id) return;

        const versionNumber = version.version_number ?? version.number ?? version.version ?? null;
        navigate(buildDocumentVersionPath(documentData.id, version.id, versionNumber), {
            state: {
                returnTo: {
                    pathname: '/documents',
                },
            },
        });
        onClose();
    }, [documentData?.id, navigate, onClose]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Historial · ${documentData?.name || documentData?.title || 'Documento'}`}
            subtitle="Las versiones se validan en el backend de Electron antes de responder el listado. El contenido se descarga recién al abrir una versión."
            maxWidth="max-w-4xl"
            footer={(
                <Button
                    variant="outline"
                    onClick={() => void loadHistory()}
                    disabled={historyLoading}
                    icon={historyLoading ? Loader2 : History}
                    className={historyLoading ? '[&_svg]:animate-spin' : ''}
                >
                    Actualizar historial
                </Button>
            )}
            footerAlignment="justify-end"
        >
            <div className="space-y-4">
                <div className="rounded-2xl border border-(--border-subtle) bg-linear-to-r from-slate-50 via-white to-sky-50/60 p-4">
                    <p className="text-sm text-(--text-secondary)">
                        El listado usa caché local cuando sigue vigente y se refresca automáticamente si Electron detecta una versión nueva en el servidor.
                    </p>
                </div>

                <VersionHistoryPanel
                    versions={versions}
                    loading={historyLoading}
                    error={historyError}
                    onRetry={() => void loadHistory()}
                    onOpenVersion={handleOpenVersion}
                />
            </div>
        </Modal>
    );
}
