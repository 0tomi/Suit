export const DOCUMENT_FILTER_STORAGE_KEY = 'documents-filter-state';
export const DOCUMENT_FILTER_STORAGE_VERSION = 1;

export const DEFAULT_DOCUMENT_FILTERS = {
    searchQuery: '',
    caseMode: 'all',
    selectedCaseId: '',
    includeClosedCases: false,
    selectedCreator: '',
    selectedClientId: '',
};

function normalizeDocumentFilterState(raw) {
    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_DOCUMENT_FILTERS };
    }

    return {
        ...DEFAULT_DOCUMENT_FILTERS,
        searchQuery: typeof raw.searchQuery === 'string' ? raw.searchQuery : DEFAULT_DOCUMENT_FILTERS.searchQuery,
        caseMode: ['all', 'personal', 'specific'].includes(raw.caseMode) ? raw.caseMode : DEFAULT_DOCUMENT_FILTERS.caseMode,
        selectedCaseId: raw.selectedCaseId ? String(raw.selectedCaseId) : DEFAULT_DOCUMENT_FILTERS.selectedCaseId,
        includeClosedCases: Boolean(raw.includeClosedCases),
        selectedCreator: typeof raw.selectedCreator === 'string' ? raw.selectedCreator : DEFAULT_DOCUMENT_FILTERS.selectedCreator,
        selectedClientId: raw.selectedClientId ? String(raw.selectedClientId) : DEFAULT_DOCUMENT_FILTERS.selectedClientId,
    };
}

export function loadDocumentFilterState() {
    try {
        const raw = localStorage.getItem(DOCUMENT_FILTER_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_DOCUMENT_FILTERS };

        const parsed = JSON.parse(raw);
        const payload = parsed?.v === DOCUMENT_FILTER_STORAGE_VERSION ? parsed.data : parsed;
        return normalizeDocumentFilterState(payload);
    } catch {
        return { ...DEFAULT_DOCUMENT_FILTERS };
    }
}

export function saveDocumentFilterState(state) {
    try {
        localStorage.setItem(DOCUMENT_FILTER_STORAGE_KEY, JSON.stringify({
            v: DOCUMENT_FILTER_STORAGE_VERSION,
            data: normalizeDocumentFilterState(state),
        }));
    } catch {
        // Ignore storage quota and private mode failures.
    }
}

export function getCaseLifecycle(caseItem) {
    if (!caseItem) return 'unknown';
    if (caseItem.end_date) return 'closed';
    if (caseItem.status === 'closed') return 'closed';
    return 'open';
}

export function getCaseClients(caseItem) {
    if (!caseItem) return [];

    if (Array.isArray(caseItem.clients)) {
        return caseItem.clients;
    }

    if (caseItem.data_json) {
        try {
            const parsed = JSON.parse(caseItem.data_json);
            if (Array.isArray(parsed?.clients)) {
                return parsed.clients;
            }
        } catch {
            return [];
        }
    }

    return [];
}

export function filterDocuments(documents, filters, casesMap) {
    return documents.filter((doc) => {
        // No mostrar multimedia en el listado de documentos por defecto (evita DragonEnd.jpg etc)
        if (doc.category === 'multimedia') return false;

        const name = (doc.name || doc.title || '').toLowerCase();
        if (filters.searchQuery && !name.includes(filters.searchQuery.toLowerCase())) return false;

        if (filters.caseMode === 'personal') {
            if (doc.suit_case_id) return false;
        } else if (filters.caseMode === 'specific') {
            if (String(doc.suit_case_id) !== filters.selectedCaseId) return false;
        } else if (doc.suit_case_id) {
            const caseForDoc = casesMap.get(String(doc.suit_case_id));
            if (!caseForDoc) return false;

            if (!filters.includeClosedCases && getCaseLifecycle(caseForDoc) === 'closed') {
                return false;
            }
        }

        if (filters.selectedCreator) {
            const creatorName = doc.latest_version?.creator?.name || '';
            if (creatorName !== filters.selectedCreator) return false;
        }

        if (filters.selectedClientId) {
            if (!doc.suit_case_id) return false;
            const caseForDoc = casesMap.get(String(doc.suit_case_id));
            if (!caseForDoc) return false;

            const hasClient = getCaseClients(caseForDoc).some((client) => String(client.id) === filters.selectedClientId);
            if (!hasClient) return false;
        }

        return true;
    });
}
