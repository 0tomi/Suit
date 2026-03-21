import { useMemo } from 'react';
import { Activity, Book, Briefcase, FileText, Landmark, Scale, Wallet, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCaseTypes } from '../context/CaseTypesContext.jsx';
import { useEventTypes } from '../context/EventTypesContext.jsx';
import { useTipoExpedientes } from '../context/TipoExpedientesContext.jsx';
import { useTipoPagos } from '../context/TipoPagosContext.jsx';
import { useGastoCatalogo } from '../context/GastoCatalogoContext.jsx';
import { useRoles } from '../context/RolesContext.jsx';
import { useRadicaciones } from '../context/RadicacionesContext.jsx';
import { createCaseType, deleteCaseType, updateCaseType, createEventType, deleteEventType, updateEventType } from '../services/adminService.js';
import { createTipoExpediente, deleteTipoExpediente, updateTipoExpediente } from '../services/tipoExpedienteService.js';
import { createTipoPago, deleteTipoPago, updateTipoPago } from '../services/tipoPagoService.js';
import { createGastoCatalogo, deleteGastoCatalogo, updateGastoCatalogo } from '../services/gastoCatalogoService.js';
import { createRol, deleteRol, updateRol } from '../services/rolService.js';
import { createRadicacion, deleteRadicacion, updateRadicacion } from '../services/radicacionService.js';
import {
    extractRoleFromMutation,
    invalidateRolesSyncMeta,
    persistRoleLocally,
    removeRoleLocally,
} from '../services/cache/roleCache.js';

function getApiErrorMessage(result, fallbackMessage) {
    return result?.data?.message || result?.error || fallbackMessage;
}

async function assertMutation(result, fallbackMessage) {
    if (result?.ok === false) {
        throw new Error(getApiErrorMessage(result, fallbackMessage));
    }

    return result;
}

function sortByField(items, key) {
    return [...items].sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || ''), 'es', { sensitivity: 'base' }));
}

function createCatalogConfig({
    id,
    testId,
    label,
    singularLabel,
    badgeLabel,
    description,
    emptyMessage,
    emptyPluralLabel,
    emptyIcon,
    primaryField,
    fields,
    items,
    initialized,
    syncing,
    onCreate,
    onUpdate,
    onDelete,
}) {
    return {
        id,
        testId,
        label,
        singularLabel,
        badgeLabel,
        description,
        emptyMessage,
        emptyPluralLabel,
        emptyIcon,
        primaryField,
        fields,
        items,
        loading: !initialized && items.length === 0 ? true : syncing,
        searchPlaceholder: `Buscar en ${label.toLowerCase()}...`,
        onCreate,
        onUpdate,
        onDelete,
    };
}

/**
 * Centraliza la configuración de grupos y catálogos para la nueva sección Categorías.
 * Las lecturas salen de los contexts/cache; solo las mutaciones traducen payloads hacia la API.
 */
export function useCategoriesCatalogs() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const {
        case_types: caseTypes = [],
        initialized: caseTypesInitialized,
        syncing: caseTypesSyncing,
        refreshCaseTypes,
    } = useCaseTypes();
    const {
        event_types: eventTypes = [],
        initialized: eventTypesInitialized,
        syncing: eventTypesSyncing,
        refreshEventTypes,
    } = useEventTypes();
    const {
        tipo_expedientes: tipoExpedientes = [],
        initialized: tipoExpedientesInitialized,
        syncing: tipoExpedientesSyncing,
        refreshTipoExpedientes,
    } = useTipoExpedientes();
    const {
        tipo_pagos: tipoPagos = [],
        initialized: tipoPagosInitialized,
        syncing: tipoPagosSyncing,
        refreshTipoPagos,
    } = useTipoPagos();
    const {
        gastos_catalogo: gastosCatalogo = [],
        initialized: gastosCatalogoInitialized,
        syncing: gastosCatalogoSyncing,
        refreshGastosCatalogo,
    } = useGastoCatalogo();
    const {
        roles = [],
        initialized: rolesInitialized,
        syncing: rolesSyncing,
        refreshRoles,
        loadLocalRoles,
    } = useRoles();
    const {
        radicaciones = [],
        initialized: radicacionesInitialized,
        syncing: radicacionesSyncing,
        refreshRadicaciones,
    } = useRadicaciones();

    const groups = useMemo(() => {
        const ensureAdminMutation = () => {
            if (!isAdmin) throw new Error('Solo los administradores pueden modificar catálogos.');
        };

        const syncRolesLocally = async (payload, fallback = {}) => {
            const role = extractRoleFromMutation(payload, fallback);
            await persistRoleLocally(role);
            await invalidateRolesSyncMeta();
            await loadLocalRoles();
            void refreshRoles();
        };

        const deleteRoleAndRefresh = async (roleId) => {
            await removeRoleLocally(roleId);
            await invalidateRolesSyncMeta();
            await loadLocalRoles();
            void refreshRoles();
        };

        const runMutation = async (mutation, refresh, fallbackMessage, ...args) => {
            ensureAdminMutation();
            const result = await assertMutation(await mutation(...args), fallbackMessage);
            await refresh();
            return result;
        };

        const normalizedCaseTypes = sortByField(caseTypes.map((item) => ({
            id: item.id,
            name: item.name || '',
            description: item.description || '',
            eventColor: item.eventColor || '#10b981',
        })), 'name');

        const normalizedEventTypes = sortByField(eventTypes.map((item) => ({
            id: item.id,
            name: item.name || '',
            color: item.color || '#3b82f6',
        })), 'name');

        const normalizedTipoExpedientes = sortByField(tipoExpedientes.map((item) => {
            const caseType = caseTypes.find((ct) => ct.id === Number(item.case_type_id));
            return {
                id: item.id,
                title: item.title || item.titulo || '',
                details: item.details || item.detalles || '',
                caseType: caseType ? caseType.name : 'Varios / General',
            };
        }), 'title');

        const normalizedTipoPagos = sortByField(tipoPagos.map((item) => ({
            id: item.id,
            name: item.name || item.titulo || '',
        })), 'name');

        const normalizedGastosCatalogo = sortByField(gastosCatalogo.map((item) => ({
            id: item.id,
            titulo: item.titulo || item.name || '',
            detalles: item.detalles || item.description || '',
        })), 'titulo');

        const normalizedRoles = sortByField(roles.map((item) => ({
            id: item.id,
            titulo: item.titulo || '',
        })), 'titulo');

        const normalizedRadicaciones = sortByField(radicaciones.map((item) => ({
            id: item.id,
            name: item.name || item.nombre_lugar || '',
        })), 'name');

        return [
            {
                id: 'casos',
                label: 'Catálogo Judicial',
                testId: 'casos',
                icon: Briefcase,
                description: 'Agrupa los catálogos judiciales usados para clasificar y estructurar un caso.',
                catalogs: [
                    createCatalogConfig({
                        id: 'fueros',
                        testId: 'fueros',
                        label: 'Fueros',
                        singularLabel: 'Fuero',
                        badgeLabel: 'Catálogo judicial',
                        description: 'Fueros disponibles para elegir al dar de alta un caso.',
                        emptyMessage: 'Todavía no hay fueros cargados en el sistema.',
                        emptyPluralLabel: 'fueros',
                        emptyIcon: Scale,
                        primaryField: 'name',
                        fields: [
                            { key: 'name', label: 'Nombre', required: true, emphasis: true, placeholder: 'Ej: Civil y Comercial' },
                            { key: 'description', label: 'Descripción', placeholder: 'Opcional', emptyLabel: 'Sin descripción' },
                            { key: 'eventColor', label: 'Color', type: 'color', defaultValue: '#10b981' },
                        ],
                        items: normalizedCaseTypes,
                        initialized: caseTypesInitialized,
                        syncing: caseTypesSyncing,
                        onCreate: (payload) => runMutation(
                            createCaseType,
                            refreshCaseTypes,
                            'No se pudo crear el fuero.',
                            {
                                name: payload.name?.trim(),
                                description: payload.description?.trim() || null,
                                eventColor: payload.eventColor || '#10b981',
                            },
                        ),
                        onUpdate: (id, payload) => runMutation(
                            updateCaseType,
                            refreshCaseTypes,
                            'No se pudo actualizar el fuero.',
                            id,
                            {
                                name: payload.name?.trim(),
                                description: payload.description?.trim() || null,
                                eventColor: payload.eventColor || '#10b981',
                            },
                        ),
                        onDelete: (id) => runMutation(deleteCaseType, refreshCaseTypes, 'No se pudo eliminar el fuero.', id),
                    }),
                    createCatalogConfig({
                        id: 'tipos-expediente',
                        testId: 'tipos-expediente',
                        label: 'Tipos de Expediente',
                        singularLabel: 'Tipo de Expediente',
                        badgeLabel: 'Catálogo judicial',
                        description: 'Clasifica expedientes y procesos vinculados a un caso.',
                        emptyMessage: 'Todavía no hay tipos de expediente cargados.',
                        emptyPluralLabel: 'tipos de expediente',
                        emptyIcon: FileText,
                        primaryField: 'title',
                        fields: [
                            { key: 'title', label: 'Título', required: true, emphasis: true, placeholder: 'Ej: Sucesión' },
                            { key: 'details', label: 'Detalles', placeholder: 'Opcional', emptyLabel: 'Sin detalles' },
                            { key: 'caseType', label: 'Fuero', emptyLabel: 'Sin fuero' },
                        ],
                        items: normalizedTipoExpedientes,
                        initialized: tipoExpedientesInitialized,
                        syncing: tipoExpedientesSyncing,
                        onCreate: (payload) => runMutation(
                            createTipoExpediente,
                            refreshTipoExpedientes,
                            'No se pudo crear el tipo de expediente.',
                            {
                                titulo: payload.title?.trim(),
                                detalles: payload.details?.trim() || null,
                            },
                        ),
                        onUpdate: (id, payload) => runMutation(
                            updateTipoExpediente,
                            refreshTipoExpedientes,
                            'No se pudo actualizar el tipo de expediente.',
                            id,
                            {
                                titulo: payload.title?.trim(),
                                detalles: payload.details?.trim() || null,
                            },
                        ),
                        onDelete: (id) => runMutation(deleteTipoExpediente, refreshTipoExpedientes, 'No se pudo eliminar el tipo de expediente.', id),
                    }),
                    createCatalogConfig({
                        id: 'radicaciones',
                        testId: 'radicaciones',
                        label: 'Radicaciones',
                        singularLabel: 'Radicación',
                        badgeLabel: 'Catálogo judicial',
                        description: 'Lista de juzgados, tribunales y organismos donde se radican las causas.',
                        emptyMessage: 'Todavía no hay radicaciones registradas.',
                        emptyPluralLabel: 'radicaciones',
                        emptyIcon: Book,
                        primaryField: 'name',
                        fields: [
                            { key: 'name', label: 'Nombre', required: true, emphasis: true, placeholder: 'Ej: Juzgado Federal de Corrientes' },
                        ],
                        items: normalizedRadicaciones,
                        initialized: radicacionesInitialized,
                        syncing: radicacionesSyncing,
                        onCreate: (payload) => runMutation(
                            createRadicacion,
                            refreshRadicaciones,
                            'No se pudo crear la radicación.',
                            { nombre_lugar: payload.name?.trim() },
                        ),
                        onUpdate: (id, payload) => runMutation(
                            updateRadicacion,
                            refreshRadicaciones,
                            'No se pudo actualizar la radicación.',
                            id,
                            { nombre_lugar: payload.name?.trim() },
                        ),
                        onDelete: (id) => runMutation(deleteRadicacion, refreshRadicaciones, 'No se pudo eliminar la radicación.', id),
                    }),
                    createCatalogConfig({
                        id: 'roles',
                        testId: 'roles',
                        label: 'Roles',
                        singularLabel: 'Rol',
                        badgeLabel: 'Catálogo judicial',
                        description: 'Roles procesales y funcionales asociados a las partes del caso.',
                        emptyMessage: 'Todavía no hay roles registrados.',
                        emptyPluralLabel: 'roles',
                        emptyIcon: Scale,
                        primaryField: 'titulo',
                        fields: [
                            { key: 'titulo', label: 'Título', required: true, emphasis: true, placeholder: 'Ej: Perito' },
                        ],
                        items: normalizedRoles,
                        initialized: rolesInitialized,
                        syncing: rolesSyncing,
                        onCreate: async (payload) => {
                            ensureAdminMutation();
                            const titulo = payload.titulo?.trim();
                            const result = await assertMutation(await createRol({ titulo }), 'No se pudo crear el rol.');
                            await syncRolesLocally(result.data, { titulo });
                            return result;
                        },
                        onUpdate: async (id, payload) => {
                            ensureAdminMutation();
                            const titulo = payload.titulo?.trim();
                            const currentRole = roles.find((role) => String(role.id) === String(id));
                            const result = await assertMutation(await updateRol(id, { titulo }), 'No se pudo actualizar el rol.');
                            await syncRolesLocally(result.data, {
                                ...currentRole,
                                id,
                                titulo,
                            });
                            return result;
                        },
                        onDelete: async (id) => {
                            ensureAdminMutation();
                            const result = await assertMutation(await deleteRol(id), 'No se pudo eliminar el rol.');
                            await deleteRoleAndRefresh(id);
                            return result;
                        },
                    }),
                ],
            },
            {
                id: 'agenda',
                label: 'Catálogos de Agenda',
                testId: 'agenda',
                icon: Calendar,
                description: 'Reservado para los catálogos que determinan cómo se estructuran y colorean los eventos.',
                catalogs: [
                    createCatalogConfig({
                        id: 'tipos-evento',
                        testId: 'tipos-evento',
                        label: 'Tipos de Evento',
                        singularLabel: 'Tipo de Evento',
                        badgeLabel: 'Catálogo de agenda',
                        description: 'Define los tipos base de evento usados por la agenda y sus colores.',
                        emptyMessage: 'Todavía no hay tipos de evento cargados.',
                        emptyPluralLabel: 'tipos de evento',
                        emptyIcon: Calendar,
                        primaryField: 'name',
                        fields: [
                            { key: 'name', label: 'Nombre', required: true, emphasis: true, placeholder: 'Ej: Audiencia' },
                            { key: 'color', label: 'Color', type: 'color', defaultValue: '#3b82f6' },
                        ],
                        items: normalizedEventTypes,
                        initialized: eventTypesInitialized,
                        syncing: eventTypesSyncing,
                        onCreate: (payload) => runMutation(
                            createEventType,
                            refreshEventTypes,
                            'No se pudo crear el tipo de evento.',
                            {
                                name: payload.name?.trim(),
                                color: payload.color || '#3b82f6',
                            },
                        ),
                        onUpdate: (id, payload) => runMutation(
                            updateEventType,
                            refreshEventTypes,
                            'No se pudo actualizar el tipo de evento.',
                            id,
                            {
                                name: payload.name?.trim(),
                                color: payload.color || '#3b82f6',
                            },
                        ),
                        onDelete: (id) => runMutation(deleteEventType, refreshEventTypes, 'No se pudo eliminar el tipo de evento.', id),
                    }),
                ],
            },
            {
                id: 'economia',
                label: 'Catálogos de Economía',
                testId: 'economia',
                icon: Landmark,
                description: 'Concentra los catálogos que alimentan la registración económica de honorarios, entregas y gastos.',
                catalogs: [
                    createCatalogConfig({
                        id: 'tipos-gasto',
                        testId: 'tipos-gasto',
                        label: 'Tipos de Gasto',
                        singularLabel: 'Tipo de Gasto',
                        badgeLabel: 'Catálogo económico',
                        description: 'Conceptos reutilizables para registrar gastos operativos vinculados a un caso.',
                        emptyMessage: 'Todavía no hay tipos de gasto registrados.',
                        emptyPluralLabel: 'tipos de gasto',
                        emptyIcon: Landmark,
                        primaryField: 'titulo',
                        fields: [
                            { key: 'titulo', label: 'Título', required: true, emphasis: true, placeholder: 'Ej: Viáticos' },
                            { key: 'detalles', label: 'Detalles', placeholder: 'Opcional', emptyLabel: 'Sin detalles' },
                        ],
                        items: normalizedGastosCatalogo,
                        initialized: gastosCatalogoInitialized,
                        syncing: gastosCatalogoSyncing,
                        onCreate: (payload) => runMutation(
                            createGastoCatalogo,
                            refreshGastosCatalogo,
                            'No se pudo crear el tipo de gasto.',
                            {
                                titulo: payload.titulo?.trim(),
                                detalles: payload.detalles?.trim() || null,
                            },
                        ),
                        onUpdate: (id, payload) => runMutation(
                            updateGastoCatalogo,
                            refreshGastosCatalogo,
                            'No se pudo actualizar el tipo de gasto.',
                            id,
                            {
                                titulo: payload.titulo?.trim(),
                                detalles: payload.detalles?.trim() || null,
                            },
                        ),
                        onDelete: (id) => runMutation(deleteGastoCatalogo, refreshGastosCatalogo, 'No se pudo eliminar el tipo de gasto.', id),
                    }),
                    createCatalogConfig({
                        id: 'tipos-pago',
                        testId: 'tipos-pago',
                        label: 'Tipos de Pago',
                        singularLabel: 'Tipo de Pago',
                        badgeLabel: 'Catálogo económico',
                        description: 'Medios y modalidades de pago disponibles para registrar entregas y cobros.',
                        emptyMessage: 'Todavía no hay tipos de pago registrados.',
                        emptyPluralLabel: 'tipos de pago',
                        emptyIcon: Wallet,
                        primaryField: 'name',
                        fields: [
                            { key: 'name', label: 'Nombre', required: true, emphasis: true, placeholder: 'Ej: Transferencia bancaria' },
                        ],
                        items: normalizedTipoPagos,
                        initialized: tipoPagosInitialized,
                        syncing: tipoPagosSyncing,
                        onCreate: (payload) => runMutation(createTipoPago, refreshTipoPagos, 'No se pudo crear el tipo de pago.', { titulo: payload.name?.trim() }),
                        onUpdate: (id, payload) => runMutation(updateTipoPago, refreshTipoPagos, 'No se pudo actualizar el tipo de pago.', id, { titulo: payload.name?.trim() }),
                        onDelete: (id) => runMutation(deleteTipoPago, refreshTipoPagos, 'No se pudo eliminar el tipo de pago.', id),
                    }),
                ],
            },
        ];
    }, [
        caseTypes,
        caseTypesInitialized,
        caseTypesSyncing,
        eventTypes,
        eventTypesInitialized,
        eventTypesSyncing,
        gastosCatalogo,
        gastosCatalogoInitialized,
        gastosCatalogoSyncing,
        isAdmin,
        radicaciones,
        radicacionesInitialized,
        radicacionesSyncing,
        refreshCaseTypes,
        refreshEventTypes,
        refreshGastosCatalogo,
        refreshRadicaciones,
        refreshRoles,
        refreshTipoExpedientes,
        refreshTipoPagos,
        loadLocalRoles,
        roles,
        rolesInitialized,
        rolesSyncing,
        tipoExpedientes,
        tipoExpedientesInitialized,
        tipoExpedientesSyncing,
        tipoPagos,
        tipoPagosInitialized,
        tipoPagosSyncing,
    ]);

    return {
        isAdmin,
        groups,
    };
}
