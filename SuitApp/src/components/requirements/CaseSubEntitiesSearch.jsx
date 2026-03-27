import { useMemo } from 'react';
import { useCaseTypes } from '../../context/CaseTypesContext';
import { useRadicaciones } from '../../context/RadicacionesContext';
import { useJurisdicciones } from '../../context/JurisdiccionesContext';
import { useCompetencias } from '../../context/CompetenciasContext';
import { useDependenciasJudiciales } from '../../context/DependenciasJudicialesContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Label } from '../ui/Label';

/** show: objeto con flags booleanos que controlan qué selectores renderizar. Default: todos visibles. */
export function CaseSubEntitiesSearch({ values, onChange, onFocus, onBlur, show = { caseType: true, radicacion: true, jurisdiccion: true, competencia: true, dependencia: true } }) {
    const { data: caseTypes = [], initialized: caseTypesInitialized } = useCaseTypes();
    const { data: radicaciones = [], initialized: radicacionesInitialized } = useRadicaciones();
    const { data: jurisdicciones = [], initialized: jurisdiccionesInitialized } = useJurisdicciones();
    const { data: competencias = [], initialized: competenciasInitialized } = useCompetencias();
    const { data: dependenciasJudiciales = [], initialized: dependenciasInitialized } = useDependenciasJudiciales();

    const caseTypeOptions = useMemo(() => {
        if (!caseTypesInitialized || !Array.isArray(caseTypes)) return [];
        return caseTypes.map((ct) => ({ value: ct.id, label: ct.name }));
    }, [caseTypes, caseTypesInitialized]);

    const radicacionOptions = useMemo(() => {
        if (!radicacionesInitialized || !Array.isArray(radicaciones)) return [];
        return radicaciones.map((r) => ({ value: r.id, label: r.name }));
    }, [radicaciones, radicacionesInitialized]);

    const jurisdiccionOptions = useMemo(() => {
        if (!jurisdiccionesInitialized || !Array.isArray(jurisdicciones)) return [];
        return jurisdicciones.map((j) => ({ value: j.id, label: j.nombre }));
    }, [jurisdicciones, jurisdiccionesInitialized]);

    const competenciaOptions = useMemo(() => {
        if (!competenciasInitialized || !Array.isArray(competencias)) return [];
        return competencias.map((c) => ({ value: c.id, label: c.fuero }));
    }, [competencias, competenciasInitialized]);

    const dependenciaOptions = useMemo(() => {
        if (!dependenciasInitialized || !Array.isArray(dependenciasJudiciales)) return [];
        return dependenciasJudiciales.map((d) => ({ value: d.id, label: d.nombre_juzgado }));
    }, [dependenciasJudiciales, dependenciasInitialized]);


    return (
        <div className="space-y-4">
            {show.caseType && (
                <div>
                    <Label>Fuero</Label>
                    <Select value={values.caseType} onValueChange={(val) => {
                        const opt = caseTypeOptions.find(o => o.value === val);
                        onChange('caseType', val, opt?.label);
                    }}>
                        <SelectTrigger onFocus={() => onFocus('caseType')} onBlur={onBlur}>
                            <SelectValue placeholder="Seleccionar fuero..." />
                        </SelectTrigger>
                        <SelectContent>
                            {caseTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {show.radicacion && (
                <div>
                    <Label>Radicación</Label>
                    <Select value={values.radicacion} onValueChange={(val) => {
                        const opt = radicacionOptions.find(o => o.value === val);
                        onChange('radicacion', val, opt?.label);
                    }}>
                        <SelectTrigger onFocus={() => onFocus('radicacion')} onBlur={onBlur}>
                            <SelectValue placeholder="Seleccionar radicación..." />
                        </SelectTrigger>
                        <SelectContent>
                            {radicacionOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {show.jurisdiccion && (
                <div>
                    <Label>Jurisdicción</Label>
                    <Select value={values.jurisdiccion} onValueChange={(val) => {
                        const opt = jurisdiccionOptions.find(o => o.value === val);
                        onChange('jurisdiccion', val, opt?.label);
                    }}>
                        <SelectTrigger onFocus={() => onFocus('jurisdiccion')} onBlur={onBlur}>
                            <SelectValue placeholder="Seleccionar jurisdicción..." />
                        </SelectTrigger>
                        <SelectContent>
                            {jurisdiccionOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {show.competencia && (
                <div>
                    <Label>Competencia</Label>
                    <Select value={values.competencia} onValueChange={(val) => {
                        const opt = competenciaOptions.find(o => o.value === val);
                        onChange('competencia', val, opt?.label);
                    }}>
                        <SelectTrigger onFocus={() => onFocus('competencia')} onBlur={onBlur}>
                            <SelectValue placeholder="Seleccionar competencia..." />
                        </SelectTrigger>
                        <SelectContent>
                            {competenciaOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {show.dependencia && (
                <div>
                    <Label>Juzgado (Dependencia)</Label>
                    <Select value={values.dependencia} onValueChange={(val) => {
                        const opt = dependenciaOptions.find(o => o.value === val);
                        onChange('dependencia', val, opt?.label);
                    }}>
                        <SelectTrigger onFocus={() => onFocus('dependencia')} onBlur={onBlur}>
                            <SelectValue placeholder="Seleccionar juzgado..." />
                        </SelectTrigger>
                        <SelectContent>
                            {dependenciaOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}
