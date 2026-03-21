import { useMemo, useRef, useState } from 'react';
import { Plus, Upload, X, FileText, User } from 'lucide-react';
import { createCase, linkClientsToCase } from '../../services/caseService.js';
import { linkParteToCaso } from '../../services/parteService.js';
import { syncTipoExpedientesToCase } from '../../services/tipoExpedienteService.js';
import { useCaseTypes } from '../../context/CaseTypesContext.jsx';
import { useRadicaciones } from '../../context/RadicacionesContext.jsx';
import { useModal } from '../../context/ModalContext.jsx';
import { SelectParteModal } from '../people/SelectParteModal.jsx';
import { SelectClientModal } from '../clients/SelectClientModal.jsx';
import { SelectTipoExpedienteModal } from './SelectTipoExpedienteModal.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select.jsx';
import { useRoles } from '../../context/RolesContext.jsx';
import { createLogger } from '../../services/logService.js';
const logger = createLogger('new-case-form');

const INITIAL_FORM = {
    title: '',
    type: '',
    startDate: '',
    description: '',
    linkedParties: [],
    linkedClients: [],
    linkedTipoExpedientes: [],
    documents: [],
    nro_expediente: '',
    radicacion_id: '',
};

// Recibe un ref de contador para evitar el estado mutable a nivel de módulo (CAS-9).
function createLocalFormItemId(counterRef, prefix) {
    counterRef.current += 1;
    return `${prefix}-${counterRef.current}`;
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
            return value.map((entry) => String(entry).trim()).filter(Boolean);
        }

        return typeof value === 'string' && value.trim()
            ? [value.trim()]
            : [];
    });
}

function extractRequestErrorMessage(result, fallbackMessage) {
    const validationMessages = flattenValidationMessages(result?.data?.errors);
    if (validationMessages.length > 0) {
        return validationMessages.join(' ');
    }

    if (typeof result?.data?.error === 'string' && result.data.error.trim()) {
        return result.data.error.trim();
    }

    return result?.error || result?.data?.message || fallbackMessage;
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

const NewCaseForm = ({ onSuccess, openDialog, closeDialog }) => {
    const fileInputRef = useRef(null);
    // CAS-9: contador local al componente para evitar que se comparta entre instancias montadas simultáneamente.
    const localFormItemCounterRef = useRef(0);
    const {
        case_types,
        syncing: caseTypesSyncing,
        initialized: caseTypesInitialized,
    } = useCaseTypes();
    const {
        radicaciones,
        syncing: radicacionesSyncing,
        initialized: radicacionesInitialized,
    } = useRadicaciones();
    const { roles } = useRoles();
    const { openModal } = useModal();
    const [newCase, setNewCase] = useState(INITIAL_FORM);

    const caseTypesLoading = !caseTypesInitialized || (caseTypesSyncing && case_types.length === 0);
    const radicacionesLoading = !radicacionesInitialized || (radicacionesSyncing && radicaciones.length === 0);
    const selectedCaseTypeName = useMemo(
        () => case_types.find((caseType) => String(caseType.id) === String(newCase.type))?.name || '',
        [case_types, newCase.type]
    );

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCase(prev => {
            if (name !== 'type') {
                return { ...prev, [name]: value };
            }

            // Si cambia el fuero, descartamos tipos de expediente ajenos para no
            // dejar asociaciones inválidas ocultas en el estado del formulario.
            const filteredTipos = value
                ? prev.linkedTipoExpedientes.filter((tipo) => String(tipo.case_type_id || '') === String(value))
                : [];

            return {
                ...prev,
                [name]: value,
                linkedTipoExpedientes: filteredTipos,
            };
        });
    };

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
    
    const getRolName = (rolId) => {
        const rol = roles.find(r => r.id === rolId);
        return rol ? rol.titulo : 'N/A';
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        const newDocs = files.map(file => ({
            id: createLocalFormItemId(localFormItemCounterRef, 'document'),
            name: file.name,
            type: 'Archivo',
            date: new Date().toISOString().split('T')[0],
            file: file
        }));

        setNewCase(prev => ({
            ...prev,
            documents: [...prev.documents, ...newDocs]
        }));

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveDocument = (documentId) => {
        setNewCase(prev => ({
            ...prev,
            documents: prev.documents.filter((document) => document.id !== documentId)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validamos IDs críticos antes del cast numérico para no enviar `0` a la API.
        if (!newCase.type) {
            openRequiredFieldDialog(openDialog, closeDialog, {
                title: 'Falta seleccionar un fuero',
                desc: 'Elegí un fuero antes de crear el expediente.',
            });
            return;
        }

        if (!newCase.radicacion_id) {
            openRequiredFieldDialog(openDialog, closeDialog, {
                title: 'Falta seleccionar una radicación',
                desc: 'Elegí una radicación antes de crear el expediente.',
            });
            return;
        }

        const payload = {
            title: newCase.title,
            case_type_id: Number(newCase.type),
            start_date: newCase.startDate,
            details: newCase.description || null,
            nro_expediente: newCase.nro_expediente,
            radicacion_id: Number(newCase.radicacion_id),
        };

        try {
            const result = await createCase(payload);
            if (!result.ok) {
                openDialog({
                    title: 'Error al crear caso',
                    desc: extractRequestErrorMessage(result, 'Error desconocido del servidor.'),
                    type: 'danger',
                    onConfirm: closeDialog,
                    confirmText: 'Aceptar'
                });
                return;
            }

            const createdPayload = result.data ?? null;
            const createdCase = extractCreatedCaseEntity(createdPayload);
            const caseId = createdCase?.id ?? null;
            const createdPayloadWithRelations = createdCase
                ? {
                    ...(createdPayload && typeof createdPayload === 'object' ? createdPayload : {}),
                    case: {
                        ...createdCase,
                        linkedTipoExpedientes: newCase.linkedTipoExpedientes,
                    },
                }
                : createdPayload;
            const linkOperations = [];

            if (caseId && newCase.linkedClients.length > 0) {
                linkOperations.push({
                    label: 'clientes',
                    run: async () => {
                        const clientIds = newCase.linkedClients.map(client => client.id);
                        await ensureRequestSucceeded(
                            await linkClientsToCase(caseId, clientIds),
                            'No se pudieron vincular los clientes seleccionados.'
                        );
                    }
                });
            }

            if (caseId && newCase.linkedParties.length > 0) {
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

            if (caseId && newCase.linkedTipoExpedientes.length > 0) {
                linkOperations.push({
                    label: 'tipos de expediente',
                    run: async () => {
                        const tipoIds = newCase.linkedTipoExpedientes.map((tipo) => tipo.id);
                        await ensureRequestSucceeded(
                            await syncTipoExpedientesToCase(caseId, tipoIds),
                            'No se pudieron vincular los tipos de expediente seleccionados.'
                        );
                    }
                });
            }

            const missingCaseIdFailedLinks = !caseId
                ? [
                    ...(newCase.linkedClients.length > 0 ? ['clientes'] : []),
                    ...(newCase.linkedParties.length > 0 ? ['partes'] : []),
                    ...(newCase.linkedTipoExpedientes.length > 0 ? ['tipos de expediente'] : []),
                ]
                : [];
            const linkResults = await Promise.allSettled(
                linkOperations.map(async ({ run }) => run())
            );
            const failedLinks = [
                ...missingCaseIdFailedLinks,
                ...linkResults.flatMap((linkResult, index) => (
                    linkResult.status === 'rejected' ? [linkOperations[index].label] : []
                )),
            ];
            const failedLinkReasons = linkResults.flatMap((linkResult, index) => {
                if (linkResult.status !== 'rejected') return [];

                const reasonMessage = linkResult.reason instanceof Error
                    ? linkResult.reason.message
                    : String(linkResult.reason || '');

                void logger.error(`Fallo al vincular ${linkOperations[index].label}`, {
                    caseId,
                    message: reasonMessage,
                    apiResponse: linkResult.reason?.apiResponse ?? null,
                });

                return reasonMessage ? [`${linkOperations[index].label}: ${reasonMessage}`] : [];
            });

            setNewCase(INITIAL_FORM);
            await onSuccess({
                title: payload.title,
                case: createdPayloadWithRelations || createdCase,
                partialFailure: failedLinks.length > 0
                    ? {
                        failedLinks,
                        message: caseId
                            ? `El expediente se creó, pero falló la vinculación de ${failedLinks.join(', ')}.${failedLinkReasons.length > 0 ? ` Detalle: ${failedLinkReasons.join(' | ')}.` : ''} Podés completarla desde el detalle del caso.`
                            : `El expediente se creó, pero la API no devolvió el identificador necesario para vincular ${failedLinks.join(', ')} en el mismo paso.`,
                    }
                    : null,
            });
        } catch (err) {
            void logger.error('Error creating case', err);
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
        <form id="new-case-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label htmlFor="case-form-title" className="text-sm font-medium text-(--text-secondary)">Carátula <span className="text-red-500">*</span></label>
                    <input
                        id="case-form-title"
                        required
                        name="title"
                        value={newCase.title}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej: Gomez vs Empresa S.A."
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="case-form-nro-expediente" className="text-sm font-medium text-(--text-secondary)">Nro. Expediente <span className="text-red-500">*</span></label>
                    <input
                        id="case-form-nro-expediente"
                        required
                        name="nro_expediente"
                        value={newCase.nro_expediente}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej: 123/2024"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="case-form-radicacion" className="text-sm font-medium text-(--text-secondary)">Radicación <span className="text-red-500">*</span></label>
                    <Select
                        value={newCase.radicacion_id ? String(newCase.radicacion_id) : ''}
                        onValueChange={(val) => handleInputChange({ target: { name: 'radicacion_id', value: val } })}
                        disabled={radicacionesLoading}
                    >
                        <SelectTrigger id="case-form-radicacion">
                            <SelectValue 
                                placeholder={getCatalogPlaceholder({
                                    loading: radicacionesLoading,
                                    loadingLabel: 'Cargando juzgados...',
                                    emptyLabel: radicaciones.length === 0 ? 'Sin juzgados disponibles' : 'Seleccionar Juzgado...',
                                })} 
                            />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                            {radicaciones.map(rad => (
                                <SelectItem key={rad.id} value={String(rad.id)}>{rad.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label htmlFor="case-form-start-date" className="text-sm font-medium text-(--text-secondary)">Fecha de Inicio <span className="text-red-500">*</span></label>
                    <input
                        id="case-form-start-date"
                        required
                        type="date"
                        name="startDate"
                        value={newCase.startDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="space-y-4 border-t border-(--border-subtle) pt-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-(--text-secondary)">Clasificación del expediente</h3>
                    <p className="text-sm text-(--text-secondary)">Primero elegí el fuero y después vinculá sólo los tipos de expediente compatibles.</p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="case-form-type" className="text-sm font-medium text-(--text-secondary)">Fuero <span className="text-red-500">*</span></label>
                    <Select
                        value={newCase.type ? String(newCase.type) : ''}
                        onValueChange={(val) => handleInputChange({ target: { name: 'type', value: val } })}
                        disabled={caseTypesLoading}
                    >
                        <SelectTrigger id="case-form-type">
                            <SelectValue 
                                placeholder={getCatalogPlaceholder({
                                    loading: caseTypesLoading,
                                    loadingLabel: 'Cargando fueros...',
                                    emptyLabel: case_types.length === 0 ? 'Sin fueros disponibles' : 'Seleccionar...',
                                })} 
                            />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                            {case_types.map(type => (
                                <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <span className="block text-sm font-medium text-gray-700">Tipo de expediente</span>
                            <p className="mt-1 text-sm text-(--text-secondary)">
                                {newCase.type
                                    ? 'Se muestran y vinculan únicamente los tipos del fuero seleccionado.'
                                    : 'Seleccioná un fuero para habilitar este selector.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={openSelectTipoExpedienteModal}
                            data-testid="new-case-link-tipo-expediente"
                            disabled={!newCase.type}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:text-gray-400 disabled:hover:text-gray-400"
                        >
                            <Plus size={16} /> Vincular Tipo
                        </button>
                    </div>
                    {newCase.linkedTipoExpedientes.length === 0 && (
                        <p className="text-sm text-(--text-tertiary) italic">
                            {newCase.type
                                ? 'No se han vinculado tipos de expediente.'
                                : 'Seleccioná primero un fuero para habilitar los tipos de expediente.'}
                        </p>
                    )}
                    <div className="space-y-2">
                        {newCase.linkedTipoExpedientes.map((tipo) => (
                            <div
                                key={tipo.id}
                                data-testid="new-case-linked-tipo-expediente"
                                className="flex items-center justify-between p-3 bg-(--bg-card-hover) rounded-lg border border-(--border-default)"
                            >
                                <p className="text-sm font-medium text-(--text-primary)">{tipo.title}</p>
                                <button type="button" onClick={() => handleRemoveTipoExpediente(tipo.id)} className="text-gray-400 hover:text-red-500 p-1"><X size={16} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="case-form-description" className="text-sm font-medium text-(--text-secondary)">Resumen / Descripción</label>
                <textarea
                    id="case-form-description"
                    name="description"
                    value={newCase.description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                    placeholder="Detalles principales del caso..."
                />
            </div>

            {/* Clients */}
            <div className="space-y-3 pt-4 border-t border-(--border-subtle)">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 block">Clientes Involucrados</span>
                    <button
                        type="button"
                        onClick={openSelectClientModal}
                        data-testid="new-case-link-client"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        <Plus size={16} /> Vincular Cliente
                    </button>
                </div>
                {newCase.linkedClients.length === 0 && (
                    <p className="text-sm text-(--text-tertiary) italic">No se han vinculado clientes.</p>
                )}
                <div className="space-y-2">
                    {newCase.linkedClients.map((client) => (
                        <div
                            key={client.id}
                            data-testid="new-case-linked-client"
                            className="flex items-center justify-between p-3 bg-(--bg-card-hover) rounded-lg border border-(--border-default)"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded">
                                    <User size={16} />
                                </div>
                                <p className="text-sm font-medium text-(--text-primary)">{client.first_name} {client.last_name}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveClient(client.id)}
                                className="text-gray-400 hover:text-red-500 p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Parties */}
            <div className="space-y-3 pt-4 border-t border-(--border-subtle)">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 block">Partes Involucradas</span>
                    <button
                        type="button"
                        onClick={openSelectParteModal}
                        data-testid="new-case-link-party"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        <Plus size={16} /> Vincular Parte
                    </button>
                </div>
                {newCase.linkedParties.length === 0 && (
                    <p className="text-sm text-(--text-tertiary) italic">No se han vinculado partes.</p>
                )}
                <div className="space-y-2">
                    {newCase.linkedParties.map((party) => (
                        <div
                            key={party.id}
                            data-testid="new-case-linked-party"
                            className="flex items-center justify-between p-3 bg-(--bg-card-hover) rounded-lg border border-(--border-default) animate-in slide-in-from-top-2 duration-200"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded">
                                    <User size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-(--text-primary) truncate">{party.nombre} {party.apellido}</p>
                                    <p className="text-xs text-(--text-secondary)">{getRolName(party.rol_id)}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveParty(party.id)}
                                className="text-gray-400 hover:text-red-500 p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

        </form>
    );
};

export default NewCaseForm;
