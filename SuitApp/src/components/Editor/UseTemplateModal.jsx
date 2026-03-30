import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileText, Loader2, Wand2, Settings as SettingsIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import {
    getTemplateRequirements,
    replaceCachedTemplateRequirements,
} from '../../services/sync/templateRequirementsSyncService.js';
import { fillTemplate, getEmptyTemplate } from '../../services/templateFillerService.js';
import { getTemplate } from '../../services/templateService.js';
import { getClosedCases, getCaseClients } from '../../services/caseService.js';
import { buildCaseCacheRow } from '../../services/cache/caseCacheRow.js';
import { ClientSearch } from '../requirements/ClientSearch.jsx';
import { UserSearch } from '../requirements/UserSearch.jsx';
import { CaseSearch } from '../requirements/CaseSearch.jsx';
import { CaseExpedientTypeSearch } from '../requirements/CaseExpedientTypeSearch.jsx';
import { CaseSubEntitiesSearch } from '../requirements/CaseSubEntitiesSearch.jsx';
import { PartesSearch } from '../requirements/PartesSearch.jsx';
import { GeneralInput } from '../requirements/GeneralInput.jsx';
import { FinancialInput } from '../requirements/FinancialInput.jsx';
import { LocationInput } from '../requirements/LocationInput.jsx';
import { CustomInput } from '../requirements/CustomInput.jsx';
import { DatePartsInput } from '../requirements/DatePartsInput.jsx';
import { EventSearch } from '../requirements/EventSearch.jsx';
import { EntityPaginator } from '../requirements/EntityPaginator.jsx';
import { buildEnhancedPreviewHtml } from '../templates/templateEditorUtils.js';
import {
    getTemplateRequirementsDiagnostics,
    pickBestTemplateRequirements,
} from '../../utils/templateRequirements.js';
import { getRequisitoLabel } from '../../constants/requisitoLabels.js';
import { createLogger } from '../../services/logService.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import TemplateCapitalizationPanel from '../settings/TemplateCapitalizationPanel.jsx';
import { getBaseNameWithoutExtension } from '../../utils/fileNameUtils.js';
import { parseJsonRows } from '../../utils/dbUtils.js';
import { useCases } from '../../context/CasesContext.jsx';
import { getRequirementNotesForEntity } from './useTemplateModalUtils.js';
import { useCaseTypes } from '../../context/CaseTypesContext.jsx';
import { useRadicaciones } from '../../context/RadicacionesContext.jsx';
import { useJurisdicciones } from '../../context/JurisdiccionesContext.jsx';
import { useCompetencias } from '../../context/CompetenciasContext.jsx';
import { useDependenciasJudiciales } from '../../context/DependenciasJudicialesContext.jsx';
import { useTipoExpedientes } from '../../context/TipoExpedientesContext.jsx';

const logger = createLogger('component:use-template-modal');

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Tipos que corresponden a la entidad "caso principal" (no sub-entidades). */
const CASE_ENTITY_TYPES = ['caseTitle', 'caseNumber', 'caseStartDate', 'caseEndDate'];

/** Tipos derivados de fecha: el filler extrae la parte correspondiente de una fecha. */
const DATE_PART_TYPES = new Set([
    'anioNombrado', 'mesNombrado', 'diaNombrado',
    'anioNumero', 'mesNumero', 'diaNumero',
    'fechaConMesNombrado',
]);

function isEventRequirementType(type) {
    return typeof type === 'string' && type.startsWith('event');
}

const CASE_SUB_ENTITY_FIELDS = ['caseType', 'radicacion', 'jurisdiccion', 'competencia', 'dependencia'];
const CASE_ASSOCIATED_FIELDS = [...CASE_SUB_ENTITY_FIELDS, 'caseExpedientType'];

const CASE_SUB_ENTITY_LABELS = {
    caseType: 'fuero',
    caseExpedientType: 'tipo de expediente',
    radicacion: 'radicación',
    jurisdiccion: 'jurisdicción',
    competencia: 'competencia',
    dependencia: 'juzgado',
};

// ─── Helpers de análisis ──────────────────────────────────────────────────────

/**
 * Extrae los NEntidad únicos y ordenados para los requisitos que coinciden con el filtro.
 * Ej: [1, 2, 3] si hay tres instancias de esa familia de entidad.
 */
function extractNEntidades(requirements, filterFn) {
    const set = new Set(
        requirements.filter(r => filterFn(r.type)).map(r => r.NEntidad ?? 1)
    );
    return [...set].sort((a, b) => a - b);
}

function isCaseClosed(caseItem) {
    if (!caseItem || typeof caseItem !== 'object') return false;
    if (caseItem.end_date || caseItem.endDate) return true;
    const rawStatus = String(caseItem.status ?? '').trim().toLowerCase();
    return rawStatus === 'closed' || rawStatus === 'finalizado';
}

function mergeCases(...sources) {
    const merged = new Map();

    for (const source of sources) {
        for (const caseItem of source || []) {
            if (!caseItem?.id) continue;
            merged.set(String(caseItem.id), caseItem);
        }
    }

    return [...merged.values()];
}

function sortCasesForTemplateSearch(left, right) {
    const lifecycleDiff = Number(isCaseClosed(left)) - Number(isCaseClosed(right));
    if (lifecycleDiff !== 0) return lifecycleDiff;

    return (left?.title || '').localeCompare(right?.title || '', 'es', {
        sensitivity: 'base',
        numeric: true,
    });
}

function extractEmbeddedClientIds(caseItem) {
    if (!caseItem || typeof caseItem !== 'object') return [];

    const candidates = [
        caseItem.clients,
        Array.isArray(caseItem.case?.clients) ? caseItem.case.clients : null,
    ];

    for (const collection of candidates) {
        if (!Array.isArray(collection)) continue;
        return collection
            .map((client) => String(client?.id ?? client?.client_id ?? ''))
            .filter(Boolean);
    }

    return [];
}

function buildCaseClientMap(cases, caseClientRows) {
    const map = new Map();

    // La pivot local es la fuente principal porque no depende de que el caso
    // actual esté montado en UI. Los clientes embebidos actúan como respaldo.
    for (const row of caseClientRows || []) {
        const caseId = String(row?.suit_case_id ?? '');
        const clientId = String(row?.client_id ?? '');
        if (!caseId || !clientId) continue;

        const currentClientIds = map.get(caseId) || new Set();
        currentClientIds.add(clientId);
        map.set(caseId, currentClientIds);
    }

    for (const caseItem of cases || []) {
        const caseId = String(caseItem?.id ?? '');
        if (!caseId) continue;

        const currentClientIds = map.get(caseId) || new Set();
        const embeddedClientIds = extractEmbeddedClientIds(caseItem);
        embeddedClientIds.forEach((clientId) => currentClientIds.add(clientId));

        if (currentClientIds.size > 0) {
            map.set(caseId, currentClientIds);
        }
    }

    return map;
}

function getTipoExpedienteOptionLabel(tipoExpediente) {
    return tipoExpediente?.title || tipoExpediente?.titulo || tipoExpediente?.name || '';
}

function extractCaseTipoExpedientes(caseItem, tipoExpedientesById) {
    if (!caseItem || typeof caseItem !== 'object') return [];

    const rawCollections = [
        caseItem.tipo_expedientes,
        caseItem.tipoExpedientes,
        caseItem.linkedTipoExpedientes,
        caseItem.tipo_expediente_ids,
        caseItem.tipoExpedienteIds,
    ].filter(Array.isArray);

    return dedupeOptions(
        rawCollections.flatMap((collection) => collection.map((item) => {
            if (typeof item === 'number' || typeof item === 'string') {
                const catalogItem = findById(tipoExpedientesById, item);
                return buildSelectOption(item, getTipoExpedienteOptionLabel(catalogItem), catalogItem);
            }

            if (!item || typeof item !== 'object') return null;

            const catalogItem = item.id != null
                ? findById(tipoExpedientesById, item.id) || item
                : item;

            return buildSelectOption(
                catalogItem?.id ?? item.id,
                getTipoExpedienteOptionLabel(catalogItem),
                catalogItem,
            );
        }))
    );
}

function buildCaseTipoExpedienteMap(cases, caseTipoExpedienteRows, tipoExpedientesById) {
    const map = new Map();

    for (const row of caseTipoExpedienteRows || []) {
        const caseId = String(row?.suit_case_id ?? '');
        const tipoId = row?.tipo_expediente_id;
        if (!caseId || tipoId == null) continue;

        const catalogItem = findById(tipoExpedientesById, tipoId);
        const currentOptions = map.get(caseId) || [];
        currentOptions.push(buildSelectOption(tipoId, getTipoExpedienteOptionLabel(catalogItem), catalogItem));
        map.set(caseId, currentOptions);
    }

    for (const caseItem of cases || []) {
        const caseId = String(caseItem?.id ?? '');
        if (!caseId) continue;

        const currentOptions = map.get(caseId) || [];
        const embeddedOptions = extractCaseTipoExpedientes(caseItem, tipoExpedientesById);
        map.set(caseId, dedupeOptions([...currentOptions, ...embeddedOptions]));
    }

    return map;
}

function getCaseTypeOptionLabel(caseType) {
    return caseType?.name || caseType?.title || caseType?.nombre || '';
}

function getRadicacionOptionLabel(radicacion) {
    return radicacion?.tipo || radicacion?.name || radicacion?.nombre_lugar || '';
}

function getJurisdiccionOptionLabel(jurisdiccion) {
    return jurisdiccion?.nombre || jurisdiccion?.name || '';
}

function getCompetenciaOptionLabel(competencia) {
    return competencia?.fuero || competencia?.name || competencia?.nombre || '';
}

function getDependenciaOptionLabel(dependencia) {
    return dependencia?.nombre_juzgado || dependencia?.nombre || dependencia?.title || '';
}

function buildSelectOption(value, label, object = null) {
    if (value == null || !label) return null;

    return {
        value: String(value),
        label,
        object,
    };
}

function dedupeOptions(options) {
    const seen = new Set();

    return (options || []).reduce((items, option) => {
        const value = String(option?.value ?? '');
        const label = option?.label || '';

        if (!value || !label || seen.has(value)) {
            return items;
        }

        seen.add(value);
        items.push({ ...option, value });
        return items;
    }, []);
}

function findById(map, id) {
    if (id == null) return null;
    return map.get(String(id)) ?? null;
}

function resolveCaseLinkedSubEntities(caseItem, {
    caseTypesById,
    radicacionesById,
    jurisdiccionesById,
    competenciasById,
    dependenciasById,
}) {
    if (!caseItem || typeof caseItem !== 'object') {
        return {};
    }

    const embeddedCaseType = caseItem.case_type && typeof caseItem.case_type === 'object'
        ? caseItem.case_type
        : null;
    const caseTypeItem = embeddedCaseType?.id != null
        ? findById(caseTypesById, embeddedCaseType.id) || embeddedCaseType
        : findById(caseTypesById, caseItem.case_type_id);

    const embeddedRadicacion = caseItem.radicacion && typeof caseItem.radicacion === 'object'
        ? caseItem.radicacion
        : null;
    const radicacionItem = embeddedRadicacion?.id != null
        ? findById(radicacionesById, embeddedRadicacion.id) || embeddedRadicacion
        : findById(radicacionesById, caseItem.radicacion_id);

    const embeddedDependencia = caseItem.dependencia && typeof caseItem.dependencia === 'object'
        ? caseItem.dependencia
        : null;
    const dependenciaItem = embeddedDependencia?.id != null
        ? findById(dependenciasById, embeddedDependencia.id) || embeddedDependencia
        : findById(dependenciasById, caseItem.dependencia_id) || embeddedDependencia;

    const embeddedJurisdiccion = embeddedDependencia?.jurisdiccion && typeof embeddedDependencia.jurisdiccion === 'object'
        ? embeddedDependencia.jurisdiccion
        : (caseItem.jurisdiccion && typeof caseItem.jurisdiccion === 'object' ? caseItem.jurisdiccion : null);
    const embeddedCompetencia = embeddedDependencia?.competencia && typeof embeddedDependencia.competencia === 'object'
        ? embeddedDependencia.competencia
        : (caseItem.competencia && typeof caseItem.competencia === 'object' ? caseItem.competencia : null);

    const jurisdiccionId = embeddedJurisdiccion?.id
        ?? dependenciaItem?.jurisdiccion_id
        ?? caseItem.jurisdiccion_id
        ?? caseItem.dependencia?.jurisdiccion_id
        ?? null;
    const competenciaId = embeddedCompetencia?.id
        ?? dependenciaItem?.competencia_id
        ?? caseItem.competencia_id
        ?? caseItem.dependencia?.competencia_id
        ?? null;

    const jurisdiccionItem = embeddedJurisdiccion?.id != null
        ? findById(jurisdiccionesById, embeddedJurisdiccion.id) || embeddedJurisdiccion
        : findById(jurisdiccionesById, jurisdiccionId);
    const competenciaItem = embeddedCompetencia?.id != null
        ? findById(competenciasById, embeddedCompetencia.id) || embeddedCompetencia
        : findById(competenciasById, competenciaId);

    return {
        caseType: buildSelectOption(caseTypeItem?.id, getCaseTypeOptionLabel(caseTypeItem), caseTypeItem),
        radicacion: buildSelectOption(radicacionItem?.id, getRadicacionOptionLabel(radicacionItem), radicacionItem),
        jurisdiccion: buildSelectOption(jurisdiccionItem?.id, getJurisdiccionOptionLabel(jurisdiccionItem), jurisdiccionItem),
        competencia: buildSelectOption(competenciaItem?.id, getCompetenciaOptionLabel(competenciaItem), competenciaItem),
        dependencia: buildSelectOption(dependenciaItem?.id, getDependenciaOptionLabel(dependenciaItem), dependenciaItem),
    };
}

/**
 * Analiza los requisitos de la plantilla y determina qué secciones mostrar
 * y cuántas instancias (NEntidades) tiene cada familia de entidad.
 */
function analyzeRequirements(requirements) {
    const caseSubEntities = {
        caseType: false, radicacion: false, jurisdiccion: false,
        competencia: false, dependencia: false,
    };
    let caseExpedientType = false;
    const general  = { text: false, number: false, date: false, dateTime: false };
    const financial = { amount: false, paymentType: false };
    const location  = { city: false, province: false, address: false };
    const customFields = [];

    for (const { type, id_campo, title } of requirements) {
        if (type === 'caseType')       caseSubEntities.caseType = true;
        else if (type === 'caseExpedientType') caseExpedientType = true;
        else if (type === 'radicacion')    caseSubEntities.radicacion = true;
        else if (type === 'jurisdiccion')  caseSubEntities.jurisdiccion = true;
        else if (type === 'competencia')   caseSubEntities.competencia = true;
        else if (type === 'dependencia')   caseSubEntities.dependencia = true;
        else if (type === 'text')          general.text = true;
        else if (type === 'number')        general.number = true;
        else if (type === 'date')          general.date = true;
        else if (type === 'dateTime')      general.dateTime = true;
        // 'amount' y 'montoNombrado' comparten el mismo input numérico
        else if (type === 'amount' || type === 'montoNombrado') financial.amount = true;
        else if (type === 'paymentType')   financial.paymentType = true;
        else if (type === 'city')          location.city = true;
        else if (type === 'province')      location.province = true;
        else if (type === 'address')       location.address = true;
        else if (type === 'custom')        customFields.push({ id_campo, title });
    }

    return {
        // Familias de entidades con NEntidad: array de instancias únicas ordenadas
        clientNEntidades:   extractNEntidades(requirements, t => t.startsWith('client')),
        userNEntidades:     extractNEntidades(requirements, t => t.startsWith('user')),
        caseNEntidades:     extractNEntidades(requirements, t => CASE_ENTITY_TYPES.includes(t)),
        parteNEntidades:    extractNEntidades(requirements, t => t.startsWith('parte')),
        eventNEntidades:    extractNEntidades(requirements, isEventRequirementType),
        datePartNEntidades: extractNEntidades(requirements, t => DATE_PART_TYPES.has(t)),
        // Secciones sin NEntidad (valor único global)
        caseSubEntities,
        caseExpedientType,
        general,
        financial,
        location,
        customFields,
    };
}

// ─── Helpers de extracción para vista previa ──────────────────────────────────
// Calculan el valor a mostrar en el preview para cada tipo de campo
// a partir del objeto de entidad seleccionado.

function extractClientPreview(type, c) {
    switch (type) {
        case 'clientCompleteName': {
            const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
            const g = c.gender ?? c.genero ?? '';
            const prefix = g === 'F' ? 'Sra. ' : g === 'M' ? 'Sr. ' : '';
            return prefix + name;
        }
        case 'clientFirstName':      return c.first_name || '';
        case 'clientLastName': {
            const lastName = c.last_name || '';
            const g = c.gender ?? c.genero ?? '';
            const prefix = g === 'F' ? 'Sra. ' : g === 'M' ? 'Sr. ' : '';
            return prefix + lastName;
        }
        case 'clientIdentification': return c.identification_number || '';
        case 'clientAddress':        return c.address || '';
        case 'clientEmail':          return c.email || '';
        case 'clientPhone':          return c.phone || '';
        case 'clientTreatment': {
            const g = c.gender ?? c.genero ?? '';
            return g === 'F' ? 'Sra.' : g === 'M' ? 'Sr.' : 'señor';
        }
        default: return '';
    }
}

function extractUserPreview(type, u) {
    switch (type) {
        case 'userCompleteName':
        case 'userName':         return u.name || '';
        case 'userLastName':     return u.last_name || '';
        case 'userEmail':        return u.email || '';
        case 'userRegistration': return u.tag || '';
        case 'userCuit':         return u.cuit || '';
        default: return '';
    }
}

function extractCasePreview(type, c) {
    switch (type) {
        case 'caseTitle':     return c.title || '';
        case 'caseNumber':    return c.nro_expediente || '';
        case 'caseStartDate': return c.start_date || '';
        case 'caseEndDate':   return c.end_date || '';
        default: return '';
    }
}

function extractPartePreview(type, p) {
    switch (type) {
        case 'parteCompleteName':   return [p.nombre, p.apellido].filter(Boolean).join(' ');
        case 'parteIdentification': return p.identification || '';
        case 'parteAddress':        return p.address || '';
        default: return '';
    }
}

function extractEventPreview(type, eventItem) {
    switch (type) {
        case 'eventType': return eventItem.type || eventItem.tipo || eventItem.event_type_name || '';
        case 'eventName': return eventItem.title || '';
        case 'eventDate': return fmtEventValue(eventItem.starts_at);
        default: return '';
    }
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

/** Formatea un Date a "dd/MM/yyyy" para enviar al filler y para el preview. */
function fmtDate(date) {
    if (!date) return '';
    try { return format(date, 'dd/MM/yyyy', { locale: es }); } catch { return ''; }
}

function fmtDateTime(date) {
    if (!date) return '';
    try { return format(date, 'dd/MM/yyyy HH:mm', { locale: es }); } catch { return ''; }
}

function fmtEventValue(startsAt) {
    if (!startsAt) return '';

    try {
        const normalized = String(startsAt).replace(' ', 'T');
        const date = new Date(normalized);
        if (Number.isNaN(date.getTime())) return String(startsAt);
        return normalized.includes('T')
            ? format(date, 'dd/MM/yyyy HH:mm', { locale: es })
            : format(date, 'dd/MM/yyyy', { locale: es });
    } catch {
        return String(startsAt);
    }
}

/**
 * Construye labels contextualizados para la preview del modal de uso.
 * Solo aplica a familias con NEntidad para evitar placeholders ambiguos
 * cuando varias entidades comparten el mismo requisito base.
 */
function buildPreviewLabelOverrides(requirements) {
    return Object.fromEntries(
        requirements.flatMap((requirement) => {
            const { id_campo, type, NEntidad } = requirement;
            const entityNumber = NEntidad ?? 1;
            const baseLabel = getRequisitoLabel(type);

            if (type.startsWith('client')) {
                return [[String(id_campo), `Cliente ${baseLabel} ${entityNumber}`]];
            }
            if (type.startsWith('user')) {
                return [[String(id_campo), `Usuario ${baseLabel} ${entityNumber}`]];
            }
            if (CASE_ENTITY_TYPES.includes(type)) {
                return [[String(id_campo), `Caso ${baseLabel} ${entityNumber}`]];
            }
            if (type.startsWith('parte')) {
                return [[String(id_campo), `Parte ${baseLabel} ${entityNumber}`]];
            }
            if (isEventRequirementType(type)) {
                return [[String(id_campo), `Evento ${baseLabel} ${entityNumber}`]];
            }
            if (DATE_PART_TYPES.has(type)) {
                return [[String(id_campo), `Fecha ${baseLabel} ${entityNumber}`]];
            }

            return [];
        })
    );
}

// ─── buildFieldIds ────────────────────────────────────────────────────────────

/**
 * Construye el mapa fieldIds requerido por fillTemplate.
 * Para entidades con NEntidad: busca la entidad en el mapa por NEntidad del requisito.
 * Para campos manuales/derivados: usa el valor global correspondiente.
 */
function buildFieldIds(requirements, {
    clientsByN, usersByN, casesByN, partesByN, eventsByN, datePartsByN,
    subEntityValues, generalValues, financialValues, locationValues, customValues,
}) {
    const fieldIds = {};

    for (const { id_campo, type, NEntidad: nEnt } of requirements) {
        const n = nEnt ?? 1;

        if (type.startsWith('client')) {
            const e = clientsByN[n];
            if (e) fieldIds[id_campo] = e.id;
        } else if (type.startsWith('user')) {
            const e = usersByN[n];
            if (e) fieldIds[id_campo] = e.id;
        } else if (CASE_ENTITY_TYPES.includes(type)) {
            const e = casesByN[n];
            if (e) fieldIds[id_campo] = e.id;
        } else if (type === 'caseType') {
            if (subEntityValues.caseType != null) fieldIds[id_campo] = subEntityValues.caseType;
        } else if (type === 'caseExpedientType') {
            if (subEntityValues.caseExpedientType != null) fieldIds[id_campo] = subEntityValues.caseExpedientType;
        } else if (type === 'radicacion') {
            if (subEntityValues.radicacion != null) fieldIds[id_campo] = subEntityValues.radicacion;
        } else if (type === 'jurisdiccion') {
            if (subEntityValues.jurisdiccion != null) fieldIds[id_campo] = subEntityValues.jurisdiccion;
        } else if (type === 'competencia') {
            if (subEntityValues.competencia != null) fieldIds[id_campo] = subEntityValues.competencia;
        } else if (type === 'dependencia') {
            if (subEntityValues.dependencia != null) fieldIds[id_campo] = subEntityValues.dependencia;
        } else if (type.startsWith('parte')) {
            const e = partesByN[n];
            if (e) fieldIds[id_campo] = e.id;
        } else if (isEventRequirementType(type)) {
            const eventItem = eventsByN[n]?.event;
            if (eventItem?.id != null) fieldIds[id_campo] = eventItem.id;
        } else if (DATE_PART_TYPES.has(type)) {
            // El filler toma una fecha formateada y extrae la parte correspondiente (año/mes/día)
            const d = datePartsByN[n];
            if (d) fieldIds[id_campo] = fmtDate(d);
        } else if (type === 'text') {
            if (generalValues.text) fieldIds[id_campo] = generalValues.text;
        } else if (type === 'number') {
            if (generalValues.number) fieldIds[id_campo] = generalValues.number;
        } else if (type === 'date') {
            const v = fmtDate(generalValues.date);
            if (v) fieldIds[id_campo] = v;
        } else if (type === 'dateTime') {
            const v = fmtDateTime(generalValues.dateTime);
            if (v) fieldIds[id_campo] = v;
        } else if (type === 'amount' || type === 'montoNombrado') {
            // Mismo input: el filler aplica transformación distinta por tipo
            if (financialValues.amount) fieldIds[id_campo] = financialValues.amount;
        } else if (type === 'paymentType') {
            if (financialValues.paymentType != null) fieldIds[id_campo] = financialValues.paymentType;
        } else if (type === 'city') {
            if (locationValues.city) fieldIds[id_campo] = locationValues.city;
        } else if (type === 'province') {
            if (locationValues.province) fieldIds[id_campo] = locationValues.province;
        } else if (type === 'address') {
            if (locationValues.address) fieldIds[id_campo] = locationValues.address;
        } else if (type === 'custom') {
            if (customValues[id_campo] != null) fieldIds[id_campo] = customValues[id_campo];
        }
    }

    return fieldIds;
}

// ─── Sub-componente de sección ────────────────────────────────────────────────

/** Agrupa visualmente un bloque de campos con espaciado uniforme. */
function RequirementSection({ children }) {
    return (
        <div className="space-y-3 py-5">
            {children}
        </div>
    );
}

function RequirementNotes({ notes }) {
    if (notes.length === 0) return null;

    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {notes.map((note) => (
                <p key={note}>
                    <span className="font-semibold">Nota:</span> {note}
                </p>
            ))}
        </div>
    );
}

function formatIndexedLabel(baseLabel, entries, currentEntry) {
    return entries.length > 1 ? `${baseLabel} ${currentEntry}` : baseLabel;
}

function capitalizeLabel(label) {
    if (!label) return '';
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function getMissingRequiredLabels({
    needs,
    hasAnyRequirements,
    clientsByN,
    usersByN,
    casesByN,
    partesByN,
    eventsByN,
    datePartsByN,
    subEntityValues,
    generalValues,
    financialValues,
    locationValues,
    customValues,
}) {
    if (!hasAnyRequirements) return [];

    const missing = [];
    const pushIfMissing = (condition, label) => {
        if (condition && label && !missing.includes(label)) {
            missing.push(label);
        }
    };

    for (const n of needs.clientNEntidades) {
        pushIfMissing(!clientsByN[n], formatIndexedLabel('Cliente', needs.clientNEntidades, n));
    }

    for (const n of needs.userNEntidades) {
        pushIfMissing(!usersByN[n], formatIndexedLabel('Usuario', needs.userNEntidades, n));
    }

    for (const n of needs.caseNEntidades) {
        pushIfMissing(!casesByN[n], formatIndexedLabel('Expediente', needs.caseNEntidades, n));
    }

    for (const n of needs.parteNEntidades) {
        pushIfMissing(!partesByN[n], formatIndexedLabel('Parte', needs.parteNEntidades, n));
    }

    for (const n of needs.eventNEntidades) {
        pushIfMissing(!eventsByN[n]?.event, formatIndexedLabel('Evento', needs.eventNEntidades, n));
    }

    for (const n of needs.datePartNEntidades) {
        pushIfMissing(!datePartsByN[n], formatIndexedLabel('Fecha', needs.datePartNEntidades, n));
    }

    pushIfMissing(needs.caseSubEntities.caseType && subEntityValues.caseType == null, capitalizeLabel(CASE_SUB_ENTITY_LABELS.caseType));
    pushIfMissing(needs.caseExpedientType && subEntityValues.caseExpedientType == null, capitalizeLabel(CASE_SUB_ENTITY_LABELS.caseExpedientType));
    pushIfMissing(needs.caseSubEntities.radicacion && subEntityValues.radicacion == null, capitalizeLabel(CASE_SUB_ENTITY_LABELS.radicacion));
    pushIfMissing(needs.caseSubEntities.jurisdiccion && subEntityValues.jurisdiccion == null, capitalizeLabel(CASE_SUB_ENTITY_LABELS.jurisdiccion));
    pushIfMissing(needs.caseSubEntities.competencia && subEntityValues.competencia == null, capitalizeLabel(CASE_SUB_ENTITY_LABELS.competencia));
    pushIfMissing(needs.caseSubEntities.dependencia && subEntityValues.dependencia == null, capitalizeLabel(CASE_SUB_ENTITY_LABELS.dependencia));

    pushIfMissing(needs.general.text && !generalValues.text.trim(), getRequisitoLabel('text'));
    pushIfMissing(needs.general.number && !generalValues.number.trim(), getRequisitoLabel('number'));
    pushIfMissing(needs.general.date && !generalValues.date, getRequisitoLabel('date'));
    pushIfMissing(needs.general.dateTime && !generalValues.dateTime, getRequisitoLabel('dateTime'));
    pushIfMissing(needs.financial.amount && !financialValues.amount.trim(), getRequisitoLabel('amount'));
    pushIfMissing(needs.financial.paymentType && financialValues.paymentType == null, getRequisitoLabel('paymentType'));
    pushIfMissing(needs.location.city && !locationValues.city.trim(), getRequisitoLabel('city'));
    pushIfMissing(needs.location.province && !locationValues.province.trim(), getRequisitoLabel('province'));
    pushIfMissing(needs.location.address && !locationValues.address.trim(), getRequisitoLabel('address'));

    for (const { id_campo, title } of needs.customFields) {
        pushIfMissing(!customValues[id_campo]?.trim(), title || `Campo ${id_campo}`);
    }

    return missing;
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * Modal inteligente para aplicar una plantilla.
 *
 * Flujo:
 * 1. Al abrirse carga en paralelo los requisitos y el body de la plantilla.
 * 2. Analiza qué categorías tienen requisitos y muestra solo esas secciones.
 * 3. Para entidades con múltiples NEntidades, muestra un EntityPaginator (← N →).
 *    Cada página corresponde a una instancia distinta; el estado se guarda por NEntidad.
 * 4. "Aplicar plantilla": construye fieldIds y llama a fillTemplate.
 * 5. "Cargar sin rellenar": llama a getEmptyTemplate (elimina los #n#) y navega.
 *
 * Props:
 *   open     — controla visibilidad
 *   onClose  — callback para cerrar
 *   template — objeto con al menos { id, title }
 */
export default function UseTemplateModal({
    open,
    onClose,
    template,
    defaultAgendaId = null,
    defaultCaseId = null,
}) {
    const navigate = useNavigate();
    const { templateCapitalization, templateClientTreatment } = useSettings();
    const { cases, initialized: casesInitialized } = useCases();
    const { data: caseTypes = [], initialized: caseTypesInitialized } = useCaseTypes();
    const { data: radicaciones = [], initialized: radicacionesInitialized } = useRadicaciones();
    const { data: jurisdicciones = [], initialized: jurisdiccionesInitialized } = useJurisdicciones();
    const { data: competencias = [], initialized: competenciasInitialized } = useCompetencias();
    const { data: dependenciasJudiciales = [], initialized: dependenciasInitialized } = useDependenciasJudiciales();
    const { tipo_expedientes: tipoExpedientes = [], initialized: tipoExpedientesInitialized } = useTipoExpedientes();

    // Estado para el modal de configuraciones de capitalización
    const [capSettingsOpen, setCapSettingsOpen] = useState(false);

    // ── Datos cargados al abrir ────────────────────────────────────────────────
    const [requirements, setRequirements] = useState([]);
    const [templateBody, setTemplateBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [filling, setFilling] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [cachedCases, setCachedCases] = useState([]);
    const [caseClientRows, setCaseClientRows] = useState([]);
    const [caseTipoExpedienteRows, setCaseTipoExpedienteRows] = useState([]);
    const [closedCasesState, setClosedCasesState] = useState({
        items: [],
        loaded: false,
        loading: false,
    });
    const [filterCasesByClient, setFilterCasesByClient] = useState(true);
    const [filterCaseRelatedOptions, setFilterCaseRelatedOptions] = useState(true);
    const [showOnlyActiveCases, setShowOnlyActiveCases] = useState(true);
    const [smartOptionsOpen, setSmartOptionsOpen] = useState(false);
    const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);

    // ── Entidades por NEntidad: cada clave es un NEntidad, el valor es el objeto seleccionado ──
    const [clientsByN, setClientsByN]       = useState({});
    const [usersByN, setUsersByN]           = useState({});
    const [casesByN, setCasesByN]           = useState({});
    const [partesByN, setPartesByN]         = useState({});
    const [eventsByN, setEventsByN]         = useState({});
    // Fechas de partes derivadas (anioNombrado, etc.) por NEntidad → Date
    const [datePartsByN, setDatePartsByN]   = useState({});

    // ── Página activa por familia (= NEntidad visible en este momento) ─────────
    const [clientPage, setClientPage]       = useState(1);
    const [userPage, setUserPage]           = useState(1);
    const [casePage, setCasePage]           = useState(1);
    const [partePage, setPartePage]         = useState(1);
    const [eventPage, setEventPage]         = useState(1);
    const [datePartsPage, setDatePartsPage] = useState(1);

    // ── Sub-entidades del caso: valor único global (sin NEntidad por ahora) ────
    const [subEntityValues, setSubEntityValues] = useState({
        caseType: null, caseExpedientType: null, radicacion: null, jurisdiccion: null,
        competencia: null, dependencia: null,
    });
    const [subEntityLabels, setSubEntityLabels] = useState({});

    // ── Campos manuales globales ───────────────────────────────────────────────
    const [generalValues, setGeneralValues]     = useState({ text: '', number: '', date: null, dateTime: null });
    const [financialValues, setFinancialValues] = useState({ amount: '', paymentType: null });
    const [financialLabels, setFinancialLabels] = useState({});
    const [locationValues, setLocationValues]   = useState({ city: '', province: '', address: '' });
    const [customValues, setCustomValues]       = useState({});

    // ── Foco activo para resaltar burbujas en la preview ──────────────────────
    // { family: string, nEntidad: number } | null
    const [activeInfo, setActiveInfo] = useState(null);

    // ── Análisis de requisitos ─────────────────────────────────────────────────
    const needs = useMemo(() => analyzeRequirements(requirements), [requirements]);
    const hasCaseSubEntities = useMemo(
        () => Object.values(needs.caseSubEntities).some(Boolean),
        [needs.caseSubEntities]
    );
    const hasCaseExpedientTypeField = needs.caseExpedientType;
    const hasGeneralFields   = useMemo(() => Object.values(needs.general).some(Boolean),  [needs.general]);
    const hasFinancialFields = useMemo(() => needs.financial.amount || needs.financial.paymentType, [needs.financial]);
    const hasLocationFields  = useMemo(() => Object.values(needs.location).some(Boolean), [needs.location]);
    const hasAnyRequirements = requirements.length > 0;
    const hasClientCaseFiltering = needs.clientNEntidades.length > 0 && needs.caseNEntidades.length > 0;
    const hasCaseDrivenEntityFiltering = needs.caseNEntidades.length > 0 && (hasCaseSubEntities || hasCaseExpedientTypeField);
    const hasCaseVisibilityToggle = needs.caseNEntidades.length > 0;
    const hasSmartOptions = hasClientCaseFiltering || hasCaseDrivenEntityFiltering || hasCaseVisibilityToggle;
    const selectedTemplateClientIds = useMemo(() => {
        const ids = needs.clientNEntidades
            .map((nEntidad) => clientsByN[nEntidad]?.id)
            .filter((clientId) => clientId != null)
            .map((clientId) => String(clientId));

        return [...new Set(ids)];
    }, [clientsByN, needs.clientNEntidades]);
    const includeClosedCases = !showOnlyActiveCases;
    const visibleTemplateCases = useMemo(() => {
        const mergedCases = mergeCases(
            cachedCases,
            casesInitialized ? cases : [],
            includeClosedCases ? closedCasesState.items : [],
        );

        return mergedCases
            .filter((caseItem) => includeClosedCases || !isCaseClosed(caseItem))
            .sort(sortCasesForTemplateSearch);
    }, [cachedCases, cases, casesInitialized, closedCasesState.items, includeClosedCases]);
    const caseClientMap = useMemo(
        () => buildCaseClientMap(visibleTemplateCases, caseClientRows),
        [visibleTemplateCases, caseClientRows]
    );
    const sharedCaseOptions = useMemo(() => {
        if (selectedTemplateClientIds.length === 0) {
            return visibleTemplateCases;
        }

        return visibleTemplateCases.filter((caseItem) => {
            const linkedClientIds = caseClientMap.get(String(caseItem.id));
            if (!linkedClientIds || linkedClientIds.size === 0) return false;

            return selectedTemplateClientIds.every((clientId) => linkedClientIds.has(clientId));
        });
    }, [visibleTemplateCases, caseClientMap, selectedTemplateClientIds]);
    const filteredCaseOptions = useMemo(
        () => (hasClientCaseFiltering && filterCasesByClient ? sharedCaseOptions : visibleTemplateCases),
        [filterCasesByClient, hasClientCaseFiltering, sharedCaseOptions, visibleTemplateCases]
    );
    const caseSearchEmptyMessage = useMemo(() => {
        if (!hasClientCaseFiltering || !filterCasesByClient) {
            return includeClosedCases
                ? 'No se encontraron expedientes, ni activos ni finalizados.'
                : 'No se encontraron expedientes activos.';
        }
        if (selectedTemplateClientIds.length === 0) {
            return includeClosedCases
                ? 'No se encontraron expedientes, ni activos ni finalizados.'
                : 'No se encontraron expedientes activos.';
        }

        return selectedTemplateClientIds.length === 1
            ? 'No se encontraron expedientes para el cliente seleccionado.'
            : 'No se encontraron expedientes compartidos por los clientes seleccionados.';
    }, [filterCasesByClient, hasClientCaseFiltering, includeClosedCases, selectedTemplateClientIds]);
    const shouldSuggestAllCases = hasClientCaseFiltering && filterCasesByClient && selectedTemplateClientIds.length > 0 && sharedCaseOptions.length === 0;
    const primarySelectedCase = useMemo(
        () => needs.caseNEntidades.map((nEntidad) => casesByN[nEntidad]).find(Boolean) || null,
        [casesByN, needs.caseNEntidades]
    );
    const caseTypesById = useMemo(
        () => new Map((caseTypesInitialized ? caseTypes : []).map((item) => [String(item.id), item])),
        [caseTypes, caseTypesInitialized]
    );
    const radicacionesById = useMemo(
        () => new Map((radicacionesInitialized ? radicaciones : []).map((item) => [String(item.id), item])),
        [radicaciones, radicacionesInitialized]
    );
    const jurisdiccionesById = useMemo(
        () => new Map((jurisdiccionesInitialized ? jurisdicciones : []).map((item) => [String(item.id), item])),
        [jurisdicciones, jurisdiccionesInitialized]
    );
    const competenciasById = useMemo(
        () => new Map((competenciasInitialized ? competencias : []).map((item) => [String(item.id), item])),
        [competencias, competenciasInitialized]
    );
    const dependenciasById = useMemo(
        () => new Map((dependenciasInitialized ? dependenciasJudiciales : []).map((item) => [String(item.id), item])),
        [dependenciasInitialized, dependenciasJudiciales]
    );
    const tipoExpedientesById = useMemo(
        () => new Map((tipoExpedientesInitialized ? tipoExpedientes : []).map((item) => [String(item.id), item])),
        [tipoExpedientes, tipoExpedientesInitialized]
    );
    const allCaseSubEntityOptions = useMemo(() => ({
        caseType: dedupeOptions((caseTypesInitialized ? caseTypes : []).map((item) => buildSelectOption(item.id, getCaseTypeOptionLabel(item), item))),
        radicacion: dedupeOptions((radicacionesInitialized ? radicaciones : []).map((item) => buildSelectOption(item.id, getRadicacionOptionLabel(item), item))),
        jurisdiccion: dedupeOptions((jurisdiccionesInitialized ? jurisdicciones : []).map((item) => buildSelectOption(item.id, getJurisdiccionOptionLabel(item), item))),
        competencia: dedupeOptions((competenciasInitialized ? competencias : []).map((item) => buildSelectOption(item.id, getCompetenciaOptionLabel(item), item))),
        dependencia: dedupeOptions((dependenciasInitialized ? dependenciasJudiciales : []).map((item) => buildSelectOption(item.id, getDependenciaOptionLabel(item), item))),
        caseExpedientType: dedupeOptions((tipoExpedientesInitialized ? tipoExpedientes : []).map((item) => buildSelectOption(item.id, getTipoExpedienteOptionLabel(item), item))),
    }), [
        caseTypes,
        caseTypesInitialized,
        competencias,
        competenciasInitialized,
        dependenciasInitialized,
        dependenciasJudiciales,
        jurisdicciones,
        jurisdiccionesInitialized,
        radicaciones,
        radicacionesInitialized,
        tipoExpedientes,
        tipoExpedientesInitialized,
    ]);
    const caseLinkedSubEntities = useMemo(
        () => resolveCaseLinkedSubEntities(primarySelectedCase, {
            caseTypesById,
            radicacionesById,
            jurisdiccionesById,
            competenciasById,
            dependenciasById,
        }),
        [caseTypesById, competenciasById, dependenciasById, jurisdiccionesById, primarySelectedCase, radicacionesById]
    );
    const selectedCaseIdsForAssociatedFields = useMemo(
        () => [...new Set(
            needs.caseNEntidades
                .map((nEntidad) => casesByN[nEntidad]?.id)
                .filter((caseId) => caseId != null)
                .map((caseId) => String(caseId))
        )],
        [casesByN, needs.caseNEntidades]
    );
    const caseTipoExpedienteMap = useMemo(
        () => buildCaseTipoExpedienteMap(visibleTemplateCases, caseTipoExpedienteRows, tipoExpedientesById),
        [caseTipoExpedienteRows, tipoExpedientesById, visibleTemplateCases]
    );
    const caseLinkedTipoExpedienteOptions = useMemo(() => {
        if (selectedCaseIdsForAssociatedFields.length === 0) {
            return allCaseSubEntityOptions.caseExpedientType;
        }

        const commonOptions = selectedCaseIdsForAssociatedFields.reduce((currentOptions, caseId, index) => {
            const caseOptions = caseTipoExpedienteMap.get(caseId) || [];
            if (index === 0) return caseOptions;

            const allowedValues = new Set(caseOptions.map((option) => option.value));
            return currentOptions.filter((option) => allowedValues.has(option.value));
        }, []);

        return dedupeOptions(commonOptions);
    }, [
        allCaseSubEntityOptions.caseExpedientType,
        caseTipoExpedienteMap,
        selectedCaseIdsForAssociatedFields,
    ]);
    const filteredCaseSubEntityOptions = useMemo(() => {
        if (!hasCaseDrivenEntityFiltering || !filterCaseRelatedOptions || !primarySelectedCase) {
            return allCaseSubEntityOptions;
        }

        return CASE_SUB_ENTITY_FIELDS.reduce((optionsByField, field) => {
            optionsByField[field] = caseLinkedSubEntities[field] ? [caseLinkedSubEntities[field]] : [];
            return optionsByField;
        }, {
            caseExpedientType: needs.caseExpedientType
                ? caseLinkedTipoExpedienteOptions
                : allCaseSubEntityOptions.caseExpedientType,
        });
    }, [
        allCaseSubEntityOptions,
        caseLinkedSubEntities,
        caseLinkedTipoExpedienteOptions,
        filterCaseRelatedOptions,
        hasCaseDrivenEntityFiltering,
        needs.caseExpedientType,
        primarySelectedCase,
    ]);
    const caseSubEntityEmptyMessages = useMemo(() => {
        if (!hasCaseDrivenEntityFiltering || !filterCaseRelatedOptions || !primarySelectedCase) {
            return {};
        }

        return CASE_ASSOCIATED_FIELDS.reduce((messages, field) => {
            const isFieldRequired = field === 'caseExpedientType'
                ? needs.caseExpedientType
                : needs.caseSubEntities[field];

            if (!isFieldRequired || filteredCaseSubEntityOptions[field].length > 0) {
                return messages;
            }

            messages[field] = `El caso seleccionado no tiene ${CASE_SUB_ENTITY_LABELS[field]} asociad${field === 'caseType' ? 'o' : 'a'}. Desactivá "Filtrar elementos por caso" para ver todo el catálogo.`;
            return messages;
        }, {});
    }, [
        filterCaseRelatedOptions,
        filteredCaseSubEntityOptions,
        hasCaseDrivenEntityFiltering,
        needs.caseExpedientType,
        needs.caseSubEntities,
        primarySelectedCase,
    ]);

    // ── Mapa de valores por id_campo para la vista previa ─────────────────────
    // Keyed by String(id_campo) para que buildEnhancedPreviewHtml pueda
    // diferenciar campos del mismo tipo pero distinto NEntidad.
    const allValues = useMemo(() => {
        const vals = {};

        requirements.forEach(({ id_campo, type, NEntidad: nEnt }) => {
            const n = nEnt ?? 1;
            let val = null;

            if (type.startsWith('client')) {
                const c = clientsByN[n];
                if (c) val = extractClientPreview(type, c);
            } else if (type.startsWith('user')) {
                const u = usersByN[n];
                if (u) val = extractUserPreview(type, u);
            } else if (CASE_ENTITY_TYPES.includes(type)) {
                const c = casesByN[n];
                if (c) val = extractCasePreview(type, c);
            } else if (type.startsWith('parte')) {
                const p = partesByN[n];
                if (p) val = extractPartePreview(type, p);
            } else if (isEventRequirementType(type)) {
                const eventSelection = eventsByN[n]?.event;
                if (eventSelection) val = extractEventPreview(type, eventSelection);
            } else if (DATE_PART_TYPES.has(type)) {
                const d = datePartsByN[n];
                if (d) val = fmtDate(d); // mostramos la fecha; el filler deriva la parte
            } else if (type === 'text') {
                val = generalValues.text || null;
            } else if (type === 'number') {
                val = generalValues.number || null;
            } else if (type === 'date') {
                val = fmtDate(generalValues.date) || null;
            } else if (type === 'dateTime') {
                val = fmtDateTime(generalValues.dateTime) || null;
            } else if (type === 'amount' || type === 'montoNombrado') {
                val = financialValues.amount || null;
            } else if (type === 'paymentType') {
                val = financialLabels.paymentType || null;
            } else if (type === 'city') {
                val = locationValues.city || null;
            } else if (type === 'province') {
                val = locationValues.province || null;
            } else if (type === 'address') {
                val = locationValues.address || null;
            } else if (type === 'custom') {
                val = customValues[id_campo] || null;
            } else if (type === 'caseType') {
                val = subEntityLabels.caseType || null;
            } else if (type === 'caseExpedientType') {
                val = subEntityLabels.caseExpedientType || null;
            } else if (type === 'radicacion') {
                val = subEntityLabels.radicacion || null;
            } else if (type === 'jurisdiccion') {
                val = subEntityLabels.jurisdiccion || null;
            } else if (type === 'competencia') {
                val = subEntityLabels.competencia || null;
            } else if (type === 'dependencia') {
                val = subEntityLabels.dependencia || null;
            }

            if (val != null && val !== '') vals[String(id_campo)] = val;
        });

        return vals;
    }, [
        requirements, clientsByN, usersByN, casesByN, partesByN, eventsByN, datePartsByN,
        subEntityLabels, generalValues, financialValues, financialLabels,
        locationValues, customValues,
    ]);

    const previewHtml = useMemo(() =>
        buildEnhancedPreviewHtml(
            templateBody,
            requirements,
            allValues,
            activeInfo,
            buildPreviewLabelOverrides(requirements)
        ),
        [templateBody, requirements, allValues, activeInfo]
    );

    const clientNotes = useMemo(
        () => getRequirementNotesForEntity(requirements, 'client', clientPage),
        [requirements, clientPage]
    );
    const userNotes = useMemo(
        () => getRequirementNotesForEntity(requirements, 'user', userPage),
        [requirements, userPage]
    );
    const caseNotes = useMemo(
        () => getRequirementNotesForEntity(requirements, 'case', casePage),
        [requirements, casePage]
    );
    const parteNotes = useMemo(
        () => getRequirementNotesForEntity(requirements, 'parte', partePage),
        [requirements, partePage]
    );
    const eventNotes = useMemo(
        () => getRequirementNotesForEntity(requirements, 'event', eventPage),
        [requirements, eventPage]
    );
    const datePartNotes = useMemo(
        () => getRequirementNotesForEntity(requirements, 'dateParts', datePartsPage),
        [requirements, datePartsPage]
    );

    // ── Validación: todos los campos requeridos están completos ────────────────
    const isFormComplete = useMemo(() => {
        if (!hasAnyRequirements) return true;
        // Verificar que todas las instancias de cada familia tengan entidad seleccionada
        for (const n of needs.clientNEntidades)   { if (!clientsByN[n]) return false; }
        for (const n of needs.userNEntidades)     { if (!usersByN[n]) return false; }
        for (const n of needs.caseNEntidades)     { if (!casesByN[n]) return false; }
        for (const n of needs.parteNEntidades)    { if (!partesByN[n]) return false; }
        for (const n of needs.eventNEntidades)    { if (!eventsByN[n]?.event) return false; }
        for (const n of needs.datePartNEntidades) { if (!datePartsByN[n]) return false; }
        if (needs.caseSubEntities.caseType    && subEntityValues.caseType == null)    return false;
        if (needs.caseExpedientType          && subEntityValues.caseExpedientType == null) return false;
        if (needs.caseSubEntities.radicacion  && subEntityValues.radicacion == null)  return false;
        if (needs.caseSubEntities.jurisdiccion && subEntityValues.jurisdiccion == null) return false;
        if (needs.caseSubEntities.competencia && subEntityValues.competencia == null) return false;
        if (needs.caseSubEntities.dependencia && subEntityValues.dependencia == null) return false;
        if (needs.general.text     && !generalValues.text.trim())     return false;
        if (needs.general.number   && !generalValues.number.trim())   return false;
        if (needs.general.date     && !generalValues.date)            return false;
        if (needs.general.dateTime && !generalValues.dateTime)        return false;
        if (needs.financial.amount      && !financialValues.amount.trim())    return false;
        if (needs.financial.paymentType && financialValues.paymentType == null) return false;
        if (needs.location.city     && !locationValues.city.trim())     return false;
        if (needs.location.province && !locationValues.province.trim()) return false;
        if (needs.location.address  && !locationValues.address.trim())  return false;
        for (const { id_campo } of needs.customFields) {
            if (!customValues[id_campo]?.trim()) return false;
        }
        return true;
    }, [
        needs, hasAnyRequirements, clientsByN, usersByN, casesByN, partesByN, eventsByN, datePartsByN,
        subEntityValues, generalValues, financialValues, locationValues, customValues,
    ]);

    const missingRequiredLabels = useMemo(() => getMissingRequiredLabels({
        needs,
        hasAnyRequirements,
        clientsByN,
        usersByN,
        casesByN,
        partesByN,
        eventsByN,
        datePartsByN,
        subEntityValues,
        generalValues,
        financialValues,
        locationValues,
        customValues,
    }), [
        needs,
        hasAnyRequirements,
        clientsByN,
        usersByN,
        casesByN,
        partesByN,
        eventsByN,
        datePartsByN,
        subEntityValues,
        generalValues,
        financialValues,
        locationValues,
        customValues,
    ]);

    // ── Carga de datos al abrir ────────────────────────────────────────────────
    const loadIdRef = useRef(0);

    useEffect(() => {
        if (!open || !template?.id) return;

        const currentLoadId = ++loadIdRef.current;
        setLoading(true);

        const load = async () => {
            try {
                const [reqs, fullTemplate] = await Promise.all([
                    getTemplateRequirements(template.id),
                    getTemplate(template.id),
                ]);

                if (loadIdRef.current !== currentLoadId) return;

                const templateObj = fullTemplate?.data ?? fullTemplate;
                const templateContent = typeof templateObj?.content === 'string' ? templateObj.content : '';
                const resolvedRequirements = pickBestTemplateRequirements(
                    reqs,
                    templateObj?.requirements,
                );
                const cacheDiagnostics = getTemplateRequirementsDiagnostics(reqs, templateContent);
                const apiDiagnostics = getTemplateRequirementsDiagnostics(templateObj?.requirements, templateContent);
                const resolvedDiagnostics = getTemplateRequirementsDiagnostics(resolvedRequirements, templateContent);

                if (
                    cacheDiagnostics.problematicRequirements.length > 0
                    || apiDiagnostics.problematicRequirements.length > 0
                    || resolvedDiagnostics.problematicRequirements.length > 0
                    || resolvedDiagnostics.missingFieldIds.length > 0
                ) {
                    void logger.warn('se detectaron requisitos nulos o placeholders sin requisito al usar plantilla', {
                        templateId: template.id,
                        templateTitle: template?.title ?? null,
                        problematicCachedRequirements: cacheDiagnostics.problematicRequirements,
                        problematicApiRequirements: apiDiagnostics.problematicRequirements,
                        problematicResolvedRequirements: resolvedDiagnostics.problematicRequirements,
                        missingFieldIds: resolvedDiagnostics.missingFieldIds,
                        cachedRequirements: reqs,
                        apiRequirements: templateObj?.requirements ?? [],
                        resolvedRequirements,
                    });
                }

                setRequirements(resolvedRequirements);
                setTemplateBody(templateContent);

                // Si el detalle fresco trae más requisitos que el caché local,
                // reparamos la tabla local para evitar que el siguiente uso siga roto.
                if (resolvedRequirements.length > reqs.length) {
                    void replaceCachedTemplateRequirements(template.id, resolvedRequirements);
                }
            } catch (err) {
                if (loadIdRef.current !== currentLoadId) return;
                setModalError(err?.message || 'No se pudieron cargar los campos de la plantilla.');
            } finally {
                if (loadIdRef.current === currentLoadId) setLoading(false);
            }
        };

        void load();
    }, [open, template?.id, template?.title]);

    // Limpia todo el estado al cerrar para no contaminar la siguiente apertura
    useEffect(() => {
        if (open) return;
        setRequirements([]);
        setTemplateBody('');
        setLoading(false);
        setFilling(false);
        setModalError(null);
        setCachedCases([]);
        setCaseClientRows([]);
        setCaseTipoExpedienteRows([]);
        setClosedCasesState({ items: [], loaded: false, loading: false });
        setFilterCasesByClient(true);
        setFilterCaseRelatedOptions(true);
        setShowOnlyActiveCases(true);
        setSmartOptionsOpen(false);
        setShowIncompleteWarning(false);
        setClientsByN({});
        setUsersByN({});
        setCasesByN({});
        setPartesByN({});
        setEventsByN({});
        setDatePartsByN({});
        setClientPage(1);
        setUserPage(1);
        setCasePage(1);
        setPartePage(1);
        setEventPage(1);
        setDatePartsPage(1);
        setSubEntityValues({ caseType: null, caseExpedientType: null, radicacion: null, jurisdiccion: null, competencia: null, dependencia: null });
        setSubEntityLabels({});
        setGeneralValues({ text: '', number: '', date: null, dateTime: null });
        setFinancialValues({ amount: '', paymentType: null });
        setFinancialLabels({});
        setLocationValues({ city: '', province: '', address: '' });
        setCustomValues({});
        setActiveInfo(null);
    }, [open]);

    useEffect(() => {
        if (showIncompleteWarning && missingRequiredLabels.length === 0) {
            setShowIncompleteWarning(false);
        }
    }, [missingRequiredLabels.length, showIncompleteWarning]);

    useEffect(() => {
        if (!open || needs.caseNEntidades.length === 0 || !window.electronAPI?.db?.getAll) return;

        let cancelled = false;

        const loadLocalCaseContext = async () => {
            try {
                const [caseRows, pivotRows, caseTipoRows] = await Promise.all([
                    window.electronAPI.db.getAll('cases'),
                    window.electronAPI.db.getAll('case_client'),
                    window.electronAPI.db.getAll('case_tipo_expediente'),
                ]);

                if (cancelled) return;

                setCachedCases(parseJsonRows(caseRows || []));
                setCaseClientRows(pivotRows || []);
                setCaseTipoExpedienteRows(caseTipoRows || []);
            } catch (error) {
                if (cancelled) return;
                void logger.warn('no se pudo cargar el contexto local de casos para plantillas', {
                    error: error?.message || String(error),
                });
                setCachedCases([]);
                setCaseClientRows([]);
                setCaseTipoExpedienteRows([]);
            }
        };

        void loadLocalCaseContext();

        return () => {
            cancelled = true;
        };
    }, [open, needs.caseNEntidades.length]);

    // ── Hidratar case_client desde la API si la pivot local está vacía ──────
    const caseClientHydratedRef = useRef(false);
    const justCreatedCaseIdRef = useRef(null);
    useEffect(() => {
        if (!open) {
            caseClientHydratedRef.current = false;
            justCreatedCaseIdRef.current = null;
            return;
        }
        if (!hasClientCaseFiltering || caseClientHydratedRef.current) return;
        if (visibleTemplateCases.length === 0) return;

        // Si ya hay pivots para la mayoría de casos, no hace falta hidratar.
        const casesWithPivot = new Set(caseClientRows.map(r => String(r?.suit_case_id ?? '')));
        const casesWithoutPivot = visibleTemplateCases.filter(c => !casesWithPivot.has(String(c.id)));
        if (casesWithoutPivot.length === 0) return;

        caseClientHydratedRef.current = true;
        let cancelled = false;

        const hydrate = async () => {
            const BATCH = 10;
            const allNewPivotRows = [];

            for (let i = 0; i < casesWithoutPivot.length; i += BATCH) {
                if (cancelled) return;
                const batch = casesWithoutPivot.slice(i, i + BATCH);
                const results = await Promise.allSettled(
                    batch.map(c => getCaseClients(c.id)),
                );

                for (let j = 0; j < batch.length; j++) {
                    const result = results[j];
                    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
                    const caseId = Number(batch[j].id);
                    for (const client of result.value) {
                        if (client?.id != null) {
                            allNewPivotRows.push({ suit_case_id: caseId, client_id: Number(client.id) });
                        }
                    }
                }
            }

            if (cancelled || allNewPivotRows.length === 0) return;

            setCaseClientRows(prev => [...prev, ...allNewPivotRows]);

            if (window.electronAPI?.db?.upsertMany) {
                try {
                    await window.electronAPI.db.upsertMany('case_client', allNewPivotRows);
                } catch { /* best-effort persist */ }
            }
        };

        void hydrate();

        return () => { cancelled = true; };
    }, [open, hasClientCaseFiltering, visibleTemplateCases, caseClientRows]);

    useEffect(() => {
        if (!open || !includeClosedCases || needs.caseNEntidades.length === 0) return;
        if (closedCasesState.loaded || closedCasesState.loading) return;

        let cancelled = false;

        const loadClosedCases = async () => {
            setClosedCasesState((current) => ({ ...current, loading: true }));

            try {
                const result = await getClosedCases();
                if (cancelled) return;

                if (result.ok && Array.isArray(result.data)) {
                    setClosedCasesState({
                        items: result.data,
                        loaded: true,
                        loading: false,
                    });
                    return;
                }
            } catch (error) {
                if (!cancelled) {
                    void logger.warn('fallo la carga remota de casos finalizados para plantillas', {
                        error: error?.message || String(error),
                    });
                }
            }

            if (cancelled) return;

            let cachedClosedCases = [];
            if (window.electronAPI?.db?.getAll) {
                try {
                    const caseRows = await window.electronAPI.db.getAll('cases');
                    if (cancelled) return;
                    cachedClosedCases = parseJsonRows(caseRows || []).filter(isCaseClosed);
                } catch (error) {
                    if (!cancelled) {
                        void logger.warn('fallo el fallback local de casos finalizados para plantillas', {
                            error: error?.message || String(error),
                        });
                    }
                }
            }

            setClosedCasesState({
                items: cachedClosedCases,
                loaded: true,
                loading: false,
            });
        };

        void loadClosedCases();

        return () => {
            cancelled = true;
        };
    }, [open, includeClosedCases, needs.caseNEntidades.length, closedCasesState.loaded, closedCasesState.loading]);

    useEffect(() => {
        if (!open || needs.caseNEntidades.length === 0) return;

        const availableCaseIds = new Set(filteredCaseOptions.map((caseItem) => String(caseItem.id)));

        // Si el caso actual deja de ser compatible con los clientes elegidos,
        // adelantamos una selección por defecto para reducir pasos manuales.
        setCasesByN((current) => {
            let changed = false;
            const next = { ...current };

            for (const nEntidad of needs.caseNEntidades) {
                const selectedCaseId = current[nEntidad]?.id != null ? String(current[nEntidad].id) : null;

                // Nunca sobreescribir un caso recién creado — aún puede no estar en filteredCaseOptions
                // si los pivots se están actualizando de forma asíncrona.
                if (selectedCaseId && justCreatedCaseIdRef.current != null && String(selectedCaseId) === String(justCreatedCaseIdRef.current)) {
                    continue;
                }

                if (filteredCaseOptions.length === 0) {
                    if (next[nEntidad]) {
                        delete next[nEntidad];
                        changed = true;
                    }
                    continue;
                }

                if (selectedCaseId && availableCaseIds.has(selectedCaseId)) {
                    continue;
                }

                if (filterCasesByClient && selectedTemplateClientIds.length > 0) {
                    next[nEntidad] = filteredCaseOptions[0];
                    changed = true;
                } else if (next[nEntidad]) {
                    delete next[nEntidad];
                    changed = true;
                }
            }

            return changed ? next : current;
        });
    }, [filterCasesByClient, open, needs.caseNEntidades, filteredCaseOptions, selectedTemplateClientIds]);

    useEffect(() => {
        if (!open || (!hasCaseSubEntities && !hasCaseExpedientTypeField) || !primarySelectedCase) return;

        // Las sub-entidades siguen siendo globales en el motor. Tomamos el primer
        // expediente elegido como fuente canónica para autocompletar sus vínculos.
        setSubEntityValues((current) => {
            let changed = false;
            const next = { ...current };

            for (const field of CASE_ASSOCIATED_FIELDS) {
                const isFieldRequired = field === 'caseExpedientType'
                    ? needs.caseExpedientType
                    : needs.caseSubEntities[field];
                if (!isFieldRequired) continue;

                const caseLinkedOption = field === 'caseExpedientType'
                    ? caseLinkedTipoExpedienteOptions[0]
                    : caseLinkedSubEntities[field];
                const visibleOptions = filteredCaseSubEntityOptions[field] || [];
                const currentValue = current[field] != null ? String(current[field]) : null;
                const currentStillVisible = currentValue
                    ? visibleOptions.some((option) => option.value === currentValue)
                    : false;

                if (filterCaseRelatedOptions) {
                    if (visibleOptions.length === 0) {
                        if (next[field] != null) {
                            next[field] = null;
                            changed = true;
                        }
                        continue;
                    }

                    if (!currentStillVisible) {
                        next[field] = visibleOptions[0].value;
                        changed = true;
                    }
                    continue;
                }

                if (next[field] == null && caseLinkedOption) {
                    next[field] = caseLinkedOption.value;
                    changed = true;
                }
            }

            return changed ? next : current;
        });

        setSubEntityLabels((current) => {
            let changed = false;
            const next = { ...current };

            for (const field of CASE_ASSOCIATED_FIELDS) {
                const isFieldRequired = field === 'caseExpedientType'
                    ? needs.caseExpedientType
                    : needs.caseSubEntities[field];
                if (!isFieldRequired) continue;

                const caseLinkedOption = field === 'caseExpedientType'
                    ? caseLinkedTipoExpedienteOptions[0]
                    : caseLinkedSubEntities[field];
                const visibleOptions = filteredCaseSubEntityOptions[field] || [];
                const selectedValue = subEntityValues[field] != null ? String(subEntityValues[field]) : null;
                const selectedOption = visibleOptions.find((option) => option.value === selectedValue) || caseLinkedOption;

                if (filterCaseRelatedOptions && visibleOptions.length === 0) {
                    if (next[field]) {
                        delete next[field];
                        changed = true;
                    }
                    continue;
                }

                if (selectedOption?.label && next[field] !== selectedOption.label) {
                    next[field] = selectedOption.label;
                    changed = true;
                }
            }

            return changed ? next : current;
        });
    }, [
        caseLinkedSubEntities,
        caseLinkedTipoExpedienteOptions,
        filterCaseRelatedOptions,
        filteredCaseSubEntityOptions,
        hasCaseExpedientTypeField,
        hasCaseSubEntities,
        needs.caseExpedientType,
        needs.caseSubEntities,
        open,
        primarySelectedCase,
        subEntityValues,
    ]);

    // ── Callbacks ──────────────────────────────────────────────────────────────
    const handleSubEntityChange = useCallback((field, value, label) => {
        setSubEntityValues((current) => ({ ...current, [field]: value }));
        setSubEntityLabels((current) => {
            const next = { ...current };

            if (label) {
                next[field] = label;
            } else {
                delete next[field];
            }

            return next;
        });
    }, []);
    const handleGeneralChange  = useCallback((field, value) => setGeneralValues(p => ({ ...p, [field]: value })), []);
    const handleFinancialChange = useCallback((field, value, label) => {
        setFinancialValues(p => ({ ...p, [field]: value }));
        if (label) setFinancialLabels(p => ({ ...p, [field]: label }));
    }, []);
    const handleLocationChange = useCallback((field, value) => setLocationValues(p => ({ ...p, [field]: value })), []);
    const handleCustomChange   = useCallback((idCampo, value) => setCustomValues(p => ({ ...p, [idCampo]: value })), []);

    const handleCaseCreated = useCallback(async (caseObject) => {
        const caseId = String(caseObject.id);

        // Marcar como caso recién creado para protegerlo del override en el efecto
        justCreatedCaseIdRef.current = caseObject.id;

        // 1. Agregar el caso al estado local para que aparezca al instante
        setCachedCases(prev => {
            if (prev.some(c => String(c.id) === caseId)) return prev;
            return [...prev, caseObject];
        });

        // 2. Obtener los clientes vinculados desde la API (fuente autoritativa)
        //    La API ya procesó el POST /cases/{id}/clients antes de que onSuccess dispare.
        let freshClients = [];
        try {
            freshClients = await getCaseClients(caseObject.id);
            if (!Array.isArray(freshClients)) freshClients = [];
        } catch { freshClients = []; }

        const newPivotRows = freshClients
            .filter(c => c?.id != null)
            .map(c => ({ suit_case_id: Number(caseId), client_id: Number(c.id) }));

        const linkedTipos = caseObject.linkedTipoExpedientes
            || caseObject.tipo_expedientes
            || [];
        const newTipoPivotRows = linkedTipos
            .filter(t => t?.id != null)
            .map(t => ({ suit_case_id: Number(caseId), tipo_expediente_id: Number(t.id) }));

        // 3. Actualizar pivots en estado local inmediatamente
        setCaseClientRows(prev => [...prev, ...newPivotRows]);
        // Resetear hydrated ref para que el efecto pueda re-evaluar si hace falta
        caseClientHydratedRef.current = false;

        if (newTipoPivotRows.length > 0) {
            setCaseTipoExpedienteRows(prev => [...prev, ...newTipoPivotRows]);
        }

        // 4. Escribir en caché SQLite en background para que persista
        if (window.electronAPI?.db?.upsertMany) {
            try {
                const cacheRow = buildCaseCacheRow(caseObject);
                if (cacheRow) {
                    await window.electronAPI.db.upsertMany('cases', [cacheRow]);
                }
                if (newPivotRows.length > 0) {
                    await window.electronAPI.db.upsertMany('case_client', newPivotRows);
                }
                if (newTipoPivotRows.length > 0) {
                    await window.electronAPI.db.upsertMany('case_tipo_expediente', newTipoPivotRows);
                }
            } catch { /* cache write best-effort */ }
        }
    }, []);

    // ── Navegación al editor ───────────────────────────────────────────────────
    const navigateToEditor = useCallback((content) => {
        onClose();
        navigate(`/documents/new?templateId=${template.id}`, {
            state: {
                prefillContent: content,
                prefillTitle: getBaseNameWithoutExtension(template?.title),
                prefillMargins: template?.margins ?? null,
            },
        });
    }, [navigate, onClose, template?.id, template?.title, template?.margins]);

    // ── Acción: rellenar ───────────────────────────────────────────────────────
    const handleFill = async () => {
        if (missingRequiredLabels.length > 0) {
            setShowIncompleteWarning(true);
            return;
        }

        setShowIncompleteWarning(false);
        setFilling(true);
        try {
            const fieldIds = buildFieldIds(requirements, {
                clientsByN, usersByN, casesByN, partesByN, eventsByN, datePartsByN,
                subEntityValues, generalValues, financialValues, locationValues, customValues,
            });
            const filledContent = await fillTemplate({
                templateId: template.id,
                body: templateBody,
                fieldIds,
                requirements,
                capitalizationSettings: templateCapitalization,
                clientTreatmentEnabled: templateClientTreatment ?? true,
            });
            navigateToEditor(filledContent);
        } catch (err) {
            setModalError(err?.message || 'No se pudo rellenar la plantilla.');
        } finally {
            setFilling(false);
        }
    };

    const handleLoadEmpty = useCallback(() => {
        navigateToEditor(getEmptyTemplate(templateBody));
    }, [navigateToEditor, templateBody]);

    // ── Render ─────────────────────────────────────────────────────────────────

    const subtitle = !loading && hasAnyRequirements
        ? `Esta plantilla requiere ${requirements.length} campo${requirements.length !== 1 ? 's' : ''} para completarse automáticamente.`
        : undefined;

    return (
        <>
        <Modal
            open={open}
            onClose={onClose}
            title={template?.title ? `Usar: ${template.title}` : 'Usar plantilla'}
            subtitle={subtitle}
            maxWidth="max-w-7xl"
            maxHeight="max-h-[92vh]"
            bodyScrollable={false}
            bodyClassName="overflow-hidden"
            footerAlignment="justify-between"
            footer={(
                <>
                    <Button variant="outline" onClick={handleLoadEmpty} disabled={filling || loading}>
                        Cargar sin rellenar
                    </Button>

                    {/* Acceso rápido a configuraciones de capitalización */}
                    <button
                        type="button"
                        onClick={() => setCapSettingsOpen(true)}
                        className="flex items-center gap-1.5 text-sm text-(--text-secondary) hover:text-(--text-primary) transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    >
                        <SettingsIcon size={13} />
                        Configuraciones de plantillas
                    </button>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} disabled={filling}>
                            Cancelar
                        </Button>

                        {hasAnyRequirements && !loading && (
                            <Button
                                variant="primary"
                                icon={filling ? Loader2 : Wand2}
                                onClick={handleFill}
                                disabled={filling}
                                className={!isFormComplete ? 'opacity-50' : ''}
                                title={!isFormComplete ? 'Faltan completar campos' : undefined}
                            >
                                {filling ? 'Aplicando...' : 'Aplicar plantilla'}
                            </Button>
                        )}

                        {!hasAnyRequirements && !loading && (
                            <Button variant="primary" icon={FileText} onClick={handleLoadEmpty}>
                                Usar plantilla
                            </Button>
                        )}
                    </div>
                </>
            )}
        >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:h-[72vh] lg:min-h-0">
                {/* Columna Izquierda: Formulario (5/12) */}
                <div className="space-y-7 lg:col-span-5 lg:flex lg:min-h-0 lg:flex-col">
                    {modalError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-sm">
                            {modalError}
                        </div>
                    )}
                    {loading && (
                        <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-(--text-secondary)">
                            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                            <span className="text-sm">Cargando campos de la plantilla...</span>
                        </div>
                    )}

                    {!loading && !hasAnyRequirements && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center text-(--text-secondary)">
                            <FileText className="h-10 w-10 text-(--text-tertiary)" />
                            <p className="text-sm max-w-xs">
                                Esta plantilla no tiene campos configurados. Se abrirá directamente en el editor.
                            </p>
                        </div>
                    )}

                    {!loading && hasAnyRequirements && (
                        <>
                        {showIncompleteWarning && missingRequiredLabels.length > 0 && (
                            <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
                                <p className="font-semibold">
                                    Faltan completar estos campos para usar la plantilla:
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-5">
                                    {missingRequiredLabels.map((label) => (
                                        <li key={label}>{label}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {hasSmartOptions && (
                            <div className="shrink-0 rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setSmartOptionsOpen((current) => !current)}
                                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-(--text-primary) hover:bg-(--bg-card-hover)"
                                >
                                    <span>Opciones</span>
                                    {smartOptionsOpen ? (
                                        <ChevronDown className="h-4 w-4 text-(--text-tertiary)" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-(--text-tertiary)" />
                                    )}
                                </button>

                                {smartOptionsOpen && (
                                    <div className="space-y-2 border-t border-(--border-subtle) px-3 py-3 text-sm">
                                        {hasClientCaseFiltering && (
                                            <label className="flex items-center gap-2 text-(--text-primary)">
                                                <input
                                                    type="checkbox"
                                                    checked={filterCasesByClient}
                                                    onChange={(event) => setFilterCasesByClient(event.target.checked)}
                                                    className="h-4 w-4 rounded border-(--border-default) text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>Filtrar casos por cliente</span>
                                            </label>
                                        )}

                                        {hasCaseDrivenEntityFiltering && (
                                            <label className="flex items-center gap-2 text-(--text-primary)">
                                                <input
                                                    type="checkbox"
                                                    checked={filterCaseRelatedOptions}
                                                    onChange={(event) => setFilterCaseRelatedOptions(event.target.checked)}
                                                    className="h-4 w-4 rounded border-(--border-default) text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>Filtrar elementos por caso</span>
                                            </label>
                                        )}

                                        {hasCaseVisibilityToggle && (
                                            <label className="flex items-center gap-2 text-(--text-primary)">
                                                <input
                                                    type="checkbox"
                                                    checked={showOnlyActiveCases}
                                                    onChange={(event) => setShowOnlyActiveCases(event.target.checked)}
                                                    className="h-4 w-4 rounded border-(--border-default) text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>Mostrar solo casos activos</span>
                                            </label>
                                        )}

                                        {shouldSuggestAllCases && (
                                            <p className="text-xs text-amber-700">
                                                No hay expedientes compartidos entre los clientes elegidos. Desactivá "Filtrar casos por cliente" para ampliar la búsqueda.
                                            </p>
                                        )}

                                        {hasCaseDrivenEntityFiltering && filterCaseRelatedOptions && !primarySelectedCase && (
                                            <p className="text-xs text-(--text-secondary)">
                                                Al elegir un expediente, el sistema va a completar automáticamente las entidades judiciales asociadas y limitar sus catálogos a ese caso.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="min-h-0 rounded-2xl border border-(--border-subtle) bg-(--bg-card-hover)/35 shadow-inner lg:flex lg:flex-1 lg:flex-col">
                            <div className="border-b border-(--border-subtle) px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--text-tertiary)">
                                    Campos de la plantilla
                                </p>
                            </div>

                            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                                <div className="divide-y divide-(--border-default) px-4">
                                    {/* ── Cliente ─────────────────────────────────── */}
                                    {needs.clientNEntidades.length > 0 && (
                                        <RequirementSection>
                                            <EntityPaginator
                                                label="Cliente"
                                                page={clientPage}
                                                nEntidades={needs.clientNEntidades}
                                                onPageChange={setClientPage}
                                            />
                                            <ClientSearch
                                                value={clientsByN[clientPage]?.id ?? null}
                                                onChange={(id, obj) => setClientsByN(p => ({ ...p, [clientPage]: obj }))}
                                                onFocus={() => setActiveInfo({ family: 'client', nEntidad: clientPage })}
                                                onBlur={() => setActiveInfo(null)}
                                            />
                                            <RequirementNotes notes={clientNotes} />
                                        </RequirementSection>
                                    )}

                                    {/* ── Usuario / Abogado ────────────────────────── */}
                                    {needs.userNEntidades.length > 0 && (
                                        <RequirementSection>
                                            <EntityPaginator
                                                label="Usuario"
                                                page={userPage}
                                                nEntidades={needs.userNEntidades}
                                                onPageChange={setUserPage}
                                            />
                                            <UserSearch
                                                value={usersByN[userPage]?.id ?? null}
                                                onChange={(id, obj) => setUsersByN(p => ({ ...p, [userPage]: obj }))}
                                                onFocus={() => setActiveInfo({ family: 'user', nEntidad: userPage })}
                                                onBlur={() => setActiveInfo(null)}
                                            />
                                            <RequirementNotes notes={userNotes} />
                                        </RequirementSection>
                                    )}

                                    {/* ── Caso ─────────────────────────────────────── */}
                                    {needs.caseNEntidades.length > 0 && (
                                        <RequirementSection>
                                            <EntityPaginator
                                                label="Caso"
                                                page={casePage}
                                                nEntidades={needs.caseNEntidades}
                                                onPageChange={setCasePage}
                                            />
                                            <CaseSearch
                                                value={casesByN[casePage]?.id ?? null}
                                                onChange={(id, obj) => setCasesByN(p => ({ ...p, [casePage]: obj }))}
                                                onCaseCreated={handleCaseCreated}
                                                onFocus={() => setActiveInfo({ family: 'case', nEntidad: casePage })}
                                                onBlur={() => setActiveInfo(null)}
                                                cases={filteredCaseOptions}
                                                emptyMessage={caseSearchEmptyMessage}
                                            />
                                            <RequirementNotes notes={caseNotes} />
                                        </RequirementSection>
                                    )}

                                    {/* ── Sub-entidades del caso (sin NEntidad) ────── */}
                                    {hasCaseSubEntities && (
                                        <RequirementSection>
                                            <CaseSubEntitiesSearch
                                                values={subEntityValues}
                                                onChange={handleSubEntityChange}
                                                onFocus={() => setActiveInfo({ family: 'caseSubEntities', nEntidad: 1 })}
                                                onBlur={() => setActiveInfo(null)}
                                                show={needs.caseSubEntities}
                                                options={filteredCaseSubEntityOptions}
                                                emptyMessages={caseSubEntityEmptyMessages}
                                            />
                                        </RequirementSection>
                                    )}

                                    {hasCaseExpedientTypeField && (
                                        <RequirementSection>
                                            <CaseExpedientTypeSearch
                                                value={subEntityValues.caseExpedientType}
                                                onChange={(id, obj) => handleSubEntityChange(
                                                    'caseExpedientType',
                                                    id != null ? String(id) : null,
                                                    obj ? getTipoExpedienteOptionLabel(obj) : undefined,
                                                )}
                                                onFocus={() => setActiveInfo({ family: 'caseSubEntities', nEntidad: 1 })}
                                                onBlur={() => setActiveInfo(null)}
                                                tipoExpedientes={filteredCaseSubEntityOptions.caseExpedientType?.map((option) => option.object ?? {
                                                    id: option.value,
                                                    title: option.label,
                                                })}
                                                emptyMessage={caseSubEntityEmptyMessages.caseExpedientType}
                                            />
                                        </RequirementSection>
                                    )}

                                    {/* ── Parte contraria ──────────────────────────── */}
                                    {needs.parteNEntidades.length > 0 && (
                                        <RequirementSection>
                                            <EntityPaginator
                                                label="Parte"
                                                page={partePage}
                                                nEntidades={needs.parteNEntidades}
                                                onPageChange={setPartePage}
                                            />
                                            <PartesSearch
                                                value={partesByN[partePage]?.id ?? null}
                                                onChange={(id, obj) => setPartesByN(p => ({ ...p, [partePage]: obj }))}
                                                onFocus={() => setActiveInfo({ family: 'parte', nEntidad: partePage })}
                                                onBlur={() => setActiveInfo(null)}
                                            />
                                            <RequirementNotes notes={parteNotes} />
                                        </RequirementSection>
                                    )}

                                    {needs.eventNEntidades.length > 0 && (
                                        <RequirementSection>
                                            <EntityPaginator
                                                label="Evento"
                                                page={eventPage}
                                                nEntidades={needs.eventNEntidades}
                                                onPageChange={setEventPage}
                                            />
                                            <EventSearch
                                                value={eventsByN[eventPage] ?? null}
                                                onChange={(eventValue) => setEventsByN((current) => ({
                                                    ...current,
                                                    [eventPage]: eventValue,
                                                }))}
                                                defaultAgendaId={defaultAgendaId}
                                                defaultCaseId={defaultCaseId ?? primarySelectedCase?.id ?? null}
                                                onFocus={() => setActiveInfo({ family: 'event', nEntidad: eventPage })}
                                                onBlur={() => setActiveInfo(null)}
                                            />
                                            <RequirementNotes notes={eventNotes} />
                                        </RequirementSection>
                                    )}

                                    {/* ── Partes de fecha derivadas ─────────────────── */}
                                    {needs.datePartNEntidades.length > 0 && (
                                        <RequirementSection>
                                            <EntityPaginator
                                                label="Fecha"
                                                page={datePartsPage}
                                                nEntidades={needs.datePartNEntidades}
                                                onPageChange={setDatePartsPage}
                                            />
                                            <DatePartsInput
                                                label={needs.datePartNEntidades.length > 1
                                                    ? `Fecha ${needs.datePartNEntidades.indexOf(datePartsPage) + 1}`
                                                    : 'Fecha'}
                                                value={datePartsByN[datePartsPage] ?? null}
                                                onChange={(date) => setDatePartsByN(p => ({ ...p, [datePartsPage]: date }))}
                                                onFocus={() => setActiveInfo({ family: 'dateParts', nEntidad: datePartsPage })}
                                                onBlur={() => setActiveInfo(null)}
                                            />
                                            <RequirementNotes notes={datePartNotes} />
                                        </RequirementSection>
                                    )}

                                    {/* ── Campos generales ─────────────────────────── */}
                                    {hasGeneralFields && (
                                        <RequirementSection>
                                            <GeneralInput
                                                show={needs.general}
                                                values={generalValues}
                                                onChange={handleGeneralChange}
                                                onFocus={() => setActiveInfo({ family: 'general', nEntidad: 1 })}
                                                onBlur={() => setActiveInfo(null)}
                                            />
                                        </RequirementSection>
                                    )}

                                    {/* ── Campos financieros ───────────────────────── */}
                                    {hasFinancialFields && (
                                        <RequirementSection>
                                            <FinancialInput
                                                show={needs.financial}
                                                values={financialValues}
                                                onChange={handleFinancialChange}
                                                onFocus={() => setActiveInfo({ family: 'financial', nEntidad: 1 })}
                                                onBlur={() => setActiveInfo(null)}
                                            />
                                        </RequirementSection>
                                    )}

                                    {/* ── Ubicación ────────────────────────────────── */}
                                    {hasLocationFields && (
                                        <RequirementSection>
                                            <LocationInput
                                                show={needs.location}
                                                values={locationValues}
                                                onChange={handleLocationChange}
                                                onFocus={() => setActiveInfo({ family: 'location', nEntidad: 1 })}
                                                onBlur={() => setActiveInfo(null)}
                                            />
                                        </RequirementSection>
                                    )}

                                    {/* ── Campos custom ────────────────────────────── */}
                                    {needs.customFields.length > 0 && (
                                        <RequirementSection>
                                            <div className="space-y-4">
                                                {needs.customFields.map(({ id_campo, title }) => (
                                                    <CustomInput
                                                        key={id_campo}
                                                        id={`custom-field-${id_campo}`}
                                                        label={title || `Campo #${id_campo}`}
                                                        value={customValues[id_campo] || ''}
                                                        onChange={(val) => handleCustomChange(id_campo, val)}
                                                        onFocus={() => setActiveInfo({ family: 'custom', nEntidad: 1 })}
                                                        onBlur={() => setActiveInfo(null)}
                                                    />
                                                ))}
                                            </div>
                                        </RequirementSection>
                                    )}
                                </div>
                            </div>
                        </div>
                        </>
                    )}
                </div>

                {/* Columna Derecha: Preview (7/12) */}
                <div className="flex flex-col gap-4 lg:col-span-7 lg:min-h-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
                        <FileText size={16} />
                        <span>Vista previa del documento (Sin el formato, se aplica al generar la plantilla)</span>
                    </div>

                    <div className="min-h-[400px] overflow-auto rounded-xl border border-(--border-default) bg-(--bg-card-hover) p-6 shadow-inner lg:min-h-0 lg:flex-1">
                        <div
                            className="text-sm text-(--text-primary)"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                        {!loading && !templateBody && (
                            <div className="flex h-full items-center justify-center text-(--text-tertiary)">
                                No hay contenido para previsualizar.
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-3">
                        <div className="flex gap-4 text-[11px] font-medium uppercase tracking-wider text-(--text-tertiary)">
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#fef3c7] border border-[#f59e0b]" />
                                <span>Vacío</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                                <span>Editando</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#dcfce7] border border-[#22c55e]" />
                                <span>Completado</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>

        {/* ── Modal de configuraciones de capitalización ─────────────────── */}
        <Modal
            open={capSettingsOpen}
            onClose={() => setCapSettingsOpen(false)}
            title="Configuraciones de plantillas"
            subtitle="Controlá cómo se escribe el texto al generar documentos desde plantilla."
            maxWidth="max-w-2xl"
            footer={(
                <div className="flex justify-end">
                    <Button onClick={() => setCapSettingsOpen(false)}>
                        Listo
                    </Button>
                </div>
            )}
        >
            <TemplateCapitalizationPanel />
        </Modal>
        </>
    );
}
