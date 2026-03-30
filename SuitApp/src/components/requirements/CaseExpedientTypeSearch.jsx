import { useMemo } from 'react';
import { useTipoExpedientes } from '../../context/TipoExpedientesContext.jsx';
import FilterAutosuggest from '../ui/FilterAutosuggest.jsx';

function getTipoExpedienteLabel(tipoExpediente) {
    return tipoExpediente?.title || tipoExpediente?.titulo || tipoExpediente?.name || '';
}

function toTipoExpedienteOption(tipoExpediente) {
    const label = getTipoExpedienteLabel(tipoExpediente);
    if (!tipoExpediente?.id || !label) return null;

    return {
        value: String(tipoExpediente.id),
        label,
        object: tipoExpediente,
    };
}

export function CaseExpedientTypeSearch({
    value,
    onChange,
    onFocus,
    onBlur,
    tipoExpedientes: providedTipos = null,
    emptyMessage = 'No se encontraron tipos de expediente.',
}) {
    const { tipo_expedientes: cachedTipos = [], initialized } = useTipoExpedientes();

    const options = useMemo(() => {
        const source = Array.isArray(providedTipos)
            ? providedTipos
            : (initialized ? cachedTipos : []);

        return source
            .map(toTipoExpedienteOption)
            .filter(Boolean);
    }, [cachedTipos, initialized, providedTipos]);

    return (
        <FilterAutosuggest
            label="Tipo de expediente"
            placeholder="Buscar tipo de expediente..."
            value={value != null ? String(value) : null}
            options={options}
            onChange={(id, option) => onChange(id, option?.object || null)}
            onClear={() => onChange(null, null)}
            onFocus={onFocus}
            onBlur={onBlur}
            emptyMessage={emptyMessage}
            maxResults={Infinity}
        />
    );
}
