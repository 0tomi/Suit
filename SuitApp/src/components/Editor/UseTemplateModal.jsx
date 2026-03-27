import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Wand2, Settings as SettingsIcon } from 'lucide-react';
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
import { showAppToast } from '../ui/show-app-toast.jsx';
import { ClientSearch } from '../requirements/ClientSearch.jsx';
import { UserSearch } from '../requirements/UserSearch.jsx';
import { CaseSearch } from '../requirements/CaseSearch.jsx';
import { CaseSubEntitiesSearch } from '../requirements/CaseSubEntitiesSearch.jsx';
import { PartesSearch } from '../requirements/PartesSearch.jsx';
import { EventSearch } from '../requirements/EventSearch.jsx';
import { GeneralInput } from '../requirements/GeneralInput.jsx';
import { FinancialInput } from '../requirements/FinancialInput.jsx';
import { LocationInput } from '../requirements/LocationInput.jsx';
import { CustomInput } from '../requirements/CustomInput.jsx';
import { DatePartsInput } from '../requirements/DatePartsInput.jsx';
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

/**
 * Analiza los requisitos de la plantilla y determina qué secciones mostrar
 * y cuántas instancias (NEntidades) tiene cada familia de entidad.
 */
function analyzeRequirements(requirements) {
    const caseSubEntities = {
        caseType: false, radicacion: false, jurisdiccion: false,
        competencia: false, dependencia: false,
    };
    const general  = { text: false, number: false, date: false, dateTime: false };
    const financial = { amount: false, paymentType: false };
    const location  = { city: false, province: false, address: false };
    const customFields = [];

    for (const { type, id_campo, title } of requirements) {
        if (type === 'caseType')       caseSubEntities.caseType = true;
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
        eventNEntidades:    extractNEntidades(requirements, t => t.startsWith('event')),
        datePartNEntidades: extractNEntidades(requirements, t => DATE_PART_TYPES.has(t)),
        // Secciones sin NEntidad (valor único global)
        caseSubEntities,
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

function extractEventPreview(type, e) {
    switch (type) {
        case 'eventName': return e.title || '';
        case 'eventType': return e.type || '';
        case 'eventDate': {
            if (!e.starts_at) return '';
            try {
                const d = new Date(e.starts_at.replace(' ', 'T'));
                return format(d, e.starts_at.includes(' ') ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: es });
            } catch { return e.starts_at; }
        }
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
            if (type.startsWith('event')) {
                return [[String(id_campo), `Evento ${baseLabel} ${entityNumber}`]];
            }
            if (DATE_PART_TYPES.has(type)) {
                return [[String(id_campo), `Fecha ${baseLabel} ${entityNumber}`]];
            }

            return [];
        })
    );
}

function getRequirementFamily(type) {
    if (type.startsWith('client')) return 'client';
    if (type.startsWith('user')) return 'user';
    if (CASE_ENTITY_TYPES.includes(type)) return 'case';
    if (type.startsWith('parte')) return 'parte';
    if (type.startsWith('event')) return 'event';
    if (DATE_PART_TYPES.has(type)) return 'dateParts';
    return null;
}

/**
 * Reúne las notas únicas de los requisitos asociados a una familia/NEntidad.
 * Se usa para mostrar aclaraciones debajo del componente actualmente visible.
 */
function getRequirementNotesForEntity(requirements, family, nEntidad) {
    const normalizedEntityNumber = nEntidad ?? 1;
    const seen = new Set();

    return requirements.reduce((notes, requirement) => {
        if (getRequirementFamily(requirement.type) !== family) {
            return notes;
        }

        if ((requirement.NEntidad ?? 1) !== normalizedEntityNumber) {
            return notes;
        }

        const note = requirement.note?.trim();
        if (!note || seen.has(note)) {
            return notes;
        }

        seen.add(note);
        notes.push(note);
        return notes;
    }, []);
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
        } else if (type.startsWith('event')) {
            const e = eventsByN[n];
            if (e) fieldIds[id_campo] = e.id;
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
    return <div className="space-y-2">{children}</div>;
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
export default function UseTemplateModal({ open, onClose, template }) {
    const navigate = useNavigate();
    const { templateCapitalization, templateClientTreatment } = useSettings();

    // Estado para el modal de configuraciones de capitalización
    const [capSettingsOpen, setCapSettingsOpen] = useState(false);

    // ── Datos cargados al abrir ────────────────────────────────────────────────
    const [requirements, setRequirements] = useState([]);
    const [templateBody, setTemplateBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [filling, setFilling] = useState(false);

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
        caseType: null, radicacion: null, jurisdiccion: null,
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
    const hasGeneralFields   = useMemo(() => Object.values(needs.general).some(Boolean),  [needs.general]);
    const hasFinancialFields = useMemo(() => needs.financial.amount || needs.financial.paymentType, [needs.financial]);
    const hasLocationFields  = useMemo(() => Object.values(needs.location).some(Boolean), [needs.location]);
    const hasAnyRequirements = requirements.length > 0;

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
            } else if (type.startsWith('event')) {
                const e = eventsByN[n];
                if (e) val = extractEventPreview(type, e);
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
        for (const n of needs.eventNEntidades)    { if (!eventsByN[n]) return false; }
        for (const n of needs.datePartNEntidades) { if (!datePartsByN[n]) return false; }
        if (needs.caseSubEntities.caseType    && subEntityValues.caseType == null)    return false;
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
                showAppToast({
                    title: 'Error al cargar la plantilla',
                    description: err?.message || 'No se pudieron cargar los campos de la plantilla.',
                    variant: 'danger',
                });
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
        setSubEntityValues({ caseType: null, radicacion: null, jurisdiccion: null, competencia: null, dependencia: null });
        setSubEntityLabels({});
        setGeneralValues({ text: '', number: '', date: null, dateTime: null });
        setFinancialValues({ amount: '', paymentType: null });
        setFinancialLabels({});
        setLocationValues({ city: '', province: '', address: '' });
        setCustomValues({});
        setActiveInfo(null);
    }, [open]);

    // ── Callbacks ──────────────────────────────────────────────────────────────
    const handleSubEntityChange = useCallback((field, value, label) => {
        setSubEntityValues(p => ({ ...p, [field]: value }));
        if (label) setSubEntityLabels(p => ({ ...p, [field]: label }));
    }, []);
    const handleGeneralChange  = useCallback((field, value) => setGeneralValues(p => ({ ...p, [field]: value })), []);
    const handleFinancialChange = useCallback((field, value, label) => {
        setFinancialValues(p => ({ ...p, [field]: value }));
        if (label) setFinancialLabels(p => ({ ...p, [field]: label }));
    }, []);
    const handleLocationChange = useCallback((field, value) => setLocationValues(p => ({ ...p, [field]: value })), []);
    const handleCustomChange   = useCallback((idCampo, value) => setCustomValues(p => ({ ...p, [idCampo]: value })), []);

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
            showAppToast({
                title: 'Error al aplicar plantilla',
                description: err?.message || 'No se pudo rellenar la plantilla.',
                variant: 'danger',
            });
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
                                disabled={filling || !isFormComplete}
                                title={!isFormComplete ? 'Completá todos los campos antes de aplicar' : undefined}
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Columna Izquierda: Formulario (5/12) */}
                <div className="lg:col-span-5 space-y-6">
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
                                        onFocus={() => setActiveInfo({ family: 'case', nEntidad: casePage })}
                                        onBlur={() => setActiveInfo(null)}
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

                            {/* ── Evento ───────────────────────────────────── */}
                            {needs.eventNEntidades.length > 0 && (
                                <RequirementSection>
                                    <EntityPaginator
                                        label="Evento"
                                        page={eventPage}
                                        nEntidades={needs.eventNEntidades}
                                        onPageChange={setEventPage}
                                    />
                                    <EventSearch
                                        value={eventsByN[eventPage]?.id ?? null}
                                        onChange={(id, obj) => setEventsByN(p => ({ ...p, [eventPage]: obj }))}
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
                        </>
                    )}
                </div>

                {/* Columna Derecha: Preview (7/12) */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
                        <FileText size={16} />
                        <span>Vista previa del documento (Sin el formato, se aplica al generar la plantilla)</span>
                    </div>

                    <div className="flex-1 overflow-auto rounded-xl border border-(--border-default) bg-(--bg-card-hover) p-6 min-h-[400px] max-h-[600px] sticky top-0 shadow-inner">
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
