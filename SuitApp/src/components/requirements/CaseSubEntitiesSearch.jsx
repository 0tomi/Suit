import { useMemo } from 'react';
import { useCaseTypes } from '../../context/CaseTypesContext';
import { useRadicaciones } from '../../context/RadicacionesContext';
import { useJurisdicciones } from '../../context/JurisdiccionesContext';
import { useCompetencias } from '../../context/CompetenciasContext';
import { useDependenciasJudiciales } from '../../context/DependenciasJudicialesContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Label } from '../ui/Label';

const DEFAULT_SHOW = {
    caseType: true,
    radicacion: true,
    jurisdiccion: true,
    competencia: true,
    dependencia: true,
};
const EMPTY_OPTIONS = {};
const EMPTY_MESSAGES = {};

function toOption(value, label) {
    if (value == null || !label) return null;
    return { value: String(value), label };
}

function getCaseTypeLabel(caseType) {
    return caseType?.name || caseType?.title || caseType?.nombre || '';
}

function getRadicacionLabel(radicacion) {
    return radicacion?.tipo || radicacion?.name || radicacion?.nombre_lugar || '';
}

function getJurisdiccionLabel(jurisdiccion) {
    return jurisdiccion?.nombre || jurisdiccion?.name || '';
}

function getCompetenciaLabel(competencia) {
    return competencia?.fuero || competencia?.name || competencia?.nombre || '';
}

function getDependenciaLabel(dependencia) {
    return dependencia?.nombre_juzgado || dependencia?.nombre || dependencia?.title || '';
}

function normalizeProvidedOptions(fallbackOptions, providedOptions) {
    if (!Array.isArray(providedOptions)) return fallbackOptions;

    const seen = new Set();

    return providedOptions.reduce((items, option) => {
        const value = option?.value != null ? String(option.value) : '';
        const label = option?.label || '';
        if (!value || !label || seen.has(value)) return items;
        seen.add(value);
        items.push({ value, label });
        return items;
    }, []);
}

function buildNoOptionsPlaceholder(emptyMessage) {
    return (
        <div className="px-2 py-2 text-sm text-(--text-secondary)">
            {emptyMessage || 'No hay opciones disponibles.'}
        </div>
    );
}

/** show: objeto con flags booleanos que controlan qué selectores renderizar. Default: todos visibles. */
export function CaseSubEntitiesSearch({
    values,
    onChange,
    onFocus,
    onBlur,
    show = DEFAULT_SHOW,
    options = EMPTY_OPTIONS,
    emptyMessages = EMPTY_MESSAGES,
}) {
    const { data: caseTypes = [], initialized: caseTypesInitialized } = useCaseTypes();
    const { data: radicaciones = [], initialized: radicacionesInitialized } = useRadicaciones();
    const { data: jurisdicciones = [], initialized: jurisdiccionesInitialized } = useJurisdicciones();
    const { data: competencias = [], initialized: competenciasInitialized } = useCompetencias();
    const { data: dependenciasJudiciales = [], initialized: dependenciasInitialized } = useDependenciasJudiciales();

    const caseTypeOptions = useMemo(() => {
        if (!caseTypesInitialized || !Array.isArray(caseTypes)) return [];
        return caseTypes
            .map((caseType) => toOption(caseType.id, getCaseTypeLabel(caseType)))
            .filter(Boolean);
    }, [caseTypes, caseTypesInitialized]);

    const radicacionOptions = useMemo(() => {
        if (!radicacionesInitialized || !Array.isArray(radicaciones)) return [];
        return radicaciones
            .map((radicacion) => toOption(radicacion.id, getRadicacionLabel(radicacion)))
            .filter(Boolean);
    }, [radicaciones, radicacionesInitialized]);

    const jurisdiccionOptions = useMemo(() => {
        if (!jurisdiccionesInitialized || !Array.isArray(jurisdicciones)) return [];
        return jurisdicciones
            .map((jurisdiccion) => toOption(jurisdiccion.id, getJurisdiccionLabel(jurisdiccion)))
            .filter(Boolean);
    }, [jurisdicciones, jurisdiccionesInitialized]);

    const competenciaOptions = useMemo(() => {
        if (!competenciasInitialized || !Array.isArray(competencias)) return [];
        return competencias
            .map((competencia) => toOption(competencia.id, getCompetenciaLabel(competencia)))
            .filter(Boolean);
    }, [competencias, competenciasInitialized]);

    const dependenciaOptions = useMemo(() => {
        if (!dependenciasInitialized || !Array.isArray(dependenciasJudiciales)) return [];
        return dependenciasJudiciales
            .map((dependencia) => toOption(dependencia.id, getDependenciaLabel(dependencia)))
            .filter(Boolean);
    }, [dependenciasJudiciales, dependenciasInitialized]);

    const resolvedOptions = useMemo(() => ({
        caseType: normalizeProvidedOptions(caseTypeOptions, options.caseType),
        radicacion: normalizeProvidedOptions(radicacionOptions, options.radicacion),
        jurisdiccion: normalizeProvidedOptions(jurisdiccionOptions, options.jurisdiccion),
        competencia: normalizeProvidedOptions(competenciaOptions, options.competencia),
        dependencia: normalizeProvidedOptions(dependenciaOptions, options.dependencia),
    }), [
        caseTypeOptions,
        competenciaOptions,
        dependenciaOptions,
        jurisdiccionOptions,
        options.caseType,
        options.competencia,
        options.dependencia,
        options.jurisdiccion,
        options.radicacion,
        radicacionOptions,
    ]);

    const renderSelect = (field, label, placeholder, fieldOptions) => {
        const hasOptions = fieldOptions.length > 0;
        const emptyMessage = emptyMessages[field];

        return (
            <div>
                <Label>{label}</Label>
                <Select
                    value={values[field] != null ? String(values[field]) : ''}
                    onValueChange={(val) => {
                        const selectedOption = fieldOptions.find((option) => option.value === val);
                        onChange(field, val, selectedOption?.label);
                    }}
                    disabled={!hasOptions}
                >
                    <SelectTrigger onFocus={() => onFocus(field)} onBlur={onBlur}>
                        <SelectValue placeholder={hasOptions ? placeholder : 'Sin opciones disponibles'} />
                    </SelectTrigger>
                    <SelectContent>
                        {hasOptions
                            ? fieldOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))
                            : buildNoOptionsPlaceholder(emptyMessage)}
                    </SelectContent>
                </Select>
                {!hasOptions && emptyMessage && (
                    <p className="mt-1 text-xs text-amber-700">
                        {emptyMessage}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {show.caseType && renderSelect('caseType', 'Fuero', 'Seleccionar fuero...', resolvedOptions.caseType)}
            {show.radicacion && renderSelect('radicacion', 'Radicación', 'Seleccionar radicación...', resolvedOptions.radicacion)}
            {show.jurisdiccion && renderSelect('jurisdiccion', 'Jurisdicción', 'Seleccionar jurisdicción...', resolvedOptions.jurisdiccion)}
            {show.competencia && renderSelect('competencia', 'Competencia', 'Seleccionar competencia...', resolvedOptions.competencia)}
            {show.dependencia && renderSelect('dependencia', 'Juzgado (Dependencia)', 'Seleccionar juzgado...', resolvedOptions.dependencia)}
        </div>
    );
}
