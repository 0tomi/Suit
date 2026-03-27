import React, { useMemo, useState, useEffect } from 'react';
import {
    Calendar, FileText, Users, FolderOpen, Loader2, ChevronRight,
    Eye, User, Clock,
    Tag, Search, MapPin, Hash, ExternalLink
} from 'lucide-react';
import { useDocuments } from '../../../context/DocumentsContext';
import { useMultimedia } from '../../../context/MultimediaContext.jsx';
import { useFiles } from '../../../context/FilesContext.jsx';
import { usePartesCaso } from '../../../hooks/usePartesCaso.js';
import dayjs from 'dayjs';
import { createLogger } from '../../../services/logService.js';
import { getDocumentStatusLabel } from '../../../utils/documentStatus.js';

const logger = createLogger('component:case-tools');

// ─── SUBCOMPONENTEN DE DETALLE INLINE ────────────────────────────────────────

/** Etiqueta–valor reutilizable */
const DetailRow = ({ label, value, icon: Icon }) => (
    <div className="space-y-0.5">
        <span className="text-[10px] font-bold text-(--text-tertiary) uppercase flex items-center gap-1">
            {Icon && <Icon size={9} />}{label}
        </span>
        <p className="text-xs text-(--text-primary) break-words">{value || '—'}</p>
    </div>
);

/**
 * Panel de detalle inline para un ítem seleccionado.
 * Aparece dentro de la categoría expandida, justo debajo de los ítems.
 * onPreviewDocument: callback para abrir la vista previa del documento (solo para type='Documento')
 */
const InlineDetail = ({ item, type, onPreviewDocument }) => {
    if (!item) return null;

    return (
        <div className="mx-2 mb-2 mt-1 rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30 overflow-hidden animate-in slide-in-from-top duration-150">
            <div className="px-3 py-1.5 bg-blue-100/70 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">{type}</span>
            </div>
            <div className="p-3 space-y-2.5">

                {/* ── DOCUMENTO ── */}
                {type === 'Documento' && (
                    <>
                        <DetailRow label="Nombre" value={item.name || item.title} />
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            {getDocumentStatusLabel(item.status)}
                        </span>
                        {item.description && <DetailRow label="Descripción" value={item.description} />}
                        <DetailRow label="Última modificación" value={item.updated_at ? dayjs(item.updated_at).format('DD/MM/YYYY HH:mm') : null} icon={Clock} />
                        <DetailRow label="Creado" value={item.created_at ? dayjs(item.created_at).format('DD/MM/YYYY') : null} icon={Calendar} />
                        {/* Botón de vista previa: abre el contenido del documento desde la API */}
                        {onPreviewDocument && (
                            <button
                                onClick={() => onPreviewDocument(item)}
                                className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            >
                                <ExternalLink size={10} />
                                Vista previa del documento
                            </button>
                        )}
                    </>
                )}

                {/* ── PERSONA (PARTE DEL CASO) ── */}
                {type === 'Persona' && (
                    <>
                        <DetailRow label="Nombre" value={item.nombre || item.title || 'Parte s/n'} />
                        {item.tipo_parte && <DetailRow label="Tipo de parte" value={item.tipo_parte} icon={Tag} />}
                        {item.dni && <DetailRow label="DNI / Documento" value={item.dni} icon={Hash} />}
                        {item.email && <DetailRow label="Correo electrónico" value={item.email} />}
                        {item.telefono && <DetailRow label="Teléfono" value={item.telefono} />}
                        {item.domicilio && <DetailRow label="Domicilio" value={item.domicilio} icon={MapPin} />}
                    </>
                )}

                {/* ── EVENTO ── */}
                {type === 'Evento' && (
                    <>
                        <DetailRow label="Título" value={item.title} />
                        <DetailRow label="Fecha" value={item.date ? dayjs(item.date).format('DD [de] MMMM, YYYY') : null} icon={Calendar} />
                        <DetailRow
                            label="Horario"
                            value={item.start_time ? `${item.start_time}${item.end_time ? ` — ${item.end_time}` : ''}` : 'Sin hora'}
                            icon={Clock}
                        />
                        {item.description && <DetailRow label="Descripción" value={item.description} />}
                        {item.location && <DetailRow label="Lugar" value={item.location} />}
                    </>
                )}

                {/* ── ARCHIVO / MULTIMEDIA ── */}
                {type === 'Archivo' && (
                    <>
                        <DetailRow label="Nombre" value={item.filename} />
                        {item.size && <DetailRow label="Tamaño" value={`${(item.size / 1024).toFixed(1)} KB`} />}
                        <DetailRow label="Tipo de archivo" value={item.mime_type || item.type} icon={Tag} />
                        {item.created_at && <DetailRow label="Subido" value={dayjs(item.created_at).format('DD/MM/YYYY')} icon={Calendar} />}
                    </>
                )}

                {/* ── HONORARIO ── */}
                {type === 'Honorario' && (
                    <>
                        <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-(--text-primary)">${Number(item.monto || 0).toLocaleString('es-AR')}</span>
                            {item.pagado
                                ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 size={9} />Pagado</span>
                                : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle size={9} />Pendiente</span>
                            }
                        </div>
                        {item.detalles && <DetailRow label="Detalles" value={item.detalles} />}
                        {item.total_entregas !== undefined && (
                            <DetailRow label="Total entregas" value={`$${Number(item.total_entregas || 0).toLocaleString('es-AR')}`} icon={DollarSign} />
                        )}
                        {item.created_at && <DetailRow label="Registrado" value={dayjs(item.created_at).format('DD/MM/YYYY')} icon={Calendar} />}
                    </>
                )}

                {/* ── GASTO ── */}
                {type === 'Gasto' && (
                    <>
                        <span className="text-base font-bold text-(--text-primary)">${Number(item.monto || 0).toLocaleString('es-AR')}</span>
                        {item.descripcion && <DetailRow label="Descripción" value={item.descripcion} />}
                        {(item.gasto?.nombre || item.gasto_id) && (
                            <DetailRow label="Categoría" value={item.gasto?.nombre || `Categoría #${item.gasto_id}`} icon={Tag} />
                        )}
                        {item.created_at && <DetailRow label="Fecha" value={dayjs(item.created_at).format('DD/MM/YYYY')} icon={Calendar} />}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── SECCIÓN CATEGORÍA CON BÚSQUEDA ─────────────────────────────────────────

/**
 * Categoría colapsable con buscador inline y panel de detalle por ítem seleccionado.
 * Cada categoría maneja su propio estado de búsqueda y selección.
 */
const CategorySection = ({ icon, title, count, isOpen, onToggle, children, searchQuery, onSearchChange, searchPlaceholder }) => {
    const IconComponent = icon;

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
                    {count > 0 && (
                        <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
                            {count}
                        </span>
                    )}
                </div>
                <ChevronRight className={`h-4 w-4 text-(--text-tertiary) transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>

            {isOpen && (
                <div className="pb-1">
                    {/* Buscador de la categoría */}
                    <div className="relative px-2 pt-1 pb-1">
                        <Search className="absolute left-4 top-3.5 h-3.5 w-3.5 text-(--text-tertiary) pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={searchPlaceholder || `Filtrar ${title.toLowerCase()}...`}
                            className="w-full rounded-md border border-(--border-subtle) bg-(--bg-input) py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    {/* Contenido de la categoría (ítems + detalle inline) */}
                    {children}
                </div>
            )}
        </div>
    );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const CaseTools = ({ caseId, onPreviewDocument, onPreviewMedia }) => {
    const [openCategories, setOpenCategories] = useState({
        docs: true,
        people: false,
        files: false,
        events: true,
    });

    // Búsqueda por categoría
    const [searches, setSearches] = useState({ docs: '', people: '', files: '', events: '' });
    const setSearch = (key) => (v) => setSearches(s => ({ ...s, [key]: v }));

    // Selección por categoría (independiente entre secciones)
    const [selected, setSelected] = useState({ docs: null, people: null, files: null, events: null });
    const setSelectedFor = (key) => (item) => setSelected(s => ({ ...s, [key]: item }));

    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);

    const { documents, loading: docsLoading } = useDocuments();
    const { multimedia, loading: mediaLoading } = useMultimedia();
    const { files, loading: filesLoading } = useFiles();
    const { partesCaso, loading: partesLoading } = usePartesCaso(caseId, { enabled: !!caseId });

    const toggleCategory = (cat) => {
        setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    // Eventos del caso desde caché SQLite directamente
    useEffect(() => {
        if (!caseId) return;
        let cancelled = false;
        const fetchEvents = async () => {
            setEventsLoading(true);
            try {
                const allEvents = await window.electronAPI?.db?.getAll('events');
                if (cancelled) return;
                const filtered = (allEvents || [])
                    .filter(e => Number(e.suit_case_id) === Number(caseId))
                    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
                setEvents(filtered);
            } catch (err) {
                void logger.error('Error fetching case events', err);
            } finally {
                if (!cancelled) setEventsLoading(false);
            }
        };
        void fetchEvents();
        return () => { cancelled = true; };
    }, [caseId]);

    // Filtrados por texto de búsqueda
    const caseDocs = useMemo(() => {
        const base = (documents || []).filter(d => Number(d.suit_case_id) === Number(caseId));
        if (!searches.docs) return base;
        const q = searches.docs.toLowerCase();
        return base.filter(d => (d.name || d.title || '').toLowerCase().includes(q));
    }, [documents, caseId, searches.docs]);

    const caseMedia = useMemo(() => {
        const base = (multimedia || []).filter(m => Number(m.suit_case_id) === Number(caseId) && !m.deleted_at);
        const filesBase = (files || []).filter(f => Number(f.suit_case_id) === Number(caseId) && !f.deleted_at);
        const all = [...base, ...filesBase];
        if (!searches.files) return all;
        const q = searches.files.toLowerCase();
        return all.filter(f => (f.filename || '').toLowerCase().includes(q));
    }, [multimedia, files, caseId, searches.files]);

    const partesFiltradas = useMemo(() => {
        const base = partesCaso || [];
        if (!searches.people) return base;
        const q = searches.people.toLowerCase();
        return base.filter(p => (p.nombre || p.title || '').toLowerCase().includes(q) || (p.tipo_parte || '').toLowerCase().includes(q));
    }, [partesCaso, searches.people]);

    const eventosFiltrados = useMemo(() => {
        if (!searches.events) return events;
        const q = searches.events.toLowerCase();
        return events.filter(e => (e.title || '').toLowerCase().includes(q));
    }, [events, searches.events]);

    const isLoading = docsLoading || mediaLoading || filesLoading || partesLoading || eventsLoading;

    if (isLoading && !caseDocs.length && !events.length) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div>
            {/* ── Documentos del caso ── */}
            <CategorySection
                icon={FileText}
                title="Documentos"
                count={caseDocs.length}
                isOpen={openCategories.docs}
                onToggle={() => toggleCategory('docs')}
                searchQuery={searches.docs}
                onSearchChange={setSearch('docs')}
            >
                {caseDocs.length > 0 ? (
                    caseDocs.map(doc => (
                        <div key={doc.id}>
                            <div
                                onClick={() => setSelectedFor('docs')(selected.docs?.id === doc.id ? null : doc)}
                                className={`mx-2 group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selected.docs?.id === doc.id ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-(--bg-card-hover)'}`}
                            >
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-medium text-(--text-primary) truncate">{doc.name || doc.title}</span>
                                    <span className="text-[10px] text-(--text-tertiary)">{dayjs(doc.updated_at).format('DD MMM')}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onPreviewDocument(doc); }}
                                    className="p-1.5 opacity-0 group-hover:opacity-100 rounded-md hover:bg-blue-100 text-blue-600 transition-all dark:hover:bg-blue-900/30"
                                    title="Previsualizar"
                                >
                                    <Eye size={14} />
                                </button>
                            </div>
                            {/* Detalle inline justo debajo del ítem seleccionado */}
                            {selected.docs?.id === doc.id && (
                                <InlineDetail item={doc} type="Documento" onPreviewDocument={onPreviewDocument} />
                            )}
                        </div>
                    ))
                ) : (
                    <p className="p-4 text-center text-[10px] text-(--text-tertiary)">No hay documentos.</p>
                )}
            </CategorySection>

            {/* ── Personas del caso ── */}
            <CategorySection
                icon={Users}
                title="Personas"
                count={partesCaso?.length || 0}
                isOpen={openCategories.people}
                onToggle={() => toggleCategory('people')}
                searchQuery={searches.people}
                onSearchChange={setSearch('people')}
            >
                {partesFiltradas.length > 0 ? (
                    partesFiltradas.map(p => (
                        <div key={p.id}>
                            <div
                                onClick={() => setSelectedFor('people')(selected.people?.id === p.id ? null : p)}
                                className={`mx-2 flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selected.people?.id === p.id ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-(--bg-card-hover)'}`}
                            >
                                <User className="h-3 w-3 text-(--text-tertiary) shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-medium text-(--text-primary) truncate">{p.nombre || p.title || 'Parte s/n'}</span>
                                    <span className="text-[10px] text-(--text-tertiary)">{p.tipo_parte || 'Parte'}</span>
                                </div>
                            </div>
                            {selected.people?.id === p.id && (
                                <InlineDetail item={p} type="Persona" />
                            )}
                        </div>
                    ))
                ) : (
                    <p className="p-4 text-center text-[10px] text-(--text-tertiary)">No hay partes vinculadas.</p>
                )}
            </CategorySection>

            {/* ── Multimedia y Archivos ── */}
            <CategorySection
                icon={FolderOpen}
                title="Multimedia y Archivos"
                count={caseMedia.length}
                isOpen={openCategories.files}
                onToggle={() => toggleCategory('files')}
                searchQuery={searches.files}
                onSearchChange={setSearch('files')}
            >
                {caseMedia.length > 0 ? (
                    caseMedia.map(item => (
                        <div key={item.id}>
                            <div
                                onClick={() => setSelectedFor('files')(selected.files?.id === item.id ? null : item)}
                                className={`mx-2 group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selected.files?.id === item.id ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-(--bg-card-hover)'}`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <FolderOpen className="h-3 w-3 text-(--text-tertiary) shrink-0" />
                                    <span className="text-xs font-medium text-(--text-primary) truncate">{item.filename}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onPreviewMedia(item); }}
                                    className="p-1.5 opacity-0 group-hover:opacity-100 rounded-md hover:bg-blue-100 text-blue-600 transition-all dark:hover:bg-blue-900/30"
                                    title="Ver"
                                >
                                    <Eye size={14} />
                                </button>
                            </div>
                            {selected.files?.id === item.id && (
                                <InlineDetail item={item} type="Archivo" />
                            )}
                        </div>
                    ))
                ) : (
                    <p className="p-4 text-center text-[10px] text-(--text-tertiary)">No hay archivos.</p>
                )}
            </CategorySection>

            {/* ── Eventos del caso ── */}
            <CategorySection
                icon={Calendar}
                title="Eventos del caso"
                count={events.length}
                isOpen={openCategories.events}
                onToggle={() => toggleCategory('events')}
                searchQuery={searches.events}
                onSearchChange={setSearch('events')}
            >
                {eventosFiltrados.length > 0 ? (
                    eventosFiltrados.map(ev => (
                        <div key={ev.id}>
                            <div
                                onClick={() => setSelectedFor('events')(selected.events?.id === ev.id ? null : ev)}
                                className={`mx-2 flex flex-col p-2 rounded-lg cursor-pointer transition-colors ${selected.events?.id === ev.id ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-(--bg-card-hover)'}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-(--text-primary) truncate">{ev.title}</span>
                                    <span className="text-[9px] font-bold uppercase text-blue-600 bg-blue-50 px-1 rounded dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
                                        {dayjs(ev.date).format('DD MMM')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-(--text-tertiary)">
                                    <Clock size={10} />
                                    <span>{ev.start_time || 'Sin hora'}</span>
                                </div>
                            </div>
                            {selected.events?.id === ev.id && (
                                <InlineDetail item={ev} type="Evento" />
                            )}
                        </div>
                    ))
                ) : (
                    <p className="p-4 text-center text-[10px] text-(--text-tertiary)">No hay eventos.</p>
                )}
            </CategorySection>
        </div>
    );
};

export default CaseTools;
