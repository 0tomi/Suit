import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, User, Shield, Search, Eye, Edit3, Crown } from 'lucide-react';
import {
    createCase,
    updateCase,
    linkClientsToCase,
    unlinkClientFromCase,
    addParticipant,
    removeParticipant,
    getCaseParticipants,
} from '../../services/caseService.js';
import { useUsers } from '../../context/UsersContext.jsx';
import { linkParteToCaso, unlinkParteFromCaso } from '../../services/parteService.js';
import { syncTipoExpedientesToCase } from '../../services/tipoExpedienteService.js';
import { useCaseTypes } from '../../context/CaseTypesContext.jsx';
import { useRadicaciones } from '../../context/RadicacionesContext.jsx';
import { useJurisdicciones } from '../../context/JurisdiccionesContext.jsx';
import { useClients } from '../../context/ClientsContext.jsx';
import { usePartes } from '../../context/PartesContext.jsx';
import { useModal } from '../../context/ModalContext.jsx';
import { SelectParteModal } from '../people/SelectParteModal.jsx';
import { SelectClientModal } from '../clients/SelectClientModal.jsx';
import { SelectTipoExpedienteModal } from './SelectTipoExpedienteModal.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select.jsx';
import { useRoles } from '../../context/RolesContext.jsx';
import { useCompetencias } from '../../context/CompetenciasContext.jsx';
import { useDependenciasJudiciales } from '../../context/DependenciasJudicialesContext.jsx';
import { createLogger } from '../../services/logService.js';
import { createDependenciaJudicial } from '../../services/dependenciaJudicialService.js';
import { createJurisdiccion } from '../../services/jurisdiccionService.js';
import { createRadicacion } from '../../services/radicacionService.js';
import { 
    syncRadicaciones, 
    syncJurisdicciones, 
    syncDependenciasJudiciales 
} from '../../services/sync/metadataSyncService.js';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { translateApiErrorMessage, getApiErrorMessage } from '../../utils/apiErrorMessage.js';

import JurisdiccionModal from '../categories/modals/JurisdiccionModal.jsx';
import DependenciaJudicialModal from '../categories/modals/DependenciaJudicialModal.jsx';
import RadicacionModal from '../categories/modals/RadicacionModal.jsx';
const logger = createLogger('new-case-form');

const FORM_MODE = {
    CREATE: 'create',
    EDIT: 'edit',
};

const INITIAL_FORM = {
    title: '',
    type: '',
    startDate: '',
    description: '',
    linkedParties: [],
    linkedClients: [],
    linkedTipoExpedientes: [],
    linkedParticipants: [],
    documents: [],
    nro_expediente: '',
    radicacion_id: '',
    jurisdiccion_id: '',
    dependencia_id: '',
};

const PARTICIPANTS_STORAGE_KEY = 'suit_newcase_default_participants';

function loadRememberedParticipants() {
    try {
        const saved = localStorage.getItem(PARTICIPANTS_STORAGE_KEY);
        if (!saved) return [];

        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function appendUniqueById(collection, item) {
    if (!item?.id) return collection;
    if (collection.some((existingItem) => String(existingItem.id) === String(item.id))) {
        return collection;
    }

    return [...collection, item];
}

function openRequiredFieldDialog(openDialog, closeDialog, { title, desc }) {
    openDialog({
        title,
        desc,
        type: 'danger',
        onConfirm: closeDialog,
        confirmText: 'Aceptar',
    });
}

function getCatalogPlaceholder({ loading, emptyLabel, loadingLabel }) {
    if (loading) return loadingLabel;
    return emptyLabel;
}

function ensureRequestSucceeded(result, fallbackMessage) {
    if (result?.ok === false) {
        const requestError = new Error(extractRequestErrorMessage(result, fallbackMessage));
        requestError.apiResponse = {
            status: result?.status ?? null,
            error: result?.error ?? null,
            data: result?.data ?? null,
        };
        throw requestError;
    }

    return result;
}

function flattenValidationMessages(errors) {
    if (!errors || typeof errors !== 'object') return [];

    return Object.values(errors).flatMap((value) => {
        if (Array.isArray(value)) {
            return value
                .map((entry) => translateApiErrorMessage(String(entry).trim()))
                .filter(Boolean);
        }

        return typeof value === 'string' && value.trim()
            ? [translateApiErrorMessage(value.trim())]
            : [];
    });
}

function extractRequestErrorMessage(result, fallbackMessage) {
    const validationMessages = flattenValidationMessages(result?.data?.errors);
    if (validationMessages.length > 0) {
        return validationMessages.join(' ');
    }

    if (typeof result?.data?.error === 'string' && result.data.error.trim()) {
        return translateApiErrorMessage(result.data.error.trim(), fallbackMessage);
    }

    return translateApiErrorMessage(result?.error || result?.data?.message, fallbackMessage);
}

function extractCreatedCaseEntity(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const source = payload.data && typeof payload.data === 'object'
        ? payload.data
        : payload;

    if (source.case && typeof source.case === 'object') return source.case;
    if (source.suit_case && typeof source.suit_case === 'object') return source.suit_case;
    if (source.createdCase && typeof source.createdCase === 'object') return source.createdCase;
    if (source.id) return source;

    return null;
}

function normalizeParticipantPermissionLevel(participant) {
    if (participant?.permission_level === 'admin') return 'admin';
    if (participant?.permission_level === 'write') return 'write';
    return 'read';
}

function isOwnerParticipant(participant, caseData) {
    if (!participant || !caseData) return false;

    if (participant.permission_level === 'owner' || participant.role === 'owner') {
        return true;
    }

    if (participant.is_owner === true || participant.owner === true) {
        return true;
    }

    const participantTag = participant.user?.tag ?? participant.tag ?? null;
    return Boolean(participantTag && caseData.owner_tag && String(participantTag) === String(caseData.owner_tag));
}

function normalizeParticipantForForm(participant, caseData) {
    const user = participant?.user ?? {};
    const isOwner = isOwnerParticipant(participant, caseData);

    return {
        id: participant.user_id ?? user.id ?? participant.id,
        name: user.name ?? participant.name ?? participant.user_name ?? participant.tag ?? 'Usuario',
        tag: user.tag ?? participant.tag ?? participant.user_tag ?? '',
        permissionLevel: isOwner ? 'owner' : normalizeParticipantPermissionLevel(participant),
        isOwner,
    };
}

function normalizeClientForForm(client) {
    return {
        ...client,
        id: client.id,
        first_name: client.first_name ?? client.name ?? '',
        last_name: client.last_name ?? client.lastname ?? '',
    };
}

function normalizeParteForForm(parte) {
    return {
        ...parte,
        id: parte.id,
        nombre: parte.nombre ?? parte.name ?? '',
        apellido: parte.apellido ?? parte.lastname ?? '',
    };
}

function resolveInitialJurisdiccionId(initialCaseData, allDependencias = []) {
    if (!initialCaseData) return '';

    const directJurisdiccionId = initialCaseData.jurisdiccion_id
        ?? initialCaseData.jurisdiccion?.id
        ?? initialCaseData.dependencia?.jurisdiccion?.id
        ?? initialCaseData.dependencia?.jurisdiccion_id;

    if (directJurisdiccionId != null) {
        return String(directJurisdiccionId);
    }

    if (initialCaseData.dependencia_id == null || allDependencias.length === 0) {
        return '';
    }

    const matchedDependencia = allDependencias.find(
        (dependencia) => String(dependencia.id) === String(initialCaseData.dependencia_id)
    );

    const dependenciaJurisdiccionId = matchedDependencia?.jurisdiccion_id
        ?? matchedDependencia?.jurisdiccion?.id;

    return dependenciaJurisdiccionId != null ? String(dependenciaJurisdiccionId) : '';
}

function buildInitialFormState(mode, initialCaseData, allDependencias = []) {
    const base = { ...INITIAL_FORM };

    if (mode === FORM_MODE.EDIT && initialCaseData) {
        return {
            ...base,
            title: initialCaseData.title ?? '',
            type: initialCaseData.case_type_id != null ? String(initialCaseData.case_type_id) : '',
            startDate: initialCaseData.start_date ?? '',
            description: initialCaseData.details ?? '',
            nro_expediente: initialCaseData.nro_expediente ?? '',
            radicacion_id: initialCaseData.radicacion_id != null ? String(initialCaseData.radicacion_id) : '',
            jurisdiccion_id: resolveInitialJurisdiccionId(initialCaseData, allDependencias),
            dependencia_id: initialCaseData.dependencia_id != null ? String(initialCaseData.dependencia_id) : '',
        };
    }

    const rememberedParticipants = loadRememberedParticipants();
    return rememberedParticipants.length > 0
        ? { ...base, linkedParticipants: rememberedParticipants }
        : base;
}

function buildRelationSignature(items, keySelector) {
    return items
        .map((item) => keySelector(item))
        .filter(Boolean)
        .map((value) => String(value))
        .sort()
        .join('|');
}

const NewCaseForm = ({ onSuccess, onClose, mode = FORM_MODE.CREATE, initialCaseData = null }) => {
    const {
        case_types,
        syncing: caseTypesSyncing,
        initialized: caseTypesInitialized,
    } = useCaseTypes();
    const {
        radicaciones = [],
        initialized: radicacionesInitialized,
        syncing: radicacionesSyncing,
        refreshRadicaciones,
    } = useRadicaciones();
    const {
        data: jurisdicciones = [],
        syncing: jurisdiccionesSyncing,
        initialized: jurisdiccionesInitialized,
        refreshJurisdicciones,
    } = useJurisdicciones();
    const { data: competencias = [] } = useCompetencias();
    const { roles = [] } = useRoles();
    const {
        data: allDependencias = [], 
        syncing: dependenciasSyncing,
        initialized: dependenciasInitialized,
        refreshData: refreshDependenciasJudiciales 
    } = useDependenciasJudiciales();
    const { refreshClients } = useClients();
    const { refreshPartes } = usePartes();
    const { openModal } = useModal();
    const { openDialog, closeDialog, dialogProps } = useConfirmDialog();
    const { users = [] } = useUsers();
    const [newCase, setNewCase] = useState(() => buildInitialFormState(mode, initialCaseData, allDependencias));
    const [isLoadingEditRelations, setIsLoadingEditRelations] = useState(mode === FORM_MODE.EDIT);

    // --- Estado para sección de Participantes ---
    const [participantSearch, setParticipantSearch] = useState('');
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
    // rememberParticipants se inicializa en true si ya hay participantes guardados
    const [rememberParticipants, setRememberParticipants] = useState(() => {
        try { return !!localStorage.getItem(PARTICIPANTS_STORAGE_KEY); } catch { return false; }
    });
    const participantSearchRef = useRef(null);
    const dropdownHideTimer = useRef(null);
    const initialRelationsRef = useRef({
        linkedClients: [],
        linkedParties: [],
        linkedTipoExpedientes: [],
        linkedParticipants: [],
    });

    // --- Estado para Modales de Creación Rápida ---
    const [isRadicacionModalOpen, setIsRadicacionModalOpen] = useState(false);
    const [isJurisdiccionModalOpen, setIsJurisdiccionModalOpen] = useState(false);
    const [isDependenciaModalOpen, setIsDependenciaModalOpen] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [skipDescription, setSkipDescription] = useState(false);

    const caseTypesLoading = !caseTypesInitialized || (caseTypesSyncing && case_types.length === 0);
    const radicacionesLoading = !radicacionesInitialized || (radicacionesSyncing && radicaciones.length === 0);
    const jurisdiccionesLoading = !jurisdiccionesInitialized || (jurisdiccionesSyncing && jurisdicciones.length === 0);
    const dependenciasLoading = !dependenciasInitialized || dependenciasSyncing;

    const isFederalRadicacion = useMemo(() => {
        const rad = radicaciones.find(r => String(r.id) === String(newCase.radicacion_id));
        if (!rad) return false;
        const tipo = (rad.tipo || rad.name || '').trim().toLowerCase();
        return tipo === 'federal';
    }, [radicaciones, newCase.radicacion_id]);

    const filteredJurisdicciones = useMemo(() => {
        const federalJurName = 'federal';
        if (isFederalRadicacion) {
            return jurisdicciones.filter(j => (j.nombre || '').trim().toLowerCase() === federalJurName);
        }
        // Si no es federal, ocultamos la opción Federal
        return jurisdicciones.filter(j => (j.nombre || '').trim().toLowerCase() !== federalJurName);
    }, [isFederalRadicacion, jurisdicciones]);

    const dependencias = useMemo(() => {
        if (!newCase.jurisdiccion_id || !newCase.radicacion_id) return [];
        return allDependencias.filter(d => 
            String(d.jurisdiccion_id) === String(newCase.jurisdiccion_id) &&
            String(d.radicacion_id) === String(newCase.radicacion_id)
        );
    }, [allDependencias, newCase.jurisdiccion_id, newCase.radicacion_id]);
    const hasSelectedDependencia = dependencias.some(
        (dependencia) => String(dependencia.id) === String(newCase.dependencia_id)
    );
    const dependenciaSelectValue = newCase.dependencia_id && hasSelectedDependencia
        ? String(newCase.dependencia_id)
        : '';


    const selectedCaseTypeName = useMemo(
        () => case_types.find((caseType) => String(caseType.id) === String(newCase.type))?.name || '',
        [case_types, newCase.type]
    );

    /**
     * En alta, clientes y partes pueden cambiar mientras el usuario tiene abierto el modal.
     * Reutilizamos el refresh del contexto para que el backend/cache resuelva last-modified.
     */
    useEffect(() => {
        if (mode !== FORM_MODE.CREATE) return;
        void Promise.all([refreshClients(), refreshPartes()]);
    }, [mode, refreshClients, refreshPartes]);

    /**
     * En edición precargamos las relaciones no incluidas en `PUT /cases/{id}`
     * para reutilizar el mismo modal de alta y luego sincronizar diffs.
     */
    useEffect(() => {
        // En modo alta (CREATE), el estado inicial ya se setea en el useState (linea 304).
        // No queremos que este efecto se ejecute cada vez que allDependencias cambie (ej: al crear un juzgado),
        // ya que resetearía el formulario que el usuario está completando.
        if (mode !== FORM_MODE.EDIT || !initialCaseData?.id) {
            initialRelationsRef.current = {
                linkedClients: [],
                linkedParties: [],
                linkedTipoExpedientes: [],
                linkedParticipants: [],
            };
            // Solo reseteamos si realmente es una deselección de caso (creo que no aplica en este modal, pero por seguridad)
            if (mode === FORM_MODE.EDIT && !initialCaseData) {
                setNewCase(buildInitialFormState(mode, initialCaseData, allDependencias));
            }
            setIsLoadingEditRelations(false);
            return;
        }

        let cancelled = false;
        // Precargamos los datos base del caso a editar
        setNewCase(buildInitialFormState(mode, initialCaseData, allDependencias));
        setIsLoadingEditRelations(true);

        const loadEditRelations = async () => {
            try {
                const participants = await getCaseParticipants(initialCaseData.id);

                if (cancelled) return;

                const normalizedRelations = {
                    linkedClients: initialCaseData.linkedClients.map(normalizeClientForForm),
                    linkedParties: initialCaseData.linkedParties.map(normalizeParteForForm),
                    linkedTipoExpedientes: initialCaseData.linkedTipoExpedientes,
                    linkedParticipants: (Array.isArray(participants) ? participants : [])
                        .map((participant) => normalizeParticipantForForm(participant, initialCaseData))
                        .filter((participant) => participant.id != null || participant.tag),
                };

                initialRelationsRef.current = normalizedRelations;
                setNewCase((prev) => ({
                    ...prev,
                    ...normalizedRelations,
                }));
            } catch (error) {
                void logger.error('Error loading case edit relations', {
                    caseId: initialCaseData.id,
                    error: error?.message || String(error),
                });
                initialRelationsRef.current = {
                    linkedClients: [],
                    linkedParties: [],
                    linkedTipoExpedientes: [],
                    linkedParticipants: [],
                };
            } finally {
                if (!cancelled) {
                    setIsLoadingEditRelations(false);
                }
            }
        };

        void loadEditRelations();

        return () => {
            cancelled = true;
        };
    }, [initialCaseData?.id, mode]);

    useEffect(() => {
        if (mode !== FORM_MODE.EDIT || newCase.jurisdiccion_id || !initialCaseData) return;

        const resolvedJurisdiccionId = resolveInitialJurisdiccionId(initialCaseData, allDependencias);
        if (!resolvedJurisdiccionId) return;

        setNewCase((prev) => {
            if (prev.jurisdiccion_id) return prev;
            return {
                ...prev,
                jurisdiccion_id: resolvedJurisdiccionId,
            };
        });
    }, [allDependencias, initialCaseData, mode, newCase.jurisdiccion_id]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'title' || name === 'nro_expediente' || name === 'type' || name === 'radicacion_id' || name === 'startDate') {
            setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        }
        setNewCase(prev => {
            let nextState = { ...prev, [name]: value };

            if (name === 'type') {
                // Si cambia el fuero, descartamos tipos de expediente ajenos
                nextState.linkedTipoExpedientes = value
                    ? prev.linkedTipoExpedientes.filter((tipo) => String(tipo.case_type_id || '') === String(value))
                    : [];
            }

            if (name === 'jurisdiccion_id' && String(prev.jurisdiccion_id) !== String(value)) {
                nextState.dependencia_id = '';
            }

            if (name === 'dependencia_id' && value) {
                // Buscamos la dependencia seleccionada para obtener su competencia_id
                const selectedDep = allDependencias.find(d => String(d.id) === String(value));
                if (selectedDep?.competencia_id) {
                    // Buscamos la competencia para obtener el nombre del fuero
                    const comp = competencias.find(c => String(c.id) === String(selectedDep.competencia_id));
                    if (comp?.fuero) {
                        const fueroNormalized = comp.fuero.toLowerCase();
                        // Buscamos en case_types (Fueros) el que mejor coincida por nombre
                        const matchedFuero = case_types.find(ct => {
                            const ctName = (ct.name || '').toLowerCase();
                            return fueroNormalized.includes(ctName) || ctName.includes(fueroNormalized);
                        });

                        if (matchedFuero) {
                            nextState.type = String(matchedFuero.id);
                            // También filtramos tipos de expedientes para que no queden orfanos de otro fuero
                            nextState.linkedTipoExpedientes = nextState.linkedTipoExpedientes.filter(
                                (tipo) => String(tipo.case_type_id || '') === String(matchedFuero.id)
                            );
                        }
                    }
                }
            }

            if (name === 'radicacion_id' && String(prev.radicacion_id) !== String(value)) {
                nextState.dependencia_id = '';
                const selectedRad = radicaciones.find(r => String(r.id) === String(value));
                const isFederal = (selectedRad?.tipo || selectedRad?.name || '').toLowerCase() === 'federal';

                if (isFederal) {
                    const fedJur = jurisdicciones.find(j => (j.nombre || '').toLowerCase() === 'federal');
                    if (fedJur) {
                        nextState.jurisdiccion_id = String(fedJur.id);
                    }
                } else if (!value) {
                    // Si se limpia radicación, podemos opcionalmente limpiar jurisdicción
                    nextState.jurisdiccion_id = '';
                } else {
                    // Si cambia a una radicación no federal, pero la jurisdicción era Federal, la limpiamos
                    const currentJur = jurisdicciones.find(j => String(j.id) === String(prev.jurisdiccion_id));
                    if ((currentJur?.nombre || '').toLowerCase() === 'federal') {
                        nextState.jurisdiccion_id = '';
                    }
                }
            }

            return nextState;
        });
    };

    const handleSelectChange = (name, value) => {
        handleInputChange({ target: { name, value } });
    };

    // Efecto para sincronizar Jurisdicción Federal cuando la radicación es Federal
    // Esto es útil si las jurisdicciones se cargan después de seleccionar la radicación
    useEffect(() => {
        if (isFederalRadicacion && !jurisdiccionesLoading && jurisdicciones.length > 0) {
            const fedJur = jurisdicciones.find(j => (j.nombre || '').toLowerCase() === 'federal');
            if (fedJur && String(newCase.jurisdiccion_id) !== String(fedJur.id)) {
                setNewCase(prev => ({
                    ...prev,
                    jurisdiccion_id: String(fedJur.id),
                    // Si forzamos jurisdicción, limpiamos dependencia para evitar inconsistencias
                    dependencia_id: String(prev.jurisdiccion_id) !== String(fedJur.id) ? '' : prev.dependencia_id
                }));
            }
        }
    }, [isFederalRadicacion, jurisdicciones, jurisdiccionesLoading, newCase.jurisdiccion_id]);


    const openSelectParteModal = () => {
        openModal(SelectParteModal, {
            linkedParteIds: newCase.linkedParties.map((p) => p.id),
            onParteSelected: (parte) => {
                setNewCase(prev => ({
                    ...prev,
                    linkedParties: appendUniqueById(prev.linkedParties, parte),
                }));
            }
        });
    };

    const handleRemoveParty = (partyId) => {
        setNewCase(prev => ({
            ...prev,
            linkedParties: prev.linkedParties.filter((p) => p.id !== partyId)
        }));
    };

    const openSelectClientModal = () => {
        openModal(SelectClientModal, {
            linkedClientIds: newCase.linkedClients.map((c) => c.id),
            onClientSelected: (client) => {
                setFieldErrors(prev => ({ ...prev, linkedClients: undefined }));
                setNewCase(prev => ({
                    ...prev,
                    linkedClients: appendUniqueById(prev.linkedClients, client),
                }));
            }
        });
    };

    const handleRemoveClient = (clientId) => {
        setNewCase(prev => ({
            ...prev,
            linkedClients: prev.linkedClients.filter((c) => c.id !== clientId)
        }));
    };

    const openSelectTipoExpedienteModal = () => {
        if (!newCase.type) {
            openRequiredFieldDialog(openDialog, closeDialog, {
                title: 'Primero seleccioná un fuero',
                desc: 'Elegí el fuero del caso antes de vincular tipos de expediente.',
            });
            return;
        }

        openModal(SelectTipoExpedienteModal, {
            caseTypeId: newCase.type,
            caseTypeName: selectedCaseTypeName,
            alreadySelectedIds: newCase.linkedTipoExpedientes.map(t => t.id),
            onSelected: (tipo) => {
                setNewCase(prev => ({
                    ...prev,
                    linkedTipoExpedientes: appendUniqueById(prev.linkedTipoExpedientes, tipo),
                }));
            }
        });
    };

    const handleRemoveTipoExpediente = (tipoId) => {
        setNewCase(prev => ({ ...prev, linkedTipoExpedientes: prev.linkedTipoExpedientes.filter((t) => t.id !== tipoId) }));
    };

    // --- Handlers para Participantes del Estudio ---

    /** Filtra usuarios disponibles según el texto de búsqueda y excluye los ya agregados.
     *  Sin término muestra todos los disponibles (para navegación desde el foco). */
    const filteredParticipantUsers = useMemo(() => {
        const term = participantSearch.toLowerCase().trim();
        const alreadyAdded = new Set(newCase.linkedParticipants.map(p => p.id));
        return users.filter(u =>
            !alreadyAdded.has(u.id) &&
            (!term || u.name?.toLowerCase().includes(term) || u.tag?.toLowerCase().includes(term))
        ).slice(0, 10);
    }, [participantSearch, users, newCase.linkedParticipants]);

    const handleAddParticipant = (user) => {
        setNewCase(prev => ({
            ...prev,
            linkedParticipants: [...prev.linkedParticipants, {
                id: user.id,
                name: user.name,
                tag: user.tag,
                permissionLevel: 'read',
            }],
        }));
        setParticipantSearch('');
        setShowParticipantDropdown(false);
    };

    const handleRemoveParticipant = (userId) => {
        setNewCase(prev => ({
            ...prev,
            linkedParticipants: prev.linkedParticipants.filter((participant) => {
                if (participant.isOwner) return true;
                return participant.id !== userId;
            }),
        }));
    };

    const handleChangeParticipantPermission = (userId, level) => {
        setNewCase(prev => ({
            ...prev,
            linkedParticipants: prev.linkedParticipants.map(p =>
                p.id === userId && !p.isOwner ? { ...p, permissionLevel: level } : p
            ),
        }));
    };

    const getRolName = (rolId) => {
        const rol = roles.find(r => r.id === rolId);
        return rol ? rol.titulo : 'N/A';
    };

    // Handlers para creación    // --- Handlers para Modales de Creación Rápida ---

    const handleCreateRadicacion = async (data) => {
        try {
            const result = await createRadicacion(data);
            if (result.ok) {
                // Sincronizar cache y contexto
                await syncRadicaciones();
                await refreshRadicaciones();
                
                const radId = String(result.data.id);
                // Usamos el handler para que se aplique la misma lógica de "Federal" si aplica
                handleInputChange({ target: { name: 'radicacion_id', value: radId } });
                showAppToast({ title: 'Radicación creada', variant: 'success' });
            } else {
                throw new Error(getApiErrorMessage(result, 'No se pudo crear la radicación.'));
            }
        } catch (error) {
            logger.error('Error creating radicacion', error);
            showAppToast({ 
                title: 'Error al crear radicación', 
                description: error.message,
                variant: 'danger' 
            });
            throw error; // Lanzamos para que el modal no se cierre
        }
    };

    const handleCreateJurisdiccion = async (data) => {
        try {
            const result = await createJurisdiccion(data);
            if (result.ok) {
                // Sincronizar cache y contexto
                await syncJurisdicciones();
                await refreshJurisdicciones();
                
                setNewCase(prev => ({ 
                    ...prev, 
                    jurisdiccion_id: String(result.data.id), 
                    dependencia_id: '' 
                }));
                showAppToast({ title: 'Jurisdicción creada', variant: 'success' });
            } else {
                throw new Error(getApiErrorMessage(result, 'No se pudo crear la jurisdicción.'));
            }
        } catch (error) {
            logger.error('Error creating jurisdiccion', error);
            showAppToast({ 
                title: 'Error al crear jurisdicción', 
                description: error.message,
                variant: 'danger' 
            });
            throw error; // Lanzamos para que el modal no se cierre
        }
    };

    const handleCreateDependencia = async (data) => {
        try {
            const result = await createDependenciaJudicial(data);
            if (result.ok) {
                // Sincronizar cache y contexto
                await syncDependenciasJudiciales();
                await refreshDependenciasJudiciales();

                const newDepId = String(result.data.id);
                const newRadId = result.data.radicacion_id != null ? String(result.data.radicacion_id) : undefined;
                const newJurId = result.data.jurisdiccion_id != null ? String(result.data.jurisdiccion_id) : undefined;

                setNewCase(prev => ({ 
                    ...prev, 
                    // Aseguramos que se mantengan (o actualicen si cambiaron en el modal) los IDs relacionados
                    radicacion_id: newRadId ?? prev.radicacion_id,
                    jurisdiccion_id: newJurId ?? prev.jurisdiccion_id,
                    dependencia_id: newDepId 
                }));

                showAppToast({ title: 'Competencia creada', variant: 'success' });
            } else {
                throw new Error(getApiErrorMessage(result, 'No se pudo crear la competencia.'));
            }
        } catch (error) {
            logger.error('Error creating dependencia', error);
            showAppToast({ 
                title: 'Error al crear competencia', 
                description: error.message,
                variant: 'danger' 
            });
            throw error; // Lanzamos para que el modal no se cierre
        }
    };

    const persistRememberedParticipants = useCallback(() => {
        if (mode !== FORM_MODE.CREATE) return;

        try {
            if (rememberParticipants && newCase.linkedParticipants.length > 0) {
                localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(newCase.linkedParticipants));
            } else if (!rememberParticipants) {
                localStorage.removeItem(PARTICIPANTS_STORAGE_KEY);
            }
        } catch {
            // Ignoramos errores de storage para no bloquear el guardado del caso.
        }
    }, [mode, newCase.linkedParticipants, rememberParticipants]);

    /**
     * Ejecuta las vinculaciones secundarias del expediente. En edición trabaja
     * por diferencia para respetar que `PUT /cases/{id}` no sincroniza relaciones.
     */
    const syncCaseRelations = useCallback(async (caseId, baseCaseAction) => {
        const initialRelations = initialRelationsRef.current;
        const linkOperations = [];

        if (baseCaseAction === FORM_MODE.CREATE) {
            if (newCase.linkedClients.length > 0) {
                linkOperations.push({
                    label: 'clientes',
                    run: async () => {
                        const clientIds = newCase.linkedClients.map((client) => client.id);
                        await ensureRequestSucceeded(
                            await linkClientsToCase(caseId, clientIds),
                            'No se pudieron vincular los clientes seleccionados.'
                        );
                    }
                });
            }

            if (newCase.linkedParties.length > 0) {
                linkOperations.push({
                    label: 'partes',
                    run: async () => {
                        await Promise.all(newCase.linkedParties.map(async (parte) => {
                            await ensureRequestSucceeded(
                                await linkParteToCaso(caseId, parte.id),
                                `No se pudo vincular la parte ${parte.nombre} ${parte.apellido}.`
                            );
                        }));
                    }
                });
            }

            if (newCase.linkedTipoExpedientes.length > 0) {
                linkOperations.push({
                    label: 'tipos de expediente',
                    run: async () => {
                        await ensureRequestSucceeded(
                            await syncTipoExpedientesToCase(caseId, newCase.linkedTipoExpedientes.map((tipo) => tipo.id)),
                            'No se pudieron vincular los tipos de expediente seleccionados.'
                        );
                    }
                });
            }

            if (newCase.linkedParticipants.length > 0) {
                linkOperations.push({
                    label: 'participantes',
                    run: async () => {
                        await Promise.all(newCase.linkedParticipants.map(async (participant) => {
                            await ensureRequestSucceeded(
                                await addParticipant(caseId, participant.tag, participant.permissionLevel),
                                `No se pudo agregar al participante ${participant.name}.`
                            );
                        }));
                    }
                });
            }
        } else {
            const initialClientIds = new Set(initialRelations.linkedClients.map((client) => String(client.id)));
            const nextClientIds = new Set(newCase.linkedClients.map((client) => String(client.id)));
            const clientsToAdd = newCase.linkedClients.filter((client) => !initialClientIds.has(String(client.id)));
            const clientsToRemove = initialRelations.linkedClients.filter((client) => !nextClientIds.has(String(client.id)));

            if (clientsToAdd.length > 0) {
                linkOperations.push({
                    label: 'clientes',
                    run: async () => {
                        await ensureRequestSucceeded(
                            await linkClientsToCase(caseId, clientsToAdd.map((client) => client.id)),
                            'No se pudieron vincular los clientes agregados.'
                        );
                    }
                });
            }

            if (clientsToRemove.length > 0) {
                linkOperations.push({
                    label: 'clientes',
                    run: async () => {
                        await Promise.all(clientsToRemove.map(async (client) => {
                            await ensureRequestSucceeded(
                                await unlinkClientFromCase(caseId, client.id),
                                `No se pudo desvincular el cliente ${client.first_name} ${client.last_name}.`
                            );
                        }));
                    }
                });
            }

            const initialParteIds = new Set(initialRelations.linkedParties.map((parte) => String(parte.id)));
            const nextParteIds = new Set(newCase.linkedParties.map((parte) => String(parte.id)));
            const partesToAdd = newCase.linkedParties.filter((parte) => !initialParteIds.has(String(parte.id)));
            const partesToRemove = initialRelations.linkedParties.filter((parte) => !nextParteIds.has(String(parte.id)));

            if (partesToAdd.length > 0) {
                linkOperations.push({
                    label: 'partes',
                    run: async () => {
                        await Promise.all(partesToAdd.map(async (parte) => {
                            await ensureRequestSucceeded(
                                await linkParteToCaso(caseId, parte.id),
                                `No se pudo vincular la parte ${parte.nombre} ${parte.apellido}.`
                            );
                        }));
                    }
                });
            }

            if (partesToRemove.length > 0) {
                linkOperations.push({
                    label: 'partes',
                    run: async () => {
                        await Promise.all(partesToRemove.map(async (parte) => {
                            await ensureRequestSucceeded(
                                await unlinkParteFromCaso(caseId, parte.id),
                                `No se pudo desvincular la parte ${parte.nombre} ${parte.apellido}.`
                            );
                        }));
                    }
                });
            }

            const currentTipoSignature = buildRelationSignature(newCase.linkedTipoExpedientes, (tipo) => tipo.id);
            const initialTipoSignature = buildRelationSignature(initialRelations.linkedTipoExpedientes, (tipo) => tipo.id);
            if (currentTipoSignature !== initialTipoSignature) {
                linkOperations.push({
                    label: 'tipos de expediente',
                    run: async () => {
                        await ensureRequestSucceeded(
                            await syncTipoExpedientesToCase(caseId, newCase.linkedTipoExpedientes.map((tipo) => tipo.id)),
                            'No se pudieron sincronizar los tipos de expediente seleccionados.'
                        );
                    }
                });
            }

            const editableInitialParticipants = initialRelations.linkedParticipants.filter((participant) => !participant.isOwner);
            const editableNextParticipants = newCase.linkedParticipants.filter((participant) => !participant.isOwner);
            const initialParticipantMap = new Map(editableInitialParticipants.map((participant) => [String(participant.tag), participant]));
            const nextParticipantMap = new Map(editableNextParticipants.map((participant) => [String(participant.tag), participant]));

            const participantsToAdd = editableNextParticipants.filter((participant) => !initialParticipantMap.has(String(participant.tag)));
            const participantsToRemove = editableInitialParticipants.filter((participant) => !nextParticipantMap.has(String(participant.tag)));
            const participantsToUpdate = editableNextParticipants.filter((participant) => {
                const initialParticipant = initialParticipantMap.get(String(participant.tag));
                return initialParticipant && initialParticipant.permissionLevel !== participant.permissionLevel;
            });

            if (participantsToAdd.length > 0 || participantsToUpdate.length > 0) {
                linkOperations.push({
                    label: 'participantes',
                    run: async () => {
                        await Promise.all([...participantsToAdd, ...participantsToUpdate].map(async (participant) => {
                            await ensureRequestSucceeded(
                                await addParticipant(caseId, participant.tag, participant.permissionLevel),
                                `No se pudo guardar el permiso del participante ${participant.name}.`
                            );
                        }));
                    }
                });
            }

            if (participantsToRemove.length > 0) {
                linkOperations.push({
                    label: 'participantes',
                    run: async () => {
                        await Promise.all(participantsToRemove.map(async (participant) => {
                            await ensureRequestSucceeded(
                                await removeParticipant(caseId, participant.id),
                                `No se pudo quitar al participante ${participant.name}.`
                            );
                        }));
                    }
                });
            }
        }

        const linkResults = await Promise.allSettled(
            linkOperations.map(async ({ run }) => run())
        );

        const failedLinks = linkResults.flatMap((linkResult, index) => (
            linkResult.status === 'rejected' ? [linkOperations[index].label] : []
        ));
        const failedLinkReasons = linkResults.flatMap((linkResult, index) => {
            if (linkResult.status !== 'rejected') return [];

            const reasonMessage = linkResult.reason instanceof Error
                ? linkResult.reason.message
                : String(linkResult.reason || '');

            void logger.error(`Fallo al sincronizar ${linkOperations[index].label}`, {
                caseId,
                mode: baseCaseAction,
                message: reasonMessage,
                apiResponse: linkResult.reason?.apiResponse ?? null,
            });

            return reasonMessage ? [`${linkOperations[index].label}: ${reasonMessage}`] : [];
        });

        return { failedLinks, failedLinkReasons };
    }, [newCase]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validaciones inline (campos con borde rojo)
        const inlineErrors = {};
        if (!newCase.title?.trim()) inlineErrors.title = 'La carátula es obligatoria.';
        if (!newCase.nro_expediente?.trim()) inlineErrors.nro_expediente = 'El número de expediente es obligatorio.';
        if (!newCase.startDate) inlineErrors.startDate = 'La fecha de inicio es obligatoria.';
        if (mode === FORM_MODE.CREATE && newCase.linkedClients.length === 0) inlineErrors.linkedClients = 'Debés vincular al menos un cliente.';
        if (!newCase.type) inlineErrors.type = 'El fuero del caso es obligatorio.';
        if (!newCase.radicacion_id) inlineErrors.radicacion_id = 'La radicación es obligatoria.';
        if (Object.keys(inlineErrors).length > 0) {
            setFieldErrors(inlineErrors);
            showAppToast({ title: 'Campos obligatorios', description: 'Completá todos los campos requeridos antes de guardar.', variant: 'danger' });
            return;
        }

        // Validamos IDs críticos antes del cast numérico para no enviar `0` a la API.
        if (isFederalRadicacion && !newCase.dependencia_id) {
            openRequiredFieldDialog(openDialog, closeDialog, {
                title: 'Juzgado Federal Requerido',
                desc: 'Para una radicación Federal, es obligatorio seleccionar el Juzgado (Competencia).',
            });
            return;
        }

        if (mode === FORM_MODE.EDIT && isLoadingEditRelations) {
            openRequiredFieldDialog(openDialog, closeDialog, {
                title: 'Esperá un momento',
                desc: 'Todavía se están cargando las relaciones actuales del caso para poder editarlo sin perder vínculos.',
            });
            return;
        }

        const payload = {
            title: newCase.title,
            case_type_id: Number(newCase.type),
            start_date: newCase.startDate,
            nro_expediente: newCase.nro_expediente,
            radicacion_id: Number(newCase.radicacion_id),
            dependencia_id:  newCase.dependencia_id ? Number(newCase.dependencia_id) : null,
        };

        const normalizedDescription = typeof newCase.description === 'string' ? newCase.description.trim() : '';
        if (normalizedDescription) {
            payload.details = normalizedDescription;
        }

        try {
            const result = mode === FORM_MODE.EDIT
                ? await updateCase(initialCaseData.id, {
                    ...payload,
                    last_updated_at: initialCaseData?.updated_at ?? undefined,
                })
                : await createCase(payload);

            if (!result.ok) {
                openDialog({
                    title: mode === FORM_MODE.EDIT ? 'Error al editar caso' : 'Error al crear caso',
                    desc: extractRequestErrorMessage(result, 'Error desconocido del servidor.'),
                    type: 'danger',
                    onConfirm: closeDialog,
                    confirmText: 'Aceptar'
                });
                return;
            }

            const responsePayload = result.data ?? null;
            const savedCase = extractCreatedCaseEntity(responsePayload);
            const caseId = savedCase?.id ?? initialCaseData?.id ?? null;
            const responsePayloadWithRelations = savedCase
                ? {
                    ...(responsePayload && typeof responsePayload === 'object' ? responsePayload : {}),
                    case: {
                        ...savedCase,
                        linkedTipoExpedientes: newCase.linkedTipoExpedientes,
                        linkedParticipants: newCase.linkedParticipants,
                        linkedClients: newCase.linkedClients,
                        linkedParties: newCase.linkedParties,
                    },
                }
                : responsePayload;

            const { failedLinks, failedLinkReasons } = caseId
                ? await syncCaseRelations(caseId, mode)
                : {
                    failedLinks: ['relaciones del caso'],
                    failedLinkReasons: ['La API no devolvió el identificador del expediente actualizado.'],
                };

            persistRememberedParticipants();

            const successPayload = {
                mode,
                title: payload.title,
                case: responsePayloadWithRelations || savedCase,
                partialFailure: failedLinks.length > 0
                    ? {
                        failedLinks,
                        message: caseId
                            ? `El expediente se ${mode === FORM_MODE.EDIT ? 'actualizó' : 'creó'}, pero falló la sincronización de ${failedLinks.join(', ')}.${failedLinkReasons.length > 0 ? ` Detalle: ${failedLinkReasons.join(' | ')}.` : ''} Podés completarla desde el detalle del caso.`
                            : `El expediente se ${mode === FORM_MODE.EDIT ? 'actualizó' : 'creó'}, pero la API no devolvió el identificador necesario para sincronizar ${failedLinks.join(', ')}.`,
                    }
                    : null,
            };

            await onSuccess?.(successPayload);
            onClose?.();
        } catch (err) {
            void logger.error(mode === FORM_MODE.EDIT ? 'Error editing case' : 'Error creating case', err);
            openDialog({
                title: 'Error de Red',
                desc: 'Ocurrió un error al contactar al servidor.',
                type: 'danger',
                onConfirm: closeDialog,
                confirmText: 'Aceptar'
            });
        }
    };

    return (
        <>
        <form id="new-case-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
            {mode === FORM_MODE.EDIT && isLoadingEditRelations && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Cargando clientes, partes, tipos y participantes actuales del expediente...
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
                <div className="space-y-2">
                    <label htmlFor="case-form-title" className="text-sm font-semibold text-(--text-secondary)">Carátula <span className="text-red-500">*</span></label>
                    <input
                        id="case-form-title"
                        required
                        name="title"
                        value={newCase.title}
                        onChange={handleInputChange}
                        className={`w-full h-11 px-4 border rounded-xl bg-(--bg-input) text-(--text-primary) shadow-sm focus:ring-2 outline-none transition-all ${
                            fieldErrors.title
                                ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                                : 'border-(--border-default) focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                        placeholder="Ej: Gomez vs Empresa S.A."
                    />
                    {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
                </div>

                <div className="space-y-2">
                    <label htmlFor="case-form-nro-expediente" className="text-sm font-semibold text-(--text-secondary)">Nro. Expediente <span className="text-red-500">*</span></label>
                    <input
                        id="case-form-nro-expediente"
                        required
                        name="nro_expediente"
                        value={newCase.nro_expediente}
                        onChange={handleInputChange}
                        className={`w-full h-11 px-4 border rounded-xl bg-(--bg-input) text-(--text-primary) shadow-sm focus:ring-2 outline-none transition-all ${
                            fieldErrors.nro_expediente
                                ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                                : 'border-(--border-default) focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                        placeholder="Ej: 123/2024"
                    />
                    {fieldErrors.nro_expediente && <p className="text-xs text-red-500 mt-1">{fieldErrors.nro_expediente}</p>}
                </div>

                <div className="space-y-2">
                    <label htmlFor="case-form-start-date" className="text-sm font-semibold text-(--text-secondary)">Fecha de Inicio <span className="text-red-500">*</span></label>
                    <input
                        id="case-form-start-date"
                        required
                        type="date"
                        name="startDate"
                        value={newCase.startDate}
                        onChange={handleInputChange}
                        className={`w-full h-11 px-4 border rounded-xl bg-(--bg-input) text-(--text-primary) shadow-sm focus:ring-2 outline-none transition-all ${
                            fieldErrors.startDate
                                ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                                : 'border-(--border-default) focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                    />
                    {fieldErrors.startDate && <p className="text-xs text-red-500 mt-1">{fieldErrors.startDate}</p>}
                </div>
            </div>

            {/* SECCIÓN RADICACIÓN */}
            <div className="space-y-4 border-t border-(--border-subtle) pt-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-(--text-secondary)">Radicación</h3>
                    <p className="text-sm text-(--text-secondary)">Seleccioná la ubicación judicial y competencia del caso.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
                    {/* Radicación con Creación Rápida */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center px-1">
                            <label htmlFor="case-form-radicacion" className={`text-sm font-semibold ${fieldErrors.radicacion_id ? 'text-red-500' : 'text-(--text-secondary)'}`}>
                                Radicación <span className="text-red-500">*</span>
                            </label>
                            <button
                                type="button"
                                data-testid="new-case-add-radicacion"
                                onClick={() => setIsRadicacionModalOpen(true)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 active:scale-95 transform"
                            >
                                <Plus size={12} /> Nueva
                            </button>
                        </div>
                        <Select
                            value={newCase.radicacion_id ? String(newCase.radicacion_id) : ''}
                            onValueChange={(val) => handleSelectChange('radicacion_id', val)}
                            disabled={radicacionesLoading}
                        >
                            <SelectTrigger id="case-form-radicacion" className={`h-11 rounded-xl shadow-sm ${fieldErrors.radicacion_id ? 'border-red-500 focus-visible:ring-red-500' : ''}`}>
                                <SelectValue
                                    placeholder={getCatalogPlaceholder({
                                        loading: radicacionesLoading,
                                        loadingLabel: 'Cargando radicaciones...',
                                        emptyLabel: 'Seleccionar Radicación...',
                                    })}
                                />
                            </SelectTrigger>
                            <SelectContent side="bottom" className="">
                                {radicaciones.map((rad) => (
                                    <SelectItem key={rad.id} value={String(rad.id)}>{rad.tipo || rad.name || rad.nombre_lugar}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldErrors.radicacion_id && <p className="text-xs text-red-500 px-1">{fieldErrors.radicacion_id}</p>}
                    </div>

                    {/* Jurisdicción con Creación Rápida */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center px-1">
                            <label htmlFor="case-form-jurisdiccion" className="text-sm font-semibold text-(--text-secondary)">
                                Jurisdicción
                            </label>
                            <button
                                type="button"
                                data-testid="new-case-add-jurisdiccion"
                                onClick={() => setIsJurisdiccionModalOpen(true)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 active:scale-95 transform"
                            >
                                <Plus size={12} /> Nueva
                            </button>
                        </div>
                        <Select
                            value={newCase.jurisdiccion_id ? String(newCase.jurisdiccion_id) : ''}
                            onValueChange={(val) => handleSelectChange('jurisdiccion_id', val)}
                            disabled={jurisdiccionesLoading || isFederalRadicacion}
                        >
                            <SelectTrigger id="case-form-jurisdiccion" className="h-11 rounded-xl shadow-sm">
                                <SelectValue
                                    placeholder={getCatalogPlaceholder({
                                        loading: jurisdiccionesLoading,
                                        loadingLabel: 'Cargando...',
                                        emptyLabel: isFederalRadicacion ? 'Federal' : 'Seleccionar...',
                                    })}
                                />
                            </SelectTrigger>
                            <SelectContent side="bottom" className="">
                                {filteredJurisdicciones.map((jur) => (
                                    <SelectItem key={jur.id} value={String(jur.id)}>{jur.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-1">
                        <label htmlFor="case-form-dependencia" className="text-sm font-semibold text-(--text-secondary)">
                            Competencia (Juzgado)
                        </label>
                        {newCase.jurisdiccion_id && (
                            <button
                                type="button"
                                data-testid="new-case-add-dependencia"
                                onClick={() => setIsDependenciaModalOpen(true)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 active:scale-95 transform"
                            >
                                <Plus size={12} /> Nueva
                            </button>
                        )}
                    </div>
                    <Select
                        value={dependenciaSelectValue}
                        onValueChange={(val) => handleSelectChange('dependencia_id', val)}
                        disabled={dependenciasLoading || !newCase.jurisdiccion_id || !newCase.radicacion_id}
                    >
                        <SelectTrigger id="case-form-dependencia" className="h-11 rounded-xl shadow-sm">
                            <SelectValue placeholder={
                                !newCase.jurisdiccion_id || !newCase.radicacion_id
                                    ? 'Seleccioná radicación y jurisdicción'
                                    : getCatalogPlaceholder({
                                        loading: dependenciasLoading,
                                        loadingLabel: 'Cargando dependencias...',
                                        emptyLabel: 'Seleccionar Juzgado...',
                                    })
                            } />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                            {dependencias.map((dep) => {
                                // Enriquecer con el nombre de la competencia (fuero)
                                const comp = competencias.find(c => String(c.id) === String(dep.competencia_id));
                                const competenciaLabel = comp ? ` (${comp.fuero || comp.name})` : '';
                                return (
                                    <SelectItem key={dep.id} value={String(dep.id)}>
                                        {dep.nombre_juzgado}{competenciaLabel}
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-(--border-subtle)">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-(--text-secondary)">Fuero y Tipos de Expediente</h3>
                    <p className="text-xs text-(--text-secondary)">Seleccioná el fuero y vinculá los tipos de expediente compatibles.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label htmlFor="case-form-type" className={`text-sm font-semibold ${fieldErrors.type ? 'text-red-500' : 'text-(--text-secondary)'}`}>Fuero del Caso <span className="text-red-500">*</span></label>
                        <Select
                            value={newCase.type ? String(newCase.type) : ''}
                            onValueChange={(val) => handleSelectChange('type', val)}
                            disabled={caseTypesLoading}
                        >
                            <SelectTrigger id="case-form-type" className={`h-11 rounded-xl shadow-sm ${fieldErrors.type ? 'border-red-500 focus-visible:ring-red-500' : ''}`}>
                                <SelectValue
                                    placeholder={getCatalogPlaceholder({
                                        loading: caseTypesLoading,
                                        loadingLabel: 'Cargando fueros...',
                                        emptyLabel: 'Seleccionar Fuero...',
                                    })}
                                />
                            </SelectTrigger>
                            <SelectContent side="bottom">
                                {case_types.map(type => (
                                    <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldErrors.type && <p className="text-xs text-red-500">{fieldErrors.type}</p>}
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <span className="text-sm font-semibold text-(--text-secondary)">Tipos Vinculados</span>
                            <button
                                type="button"
                                onClick={openSelectTipoExpedienteModal}
                                disabled={!newCase.type}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 disabled:text-gray-400 active:scale-95 transform"
                            >
                                <Plus size={14} /> Vincular Tipo
                            </button>
                        </div>
                        {newCase.linkedTipoExpedientes.length === 0 && (
                            <p className="text-xs text-(--text-tertiary) italic px-1">
                                {newCase.type ? 'Ningún tipo vinculado todavía.' : 'Debes seleccionar un fuero primero.'}
                            </p>
                        )}
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                            {newCase.linkedTipoExpedientes.map((tipo) => (
                                <div
                                    key={tipo.id}
                                    className="flex items-center justify-between p-2.5 bg-(--bg-card-hover) rounded-xl border border-(--border-default) group"
                                >
                                    <p className="text-xs font-medium text-(--text-primary) truncate">{tipo.titulo || tipo.title}</p>
                                    <button type="button" onClick={() => handleRemoveTipoExpediente(tipo.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-(--border-subtle)">
                <div className="flex items-center justify-between">
                    <label htmlFor="case-form-description" className="text-sm font-semibold text-(--text-secondary)">Resumen / Descripción del Caso</label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-(--text-secondary)">
                        <input
                            type="checkbox"
                            className="accent-blue-600"
                            checked={skipDescription}
                            onChange={(e) => {
                                const shouldSkip = e.target.checked;
                                setSkipDescription(shouldSkip);
                                if (shouldSkip) {
                                    setNewCase(prev => ({ ...prev, description: '' }));
                                }
                            }}
                        />
                        No incluir
                    </label>
                </div>
                <textarea
                    id="case-form-description"
                    name="description"
                    disabled={skipDescription}
                    value={newCase.description}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border border-(--border-default) rounded-xl bg-(--bg-input) text-(--text-primary) shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none h-[110px] resize-none transition-all text-sm ${skipDescription ? 'opacity-40 cursor-not-allowed' : ''}`}
                    placeholder="Escribí aquí los detalles principales, estrategia o notas iniciales del expediente..."
                />
            </div>

            {mode === FORM_MODE.CREATE && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 pt-4 border-t border-(--border-subtle)">
                        {/* Clients */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className={`text-sm font-semibold ${fieldErrors.linkedClients ? 'text-red-500' : 'text-(--text-secondary)'}`}>
                                    Clientes <span className="text-red-500">*</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={openSelectClientModal}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 active:scale-95 transform"
                                >
                                    <Plus size={14} /> Vincular
                                </button>
                            </div>
                            {newCase.linkedClients.length === 0 && (
                                <p className={`text-xs italic ${fieldErrors.linkedClients ? 'text-red-500' : 'text-(--text-tertiary)'}`}>Sin clientes vinculados.</p>
                            )}
                            {fieldErrors.linkedClients && <p className="text-xs text-red-500">{fieldErrors.linkedClients}</p>}
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                {newCase.linkedClients.map((client) => (
                                    <div
                                        key={client.id}
                                        className="flex items-center justify-between p-2.5 bg-(--bg-card-hover) rounded-xl border border-(--border-default) group"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="p-1 bg-indigo-50 text-indigo-500 rounded-lg shrink-0">
                                                <User size={14} />
                                            </div>
                                            <p className="text-xs font-medium text-(--text-primary) truncate">{client.first_name} {client.last_name}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveClient(client.id)}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Parties */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-(--text-secondary)">Otras Partes</span>
                                <button
                                    type="button"
                                    onClick={openSelectParteModal}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 active:scale-95 transform"
                                >
                                    <Plus size={14} /> Vincular
                                </button>
                            </div>
                            {newCase.linkedParties.length === 0 && (
                                <p className="text-xs text-(--text-tertiary) italic">Sin otras partes vinculadas.</p>
                            )}
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                {newCase.linkedParties.map((party) => (
                                    <div
                                        key={party.id}
                                        className="flex items-center justify-between p-2.5 bg-(--bg-card-hover) rounded-xl border border-(--border-default) group animate-in slide-in-from-top-1 duration-200"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="p-1 bg-blue-50 text-blue-500 rounded-lg shrink-0">
                                                <User size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-(--text-primary) truncate">{party.nombre} {party.apellido}</p>
                                                <p className="text-[10px] text-(--text-tertiary)">{getRolName(party.rol_id)}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveParty(party.id)}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN PARTICIPANTES DEL ESTUDIO */}
                    <div className="space-y-4 pt-4 border-t border-(--border-subtle)">
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-(--text-secondary) flex items-center gap-2">
                                <Shield size={13} />
                                Participantes del Estudio
                            </h3>
                            <p className="text-xs text-(--text-secondary)">Agregá miembros del estudio con su nivel de acceso al caso.</p>
                        </div>

                        {/* Buscador de usuarios */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-tertiary) pointer-events-none" />
                            <input
                                ref={participantSearchRef}
                                type="text"
                                value={participantSearch}
                                onChange={(e) => {
                                    setParticipantSearch(e.target.value);
                                    setShowParticipantDropdown(true);
                                }}
                                onFocus={() => setShowParticipantDropdown(true)}
                                onBlur={() => {
                                    // Delay para permitir click en dropdown antes de cerrarlo
                                    dropdownHideTimer.current = setTimeout(() => setShowParticipantDropdown(false), 150);
                                }}
                                placeholder="Buscar miembro por nombre o @tag..."
                                className="w-full h-10 pl-9 pr-4 border border-(--border-default) rounded-xl bg-(--bg-input) text-(--text-primary) shadow-sm text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                            {showParticipantDropdown && filteredParticipantUsers.length > 0 && (
                                <div
                                    role="presentation"
                                    className="absolute top-full left-0 right-0 mt-1 bg-(--bg-card) border border-(--border-default) shadow-xl rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto"
                                    onMouseDown={() => clearTimeout(dropdownHideTimer.current)}
                                >
                                    {filteredParticipantUsers.map(user => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => handleAddParticipant(user)}
                                            className="w-full px-4 py-2.5 text-left hover:bg-(--bg-card-hover) transition-colors flex items-center gap-3"
                                        >
                                            <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                {user.name?.charAt(0)?.toUpperCase() ?? '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-(--text-primary) truncate">{user.name}</p>
                                                <p className="text-xs text-(--text-tertiary)">@{user.tag}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Lista de participantes agregados */}
                        {newCase.linkedParticipants.length > 0 && (
                            <div className="space-y-2">
                                {newCase.linkedParticipants.map((p) => (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between p-2.5 bg-(--bg-card-hover) rounded-xl border border-(--border-default) group animate-in slide-in-from-top-1 duration-200"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                {p.name?.charAt(0)?.toUpperCase() ?? '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-(--text-primary) truncate flex items-center gap-1.5">
                                                    <span>{p.name}</span>
                                                    {p.isOwner && <Crown size={11} className="text-amber-500" />}
                                                </p>
                                                <p className="text-[10px] text-(--text-tertiary)">
                                                    @{p.tag} {p.isOwner ? '• Dueño del caso' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Toggle lectura / escritura */}
                                            <div className="flex items-center rounded-lg border border-(--border-default) overflow-hidden text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => handleChangeParticipantPermission(p.id, 'read')}
                                                    disabled={p.isOwner}
                                                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${p.permissionLevel === 'read' ? 'bg-blue-500 text-white' : 'text-(--text-secondary) hover:bg-(--bg-card)'} ${p.isOwner ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    title="Solo lectura"
                                                >
                                                    <Eye size={11} /> Lectura
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChangeParticipantPermission(p.id, 'write')}
                                                    disabled={p.isOwner}
                                                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${p.permissionLevel === 'write' ? 'bg-indigo-500 text-white' : 'text-(--text-secondary) hover:bg-(--bg-card)'} ${p.isOwner ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    title="Puede editar"
                                                >
                                                    <Edit3 size={11} /> Escritura
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChangeParticipantPermission(p.id, 'admin')}
                                                    disabled={p.isOwner}
                                                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${p.permissionLevel === 'admin' ? 'bg-amber-500 text-white' : 'text-(--text-secondary) hover:bg-(--bg-card)'} ${p.isOwner ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    title="Administración"
                                                >
                                                    <Crown size={11} /> Admin
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveParticipant(p.id)}
                                                disabled={p.isOwner}
                                                className={`text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 ${p.isOwner ? 'cursor-not-allowed opacity-50' : ''}`}
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                            <input
                                type="checkbox"
                                checked={rememberParticipants}
                                onChange={(e) => setRememberParticipants(e.target.checked)}
                                className="rounded text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-xs text-(--text-secondary)">Recordar esta selección para próximos casos</span>
                        </label>
                    </div>
                </>
            )}

        </form>

        <RadicacionModal
            open={isRadicacionModalOpen}
            onClose={() => setIsRadicacionModalOpen(false)}
            onSave={handleCreateRadicacion}
        />

        <JurisdiccionModal
            open={isJurisdiccionModalOpen}
            onClose={() => setIsJurisdiccionModalOpen(false)}
            onSave={handleCreateJurisdiccion}
        />

        <DependenciaJudicialModal
            open={isDependenciaModalOpen}
            onClose={() => setIsDependenciaModalOpen(false)}
            onSave={handleCreateDependencia}
            jurisdicciones={jurisdicciones}
            competencias={competencias}
            defaultJurisdiccionId={newCase.jurisdiccion_id}
            defaultRadicacionId={newCase.radicacion_id}
        />

        <ConfirmDialog {...dialogProps} />
        </>
    );
};

export default NewCaseForm;
