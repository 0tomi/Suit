import { memo, lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Plus, Trash2, ExternalLink, File, Lock, Users, Download, Upload, Play, X, Film, Printer, ChevronLeft, ChevronRight, Eye, FolderOpen, FileText, FolderArchive, Calendar, Clock, CalendarRange, Image as LucideImage, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SideMenuPageLayout from '../ui/SideMenuPageLayout.jsx';
import AddParticipantModal from './AddParticipantModal';
import AddCaseClientModal from './AddCaseClientModal.jsx';
import CaseVideoPlayer from '../media/CaseVideoPlayer.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDocuments } from '../../context/DocumentsContext';
import { useMultimedia } from '../../context/MultimediaContext.jsx';
import { useFiles } from '../../context/FilesContext.jsx';
import { useCaseTypes } from '../../context/CaseTypesContext.jsx';
import { useRadicaciones } from '../../context/RadicacionesContext.jsx';
import { useTipoExpedientes } from '../../context/TipoExpedientesContext.jsx';
import { useCompetencias } from '../../context/CompetenciasContext.jsx';
import { useJurisdicciones } from '../../context/JurisdiccionesContext.jsx';
import { useDependenciasJudiciales } from '../../context/DependenciasJudicialesContext.jsx';
import {
    getParticipants,
    removeParticipant,
    getCaseClients,
    unlinkClientFromCase,
    generateCaseLink,
} from '../../services/caseService';
import { downloadMultimedia, uploadMultimedia, deleteMultimedia } from '../../services/multimediaService.js';
import { downloadFile, uploadFile, deleteFile } from '../../services/fileService.js';
import { getCaseOverviewMetrics } from '../../services/caseDetailService.js';
import { buildDocumentCreatePath, buildDocumentEditPath } from '../../utils/appRoutes.js';
import { isVideoDocument } from '../../utils/mediaDocument.js';
import { captureVideoPoster } from '../../utils/videoThumbnail.js';
import { getCaseStatusLabel } from '../../utils/caseStatus.js';
import { getClientDisplayName } from '../../utils/clientDisplayName.js';
import { getCaseParticipantPermissionLabel } from '../../utils/caseParticipantPermissionLabel.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { Table } from '../ui/Table.jsx';
import { usePartesCaso } from '../../hooks/usePartesCaso.js';
import { useModal } from '../../context/ModalContext.jsx';
import { SelectParteModal } from '../people/SelectParteModal.jsx';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { createLogger } from '../../services/logService.js';
import { getApiErrorMessage } from '../../utils/apiErrorMessage.js';
import { useCaseDeadlineBadge } from '../../hooks/useDeadlineBadge';

const logger = createLogger('case-detail-tab-content');
const AgendaComponent = lazy(() => import('../Agenda/AgendaComponent'));
const CaseDeadlinesSection = lazy(() => import('../deadlines/CaseDeadlinesSection'));
import { HonorariosList } from '../economia/HonorariosList.jsx';
import { GastosList } from '../economia/GastosList.jsx';
import { BibliotecaFilters } from '../Biblioteca/BibliotecaFilters';
import { BibliotecaGrid } from '../Biblioteca/BibliotecaGrid';
import { QrCodeModal } from '../Biblioteca/Modals/QrCodeModal';

dayjs.locale('es');
dayjs.extend(localizedFormat);

const CASE_DETAIL_WIDE_SECTION_CLASS = 'w-full px-2 md:px-3';

function resolveStatusClasses(statusLabel) {
    if (statusLabel === 'Finalizado') {
        return 'bg-green-100 text-green-700 border-green-200';
    }

    if (statusLabel === 'Activo') {
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }

    return 'bg-(--bg-card-hover) text-(--text-secondary) border-(--border-default)';
}

/**
 * Renderiza una métrica puntual del expediente manteniendo el layout compacto del resumen.
 */
function OverviewMetricCard({ label, value, description }) {
    return (
        <div className="rounded-xl border border-(--border-default) bg-(--bg-card-hover) px-4 py-4">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-(--text-tertiary)">{label}</span>
            <p className="mt-2 text-3xl font-bold text-(--text-primary)">{value}</p>
            <p className="mt-1 text-sm text-(--text-secondary)">{description}</p>
        </div>
    );
}

/**
 * Muestra una fila uniforme para clientes o usuarios y deja la acción opcional desacoplada.
 */
function LinkedPartyRow({ avatar, title, subtitle, action }) {
    return (
        <li className="flex items-center justify-between gap-3 p-4 hover:bg-(--bg-card-hover)">
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600">
                    {avatar}
                </div>
                <div>
                    <p className="font-medium text-(--text-primary)">{title}</p>
                    <p className="text-sm text-(--text-secondary)">{subtitle}</p>
                </div>
            </div>
            {action}
        </li>
    );
}

/**
 * Agrupa visualmente las secciones de partes para separar clientes de colaboradores internos.
 */
function PartiesSection({ title, subtitle, action, items, emptyMessage }) {
    return (
        <section className="rounded-xl border border-(--border-default) overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-(--border-default) bg-(--bg-header) px-4 py-3">
                <div>
                    <h4 className="font-semibold text-(--text-primary)">{title}</h4>
                    <p className="text-sm text-(--text-secondary)">{subtitle}</p>
                </div>
                {action}
            </div>
            <ul className="divide-y divide-(--border-default)">
                {items.length > 0 ? items : (
                    <li className="p-6 text-center italic text-(--text-secondary)">{emptyMessage}</li>
                )}
            </ul>
        </section>
    );
}

function getDocumentLatestAuthorName(document) {
    return (
        document?.latest_version?.creator?.name ||
        document?.latest_version_creator_name ||
        '—'
    );
}

function getCaseTypeLabel(caseData, caseTypes) {
    if (typeof caseData?.case_type === 'string' && caseData.case_type.trim()) {
        return caseData.case_type.trim();
    }

    if (typeof caseData?.type === 'string' && caseData.type.trim()) {
        return caseData.type.trim();
    }

    if (caseData?.case_type?.name) {
        return caseData.case_type.name;
    }

    const matchedCaseType = caseTypes.find((item) => String(item.id) === String(caseData?.case_type_id ?? ''));
    return matchedCaseType?.name || 'Sin fuero';
}

function getRadicacionLabel(caseData, radicaciones) {
    if (caseData?.radicacion?.tipo) {
        return caseData.radicacion.tipo;
    }

    if (caseData?.radicacion?.name) {
        return caseData.radicacion.name;
    }

    if (caseData?.radicacion?.nombre_lugar) {
        return caseData.radicacion.nombre_lugar;
    }

    if (typeof caseData?.radicacion_name === 'string' && caseData.radicacion_name.trim()) {
        return caseData.radicacion_name.trim();
    }

    const matchedRadicacion = radicaciones.find((item) => String(item.id) === String(caseData?.radicacion_id ?? ''));
    return matchedRadicacion?.tipo || matchedRadicacion?.name || matchedRadicacion?.nombre_lugar || 'Sin radicación';
}

function getCompetenciaLabel(caseData, dependencias) {
    // 1. Prioridad: Objeto embebido en caseData (si vino de API)
    const depFromCase = caseData?.dependencia;
    if (depFromCase) {
        return depFromCase.nombre_juzgado || depFromCase.nombre || depFromCase.title;
    }

    // 2. Buscar en catálogo usando dependencia_id
    const depId = caseData?.dependencia_id;
    if (!depId) return '—';

    const dep = dependencias.find(d => String(d.id) === String(depId));
    if (!dep) return '—';

    // 3. Devolver el nombre de la dependencia (juzgado)
    return dep.nombre_juzgado || dep.nombre || dep.title || '—';
}

function getJurisdiccionLabel(caseData, dependencias, jurisdicciones) {
    const jurFromCase = caseData?.dependencia?.jurisdiccion;
    if (jurFromCase) return jurFromCase.nombre;

    const depId = caseData?.dependencia_id;
    if (!depId) return '—';

    const dep = dependencias.find(d => String(d.id) === String(depId));
    if (!dep) return '—';

    if (dep.data_json) {
        try {
            const parsed = JSON.parse(dep.data_json);
            if (parsed.jurisdiccion?.nombre) return parsed.jurisdiccion.nombre;
        } catch { /* ignore */ }
    }

    const jur = jurisdicciones.find(j => String(j.id) === String(dep.jurisdiccion_id));
    return jur?.nombre || '—';
}

function resolveTipoExpedienteLabel(tipo, catalogById) {
    if (typeof tipo === 'string' && tipo.trim()) {
        return tipo.trim();
    }

    if (typeof tipo === 'number') {
        return catalogById.get(String(tipo))?.title || catalogById.get(String(tipo))?.titulo || `#${tipo}`;
    }

    if (!tipo || typeof tipo !== 'object') {
        return null;
    }

    if (typeof tipo.title === 'string' && tipo.title.trim()) {
        return tipo.title.trim();
    }

    if (typeof tipo.titulo === 'string' && tipo.titulo.trim()) {
        return tipo.titulo.trim();
    }

    if (tipo.id != null) {
        const catalogItem = catalogById.get(String(tipo.id));
        return catalogItem?.title || catalogItem?.titulo || `#${tipo.id}`;
    }

    return null;
}

function summarizeTipoExpedienteSourceItem(item) {
    if (typeof item === 'string') {
        return item.length > 60 ? `${item.slice(0, 60)}…` : item;
    }

    if (typeof item === 'number') {
        return item;
    }

    if (!item || typeof item !== 'object') {
        return item;
    }

    return {
        id: item.id ?? null,
        title: item.title ?? item.titulo ?? item.name ?? null,
        keys: Object.keys(item).slice(0, 8),
    };
}

function buildTipoExpedienteResolutionSnapshot(caseData, tipoExpedientes, caseTipoExpedientesFromCache = []) {
    const catalogById = new Map(tipoExpedientes.map((item) => [String(item.id), item]));
    const sourceCollections = [
        { key: 'tipo_expedientes', value: caseData?.tipo_expedientes },
        { key: 'tipoExpedientes', value: caseData?.tipoExpedientes },
        { key: 'linkedTipoExpedientes', value: caseData?.linkedTipoExpedientes },
        { key: 'tipo_expediente_ids', value: caseData?.tipo_expediente_ids },
        { key: 'tipoExpedienteIds', value: caseData?.tipoExpedienteIds },
        { key: 'cachePivotTipoExpedientes', value: caseTipoExpedientesFromCache },
    ];

    const resolvedLabels = [];
    const unresolvedRefs = [];

    for (const source of sourceCollections) {
        if (!Array.isArray(source.value)) continue;

        for (const item of source.value) {
            const label = resolveTipoExpedienteLabel(item, catalogById);
            if (label) {
                resolvedLabels.push(label);
            }

            let candidateId = null;

            if (typeof item === 'number') {
                candidateId = item;
            } else if (typeof item === 'string' && /^\d+$/.test(item.trim())) {
                candidateId = Number(item.trim());
            } else if (item && typeof item === 'object' && item.id != null) {
                candidateId = Number(item.id);
            }

            if (Number.isInteger(candidateId) && !catalogById.has(String(candidateId))) {
                unresolvedRefs.push(candidateId);
            }
        }
    }

    return {
        caseId: caseData?.id ?? null,
        caseTypeId: caseData?.case_type_id ?? null,
        caseUpdatedAt: caseData?.updated_at ?? null,
        catalogCount: tipoExpedientes.length,
        sourceCollections: sourceCollections.map((source) => ({
            key: source.key,
            isArray: Array.isArray(source.value),
            length: Array.isArray(source.value) ? source.value.length : null,
            sample: Array.isArray(source.value)
                ? source.value.slice(0, 3).map(summarizeTipoExpedienteSourceItem)
                : null,
        })),
        resolvedLabelCount: Array.from(new Set(resolvedLabels)).length,
        unresolvedRefs: Array.from(new Set(unresolvedRefs)),
    };
}

function getCaseTipoExpedienteLabels(caseData, tipoExpedientes, caseTipoExpedientesFromCache = []) {
    const catalogById = new Map(tipoExpedientes.map((item) => [String(item.id), item]));
    const rawCollections = [
        caseData?.tipo_expedientes,
        caseData?.tipoExpedientes,
        caseData?.linkedTipoExpedientes,
        caseData?.tipo_expediente_ids,
        caseData?.tipoExpedienteIds,
        caseTipoExpedientesFromCache,
    ].filter(Array.isArray);

    const labels = rawCollections
        .flatMap((collection) => collection.map((item) => resolveTipoExpedienteLabel(item, catalogById)))
        .filter(Boolean);

    return Array.from(new Set(labels));
}

/**
 * Rehidrata clientes del caso desde SQLite usando la pivot `case_client`.
 * Se usa cuando el caso ya pasó por syncDown y queremos evitar un segundo
 * fetch inicial de `GET /cases/{id}/clients`.
 */
async function readCaseClientsFromCache(caseId) {
    if (!window.electronAPI?.db?.getAll || !caseId) return [];

    const [pivotRows, clientRows] = await Promise.all([
        window.electronAPI.db.getAll('case_client'),
        window.electronAPI.db.getAll('clients'),
    ]);

    const clientIds = new Set(
        (pivotRows || [])
            .filter((row) => String(row.suit_case_id) === String(caseId))
            .map((row) => String(row.client_id))
    );

    return (clientRows || []).filter((row) => clientIds.has(String(row.id)));
}

async function readCaseTipoExpedientesFromCache(caseId) {
    if (!window.electronAPI?.db?.getAll || !caseId) return [];

    const [pivotRows, catalogRows] = await Promise.all([
        window.electronAPI.db.getAll('case_tipo_expediente'),
        window.electronAPI.db.getAll('tipo_expedientes'),
    ]);

    const catalogById = new Map((catalogRows || []).map((row) => [String(row.id), row]));
    const casePivotRows = (pivotRows || []).filter((row) => String(row.suit_case_id) === String(caseId));

    return casePivotRows.map((row) => {
        const catalogRow = catalogById.get(String(row.tipo_expediente_id));
        return catalogRow || { id: row.tipo_expediente_id };
    });
}

const THUMB_INITIAL = { blobUrl: null, poster: null, isVideo: false, loading: true };

function thumbnailReducer(state, action) {
    switch (action.type) {
        case 'SET_IS_VIDEO': return { ...state, isVideo: action.payload };
        case 'SET_POSTER':   return { ...state, poster: action.payload };
        case 'SET_LOADING':  return { ...state, loading: action.payload };
        // Batches blobUrl + loading=false en un único re-render.
        case 'LOAD_DONE':    return { ...state, blobUrl: action.payload, loading: false };
        default:             return state;
    }
}

/**
 * Carga el binario de un item multimedia on-demand, construye una blobUrl para
 * preview y la revoca al desmontarse. Notifica al padre con la url y si es video.
 */
const MultimediaThumbnailItem = memo(function MultimediaThumbnailItem({
    item, onPreview, onDelete, onGenerateQr, isNew, onMarkAsSeen,
}) {
    const [thumbState, dispatch] = useReducer(thumbnailReducer, THUMB_INITIAL);
    const { blobUrl, poster, isVideo, loading } = thumbState;
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        let objectUrl = null;

        const load = async () => {
            try {
                const result = await downloadMultimedia(item.id);
                if (!mountedRef.current || !result.ok) return;

                const mimeType = result.data?.mimeType || item.mime_type || 'application/octet-stream';
                const uint8 = new Uint8Array(result.data.bytes);
                const blob = new Blob([uint8], { type: mimeType });
                objectUrl = URL.createObjectURL(blob);

                // Determinar si es video por mime_type o filename
                const videoLike = isVideoDocument({ mime_type: mimeType, filename: item.filename });
                dispatch({ type: 'SET_IS_VIDEO', payload: videoLike });

                if (videoLike) {
                    // Captura poster del primer frame del video
                    const { poster: framePoster } = await captureVideoPoster(objectUrl);
                    if (mountedRef.current) {
                        dispatch({ type: 'SET_POSTER', payload: framePoster });
                    }
                }

                if (mountedRef.current) {
                    // Batchea blobUrl + loading=false en un único re-render.
                    dispatch({ type: 'LOAD_DONE', payload: objectUrl });
                }
            } catch {
                if (mountedRef.current) dispatch({ type: 'SET_LOADING', payload: false });
            }
        };

        void load();

        return () => {
            mountedRef.current = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
        // Solo recargar si cambia el id del item
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id]);

    const handlePreview = useCallback(() => {
        if (blobUrl) onPreview({ item, blobUrl, isVideo, poster });
    }, [blobUrl, isVideo, item, onPreview, poster]);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handlePreview}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePreview()}
            aria-label={`Previsualizar ${item.filename || 'archivo'}`}
            className="group relative aspect-square overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-card-hover) cursor-pointer"
            onMouseEnter={() => isNew && onMarkAsSeen('multimedia', item.id)}
        >
            {isNew && (
                <div className="absolute top-2 left-2 z-20">
                    <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm border border-red-600 animate-pulse-subtle">
                        NUEVO
                    </span>
                </div>
            )}
            {loading ? (
                <div className="flex h-full items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
            ) : blobUrl ? (
                <>
                    {isVideo ? (
                        <div className="relative flex h-full w-full items-center justify-center bg-gray-900">
                            {poster
                                ? <img src={poster} alt={item.filename} className="h-full w-full object-cover opacity-80" />
                                : <Film className="h-10 w-10 text-gray-400" />
                            }
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="rounded-full bg-white/80 p-3 shadow text-gray-800">
                                    <Play className="h-6 w-6" fill="currentColor" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <img
                            src={blobUrl}
                            alt={item.filename}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                    )}
                    {/* Overlay de acciones al hover */}
                    <div className="absolute inset-0 flex items-end justify-end gap-1 p-2 pb-9 opacity-0 transition-opacity group-hover:opacity-100 z-10">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                            className="rounded-lg bg-red-500/90 p-1.5 text-white shadow hover:bg-red-600"
                            title="Eliminar"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onGenerateQr(item); }}
                            className="rounded-lg bg-blue-600/90 p-1.5 text-white shadow hover:bg-blue-700 transition-colors"
                            title="Generar QR para compartir"
                        >
                            <QrCode size={14} />
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex h-full items-center justify-center text-center text-xs text-(--text-tertiary) px-2">
                    {item.filename || 'Sin preview'}
                </div>
            )}
            {/* Nombre del archivo debajo */}
            <p className="absolute bottom-0 left-0 right-0 truncate bg-black/40 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {item.filename}
            </p>
        </div>
    );
});

const CASE_DATA_INITIAL = {
    participantsList: [],
    clientsList: [],
    overviewMetrics: { deadlinesCount: 0, eventsCount: 0, documentsCount: 0 },
};

function caseDataReducer(state, action) {
    switch (action.type) {
        case 'SET_PARTICIPANTS': return { ...state, participantsList: action.payload };
        case 'SET_CLIENTS':      return { ...state, clientsList: action.payload };
        case 'SET_METRICS':      return { ...state, overviewMetrics: action.payload };
        // Resetea los 3 arrays en un único dispatch al cambiar de caso.
        case 'RESET_CASE_DATA':  return CASE_DATA_INITIAL;
        default:                 return state;
    }
}

const CaseDetailTabContent = memo(function CaseDetailTabContent({
    activeTab,
    caseData,
    syncResult,
    caseSyncing = false,
    newItemsByEntity = { documents: new Set(), events: new Set(), multimedia: new Set(), archivos: new Set() },
    onMarkAsSeen = () => { },
}) {
    const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
    const [isAddClientOpen, setIsAddClientOpen] = useState(false);
    const [bibliotecaTab, setBibliotecaTab] = useState('documents');
    const [cronogramaTab, setCronogramaTab] = useState('agenda');

    const [caseDataState, dispatchCaseData] = useReducer(caseDataReducer, CASE_DATA_INITIAL);
    const { participantsList, clientsList, overviewMetrics } = caseDataState;
    const setParticipantsList = (v) => dispatchCaseData({ type: 'SET_PARTICIPANTS', payload: v });
    const setClientsList      = (v) => dispatchCaseData({ type: 'SET_CLIENTS',      payload: v });
    const setOverviewMetrics  = (v) => dispatchCaseData({ type: 'SET_METRICS',      payload: v });

    const [nextEvent, setNextEvent] = useState(undefined); // undefined = cargando, null = no hay
    const [multimediaUploading, setMultimediaUploading] = useState(false);
    const [archivosUploading, setArchivosUploading] = useState(false);
    // Item siendo previsualizaddo: { item, blobUrl, isVideo, poster }
    const [previewItem, setPreviewItem] = useState(null);
    const { badgeColor: deadlineBadgeColor } = useCaseDeadlineBadge(caseData.id);

    // Filter & Sort States for Case Files
    const [archivosSearchTerm, setArchivosSearchTerm] = useState('');
    const [archivosSortBy, setArchivosSortBy] = useState('created_at');
    const [archivosSortOrder, setArchivosSortOrder] = useState('desc');
    const [archivosSelectedExtensions, setArchivosSelectedExtensions] = useState([]);
    const [archivosPage, setArchivosPage] = useState(1);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrData, setQrData] = useState(null);
    const [caseTipoExpedientesFromCache, setCaseTipoExpedientesFromCache] = useState([]);

    const navigate = useNavigate();
    const { openModal } = useModal();
    const { dialogProps, openDialog, closeDialog } = useConfirmDialog();
    const { documents } = useDocuments();
    const {
        multimedia,
        refreshData: refreshMultimedia,
        loadLocalData: loadMultimediaLocalData,
        removeItem: removeMultimediaItem,
    } = useMultimedia();
    const {
        files,
        refreshData: refreshFiles,
        loadLocalData: loadFilesLocalData,
        removeItem: removeFilesItem,
    } = useFiles();
    const { case_types: caseTypes = [] } = useCaseTypes();
    const { radicaciones = [] } = useRadicaciones();
    const { tipo_expedientes: tipoExpedientes = [] } = useTipoExpedientes();
    useCompetencias();
    const { data: jurisdicciones = [] } = useJurisdicciones();
    const { data: allDependencias = [] } = useDependenciasJudiciales();
    const {
        partesCaso,
        linkedParteIds,
        error: partesError,
        linkParte,
        unlinkParte,
    } = usePartesCaso(caseData.id, {
        enabled: activeTab === 'parties' && !caseSyncing,
        skipInitialFetch: activeTab === 'parties' && !caseSyncing,
    });
    const statusLabel = getCaseStatusLabel(caseData);
    const caseTypeLabel = useMemo(
        () => getCaseTypeLabel(caseData, caseTypes),
        [caseData, caseTypes],
    );
    const radicacionLabel = useMemo(
        () => getRadicacionLabel(caseData, radicaciones),
        [caseData, radicaciones],
    );
    const competenciaLabel = useMemo(
        () => getCompetenciaLabel(caseData, allDependencias),
        [caseData, allDependencias],
    );
    const jurisdiccionLabel = useMemo(
        () => getJurisdiccionLabel(caseData, allDependencias, jurisdicciones),
        [caseData, allDependencias, jurisdicciones],
    );
    const tipoExpedienteResolutionSnapshot = useMemo(
        () => buildTipoExpedienteResolutionSnapshot(caseData, tipoExpedientes, caseTipoExpedientesFromCache),
        [caseData, tipoExpedientes, caseTipoExpedientesFromCache],
    );
    const tipoExpedienteLabels = useMemo(
        () => getCaseTipoExpedienteLabels(caseData, tipoExpedientes, caseTipoExpedientesFromCache),
        [caseData, tipoExpedientes, caseTipoExpedientesFromCache],
    );
    const lastTipoExpedienteDiagKeyRef = useRef('');
    const caseDocs = useMemo(
        () => documents?.filter((doc) => Number(doc.suit_case_id) === Number(caseData.id)) || [],
        [caseData.id, documents],
    );
    // Multimedia y archivos del caso — filtramos por caseId y excluimos soft-deleted
    const caseMultimedia = useMemo(
        () => (multimedia || []).filter((m) => Number(m.suit_case_id) === Number(caseData.id) && !m.deleted_at),
        [caseData.id, multimedia],
    );
    const caseFiles = useMemo(
        () => (files || []).filter((f) => Number(f.suit_case_id) === Number(caseData.id) && !f.deleted_at),
        [caseData.id, files],
    );

    // Filtering & Sorting for Case Files
    const filteredCaseFiles = useMemo(() => {
        let result = [...caseFiles];
        const term = archivosSearchTerm.toLowerCase().trim();

        // 1. Search term
        if (term) {
            result = result.filter(f => (f.filename || '').toLowerCase().includes(term));
        }

        // 2. Extensions
        if (archivosSelectedExtensions.length > 0) {
            result = result.filter(file => {
                const name = (file.filename || '').toLowerCase();
                const mime = (file.mime_type || '').toLowerCase();
                
                return archivosSelectedExtensions.some(extGroup => {
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

        // 3. Sort
        result.sort((a, b) => {
            let comparison = 0;
            if (archivosSortBy === 'created_at') {
                const dateA = new Date(a.created_at || a.updated_at);
                const dateB = new Date(b.created_at || b.updated_at);
                comparison = dateA - dateB;
            } else if (archivosSortBy === 'name') {
                comparison = (a.filename || '').localeCompare(b.filename || '');
            } else if (archivosSortBy === 'size') {
                comparison = (a.size || 0) - (b.size || 0);
            }
            return archivosSortOrder === 'desc' ? -comparison : comparison;
        });

        // 4. Pagination
        return result.slice(0, archivosPage * 20);
    }, [caseFiles, archivosSearchTerm, archivosSelectedExtensions, archivosSortBy, archivosSortOrder, archivosPage]);

    const hasMoreArchivos = filteredCaseFiles.length < caseFiles.length && !archivosSearchTerm.trim() && archivosSelectedExtensions.length === 0;
    const caseDocumentNavigationState = useMemo(() => ({
        returnTo: {
            pathname: `/cases/${caseData.id}`,
            state: {
                activeTab: 'biblioteca',
            },
        },
    }), [caseData.id]);

    /**
     * Mantiene el retorno al detalle del caso cuando se abre o crea un documento desde esta pestaña.
     */
    const openCaseDocumentEditor = useCallback((path) => {
        navigate(path, { state: caseDocumentNavigationState });
    }, [caseDocumentNavigationState, navigate]);

    // Resetea los datos del caso en un único dispatch al cambiar de expediente.
    useEffect(() => {
        dispatchCaseData({ type: 'RESET_CASE_DATA' });
    }, [caseData.id]);

    /**
     * syncDown ya persiste multimedia/archivos en SQLite. Para reflejar esos cambios
     * en la UI no debemos volver a golpear `/api/multimedia` ni `/api/files`;
     * basta con releer la caché local.
     */
    useEffect(() => {
        if (!syncResult?.changed) return;
        if (syncResult.staleEntities.includes('multimedia')) void loadMultimediaLocalData();
        if (syncResult.staleEntities.includes('archivos')) void loadFilesLocalData();
    }, [loadFilesLocalData, loadMultimediaLocalData, syncResult]);

    /**
     * Relee los participantes desde la API para mantener sincronizadas Partes y Permisos.
     */
    const refreshParticipants = useCallback(async () => {
        try {
            const data = await getParticipants(caseData.id);
            setParticipantsList(Array.isArray(data) ? data : []);
        } catch (error) {
            void logger.error('No se pudieron cargar los participantes del caso', error);
            setParticipantsList([]);
        }
    }, [caseData.id]);

    /**
     * Relee los clientes ya vinculados al caso sin bloquear la UI si el endpoint aún no existe.
     */
    const refreshClients = useCallback(async ({ fromCacheOnly = false } = {}) => {
        try {
            if (fromCacheOnly) {
                const cachedClients = await readCaseClientsFromCache(caseData.id);
                setClientsList(Array.isArray(cachedClients) ? cachedClients : []);
                return cachedClients;
            }

            const data = await getCaseClients(caseData.id);
            if (Array.isArray(data)) {
                setClientsList(data);
                return data;
            }
            return [];
        } catch (error) {
            void logger.warn('No se pudieron cargar los clientes del caso', error);
            return null;
        }
    }, [caseData.id]);

    /**
     * Carga los contadores del resumen del caso.
     * El detalle del caso mantiene fresca la cache con syncDown; acá sólo releemos SQLite.
     * Un único punto de disparo evita además el doble conteo que antes ocurría con
     * efectos paralelos.
     */
    const refreshOverviewMetrics = useCallback(async () => {
        try {
            const [metrics, next] = await Promise.all([
                getCaseOverviewMetrics(caseData.id),
                window.electronAPI?.db?.getCaseNextEvent?.(caseData.id) ?? null,
            ]);
            setOverviewMetrics(metrics);
            setNextEvent(next ?? null);
        } catch (error) {
            void logger.error('No se pudieron cargar las métricas del caso', error);
            setOverviewMetrics({ deadlinesCount: 0, eventsCount: 0, documentsCount: 0 });
            setNextEvent(null);
        }
    }, [caseData.id]);

    useEffect(() => {
        if (activeTab === 'permissions') {
            void refreshParticipants();
        }

        if (activeTab === 'parties') {
            if (caseSyncing) return;
            void refreshClients({ fromCacheOnly: true });
        }
    }, [activeTab, caseData.id, caseSyncing, refreshClients, refreshParticipants]);

    useEffect(() => {
        if (caseSyncing) return;
        if (!syncResult) return;

        let cancelled = false;

        const loadCaseTipoExpedientes = async () => {
            const rows = await readCaseTipoExpedientesFromCache(caseData.id);
            if (!cancelled) {
                setCaseTipoExpedientesFromCache(rows);
            }
        };

        void loadCaseTipoExpedientes().catch((error) => {
            void logger.error('No se pudieron leer los tipos de expediente cacheados en pivot', {
                caseId: caseData.id,
                error: error?.message || String(error),
            });
        });

        return () => {
            cancelled = true;
        };
    }, [caseData.id, caseSyncing, syncResult]);

    useEffect(() => {
        const diagKey = JSON.stringify({
            caseId: caseData?.id ?? null,
            labels: tipoExpedienteLabels,
            catalogCount: tipoExpedienteResolutionSnapshot.catalogCount,
            sourceCollections: tipoExpedienteResolutionSnapshot.sourceCollections.map(({ key, isArray, length }) => ({
                key,
                isArray,
                length,
            })),
            unresolvedRefs: tipoExpedienteResolutionSnapshot.unresolvedRefs,
        });

        if (lastTipoExpedienteDiagKeyRef.current === diagKey) {
            return;
        }

        if (tipoExpedienteLabels.length === 0) {
            lastTipoExpedienteDiagKeyRef.current = diagKey;
            void logger.warn('No se pudieron resolver tipos de expediente para el caso', {
                ...tipoExpedienteResolutionSnapshot,
                caseDataKeys: Object.keys(caseData || {}),
                fallbackVisibleMessage: 'Sin tipos de expediente asociados.',
            });
            return;
        }

        if (tipoExpedienteResolutionSnapshot.unresolvedRefs.length > 0) {
            lastTipoExpedienteDiagKeyRef.current = diagKey;
            void logger.warn('Resolucion parcial de tipos de expediente (ids sin catalogo)', {
                ...tipoExpedienteResolutionSnapshot,
                resolvedLabels: tipoExpedienteLabels,
            });
        }
    }, [caseData, tipoExpedienteLabels, tipoExpedienteResolutionSnapshot]);

    // Esperamos a que termine el sync del caso antes de releer métricas para evitar
    // carreras contra la persistencia en SQLite.
    useEffect(() => {
        if (activeTab !== 'overview') return;
        if (caseSyncing) return;
        void refreshOverviewMetrics();
    }, [activeTab, caseData.id, caseDocs.length, caseSyncing, syncResult, refreshOverviewMetrics]);

    const handleAddParticipantSuccess = async () => {
        await refreshParticipants();
    };

    const handleAddClientSuccess = async (linkedClient = null) => {
        if (linkedClient?.id != null) {
            const alreadyLinked = clientsList.some((entry) => String(entry.id) === String(linkedClient.id));
            if (!alreadyLinked) setClientsList([...clientsList, linkedClient]);
        }
        await refreshClients();
        await refreshOverviewMetrics();
    };

    const handleDeleteParticipant = async (userId) => {
        try {
            const res = await removeParticipant(caseData.id, userId);
            if (!res.ok) {
                throw new Error(getApiErrorMessage(res, 'No se pudo quitar al usuario del caso.'));
            }
            setParticipantsList(participantsList.filter((participant) => String(participant.id) !== String(userId)));
            showAppToast({
                title: 'Usuario desvinculado',
                description: 'El usuario dejó de colaborar en este caso.',
                variant: 'success',
            });
        } catch (error) {
            void logger.error('No se pudo completar la acción del detalle del expediente', error);
            showAppToast({
                title: 'Error',
                description: error.message || 'No se pudo quitar al usuario del caso.',
                variant: 'danger',
            });
        }
    };

    const handleDeleteClient = async (clientId) => {
        try {
            const result = await unlinkClientFromCase(caseData.id, clientId);
            if (!result.ok) {
                throw new Error(getApiErrorMessage(result, 'No se pudo desvincular el cliente.'));
            }

            setClientsList(clientsList.filter((client) => String(client.id) !== String(clientId)));
            showAppToast({
                title: 'Cliente desvinculado',
                description: 'El cliente dejó de estar asociado al expediente.',
                variant: 'success',
            });
            await refreshOverviewMetrics();
        } catch (error) {
            void logger.error('No se pudo desvincular el cliente del caso', error);
            showAppToast({
                title: 'Error',
                description: error.message || 'No se pudo desvincular el cliente.',
                variant: 'danger',
            });
        }
    };

    /**
     * Vincula una parte existente o recién creada al caso actual y refresca la UI
     * visible del tab Partes sin desviar al usuario a la pestaña de permisos.
     */
    const handleParteSelected = useCallback(async (parte) => {
        if (!parte?.id) return;

        if (linkedParteIds.has(String(parte.id))) {
            showAppToast({
                title: 'Parte ya vinculada',
                description: 'La parte seleccionada ya forma parte de este expediente.',
                variant: 'warning',
            });
            return;
        }

        try {
            const result = await linkParte(parte.id);
            if (!result?.ok) {
                throw new Error(getApiErrorMessage(result, 'No se pudo vincular la parte.'));
            }

            showAppToast({
                title: 'Parte vinculada',
                description: 'La parte quedó asociada al expediente.',
                variant: 'success',
            });
        } catch (error) {
            void logger.error('No se pudo vincular la parte al caso', error);
            showAppToast({
                title: 'Error',
                description: error.message || 'No se pudo vincular la parte.',
                variant: 'danger',
            });
        }
    }, [linkedParteIds, linkParte]);

    /**
     * Desvincula una parte del caso manteniendo el listado del tab sincronizado.
     */
    const handleDeleteParte = useCallback(async (parteId) => {
        try {
            const result = await unlinkParte(parteId);
            if (!result?.ok) {
                throw new Error(getApiErrorMessage(result, 'No se pudo quitar la parte del expediente.'));
            }

            showAppToast({
                title: 'Parte desvinculada',
                description: 'La parte dejó de estar asociada al expediente.',
                variant: 'success',
            });
        } catch (error) {
            void logger.error('No se pudo desvincular la parte del caso', error);
            showAppToast({
                title: 'Error',
                description: error.message || 'No se pudo quitar la parte del expediente.',
                variant: 'danger',
            });
        }
    }, [unlinkParte]);

    /**
     * Sube un archivo multimedia (imagen o video) al caso.
     */
    const handleMultimediaUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Límite de 100MB — ajustar cuando se configure upload_max_filesize en el server
        const MAX_SIZE_MB = 100;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            showAppToast({
                title: 'Archivo demasiado grande',
                description: `El archivo supera el límite de ${MAX_SIZE_MB} MB. Usá un archivo más pequeño.`,
                variant: 'danger',
            });
            e.target.value = '';
            return;
        }
        setMultimediaUploading(true);
        try {
            const res = await uploadMultimedia(file, caseData.id);
            if (!res.ok) throw new Error(getApiErrorMessage(res, 'Error al subir el archivo'));
            showAppToast({ title: 'Multimedia subida', description: file.name, variant: 'success' });
            await refreshMultimedia();
        } catch (err) {
            void logger.error('Error subiendo multimedia', err);
            showAppToast({ title: 'Error', description: err.message || 'No se pudo subir el archivo.', variant: 'danger' });
        } finally {
            setMultimediaUploading(false);
            // Limpiar el input para permitir subir el mismo archivo nuevamente
            e.target.value = '';
        }
    }, [caseData.id, refreshMultimedia]);

    /**
     * Elimina un item multimedia del caso con confirmación.
     */
    const handleDeleteMultimediaItem = useCallback((item) => {
        openDialog({
            title: '¿Eliminar archivo?',
            desc: `Estás a punto de eliminar "${item.filename}". Esta acción no se puede deshacer.`,
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                try {
                    const res = await deleteMultimedia(item.id);
                    if (res.ok || res.status === 404) {
                        removeMultimediaItem(item.id);
                        showAppToast({ title: 'Archivo eliminado', variant: 'success' });
                        if (previewItem?.item?.id === item.id) setPreviewItem(null);
                    } else {
                        showAppToast({ title: 'Error', description: getApiErrorMessage(res, 'No se pudo eliminar.'), variant: 'danger' });
                    }
                } catch (err) {
                    void logger.error('Error eliminando multimedia', err);
                    showAppToast({ title: 'Error de red', variant: 'danger' });
                } finally {
                    closeDialog();
                }
            },
        });
    }, [closeDialog, openDialog, previewItem, removeMultimediaItem]);

    /**
     * Genera un QR para descargar un archivo general del caso.
     */
    const handleGenerateArchivoQr = useCallback(async (file) => {
        try {
            console.log('[CaseDetailTabContent] Click generar QR ARCHIVO. Case ID:', caseData.id, 'File ID:', file.id);
            const res = await generateCaseLink(caseData.id, {
                type: 'download',
                model_type: 'file',
                model_id: file.id
            });
            if (res.download_url) {
                setQrData({
                    ...res,
                    signed_url: res.download_url, // QrCodeModal expects signed_url
                    title: 'Escanea para descargar',
                    description: `Descargar "${file.filename}" en tu dispositivo móvil.`,
                    file: { name: file.filename }
                });
                setQrModalOpen(true);
            }
        } catch (err) {
            void logger.error('Error generando QR de archivo', err);
            const message = err.message?.includes('422') || err.message?.includes('403')
                ? 'No tenes permisos para realizar esta accion.'
                : 'No se pudo generar el QR.';
            showAppToast({ title: 'Error', description: message, variant: 'danger' });
        }
    }, [caseData.id]);

    /**
     * Genera un QR para descargar un elemento multimedia.
     */
    const handleGenerateMultimediaQr = useCallback(async (item) => {
        try {
            console.log('[CaseDetailTabContent] Click generar QR MULTIMEDIA. Case ID:', caseData.id, 'Item ID:', item.id);
            const res = await generateCaseLink(caseData.id, {
                type: 'download',
                model_type: 'multimedia',
                model_id: item.id
            });
            if (res.download_url) {
                setQrData({
                    ...res,
                    signed_url: res.download_url,
                    title: 'Escanea para descargar',
                    description: `Ver "${item.filename}" en tu dispositivo móvil.`,
                    file: { name: item.filename }
                });
                setQrModalOpen(true);
            }
        } catch (err) {
            void logger.error('Error generando QR de multimedia', err);
            const message = err.message?.includes('422') || err.message?.includes('403')
                ? 'No tenes permisos para realizar esta accion.'
                : 'No se pudo generar el QR.';
            showAppToast({ title: 'Error', description: message, variant: 'danger' });
        }
    }, [caseData.id]);

    /**
     * Genera un QR para subir archivos o multimedia al caso.
     */
    const handleGenerateUploadQr = useCallback(async (modelType) => {
        try {
            console.log('[CaseDetailTabContent] Click generar QR CARGA. Case ID:', caseData.id, 'Model type:', modelType);
            const res = await generateCaseLink(caseData.id, {
                type: 'upload',
                model_type: modelType
            });
            if (res.upload_url) {
                setQrData({
                    ...res,
                    signed_url: res.upload_url,
                    title: 'Escanea para cargar',
                    description: `Cargá ${modelType === 'file' ? 'archivos' : 'multimedia'} directamente desde tu celular.`
                });
                setQrModalOpen(true);
            }
        } catch (err) {
            void logger.error('Error generando QR de carga', err);
            const message = err.message?.includes('422') || err.message?.includes('403')
                ? 'No tenes permisos para realizar esta accion.'
                : 'No se pudo generar el enlace de carga.';
            showAppToast({ title: 'Error', description: message, variant: 'danger' });
        }
    }, [caseData.id]);

    /**
     * Descarga un archivo multimedia al disco usando el diálogo nativo.
     */
    const handleDownloadMultimedia = useCallback(async (item) => {
        try {
            const res = await downloadMultimedia(item.id);
            if (!res.ok) throw new Error(getApiErrorMessage(res, 'Error al descargar'));
            await window.electronAPI.dialog.saveFile({
                defaultName: item.filename || 'multimedia',
                bytes: res.data.bytes,
                mimeType: res.data.mimeType,
            });
        } catch (err) {
            void logger.error('Error descargando multimedia', err);
            showAppToast({ title: 'Error', description: 'No se pudo descargar el archivo.', variant: 'danger' });
        }
    }, []);

    /**
     * Navega al elemento multimedia anterior o siguiente en la lista.
     */
    const handleNavigateMultimedia = useCallback(async (direction) => {
        if (!previewItem || caseMultimedia.length <= 1) return;

        const currentIndex = caseMultimedia.findIndex((m) => Number(m.id) === Number(previewItem.item.id));
        if (currentIndex === -1) return;

        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % caseMultimedia.length;
        } else {
            nextIndex = (currentIndex - 1 + caseMultimedia.length) % caseMultimedia.length;
        }

        const nextItem = caseMultimedia[nextIndex];

        try {
            const result = await downloadMultimedia(nextItem.id);
            if (!result.ok) throw new Error('Download failed');

            const mimeType = result.data?.mimeType || nextItem.mime_type || 'application/octet-stream';
            const uint8 = new Uint8Array(result.data.bytes);
            const blob = new Blob([uint8], { type: mimeType });
            const objectUrl = URL.createObjectURL(blob);
            const videoLike = isVideoDocument({ mime_type: mimeType, filename: nextItem.filename });

            let poster = null;
            if (videoLike) {
                const { poster: framePoster } = await captureVideoPoster(objectUrl);
                poster = framePoster;
            }

            // Revocamos el anterior si fue generado por nosotros para evitar fugas
            if (previewItem.isGenerated && previewItem.blobUrl) {
                URL.revokeObjectURL(previewItem.blobUrl);
            }

            setPreviewItem({
                item: nextItem,
                blobUrl: objectUrl,
                isVideo: videoLike,
                poster,
                isGenerated: true,
            });
        } catch (err) {
            void logger.error('Error navigating multimedia', err);
            showAppToast({ title: 'Error', description: 'No se pudo cargar el archivo.', variant: 'danger' });
        }
    }, [previewItem, caseMultimedia]);

    /**
     * Cierra el visor multimedia revocando la URL si fue generada localmente.
     */
    const closePreview = useCallback(() => {
        if (previewItem?.isGenerated && previewItem?.blobUrl) {
            URL.revokeObjectURL(previewItem.blobUrl);
        }
        setPreviewItem(null);
    }, [previewItem]);

    // Manejo de teclado para el visor
    useEffect(() => {
        if (!previewItem || caseMultimedia.length <= 1) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                void handleNavigateMultimedia('next');
            } else if (e.key === 'ArrowLeft') {
                void handleNavigateMultimedia('prev');
            } else if (e.key === 'Escape') {
                closePreview();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previewItem, caseMultimedia.length, handleNavigateMultimedia, closePreview]);

    /**
     * Sube un archivo general (PDF, Word, Excel, CSV) al caso.
     */
    const handleArchivoUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void logger.info('Upload archivo: inicio', { name: file.name, size: file.size, type: file.type, caseId: caseData.id });
        setArchivosUploading(true);
        try {
            const res = await uploadFile(file, caseData.id);
            void logger.info('Upload archivo: respuesta API', { ok: res.ok, status: res.status, data: res.data, error: res.error });
            if (!res.ok) throw new Error(getApiErrorMessage(res, 'Error al subir el archivo'));
            showAppToast({ title: 'Archivo subido', description: file.name, variant: 'success' });
            await refreshFiles();
        } catch (err) {
            void logger.error('Error subiendo archivo — detalle completo', { message: err.message, stack: err.stack });
            showAppToast({ title: 'Error', description: err.message || 'No se pudo subir el archivo.', variant: 'danger' });
        } finally {
            setArchivosUploading(false);
            e.target.value = '';
        }
    }, [caseData.id, refreshFiles]);

    /**
     * Elimina un archivo general del caso con confirmación.
     */
    const handleDeleteArchivoItem = useCallback((item) => {
        openDialog({
            title: '¿Eliminar archivo?',
            desc: `Estás a punto de eliminar "${item.filename}". Esta acción no se puede deshacer.`,
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                try {
                    const res = await deleteFile(item.id);
                    if (res.ok || res.status === 404) {
                        removeFilesItem(item.id);
                        showAppToast({ title: 'Archivo eliminado', variant: 'success' });
                    } else {
                        showAppToast({ title: 'Error', description: getApiErrorMessage(res, 'No se pudo eliminar.'), variant: 'danger' });
                    }
                } catch (err) {
                    void logger.error('Error eliminando archivo', err);
                    showAppToast({ title: 'Error de red', variant: 'danger' });
                } finally {
                    closeDialog();
                }
            },
        });
    }, [closeDialog, openDialog, removeFilesItem]);

    /**
     * Descarga un archivo general al disco usando el diálogo nativo.
     */
    const handleDownloadArchivo = useCallback(async (item) => {
        try {
            const res = await downloadFile(item.id);
            if (!res.ok) throw new Error(getApiErrorMessage(res, 'Error al descargar'));
            await window.electronAPI.dialog.saveFile({
                defaultName: item.filename || 'archivo',
                bytes: res.data.bytes,
                mimeType: res.data.mimeType,
            });
        } catch (err) {
            void logger.error('Error descargando archivo', err);
            showAppToast({ title: 'Error', description: 'No se pudo descargar el archivo.', variant: 'danger' });
        }
    }, []);

    /**
     * El tab Partes sólo gestiona clientes y partes procesales.
     * Los usuarios internos se comparten exclusivamente desde Permisos.
     */
    const handleOpenAddParteModal = useCallback(() => {
        openModal(SelectParteModal, {
            linkedParteIds: Array.from(linkedParteIds),
            onParteSelected: handleParteSelected,
        });
    }, [handleParteSelected, linkedParteIds, openModal]);

    const parteRows = partesCaso.map((parte) => {
        const fullName = `${parte.nombre || ''} ${parte.apellido || ''}`.trim() || 'Parte sin nombre';
        const subtitleParts = [];

        if (parte.rol?.titulo || parte.rol_titulo) {
            subtitleParts.push(parte.rol?.titulo || parte.rol_titulo);
        }

        if (parte.email) {
            subtitleParts.push(parte.email);
        }

        return (
            <LinkedPartyRow
                key={parte.id}
                avatar={fullName.charAt(0).toUpperCase()}
                title={fullName}
                subtitle={subtitleParts.join(' • ') || 'Parte vinculada al caso'}
                action={(
                    <button
                        type="button"
                        onClick={() => handleDeleteParte(parte.id)}
                        className="p-2 text-(--text-tertiary) transition-colors hover:text-red-500"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            />
        );
    });

    const clientRows = clientsList.map((client) => (
        <LinkedPartyRow
            key={client.id}
            avatar={getClientDisplayName(client).charAt(0).toUpperCase()}
            title={getClientDisplayName(client)}
            subtitle={client.identification_number ? `DNI/CUIT ${client.identification_number}` : 'Cliente vinculado al caso'}
            action={(
                <button
                    type="button"
                    onClick={() => handleDeleteClient(client.id)}
                    className="p-2 text-(--text-tertiary) transition-colors hover:text-red-500"
                >
                    <Trash2 size={16} />
                </button>
            )}
        />
    ));

    let content = null;

    switch (activeTab) {
        case 'overview':
            content = (
                <div className={CASE_DETAIL_WIDE_SECTION_CLASS}>
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            {/* Fila Superior: Estado y Próximo Evento */}
                            <div className="md:col-span-2 rounded-xl border border-(--border-default) bg-(--bg-card) p-6 shadow-sm">
                                <h3 className="mb-2 text-xl font-semibold text-(--text-primary)">Estado del Caso</h3>
                                <div className="flex items-center gap-3">
                                    <span className={`rounded-full border px-3 py-1 text-sm font-medium ${resolveStatusClasses(statusLabel)}`}>
                                        {statusLabel}
                                    </span>
                                    <span className="text-sm text-(--text-secondary)">
                                        Iniciado: {caseData.start_date ? dayjs(caseData.start_date).format('LL') : 'Sin fecha'}
                                    </span>
                                    {caseData.end_date && (
                                        <span className="ml-3 border-l border-(--border-default) pl-3 text-sm text-(--text-secondary)">
                                            Finalizado: {dayjs(caseData.end_date).format('LL')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-(--border-default) bg-(--bg-card) p-6 shadow-sm">
                                <h3 className="mb-4 text-xl font-semibold text-(--text-primary)">Próximo evento</h3>
                                {nextEvent ? (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm font-bold text-blue-700 uppercase tracking-tight">
                                                {nextEvent.title || 'Evento sin título'}
                                            </p>
                                            <p className="text-xs font-semibold text-(--text-tertiary) uppercase tracking-widest mt-0.5">
                                                {nextEvent.event_type_name || 'Otro'}
                                            </p>
                                        </div>
                                        <div className="inline-block rounded-xl border border-blue-100 bg-blue-300/10 px-4 py-3 shadow-none">
                                            <p className="font-bold text-blue-700 text-lg">
                                                {dayjs(nextEvent.starts_at).format('DD MMM - HH:mm')} hs
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-yellow-100 bg-yellow-50/50 px-4 py-3">
                                        <span className="text-xs font-bold text-yellow-600 uppercase tracking-tight">Sin eventos próximos</span>
                                    </div>
                                )}
                            </div>

                            {/* Fila Inferior: Descripción/Datos e Información Clave */}
                            <div className="md:col-span-2 space-y-6">
                                <div className="rounded-xl border border-(--border-default) bg-(--bg-card) p-6 shadow-sm">
                                    <h3 className="mb-4 text-xl font-semibold text-(--text-primary)">Descripción</h3>
                                    <textarea
                                        className="h-32 w-full resize-none rounded-lg border-none bg-(--bg-input) p-4 text-(--text-secondary) focus:ring-2 focus:ring-blue-500/20"
                                        value={caseData.details || ''}
                                        readOnly
                                    />

                                    <div className="mt-8 border-t border-(--border-subtle) pt-6">
                                        <h3 className="mb-4 text-xl font-semibold text-(--text-primary)">Datos del caso</h3>
                                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Nro. de expediente</p>
                                                <p className="mt-1 font-medium text-(--text-primary)">{caseData.nro_expediente || 'Sin número cargado'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Fuero</p>
                                                <p className="mt-1 font-medium text-(--text-primary)">{caseTypeLabel}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Radicación</p>
                                                <p className="mt-1 font-medium text-(--text-primary)">{radicacionLabel}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Jurisdicción</p>
                                                <p className="mt-1 font-medium text-(--text-primary)">{jurisdiccionLabel}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Juzgado</p>
                                                <p className="mt-1 font-medium text-(--text-primary)">{competenciaLabel}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Tipos de expediente</p>
                                                {tipoExpedienteLabels.length > 0 ? (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {tipoExpedienteLabels.map((label) => (
                                                            <span
                                                                key={label}
                                                                className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                                                            >
                                                                {label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="mt-1 text-sm text-(--text-tertiary) italic">Sin tipos de expediente asociados.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div> 
                                </div>
                            </div>

                            <div className="rounded-xl border border-(--border-default) bg-(--bg-card) p-6 shadow-sm">
                                <h3 className="mb-4 text-xl font-semibold text-(--text-primary)">Información Clave</h3>
                                <div className="space-y-4">
                                    <OverviewMetricCard
                                        label="Vencimientos"
                                        value={overviewMetrics.deadlinesCount}
                                        description="Eventos tipificados como vencimiento."
                                    />
                                    <OverviewMetricCard
                                        label="Eventos"
                                        value={overviewMetrics.eventsCount}
                                        description="Eventos del caso excluyendo vencimientos."
                                    />
                                    <OverviewMetricCard
                                        label="Documentos"
                                        value={overviewMetrics.documentsCount}
                                        description="Documentos raíz asociados al expediente."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
            break;
        case 'parties':
            content = (
                <div className={CASE_DETAIL_WIDE_SECTION_CLASS}>
                    <div className="space-y-6 rounded-xl border border-(--border-default) bg-(--bg-card) p-6 shadow-sm animate-in fade-in duration-300">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-semibold text-(--text-primary)">Partes del Caso</h3>
                                <p className="text-sm text-(--text-secondary)">
                                    Gestiona clientes y partes procesales vinculadas al expediente.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddClientOpen(true)}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                                >
                                    <Plus size={16} /> Agregar Cliente
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenAddParteModal}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                                >
                                    <Users size={16} /> Agregar Parte
                                </button>
                            </div>
                        </div>

                        {partesError ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {partesError}
                            </div>
                        ) : null}

                        <div className="grid gap-6 lg:grid-cols-2">
                            <PartiesSection
                                title="Clientes"
                                subtitle={`${clientsList.length} vinculados al expediente`}
                                action={null}
                                items={clientRows}
                                emptyMessage="No hay clientes vinculados a este caso."
                            />
                            <PartiesSection
                                title="Partes"
                                subtitle={`${partesCaso.length} vinculadas al expediente`}
                                action={null}
                                items={parteRows}
                                emptyMessage="No hay partes vinculadas a este caso."
                            />
                        </div>
                    </div>
                </div>
            );
            break;
        case 'biblioteca': {
            const BIBLIOTECA_TABS = [
                { id: 'documents', label: 'Documentación', testId: 'biblioteca-nav-documents', icon: FileText, hasBadge: newItemsByEntity.documents.size > 0 },
                { id: 'archivos', label: 'Archivos', testId: 'biblioteca-nav-archivos', icon: FolderArchive, hasBadge: newItemsByEntity.archivos.size > 0 },
                { id: 'multimedia', label: 'Multimedia', testId: 'biblioteca-nav-multimedia', icon: LucideImage, hasBadge: newItemsByEntity.multimedia.size > 0 },
            ];

            let bibliotecaContent = null;
            if (bibliotecaTab === 'documents') {
                bibliotecaContent = (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-6 border-b border-(--border-subtle) pb-4">
                            <div>
                                <h3 className="text-xl font-semibold text-(--text-primary)">Documentación Vinculada</h3>
                                <p className="text-sm text-(--text-secondary)">{caseDocs.length} documentos generados en el sistema</p>
                            </div>
                            <div className="flex gap-2">
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-(--border-default) bg-(--bg-card-hover) px-3 py-1.5 text-sm font-medium text-(--text-tertiary) shadow-sm"
                                                >
                                                    <ExternalLink size={16} /> Vincular Existente
                                                </button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            En desarrollo
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <button
                                    type="button"
                                    onClick={() => openCaseDocumentEditor(buildDocumentCreatePath({ caseId: caseData.id }))}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                                >
                                    <Plus size={16} /> Nuevo Doc
                                </button>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-(--border-default)">
                            <Table
                                isEmpty={caseDocs.length === 0}
                                emptyMessage="No hay documentos vinculados."
                                columns={[
                                    { header: 'Nombre' },
                                    { header: 'Últ. Modificación' },
                                    { header: 'Autor' },
                                ]}
                                className="rounded-t-none border-t-0 shadow-none"
                            >
                                {caseDocs.map((doc) => (
                                    <tr
                                        key={doc.id}
                                        className="group transition-colors hover:bg-(--bg-card-hover)"
                                        onMouseEnter={() => newItemsByEntity.documents.has(Number(doc.id)) && onMarkAsSeen('documents', doc.id)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                                                    <File className="h-5 w-5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openCaseDocumentEditor(buildDocumentEditPath(doc.id))}
                                                            className="cursor-pointer text-left font-medium text-(--text-primary) transition-colors hover:text-blue-600"
                                                        >
                                                            {doc.name || doc.title || 'Sin título'}
                                                        </button>
                                                        {newItemsByEntity.documents.has(Number(doc.id)) && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500 text-white shadow-sm border border-red-600 animate-pulse-subtle">
                                                                NUEVO
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-(--text-secondary)">
                                            {doc.updated_at ? dayjs(doc.updated_at).format('DD/MM/YYYY') : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-(--text-secondary)">
                                            {getDocumentLatestAuthorName(doc)}
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        </div>
                    </div>
                );
            } else if (bibliotecaTab === 'archivos') {
                bibliotecaContent = (
                    <div data-testid="case-archivos-panel" className="animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-6 border-b border-(--border-subtle) pb-4">
                            <div>
                                <h3 className="text-xl font-semibold text-(--text-primary)">Archivos del Caso</h3>
                                <p className="text-sm text-(--text-secondary)">{caseFiles.length} archivos · PDF, Word, Excel, CSV</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleGenerateUploadQr('file')}
                                    className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
                                    title="Generar QR para subir archivos desde el celular"
                                >
                                    <QrCode size={16} /> Subir vía QR
                                </button>
                                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
                                    <Upload size={16} />
                                    {archivosUploading ? 'Subiendo...' : 'Subir Archivo'}
                                    <input
                                        id="case-file-upload"
                                        data-testid="case-file-upload"
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                                        disabled={archivosUploading}
                                        onChange={handleArchivoUpload}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <BibliotecaFilters
                                searchTerm={archivosSearchTerm}
                                onSearchChange={(e) => {
                                    setArchivosSearchTerm(e.target.value);
                                    setArchivosPage(1);
                                }}
                                catalogOptions={[]}
                                sortBy={archivosSortBy}
                                onSortByChange={(val) => {
                                    setArchivosSortBy(val);
                                    setArchivosPage(1);
                                }}
                                sortOrder={archivosSortOrder}
                                onSortOrderChange={(val) => {
                                    setArchivosSortOrder(val);
                                    setArchivosPage(1);
                                }}
                                selectedExtensions={archivosSelectedExtensions}
                                onExtensionChange={(exts) => {
                                    setArchivosSelectedExtensions(exts);
                                    setArchivosPage(1);
                                }}
                                resultCount={filteredCaseFiles.length}
                            />

                            <BibliotecaGrid
                                files={filteredCaseFiles}
                                hasMore={hasMoreArchivos}
                                onLoadMore={() => setArchivosPage((prev) => prev + 1)}
                                onDownload={handleDownloadArchivo}
                                onOpenUploadModal={() => document.getElementById('case-file-upload').click()}
                                onDelete={handleDeleteArchivoItem}
                                onGenerateQr={handleGenerateArchivoQr}
                                deleteLoading={archivosUploading}
                                isNew={(f) => newItemsByEntity.archivos.has(Number(f.id))}
                                onMarkAsSeen={(id) => onMarkAsSeen('archivos', id)}
                            />
                        </div>
                    </div>
                );
            } else if (bibliotecaTab === 'multimedia') {
                bibliotecaContent = (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-6 border-b border-(--border-subtle) pb-4">
                            <div>
                                <h3 className="text-xl font-semibold text-(--text-primary)">Multimedia del Caso</h3>
                                <p className="text-sm text-(--text-secondary)">{caseMultimedia.length} elementos · imágenes y videos</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleGenerateUploadQr('multimedia')}
                                    className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
                                    title="Generar QR para subir multimedia desde el celular"
                                >
                                    <QrCode size={16} /> Subir vía QR
                                </button>
                                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
                                    <Upload size={16} />
                                    {multimediaUploading ? 'Subiendo...' : 'Subir Multimedia'}
                                    <input
                                        id="case-media-upload"
                                        data-testid="case-media-upload"
                                        type="file"
                                        className="hidden"
                                        accept="image/*,video/*"
                                        disabled={multimediaUploading}
                                        onChange={handleMultimediaUpload}
                                    />
                                </label>
                            </div>
                        </div>
                        {caseMultimedia.length === 0 ? (
                            <div data-testid="case-multimedia-empty" className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-(--border-strong) bg-(--bg-card-hover) text-(--text-tertiary)">
                                <Film className="mb-3 h-12 w-12 opacity-30" />
                                <p className="text-sm">No hay multimedia vinculada a este caso.</p>
                                <p className="text-xs mt-1 opacity-60">Subí imágenes o videos para verlos aquí.</p>
                            </div>
                        ) : (
                            <div data-testid="case-multimedia-grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                {caseMultimedia.map((item) => (
                                    <MultimediaThumbnailItem
                                        key={item.id}
                                        item={item}
                                        onPreview={setPreviewItem}
                                        onDelete={handleDeleteMultimediaItem}
                                        onGenerateQr={handleGenerateMultimediaQr}
                                        isNew={newItemsByEntity.multimedia.has(Number(item.id))}
                                        onMarkAsSeen={onMarkAsSeen}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            }

            content = (
                <div className={`animate-in fade-in duration-300 pt-2 ${CASE_DETAIL_WIDE_SECTION_CLASS}`}>
                    <SideMenuPageLayout
                        sections={BIBLIOTECA_TABS}
                        activeSection={bibliotecaTab}
                        onSectionChange={setBibliotecaTab}
                        sectionIdPrefix="biblioteca-tab"
                        maxWidthClass="w-full"
                    >
                        {bibliotecaContent}
                    </SideMenuPageLayout>
                </div>
            );
            break;
        }
        case 'permissions':
            content = (
                <div className={CASE_DETAIL_WIDE_SECTION_CLASS}>
                    <div className="overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-card) shadow-sm animate-in fade-in duration-300">
                        <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-header) p-4">
                            <div>
                                <h3 className="text-xl font-semibold text-(--text-primary)">Acceso y Colaboración</h3>
                                <p className="text-sm text-(--text-secondary)">Este módulo administra los usuarios con permisos sobre el caso.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAddParticipantOpen(true)}
                                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
                            >
                                <Lock size={16} /> Compartir
                            </button>
                        </div>
                        <ul className="divide-y divide-(--border-default)">
                            {participantsList.map((participant) => (
                                <li key={participant.id || participant.user_id} className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600">
                                            {(participant.user?.name?.charAt(0)) || participant.name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-(--text-primary)">{participant.user?.name || participant.name}</p>
                                            <p className="text-xs text-(--text-secondary)">{participant.user?.tag || participant.tag}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="rounded border border-(--border-default) bg-(--bg-card-hover) px-2 py-1 text-xs text-(--text-secondary)">
                                            {getCaseParticipantPermissionLabel(participant, caseData)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteParticipant(participant.id)}
                                            className="p-1 text-(--text-tertiary) transition-colors hover:text-red-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {participantsList.length === 0 && (
                                <li className="p-6 text-center italic text-(--text-secondary)">No hay permisos asignados.</li>
                            )}
                        </ul>
                    </div>
                </div>
            );
            break;
        case 'cronograma': {
            const CRONOGRAMA_TABS = [
                { id: 'agenda', label: 'Calendario', testId: 'cronograma-nav-agenda', icon: Calendar, hasBadge: newItemsByEntity.events.size > 0 },
                {
                    id: 'deadlines',
                    label: 'Vencimientos',
                    testId: 'cronograma-nav-deadlines',
                    icon: Clock,
                    badgeColor: deadlineBadgeColor,
                    hasBadge: !deadlineBadgeColor && newItemsByEntity.events.size > 0
                },
            ];

            let cronogramaContent = null;
            if (cronogramaTab === 'agenda') {
                cronogramaContent = (
                    <Suspense fallback={<div className="p-8 text-center text-(--text-secondary)">Cargando calendario...</div>}>
                        <AgendaComponent
                            caseId={caseData.id}
                            caseSyncChecked={!caseSyncing}
                            caseSyncReady={!caseSyncing && syncResult !== null}
                            newIds={newItemsByEntity.events}
                            onMarkAsSeen={onMarkAsSeen}
                        />
                    </Suspense>
                );
            } else if (cronogramaTab === 'deadlines') {
                cronogramaContent = (
                    <Suspense fallback={<div className="p-8 text-center text-(--text-secondary)">Cargando vencimientos...</div>}>
                        <CaseDeadlinesSection
                            caseId={caseData.id}
                            hideHeader
                            hideSidebar
                            newIds={newItemsByEntity.events}
                            onMarkAsSeen={onMarkAsSeen}
                        />
                    </Suspense>
                );
            }

            content = (
                <div className={`animate-in fade-in duration-300 pt-2 ${CASE_DETAIL_WIDE_SECTION_CLASS}`}>
                    <SideMenuPageLayout
                        sections={CRONOGRAMA_TABS}
                        activeSection={cronogramaTab}
                        onSectionChange={setCronogramaTab}
                        sectionIdPrefix="cronograma-tab"
                        maxWidthClass="w-full"
                    >
                        {cronogramaContent}
                    </SideMenuPageLayout>
                </div>
            );
            break;
        }
        case 'economia':
            content = (
                <div className={`space-y-8 animate-in fade-in duration-300 ${CASE_DETAIL_WIDE_SECTION_CLASS}`}>
                    <HonorariosList caseId={caseData.id} caseCacheReady={!caseSyncing} />
                    <GastosList caseId={caseData.id} caseCacheReady={!caseSyncing} />
                </div>
            );
            break;
        default:
            content = null;
    }

    return (
        <>
            {content}

            {/* Modal de preview inteligente (Multimedia, PDFs) */}
            {previewItem && (
                <div
                    role="button"
                    tabIndex={0}
                    aria-label="Cerrar preview"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={closePreview}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && closePreview()}
                >
                    <div
                        role="presentation"
                        className="relative max-h-[94vh] w-full max-w-5xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="grid grid-cols-3 items-center mb-6 px-1">
                            {/* Acciones Izquierda: Descargar e Imprimir */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDownloadMultimedia(previewItem.item)}
                                    className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-all active:scale-95 shadow-sm"
                                    title="Descargar archivo"
                                >
                                    <Download size={16} />
                                    <span className="hidden sm:inline">Descargar</span>
                                </button>
                                {!previewItem.isVideo && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const printWindow = window.open('', '_blank');
                                            printWindow.document.write(`
                                                <html>
                                                    <head><title>Imprimir - ${previewItem.item.filename}</title></head>
                                                    <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
                                                        <img src="${previewItem.blobUrl}" style="max-width:100%; max-height:100%; object-contain: fit;" onload="window.print();window.close();" />
                                                    </body>
                                                </html>
                                            `);
                                            printWindow.document.close();
                                        }}
                                        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-all active:scale-95 shadow-sm"
                                        title="Imprimir imagen"
                                    >
                                        <Printer size={16} />
                                        <span className="hidden sm:inline">Imprimir</span>
                                    </button>
                                )}
                            </div>

                            {/* Centro: Nombre del archivo */}
                            <div className="flex justify-center min-w-0">
                                <span className="text-white font-semibold truncate text-base px-4 border-l border-r border-white/10" title={previewItem.item.filename}>
                                    {previewItem.item.filename}
                                </span>
                            </div>

                            {/* Derecha: Botón de cerrar */}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={closePreview}
                                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                    title="Cerrar visor"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {previewItem.isVideo ? (
                            <CaseVideoPlayer
                                src={previewItem.blobUrl}
                                title={previewItem.item.filename}
                                poster={previewItem.poster}
                            />
                        ) : (
                            <img
                                src={previewItem.blobUrl}
                                alt={previewItem.item.filename}
                                className="max-h-[80vh] w-full rounded-xl object-contain animate-in fade-in zoom-in-95 duration-200"
                            />
                        )}

                        {/* Flechas de Navegación (solo si estamos en multimedia) */}
                        {activeTab === 'biblioteca' && caseMultimedia.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); void handleNavigateMultimedia('prev'); }}
                                    className="fixed left-8 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 text-white hover:bg-white/30 transition-all active:scale-90 z-[60]"
                                    title="Anterior (flecha izquierda)"
                                >
                                    <ChevronLeft size={48} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); void handleNavigateMultimedia('next'); }}
                                    className="fixed right-8 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 text-white hover:bg-white/30 transition-all active:scale-90 z-[60]"
                                    title="Siguiente (flecha derecha)"
                                >
                                    <ChevronRight size={48} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
            <AddParticipantModal
                caseId={caseData.id}
                onClose={() => setIsAddParticipantOpen(false)}
                onSuccess={handleAddParticipantSuccess}
                openDialog={openDialog}
                closeDialog={closeDialog}
                open={isAddParticipantOpen}
            />
            <AddCaseClientModal
                open={isAddClientOpen}
                caseId={caseData.id}
                linkedClientIds={clientsList.map((client) => client.id)}
                onClose={() => setIsAddClientOpen(false)}
                onSuccess={handleAddClientSuccess}
            />
            <ConfirmDialog {...dialogProps} />
            <QrCodeModal
                open={qrModalOpen}
                onClose={() => setQrModalOpen(false)}
                signedData={qrData}
                file={qrData?.file}
                title={qrData?.title}
                description={qrData?.description}
            />
        </>
    );
});

export default CaseDetailTabContent;
