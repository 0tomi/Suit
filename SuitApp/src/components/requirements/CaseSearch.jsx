import { useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useCases } from '../../context/CasesContext';
import FilterAutosuggest from '../ui/FilterAutosuggest';
import { useModal } from '../../context/ModalContext';
import { NewCaseModal } from '../cases/NewCaseModal';
import { Button } from '../ui/Button';

function toCaseOption(suitCase) {
    return {
        value: suitCase.id,
        label: suitCase.title,
        object: suitCase,
    };
}

function extractCaseEntity(result) {
    const candidates = [
        result?.case?.data,
        result?.case?.case,
        result?.case?.suit_case,
        result?.case?.createdCase,
        result?.case,
        result?.data?.case,
        result?.data?.suit_case,
        result?.data?.createdCase,
        result?.data,
        result,
    ];

    return candidates.find((candidate) => candidate?.id) ?? null;
}

export function CaseSearch({
    value,
    onChange,
    onCaseCreated,
    onFocus,
    onBlur,
    cases: providedCases = null,
    emptyMessage = 'No se encontraron expedientes.',
}) {
    const { cases, initialized, refreshCases } = useCases();
    const { openModal } = useModal();

    const options = useMemo(() => {
        if (Array.isArray(providedCases)) {
            return providedCases.map(toCaseOption);
        }
        if (!initialized || !Array.isArray(cases)) return [];
        return cases.map(toCaseOption);
    }, [cases, initialized, providedCases]);

    const handleChange = (id, option) => {
        onChange(id, option?.object || null);
    };

    const handleClear = () => {
        onChange(null, null);
    };

    const handleNewCaseSuccess = useCallback(async (result) => {
        const caseObject = extractCaseEntity(result);
        if (caseObject?.id) {
            onCaseCreated?.(caseObject);
            onChange(caseObject.id, caseObject);
        }
        refreshCases();
    }, [onChange, onCaseCreated, refreshCases]);

    const handleAddNew = () => {
        openModal(NewCaseModal, { onSuccess: handleNewCaseSuccess });
    };

    return (
        <div>
            <FilterAutosuggest
                label="Expediente"
                placeholder="Buscar expediente..."
                value={value}
                options={options}
                onChange={handleChange}
                onClear={handleClear}
                onFocus={onFocus}
                onBlur={onBlur}
                emptyMessage={emptyMessage}
                maxResults={Infinity}
            />
            <div className="mt-2">
                <button type="button" onClick={handleAddNew} className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
                    + Agregar nuevo
                </button>
            </div>
        </div>
    );
}
