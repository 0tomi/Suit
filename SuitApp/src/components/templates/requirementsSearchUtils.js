import { REQUISITO_CATEGORIES, getRequisitoLabel } from '../../constants/requisitoLabels.js';

/**
 * Construye el mapa de requisitos por tipo para acceso O(1) desde la UI.
 */
export function buildRequisitosByType(requisitos = []) {
    const map = new Map();
    for (const requisito of requisitos || []) {
        if (requisito?.type === 'custom') continue;
        map.set(requisito.type, requisito);
    }
    return map;
}

/**
 * Devuelve las categorías con requisitos existentes, respetando el orden
 * definido por REQUISITO_CATEGORIES y afinando por texto si hay búsqueda.
 */
export function getRequirementSections(requisitos = [], searchTerm = '') {
    const requisitosByType = buildRequisitosByType(requisitos);
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return REQUISITO_CATEGORIES
        .map((category) => {
            let items = category.types
                .map((type) => requisitosByType.get(type))
                .filter(Boolean);

            if (normalizedSearch) {
                items = items.filter((req) => {
                    const label = getRequisitoLabel(req.type).toLowerCase();
                    return label.includes(normalizedSearch);
                });
            }

            if (items.length === 0) return null;

            return {
                ...category,
                items,
            };
        })
        .filter(Boolean);
}
