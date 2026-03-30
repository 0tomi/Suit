const CASE_ENTITY_TYPES = ['caseTitle', 'caseNumber', 'caseStartDate', 'caseEndDate'];

const EVENT_REQUIREMENT_TYPES = new Set([
    'eventType',
    'eventName',
    'eventDate',
]);

const DATE_PART_TYPES = new Set([
    'anioNombrado',
    'mesNombrado',
    'diaNombrado',
    'anioNumero',
    'mesNumero',
    'diaNumero',
    'fechaConMesNombrado',
]);

/** Devuelve la familia lógica de un requisito para agrupar UI y notas por entidad. */
export function getRequirementFamily(type) {
    if (type.startsWith('client')) return 'client';
    if (type.startsWith('user')) return 'user';
    if (CASE_ENTITY_TYPES.includes(type)) return 'case';
    if (type.startsWith('parte')) return 'parte';
    if (EVENT_REQUIREMENT_TYPES.has(type)) return 'event';
    if (DATE_PART_TYPES.has(type)) return 'dateParts';
    return null;
}

/** Reúne notas únicas por familia y NEntidad para mostrarlas junto al requisito activo. */
export function getRequirementNotesForEntity(requirements, family, nEntidad) {
    const normalizedEntityNumber = nEntidad ?? 1;
    const seen = new Set();

    return requirements.reduce((notes, requirement) => {
        if (getRequirementFamily(requirement.type) !== family) {
            return notes;
        }

        if ((requirement.NEntidad ?? 1) !== normalizedEntityNumber) {
            return notes;
        }

        const note = requirement.note?.trim();
        if (!note || seen.has(note)) {
            return notes;
        }

        seen.add(note);
        notes.push(note);
        return notes;
    }, []);
}
