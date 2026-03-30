import { useState, useMemo, useEffect, useRef } from 'react';
import { Landmark, Scale, Plus, Pencil, Trash2, SearchX, ChevronRight, BookOpen } from 'lucide-react';
import { useJurisdicciones } from '../../context/JurisdiccionesContext.jsx';
import { useCompetencias } from '../../context/CompetenciasContext.jsx';
import { useRadicaciones } from '../../context/RadicacionesContext.jsx';
import { useDependenciasJudiciales } from '../../context/DependenciasJudicialesContext.jsx';
import { createDependenciaJudicial, updateDependenciaJudicial, deleteDependenciaJudicial } from '../../services/dependenciaJudicialService.js';
import { createJurisdiccion, updateJurisdiccion, deleteJurisdiccion } from '../../services/jurisdiccionService.js';
import { Button } from '../ui/Button.jsx';
import { SearchBar } from '../ui/SearchBar.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { getApiErrorMessage, translateTechnicalErrorMessage } from '../../utils/apiErrorMessage.js';
import JurisdiccionModal from './modals/JurisdiccionModal.jsx';
import DependenciaJudicialModal from './modals/DependenciaJudicialModal.jsx';

/**
 * Sección especializada para Jurisdicciones.
 * Diseño en dos paneles (Split View):
 * - Izquierda: Lista de Jurisdicciones.
 * - Derecha: Competencias Asociadas (Dependencias Judiciales) de la jurisdicción elegida.
 */
export default function JurisdiccionesCatalogSection({ isAdmin, canEdit }) {
    const { data: jurisdicciones, refreshJurisdicciones, syncing: jurisdiccionesLoading } = useJurisdicciones();
    const { data: todasCompetencias, refreshCompetencias } = useCompetencias();
    const { data: todasRadicaciones, refreshRadicaciones } = useRadicaciones();
    const { 
        data: rawDependencias, 
        refreshDependenciasJudiciales, 
        syncing: dependenciasLoading 
    } = useDependenciasJudiciales();

    const [userSelectedJurisdiccionId, setUserSelectedJurisdiccionId] = useState(null);
    const [query, setQuery] = useState('');

    // Modales
    const [isJurisdiccionModalOpen, setIsJurisdiccionModalOpen] = useState(false);
    const [isDependenciaModalOpen, setIsDependenciaModalOpen] = useState(false);
    const [editingJurisdiccion, setEditingJurisdiccion] = useState(null);
    const [editingDependencia, setEditingDependencia] = useState(null);

    // Cálculos de altura dinámica para la lista
    const listContainerRef = useRef(null);
    const rightListContainerRef = useRef(null);
    const [maxListHeight, setMaxListHeight] = useState(null);
    const [maxRightHeight, setMaxRightHeight] = useState(null);
    const ITEM_ESTIMATED_HEIGHT = 60; // 56px height + gap

    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    // Sincronizar con la API al entrar al tab
    useEffect(() => {
        refreshJurisdicciones();
        refreshCompetencias();
        refreshRadicaciones();
        refreshDependenciasJudiciales();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    // Cálculo dinámico de altura disponible para los listados
    useEffect(() => {
        const calculateMaxHeight = () => {
            // Panel Izquierdo
            if (listContainerRef.current) {
                const rect = listContainerRef.current.getBoundingClientRect();
                const footerReservedSpace = 100;
                const availableHeight = (window.innerHeight - rect.top - footerReservedSpace) * 0.9;
                setMaxListHeight(Math.max(300, availableHeight));
            }

            // Panel Derecho
            if (rightListContainerRef.current) {
                const rect = rightListContainerRef.current.getBoundingClientRect();
                const bottomReservedSpace = 40;
                const availableHeight = (window.innerHeight - rect.top - bottomReservedSpace) * 0.9;
                setMaxRightHeight(Math.max(300, availableHeight));
            }
        };

        calculateMaxHeight();
        window.addEventListener('resize', calculateMaxHeight);
        
        // Pequeño timeout para asegurar que el DOM se asentó post-animaciones de entrada
        const timer = setTimeout(calculateMaxHeight, 500);
        
        return () => {
            window.removeEventListener('resize', calculateMaxHeight);
            clearTimeout(timer);
        };
    }, []);


    // Filtrar jurisdicciones por búsqueda
    const filteredJurisdicciones = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return jurisdicciones;
        return jurisdicciones.filter(j => j.nombre.toLowerCase().includes(q));
    }, [jurisdicciones, query]);

    // Derivar el ID activo durante el render
    const activeJurisdiccionId = useMemo(() => {
        const selectedIsValid = userSelectedJurisdiccionId && filteredJurisdicciones.some(j => j.id === userSelectedJurisdiccionId);
        if (selectedIsValid) {
            return userSelectedJurisdiccionId;
        }
        if (filteredJurisdicciones.length > 0) {
            return filteredJurisdicciones[0].id;
        }
        return null;
    }, [filteredJurisdicciones, userSelectedJurisdiccionId]);

    // Enriquecer dependencias con datos de competencia y radicación
    const dependencias = useMemo(() => {
        if (!activeJurisdiccionId || !rawDependencias || !todasCompetencias) {
            return [];
        }
        return rawDependencias
            .filter(dep => dep.jurisdiccion_id === activeJurisdiccionId)
            .map(dep => ({
                ...dep,
                competencia: todasCompetencias.find(comp => comp.id === dep.competencia_id),
                radicacion: todasRadicaciones?.find(r => r.id === dep.radicacion_id)
            }));
    }, [activeJurisdiccionId, rawDependencias, todasCompetencias, todasRadicaciones]);
    
    const selectedJurisdiccion = useMemo(() => 
        jurisdicciones.find(j => j.id === activeJurisdiccionId)
    , [jurisdicciones, activeJurisdiccionId]);

    // --- Handlers Jurisdicciones ---

    const handleSaveJurisdiccion = async (data) => {
        try {
            let result;
            if (editingJurisdiccion) {
                result = await updateJurisdiccion(editingJurisdiccion.id, data);
            } else {
                result = await createJurisdiccion(data);
            }

            if (result.ok) {
                await refreshJurisdicciones();
                setIsJurisdiccionModalOpen(false);
                setEditingJurisdiccion(null);
                showAppToast({
                    title: editingJurisdiccion ? 'Jurisdicción actualizada' : 'Jurisdicción creada',
                    variant: 'success'
                });
            } else {
                showAppToast({
                    title: 'Error',
                    description: getApiErrorMessage(result, 'No se pudo completar la operación.'),
                    variant: 'danger'
                });
            }
        } catch (error) {
            showAppToast({
                title: 'Error',
                description: translateTechnicalErrorMessage(error.message),
                variant: 'danger'
            });
        }
    };

    const handleDeleteJurisdiccion = (jurisdiccion) => {
        openDialog({
            title: '¿Eliminar Jurisdicción?',
            desc: `Se eliminará "${jurisdiccion.nombre}" y sus asociaciones. Esta acción no se puede deshacer.`,
            type: 'danger',
            confirmText: 'Eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await deleteJurisdiccion(jurisdiccion.id);
                    if (result.ok) {
                        await refreshJurisdicciones();
                        await refreshDependenciasJudiciales(); 
                        if (activeJurisdiccionId === jurisdiccion.id) {
                            setUserSelectedJurisdiccionId(null);
                        }
                        closeDialog();
                        showAppToast({ title: 'Jurisdicción eliminada', variant: 'success' });
                    } else {
                        setDialogLoading(false);
                        closeDialog();
                        showAppToast({ title: 'Error al eliminar', description: getApiErrorMessage(result, 'La API rechazó la solicitud.'), variant: 'danger' });
                    }
                } catch (error) {
                    setDialogLoading(false);
                    closeDialog();
                    showAppToast({ title: 'Error al eliminar', description: translateTechnicalErrorMessage(error.message), variant: 'danger' });
                }
            }
        });
    };

    // --- Handlers Dependencias (Competencias Asociadas) ---

    const handleSaveDependencia = async (data) => {
        try {
            let result;
            if (editingDependencia) {
                result = await updateDependenciaJudicial(editingDependencia.id, data);
            } else {
                result = await createDependenciaJudicial(data);
            }

            if (result.ok) {
                await refreshDependenciasJudiciales();
                setIsDependenciaModalOpen(false);
                setEditingDependencia(null);
                showAppToast({
                    title: editingDependencia ? 'Asociación actualizada' : 'Competencia asociada correctamente',
                    variant: 'success'
                });
            } else {
                showAppToast({
                    title: 'Error',
                    description: getApiErrorMessage(result, 'No se pudo guardar la asociación.'),
                    variant: 'danger'
                });
            }
        } catch (error) {
            showAppToast({
                title: 'Error',
                description: translateTechnicalErrorMessage(error.message),
                variant: 'danger'
            });
        }
    };

    const handleDeleteDependencia = (dep) => {
        openDialog({
            title: '¿Eliminar Competencia Asociada?',
            desc: `Se eliminará el juzgado "${dep.nombre_juzgado}".`,
            type: 'danger',
            confirmText: 'Eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await deleteDependenciaJudicial(dep.id);
                    if (result.ok) {
                        await refreshDependenciasJudiciales();
                        closeDialog();
                        showAppToast({ title: 'Asociación eliminada', variant: 'success' });
                    } else {
                        setDialogLoading(false);
                        closeDialog();
                        showAppToast({ title: 'Error al eliminar', description: getApiErrorMessage(result, 'La API rechazó la solicitud.'), variant: 'danger' });
                    }
                } catch (error) {
                    setDialogLoading(false);
                    closeDialog();
                    showAppToast({ title: 'Error al eliminar', description: translateTechnicalErrorMessage(error.message), variant: 'danger' });
                }
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header de la sección */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-(--border-subtle) bg-(--bg-card-hover) shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold text-(--text-primary)">Jurisdicciones</h3>
                        {!canEdit && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                <BookOpen size={12} />
                                Solo lectura
                            </div>
                        )}
                        {canEdit && !isAdmin && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                <Pencil size={12} />
                                Edición habilitada
                            </div>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-(--text-secondary)">
                        Gestiona las jurisdicciones y asocia competencias (juzgados) a cada una.
                    </p>
                </div>
            </div>

            {/* Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
                
                {/* Panel Izquierdo: Lista de Jurisdicciones */}
                <div className="lg:col-span-4 flex flex-col gap-4 rounded-2xl border border-(--border-default) bg-(--bg-card) p-4 shadow-sm">
                    <SearchBar 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)} 
                        placeholder="Buscar jurisdicción..." 
                        containerClassName="flex-none"
                    />

                    <div 
                        ref={listContainerRef}
                        className="flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar"
                        style={maxListHeight ? { maxHeight: `${maxListHeight}px` } : { maxHeight: '300px' }}
                    >
                        {jurisdiccionesLoading && jurisdicciones.length === 0 ? (
                            <div className="py-10 text-center text-sm text-(--text-secondary)">Cargando...</div>
                        ) : filteredJurisdicciones.length === 0 ? (
                            <div className="py-10 text-center">
                                <SearchX className="mx-auto h-8 w-8 text-(--text-tertiary)" />
                                <p className="mt-2 text-sm text-(--text-secondary)">No hay resultados</p>
                            </div>
                        ) : (
                            filteredJurisdicciones.map((j) => {
                                    const isActive = activeJurisdiccionId === j.id;
                                    const isFederalJurisdiccion = j.nombre?.toLowerCase().includes('federal');
                                    return (
                                        <div 
                                            key={j.id}
                                            onClick={() => setUserSelectedJurisdiccionId(j.id)}
                                            className={`
                                                group flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all
                                                ${isActive 
                                                    ? 'bg-blue-500/5 border-blue-500/30 text-blue-700 shadow-sm' 
                                                    : 'border-transparent hover:bg-(--bg-card-hover) text-(--text-primary)'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-lg ${
                                                    isActive 
                                                        ? 'bg-blue-600 text-white' 
                                                        : isFederalJurisdiccion
                                                            ? 'bg-blue-100 text-blue-600'
                                                            : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    <Landmark className="h-4 w-4" />
                                                </div>
                                                <span className="font-semibold truncate">{j.nombre}</span>
                                            </div>
                                        
                                        <div className="flex items-center gap-1">
                                            {isActive && (canEdit || isAdmin) && (
                                                <div className="flex items-center gap-1 mr-2 animate-in fade-in slide-in-from-right-2">
                                                    {canEdit && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setEditingJurisdiccion(j); setIsJurisdiccionModalOpen(true); }}
                                                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-600 transition-colors"
                                                            title="Editar jurisdicción"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                    )}
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteJurisdiccion(j); }}
                                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                                                            title="Eliminar jurisdicción"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? 'text-blue-500 translate-x-0.5' : 'text-(--text-tertiary)'}`} />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Botón de creación al pie de la lista */}
                    {canEdit && (
                        <div className="mt-auto pt-2 border-t border-(--border-subtle)">
                            <button
                                onClick={() => { setEditingJurisdiccion(null); setIsJurisdiccionModalOpen(true); }}
                                className="flex w-full items-center gap-3 px-3 py-3 text-blue-600 transition-all hover:bg-blue-500/5 rounded-xl group"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 transition-colors group-hover:bg-blue-500/20">
                                    <Plus className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm text-blue-600">Nueva Jurisdicción</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Panel Derecho: Competencias Asociadas */}
                <div className="lg:col-span-8 flex flex-col gap-4 rounded-2xl border border-(--border-default) bg-(--bg-card) p-6 shadow-sm">
                    {selectedJurisdiccion ? (
                        <>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                        <Scale className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg text-(--text-primary)">
                                            Competencias en {selectedJurisdiccion.nombre}
                                        </h4>
                                        <p className="text-xs text-(--text-secondary) uppercase tracking-wider font-semibold">
                                            Juzgados y Tribunales
                                        </p>
                                    </div>
                                </div>

                                {canEdit && (
                                    <Button 
                                        size="sm" 
                                        icon={Plus}
                                        onClick={() => { setEditingDependencia(null); setIsDependenciaModalOpen(true); }}
                                    >
                                        Asociar Competencia
                                    </Button>
                                )}
                            </div>

                            <div 
                                ref={rightListContainerRef}
                                className="flex-1 overflow-y-auto pr-1 custom-scrollbar"
                                style={maxRightHeight ? { maxHeight: `${maxRightHeight}px` } : {}}
                            >
                                {dependenciasLoading ? (
                                    <div className="py-20 text-center text-(--text-secondary)">Buscando asociaciones...</div>
                                ) : dependencias.length === 0 ? (
                                    <EmptyState 
                                        icon={BookOpen}
                                        title="Sin competencias asociadas"
                                        description={`Aún no se han configurado juzgados para la jurisdicción ${selectedJurisdiccion.nombre}.`}
                                        className="py-12"
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {dependencias.map((dep) => (
                                            <div 
                                                key={dep.id}
                                                className="p-4 rounded-xl border border-(--border-subtle) bg-(--bg-card-hover)/30 flex items-start justify-between hover:border-blue-500/20 transition-all group"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold uppercase py-0.5 px-1.5 rounded bg-blue-500/10 text-blue-600 tracking-wider">
                                                            {dep.competencia?.fuero || 'Sin Fuero'}
                                                        </span>
                                                        {dep.radicacion && (
                                                            <span className={`text-[10px] font-bold uppercase py-0.5 px-1.5 rounded tracking-wider ${
                                                                dep.radicacion.name?.toLowerCase().includes('federal')
                                                                    ? 'bg-blue-500/10 text-blue-600'
                                                                    : dep.radicacion.name?.toLowerCase().includes('provincial')
                                                                        ? 'bg-emerald-500/10 text-emerald-600'
                                                                        : 'bg-amber-500/10 text-amber-600'
                                                            }`}>
                                                                {dep.radicacion.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h5 className="font-bold text-(--text-primary) mb-1 truncate">
                                                        {dep.nombre_juzgado}
                                                    </h5>
                                                    <p className="text-xs text-(--text-secondary)">
                                                        ID: {dep.id} — {selectedJurisdiccion.nombre}
                                                    </p>
                                                </div>

                                                {canEdit && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => { setEditingDependencia(dep); setIsDependenciaModalOpen(true); }}
                                                            className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-600 transition-colors"
                                                            title="Editar juzgado"
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        {isAdmin && (
                                                            <button 
                                                                onClick={() => handleDeleteDependencia(dep)}
                                                                className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                                                                title="Eliminar asociación"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center text-center py-10">
                            <div className="h-16 w-16 mb-4 rounded-full bg-slate-50 flex items-center justify-center">
                                <Landmark className="h-8 w-8 text-slate-300" />
                            </div>
                            <h4 className="text-lg font-semibold text-(--text-secondary)">Selecciona una jurisdicción</h4>
                            <p className="text-sm text-(--text-tertiary) max-w-xs">
                                Elige una jurisdicción del panel izquierdo para ver los juzgados y competencias asociadas.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modales */}
            <JurisdiccionModal
                open={isJurisdiccionModalOpen}
                onClose={() => {
                    setIsJurisdiccionModalOpen(false);
                    setEditingJurisdiccion(null);
                }}
                onSave={handleSaveJurisdiccion}
                initialData={editingJurisdiccion}
            />

            <DependenciaJudicialModal
                open={isDependenciaModalOpen}
                onClose={() => setIsDependenciaModalOpen(false)}
                onSave={handleSaveDependencia}
                jurisdicciones={jurisdicciones}
                competencias={todasCompetencias}
                initialData={editingDependencia}
                defaultJurisdiccionId={activeJurisdiccionId}
            />

            <ConfirmDialog {...dialogProps} />
        </div>
    );
}
