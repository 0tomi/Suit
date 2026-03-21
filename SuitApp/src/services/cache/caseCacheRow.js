import { formatISO } from 'date-fns';

export function buildCaseCacheRow(caseRecord) {
    if (!caseRecord?.id) return null;

    return {
        id: caseRecord.id,
        title: caseRecord.title,
        case_type: caseRecord.case_type || null,
        case_type_id: caseRecord.case_type_id || null,
        status: caseRecord.status,
        owner_tag: caseRecord.owner_tag,
        start_date: caseRecord.start_date,
        end_date: caseRecord.end_date,
        details: caseRecord.details,
        nro_expediente: caseRecord.nro_expediente || null,
        radicacion_id: caseRecord.radicacion_id || null,
        updated_at: caseRecord.updated_at || null,
        data_json: JSON.stringify(caseRecord),
        synced_at: formatISO(new Date()),
    };
}
