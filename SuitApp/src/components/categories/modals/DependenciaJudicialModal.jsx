import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/Select.jsx';
import { Plus, Landmark, Scale } from 'lucide-react';
import { useRadicaciones } from '../../../context/RadicacionesContext.jsx';
import { showAppToast } from '../../ui/show-app-toast.jsx';

/**
 * Modal para asociar una competencia (crear una Dependencia Judicial).
 */
export default function DependenciaJudicialModal({ 
    open, 
    onClose, 
    onSave, 
    jurisdicciones = [], 
    competencias = [], 
    initialData = null,
    defaultJurisdiccionId = null,
    defaultRadicacionId = null
}) {
    const { data: radicaciones } = useRadicaciones();
    
    const [nombre, setNombre] = useState(initialData?.nombre_juzgado || '');
    const [jurisdiccionId, setJurisdiccionId] = useState(initialData?.jurisdiccion_id || defaultJurisdiccionId || '');
    const [competenciaId, setCompetenciaId] = useState(initialData?.competencia_id || '');
    const [radicacionId, setRadicacionId] = useState(initialData?.radicacion_id || defaultRadicacionId || '');
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    const currentJurisdiccion = jurisdicciones.find(j => String(j.id) === String(jurisdiccionId));
    const isFederal = currentJurisdiccion?.nombre?.toLowerCase().includes('federal');
    const hasSelectedCompetencia = competencias.some((competencia) => String(competencia.id) === String(competenciaId));
    const competenciaSelectValue = competenciaId && hasSelectedCompetencia ? String(competenciaId) : undefined;

    // Sincronizar estado cuando cambia initialData o defaultJurisdiccionId
    useEffect(() => {
        if (open) {
            setNombre(initialData?.nombre_juzgado || '');
            setJurisdiccionId(initialData?.jurisdiccion_id || defaultJurisdiccionId || '');
            setCompetenciaId(initialData?.competencia_id || '');
            setRadicacionId(initialData?.radicacion_id || defaultRadicacionId || '');
        }
    }, [open, initialData, defaultJurisdiccionId, defaultRadicacionId]);

    // Lógica para Radicación Federal automática
    useEffect(() => {
        if (isFederal && radicaciones.length > 0) {
            const federalRad = radicaciones.find(r => r.name?.toLowerCase().includes('federal'));
            if (federalRad) {
                setRadicacionId(String(federalRad.id));
            }
        }
    }, [isFederal, radicaciones]);

    useEffect(() => {
        if (!open || !competenciaId || competencias.length === 0 || hasSelectedCompetencia) return;
        setCompetenciaId('');
    }, [competenciaId, competencias, hasSelectedCompetencia, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errors = {};
        if (!nombre.trim()) errors.nombre = 'El nombre del juzgado es obligatorio.';
        if (!competenciaId) errors.competenciaId = 'Seleccioná una competencia / fuero.';
        if (!radicacionId) errors.radicacionId = 'Seleccioná una radicación.';
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            showAppToast({ title: 'Campos obligatorios', description: 'Completá todos los campos requeridos.', variant: 'danger' });
            return;
        }

        setSaving(true);
        try {
            await onSave({
                nombre_juzgado: nombre.trim(),
                jurisdiccion_id: Number(jurisdiccionId),
                competencia_id: Number(competenciaId),
                radicacion_id: Number(radicacionId),
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={initialData ? 'Editar Competencia Asociada' : 'Asociar Competencia'}
            subtitle="Configura un nuevo juzgado combinando una jurisdicción y una competencia."
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 pt-2">
                {/* Jurisdicción (Informativo, no editable ya que se asume la actual) */}
                <div className="p-3 rounded-lg bg-(--bg-card-hover)/50 border border-(--border-subtle) flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                        <Landmark size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-(--text-tertiary) tracking-wider">Jurisdicción Seleccionada</p>
                        <p className="text-sm font-semibold text-(--text-primary)">{currentJurisdiccion?.nombre || 'Sin jurisdicción'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    {/* Nombre del Juzgado */}
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-(--text-secondary)">
                            Nombre del Juzgado <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => { setNombre(e.target.value); if (fieldErrors.nombre) setFieldErrors(p => ({ ...p, nombre: undefined })); }}
                            placeholder="Ej: Civil Nro 1"
                            className={`w-full h-11 rounded-xl border bg-(--bg-input) px-4 text-sm text-(--text-primary) shadow-sm focus:ring-2 focus:outline-none transition-all ${
                                fieldErrors.nombre
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
                                    : 'border-(--border-default) focus:border-blue-500 focus:ring-blue-500/10'
                            }`}
                            required
                        />
                        {fieldErrors.nombre && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.nombre}</p>}
                    </div>

                    {/* Competencia / Fuero */}
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-(--text-secondary)">
                            Competencia / Fuero <span className="text-red-500">*</span>
                        </label>
                        <Select 
                            value={competenciaSelectValue} 
                            onValueChange={(val) => { setCompetenciaId(val); if (fieldErrors.competenciaId) setFieldErrors(p => ({ ...p, competenciaId: undefined })); }}
                        >
                            <SelectTrigger aria-label="Selecciona el fuero" className={fieldErrors.competenciaId ? 'border-red-500 focus-visible:ring-red-500' : ''}>
                                <div className="flex items-center gap-2">
                                    <Scale size={16} className="text-(--text-tertiary)" />
                                    <SelectValue placeholder="Selecciona el fuero" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {competencias.map(c => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                        {c.fuero}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldErrors.competenciaId && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.competenciaId}</p>}
                    </div>

                    {/* Radicación */}
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-(--text-secondary)">
                            Radicación <span className="text-red-500">*</span>
                        </label>
                        <Select 
                            value={radicacionId ? String(radicacionId) : undefined} 
                            onValueChange={(val) => { setRadicacionId(val); if (fieldErrors.radicacionId) setFieldErrors(p => ({ ...p, radicacionId: undefined })); }}
                            disabled={isFederal}
                        >
                            <SelectTrigger aria-label="Selecciona la radicación" className={fieldErrors.radicacionId ? 'border-red-500 focus-visible:ring-red-500' : ''}>
                                <div className="flex items-center gap-2">
                                    <Landmark size={16} className="text-(--text-tertiary)" />
                                    <SelectValue placeholder="Selecciona la radicación" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {radicaciones
                                    .filter(r => {
                                        const isRadFederal = r.name?.toLowerCase().includes('federal');
                                        return isFederal ? isRadFederal : !isRadFederal;
                                    })
                                    .map(r => (
                                        <SelectItem key={r.id} value={String(r.id)}>
                                            {r.name}
                                        </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isFederal && (
                            <p className="mt-1.5 text-[11px] text-blue-600 font-medium">
                                En Jurisdicciones Federales, la radicación es automáticamente Federal.
                            </p>
                        )}
                        {fieldErrors.radicacionId && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.radicacionId}</p>}
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button
                        type="submit"
                        icon={Plus}
                        isLoading={saving}
                        className="w-full h-11 justify-center shadow-lg shadow-blue-500/10"
                        disabled={!nombre.trim() || !jurisdiccionId || !competenciaId || !radicacionId}
                    >
                        {initialData ? 'Guardar Cambios' : 'Asociar Competencia'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
