import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    Search, Briefcase, Users, FileText, Loader2, ChevronDown, ChevronRight,
    User, Mail, Phone, MapPin, Calendar, Clock,
    Hash, Tag, ShieldCheck, ExternalLink
} from 'lucide-react';
import { useCases } from '../../../context/CasesContext';
import { useClients } from '../../../context/ClientsContext';
import { useDocuments } from '../../../context/DocumentsContext';
import { useUsers } from '../../../context/UsersContext';
import { usePartes } from '../../../context/PartesContext';
import { getCaseStatusLabel } from '../../../utils/caseStatus.js';
import { getDocumentStatusLabel } from '../../../utils/documentStatus.js';
import { fetchEntityDetail } from '../../../services/draftingToolsApiService.js';
import dayjs from 'dayjs';

// ─── COMPONENTE DE DETALLE INLINE ────────────────────────────────────────────

/** Fila de detalle con etiqueta e ícono opcional */
const DetailRow = ({ label, value, icon: Icon }) => (
    <div className="space-y-0.5">
        <span className="text-[10px] font-bold text-(--text-tertiary) uppercase flex items-center gap-1">
            {Icon && <Icon size={9} />}{label}
        </span>
        <p className="text-xs text-(--text-primary) break-words">{value || '—'}</p>
    </div>
);

function getClientTypeLabel(type) {
    return {
        person: 'Persona física',
        company: 'Empresa / Persona jurídica',
    }[type] ?? type;
}

function getUserRoleLabel(role) {
    return {
        admin: 'Administrador',
        user: 'Usuario',
        lawyer: 'Abogado',
    }[role] ?? role;
}

/** Badge de estado con colores semánticos */
const StatusBadge = ({ value, paid }) => {
    const colorMap = {
        'Activo':     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Inactivo':   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        'Cerrado':    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Borrador':   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        'Firmado':    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Presentado': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        'Deudor':     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    if (paid !== undefined) {
        return paid
            ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 size={9} />Pagado</span>
            : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle size={9} />Pendiente</span>;
    }
    const classes = colorMap[value] ?? 'bg-gray-100 text-gray-600';
    return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${classes}`}>{value}</span>;
};

/**
 * Panel de detalle inline para una entidad seleccionada.
 * Renderiza todos los campos disponibles según el tipo, incluyendo datos enriquecidos
 * desde la API cuando están disponibles. Para documentos, muestra botón de vista previa.
 *
 * @param {Object} item - { id, title, type, raw } donde raw puede ser enriquecido con datos API
 * @param {string} type - Tipo de entidad ('Caso', 'Cliente', 'Documento', etc.)
 * @param {Function} [onPreviewDocument] - Callback para abrir vista previa (solo Documento)
 * @param {boolean} [enriching] - Si se está cargando datos enriquecidos de la API
 */
const EntityDetail = ({ item, type, onPreviewDocument, enriching }) => {
    if (!item) return null;
    const raw = item.raw;

    return (
        <div className="mx-2 mb-2 rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30 overflow-hidden animate-in slide-in-from-top duration-150">
            {/* Label de tipo + indicador de carga API */}
            <div className="px-3 py-1.5 bg-blue-100/70 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">{type}</span>
                {enriching && <Loader2 size={10} className="animate-spin text-blue-500" />}
            </div>

            <div className="p-3 space-y-2.5">
                {/* ── CASO ── */}
                {type === 'Caso' && (
                    <>
                        <DetailRow label="Título" value={raw.title} />
                        <StatusBadge value={getCaseStatusLabel(raw)} />
                        {raw.nro_expediente && <DetailRow label="Nro. expediente" value={raw.nro_expediente} icon={Hash} />}
                        {raw.start_date && <DetailRow label="Inicio" value={dayjs(raw.start_date).format('DD/MM/YYYY')} icon={Calendar} />}
                        {raw.end_date && <DetailRow label="Cierre" value={dayjs(raw.end_date).format('DD/MM/YYYY')} icon={Calendar} />}
                        {raw.details && <DetailRow label="Detalles" value={raw.details} />}
                        {raw.owner_tag && <DetailRow label="Responsable" value={`@${raw.owner_tag}`} icon={User} />}
                        <DetailRow label="Registrado" value={raw.created_at ? dayjs(raw.created_at).format('DD/MM/YYYY') : null} icon={Calendar} />
                    </>
                )}

                {/* ── CLIENTE ── */}
                {type === 'Cliente' && (
                    <>
                        <DetailRow label="Nombre" value={`${raw.first_name || ''} ${raw.last_name || ''}`.trim()} />
                        {raw.gender && <DetailRow label="Género" value={{ M: 'Masculino', F: 'Femenino', X: 'No binario' }[raw.gender] ?? raw.gender} />}
                        {raw.identification_number && <DetailRow label="DNI / ID" value={raw.identification_number} icon={Hash} />}
                        {raw.type && <DetailRow label="Tipo" value={getClientTypeLabel(raw.type)} icon={Tag} />}
                        {raw.status && (
                            <StatusBadge value={
                                { active: 'Activo', inactive: 'Inactivo', debtor: 'Deudor' }[raw.status] ?? raw.status
                            } />
                        )}
                        {raw.email && <DetailRow label="Correo electrónico" value={raw.email} icon={Mail} />}
                        {raw.phone && <DetailRow label="Teléfono" value={raw.phone} icon={Phone} />}
                        {raw.address && <DetailRow label="Dirección" value={raw.address} icon={MapPin} />}
                        {raw.birth_date && <DetailRow label="Nacimiento" value={dayjs(raw.birth_date).format('DD/MM/YYYY')} icon={Calendar} />}
                        {raw.notes && <DetailRow label="Notas" value={raw.notes} />}
                        <DetailRow label="Registrado" value={raw.created_at ? dayjs(raw.created_at).format('DD/MM/YYYY') : null} icon={Calendar} />
                    </>
                )}

                {/* ── DOCUMENTO ── */}
                {type === 'Documento' && (
                    <>
                        <DetailRow label="Nombre" value={raw.name || raw.title} />
                        <StatusBadge value={getDocumentStatusLabel(raw.status)} />
                        {raw.description && <DetailRow label="Descripción" value={raw.description} />}
                        <DetailRow label="Última modificación" value={raw.updated_at ? dayjs(raw.updated_at).format('DD/MM/YYYY HH:mm') : null} icon={Clock} />
                        {/* Botón de vista previa: obtiene el contenido HTML desde la API */}
                        {onPreviewDocument && (
                            <button
                                onClick={() => onPreviewDocument(raw)}
                                className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            >
                                <ExternalLink size={10} />
                                Vista previa del documento
                            </button>
                        )}
                    </>
                )}

                {/* ── USUARIO ── */}
                {type === 'Usuario' && (
                    <>
                        <DetailRow label="Nombre" value={raw.name} icon={User} />
                        {raw.tag && <DetailRow label="Usuario" value={`@${raw.tag}`} icon={Tag} />}
                        {raw.email && <DetailRow label="Correo electrónico" value={raw.email} icon={Mail} />}
                        {raw.role && (
                            <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-(--text-tertiary) uppercase flex items-center gap-1">
                                    <ShieldCheck size={9} />Rol
                                </span>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    raw.role === 'admin'
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>{getUserRoleLabel(raw.role)}</span>
                            </div>
                        )}
                        <DetailRow label="Registrado" value={raw.created_at ? dayjs(raw.created_at).format('DD/MM/YYYY') : null} icon={Calendar} />
                    </>
                )}

                {/* ── PARTE ── */}
                {type === 'Parte' && (
                    <>
                        <DetailRow label="Nombre" value={raw.nombre || raw.name || raw.title} icon={User} />
                        {raw.dni && <DetailRow label="DNI / Documento" value={raw.dni} icon={Hash} />}
                        {raw.tipo_parte && <DetailRow label="Tipo de parte" value={raw.tipo_parte} icon={Tag} />}
                        {raw.email && <DetailRow label="Correo electrónico" value={raw.email} icon={Mail} />}
                        {raw.telefono && <DetailRow label="Teléfono" value={raw.telefono} icon={Phone} />}
                        {raw.domicilio && <DetailRow label="Domicilio" value={raw.domicilio} icon={MapPin} />}
                    </>
                )}

                {/* ── HONORARIO ── */}
                {type === 'Honorario' && (
                    <>
                        <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-(--text-primary)">${Number(raw.monto || 0).toLocaleString('es-AR')}</span>
                            <StatusBadge paid={Boolean(raw.pagado)} />
                        </div>
                        {raw.detalles && <DetailRow label="Detalles" value={raw.detalles} />}
                        {raw.total_entregas !== undefined && (
                            <DetailRow label="Total entregas" value={`$${Number(raw.total_entregas || 0).toLocaleString('es-AR')}`} icon={DollarSign} />
                        )}
                        <DetailRow label="Registrado" value={raw.created_at ? dayjs(raw.created_at).format('DD/MM/YYYY') : null} icon={Calendar} />
                    </>
                )}

                {/* ── GASTO ── */}
                {type === 'Gasto' && (
                    <>
                        <span className="text-base font-bold text-(--text-primary)">${Number(raw.monto || 0).toLocaleString('es-AR')}</span>
                        {raw.descripcion && <DetailRow label="Descripción" value={raw.descripcion} />}
                        {(raw.gasto?.nombre || raw.gasto_id) && (
                            <DetailRow label="Categoría" value={raw.gasto?.nombre || `Categoría #${raw.gasto_id}`} icon={Tag} />
                        )}
                        <DetailRow label="Fecha" value={raw.created_at ? dayjs(raw.created_at).format('DD/MM/YYYY') : null} icon={Calendar} />
                    </>
                )}
            </div>
        </div>
    );
};

// ─── SECCIÓN DE BÚSQUEDA ─────────────────────────────────────────────────────

/**
 * Sección colapsable con input de búsqueda y detalle inline.
 * Al seleccionar un ítem, el panel de detalle aparece justo debajo del buscador
 * dentro de la misma sección, sin afectar las otras.
 */
const SearchSection = ({ title, icon, query, setQuery, results, isLoading, isOpen, onToggle, onSelect, selectedItem, displayItem, enriching, type, onPreviewDocument }) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);
    const IconComponent = icon;

    // El ítem está seleccionado en esta sección si tiene el tipo correcto
    const isThisTypeSelected = selectedItem?.type === type;

    const handleSelect = (item) => {
        setQuery('');
        setIsFocused(false);
        inputRef.current?.blur();
        onSelect(item);
    };

    const handleFocus = () => {
        setIsFocused(true);
        // Si hay un ítem seleccionado y se vuelve a enfocar, limpiar para buscar de nuevo
        if (isThisTypeSelected) {
            onSelect(null);
            setQuery('');
        }
    };

    const showDropdown = isFocused && (results.length > 0 || (!isLoading && query.trim()));

    // Usar datos enriquecidos si están disponibles para este tipo
    const itemForDisplay = isThisTypeSelected && displayItem ? displayItem : selectedItem;

    return (
        <div className="border-b border-(--border-default)">
            {/* Encabezado colapsable */}
            <button
                onClick={onToggle}
                className="flex w-full items-center justify-between p-3 hover:bg-(--bg-card-hover) transition-colors"
            >
                <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold text-(--text-primary)">{title}</span>
                    {isThisTypeSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                </div>
                {isOpen
                    ? <ChevronDown size={14} className="text-(--text-tertiary)" />
                    : <ChevronRight size={14} className="text-(--text-tertiary)" />
                }
            </button>

            {isOpen && (
                <div className="pb-1">
                    {/* Input de búsqueda */}
                    <div className="relative px-2 pt-1 pb-1">
                        <Search className="absolute left-4 top-3.5 h-3.5 w-3.5 text-(--text-tertiary) pointer-events-none" />
                        {isLoading && (
                            <Loader2 className="absolute right-4 top-3.5 h-3.5 w-3.5 animate-spin text-blue-500" />
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={handleFocus}
                            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                            placeholder={`Buscar ${title.toLowerCase()}...`}
                            className="w-full rounded-md border border-(--border-subtle) bg-(--bg-input) py-1.5 pl-8 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </div>

                    {/* Dropdown de resultados (solo mientras está activo) */}
                    {showDropdown && (
                        <div className="mx-2 mb-1 rounded-md border border-(--border-subtle) bg-(--bg-card) shadow-md overflow-hidden">
                            {results.length === 0 ? (
                                <p className="p-3 text-center text-[10px] text-(--text-tertiary)">Sin resultados.</p>
                            ) : (
                                results.map((item) => (
                                    <button
                                        key={item.id}
                                        onMouseDown={() => handleSelect(item)}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-(--bg-card-hover) text-(--text-primary) transition-colors border-b border-(--border-subtle) last:border-0"
                                    >
                                        <IconComponent className="h-3 w-3 shrink-0 text-(--text-tertiary)" />
                                        <span className="truncate flex-1">{item.title}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {/* Panel de detalle: aparece justo debajo del buscador cuando hay selección */}
                    {isThisTypeSelected && !isFocused && (
                        <EntityDetail
                            item={itemForDisplay}
                            type={type}
                            onPreviewDocument={type === 'Documento' ? onPreviewDocument : undefined}
                            enriching={enriching && isThisTypeSelected}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

/**
 * Panel de herramientas generales para búsqueda de entidades sin caso vinculado.
 * Al seleccionar una entidad con endpoint individual (Caso, Cliente), enriquece
 * los datos mostrados con una llamada fresca a la API.
 *
 * @param {Function} [onPreviewDocument] - Callback para abrir vista previa de documentos
 */
const GeneralTools = ({ onPreviewDocument }) => {
    const { cases, syncing: casesLoading } = useCases();
    const { clients, syncing: clientsLoading } = useClients();
    const { documents, syncing: docsLoading } = useDocuments();
    const { users, syncing: usersLoading } = useUsers();
    const { partes, syncing: partesLoading } = usePartes();

    const [queries, setQueries] = useState({ cases: '', clients: '', docs: '', users: '', partes: '' });
    const [openSections, setOpenSections] = useState({ cases: true, clients: false, docs: false, users: false, partes: false });

    // Un único ítem seleccionado global (solo uno a la vez, cualquier tipo)
    const [selectedItem, setSelectedItem] = useState(null);

    // Datos enriquecidos desde la API para el ítem seleccionado (Caso, Cliente)
    const [enrichedData, setEnrichedData] = useState(null);
    const [enriching, setEnriching] = useState(false);

    const setQuery = (key) => (v) => setQueries(q => ({ ...q, [key]: v }));
    const toggleSection = (section) => setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));

    /** Seleccionar un ítem; null limpia la selección */
    const handleSelect = useCallback((item) => {
        setSelectedItem(item ?? null);
        setEnrichedData(null); // Resetear datos enriquecidos al cambiar selección
        setEnriching(Boolean(item && ['Caso', 'Cliente'].includes(item.type)));
    }, []);

    // Al seleccionar un ítem con endpoint individual, enriquecer desde API (silenciosamente)
    useEffect(() => {
        if (!selectedItem?.id || !['Caso', 'Cliente'].includes(selectedItem.type)) {
            return;
        }

        let cancelled = false;

        fetchEntityDetail(selectedItem.type, selectedItem.id).then((data) => {
            if (!cancelled) {
                setEnrichedData(data);
                setEnriching(false);
            }
        });

        return () => { cancelled = true; };
    }, [selectedItem]);

    /**
     * Item a mostrar en el detalle: si hay datos enriquecidos, mergearlos con el raw de caché.
     * Esto permite que la UI muestre los datos del caché inmediatamente
     * y los actualice silenciosamente cuando la API responde.
     */
    const displayItem = useMemo(() => {
        if (!selectedItem) return null;
        if (!enrichedData) return selectedItem;
        return { ...selectedItem, raw: { ...selectedItem.raw, ...enrichedData } };
    }, [selectedItem, enrichedData]);

    // ── Resultados filtrados ──────────────────────────────────────────────────

    const results = useMemo(() => {
        const match = (str, q) => !q || String(str || '').toLowerCase().includes(q.toLowerCase());

        const caseMatches = (cases || [])
            .filter(c => match(c.title, queries.cases) || match(c.description, queries.cases))
            .slice(0, 10)
            .map(c => ({ id: c.id, title: c.title || `Caso #${c.id}`, type: 'Caso', raw: c }));

        const clientMatches = (clients || [])
            .filter(c => {
                const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
                return match(fullName, queries.clients) || match(c.identification_number, queries.clients) || match(c.email, queries.clients);
            })
            .slice(0, 10)
            .map(c => ({
                id: c.id,
                title: `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Cliente #${c.id}`,
                type: 'Cliente',
                raw: c,
            }));

        const docMatches = (documents || [])
            .filter(d => match(d.name || d.title, queries.docs))
            .slice(0, 10)
            .map(d => ({ id: d.id, title: d.name || d.title || `Doc #${d.id}`, type: 'Documento', raw: d }));

        const userMatches = (users || [])
            .filter(u => match(u.name, queries.users) || match(u.tag, queries.users) || match(u.email, queries.users))
            .slice(0, 10)
            .map(u => ({ id: u.id, title: u.name || u.tag || `Usuario #${u.id}`, type: 'Usuario', raw: u }));

        const parteMatches = (partes || [])
            .filter(p => {
                const name = p.nombre || p.name || p.title || '';
                return match(name, queries.partes) || match(p.dni, queries.partes);
            })
            .slice(0, 10)
            .map(p => ({
                id: p.id,
                title: p.nombre || p.name || p.title || `Parte #${p.id}`,
                type: 'Parte',
                raw: p,
            }));

        return { cases: caseMatches, clients: clientMatches, docs: docMatches, users: userMatches, partes: parteMatches };
    }, [queries, cases, clients, documents, users, partes]);

    const sections = [
        { key: 'cases',      title: 'Casos',      icon: Briefcase,   loading: casesLoading,   type: 'Caso' },
        { key: 'clients',    title: 'Clientes',   icon: Users,       loading: clientsLoading, type: 'Cliente' },
        { key: 'docs',       title: 'Documentos', icon: FileText,    loading: docsLoading,    type: 'Documento' },
        { key: 'users',      title: 'Usuarios',   icon: User,        loading: usersLoading,   type: 'Usuario' },
        { key: 'partes',     title: 'Partes',     icon: Users,       loading: partesLoading,  type: 'Parte' },
    ];

    return (
        <div>
            {sections.map(({ key, title, icon, loading, type }) => (
                <SearchSection
                    key={key}
                    title={title}
                    icon={icon}
                    query={queries[key]}
                    setQuery={setQuery(key)}
                    results={results[key]}
                    isLoading={loading}
                    isOpen={openSections[key]}
                    onToggle={() => toggleSection(key)}
                    onSelect={handleSelect}
                    selectedItem={selectedItem}
                    displayItem={displayItem}
                    enriching={enriching}
                    type={type}
                    onPreviewDocument={onPreviewDocument}
                />
            ))}
        </div>
    );
};

export default GeneralTools;
