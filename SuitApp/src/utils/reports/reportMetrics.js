import dayjs from 'dayjs';
import { isCaseClosed } from '../caseStatus.js';

function parseJsonSafely(value) {
  if (!value || typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseDateCandidate(value) {
  if (!value) return null;

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function resolveCaseActivityDate(caseItem) {
  return parseDateCandidate(
    caseItem?.created_at
    || caseItem?.createdAt
    || caseItem?.start_date
    || caseItem?.startDate
    || null
  );
}

function resolveClientActivityDate(client) {
  return parseDateCandidate(
    client?.created_at
    || client?.createdAt
    || client?.updated_at
    || client?.updatedAt
    || null
  );
}

function resolveEventDate(eventItem) {
  return parseDateCandidate(
    eventItem?.starts_at
    || eventItem?.start
    || eventItem?.date
    || null
  );
}

function isDeadlineEvent(eventItem) {
  const eventTypeName = String(
    eventItem?.event_type?.name
    || eventItem?.eventType?.name
    || eventItem?.event_type_name
    || ''
  ).toLowerCase();

  if (eventTypeName === 'vencimiento') {
    return true;
  }

  return String(eventItem?.event_type_id ?? eventItem?.eventTypeId ?? '') === '2';
}

function resolveDeadlineDate(deadline) {
  return parseDateCandidate(deadline?.due_date || deadline?.dueDate || null);
}

function isPendingDeadline(deadline) {
  return deadline?.status !== 'Cumplido';
}

function isUrgentDeadline(deadline) {
  return String(deadline?.priority ?? '').toLowerCase() === 'urgente';
}

function createMonthBucketCursor(now, offset) {
  return dayjs(now).startOf('month').subtract(offset, 'month');
}

function readEmbeddedCaseClients(caseItem) {
  if (Array.isArray(caseItem?.clients)) {
    return caseItem.clients;
  }

  const parsed = parseJsonSafely(caseItem?.data_json);
  if (Array.isArray(parsed?.clients)) {
    return parsed.clients;
  }

  return null;
}

/**
 * Construye la serie mensual combinando eventos con altas de casos y clientes.
 * Esto ofrece una lectura operativa sin depender de una única entidad.
 */
function buildActivityTimeline({ cases, clients, events, now }) {
  const monthCount = 12;
  const buckets = [];
  const bucketIndex = new Map();

  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const cursor = createMonthBucketCursor(now, index);
    const key = cursor.format('YYYY-MM');
    const bucket = {
      key,
      label: cursor.format('MMM'),
      monthLabel: cursor.format('MMMM YYYY'),
      events: 0,
      cases: 0,
      clients: 0,
      total: 0,
    };

    bucketIndex.set(key, bucket);
    buckets.push(bucket);
  }

  const appendToBucket = (entryDate, fieldName) => {
    if (!entryDate?.isValid()) return;
    const bucket = bucketIndex.get(entryDate.format('YYYY-MM'));
    if (!bucket) return;
    bucket[fieldName] += 1;
    bucket.total += 1;
  };

  events.forEach((eventItem) => appendToBucket(resolveEventDate(eventItem), 'events'));
  cases.forEach((caseItem) => appendToBucket(resolveCaseActivityDate(caseItem), 'cases'));
  clients.forEach((client) => appendToBucket(resolveClientActivityDate(client), 'clients'));

  return buckets;
}

/**
 * Construye el set de IDs de clientes asociados a los casos activos.
 * @param {Object[]} activeCases
 * @param {Map<string, number[]>} caseClientMap - Map<caseId (string), clientId[]>
 */
function buildActiveClientIds(activeCases, caseClientMap) {
  const activeClientIds = new Set();

  activeCases.forEach((caseItem) => {
    const caseId = String(caseItem?.id ?? '');
    const embeddedClients = readEmbeddedCaseClients(caseItem) || [];
    const mappedClientIds = caseClientMap.get(caseId) || [];
    const clientIds = mappedClientIds.length > 0
      ? mappedClientIds
      : embeddedClients.map((client) => client?.id);

    clientIds.forEach((id) => activeClientIds.add(String(id)));
  });

  return activeClientIds;
}

function sortByDateAsc(left, right, readDate) {
  const leftDate = readDate(left);
  const rightDate = readDate(right);

  if (!leftDate && !rightDate) return 0;
  if (!leftDate) return 1;
  if (!rightDate) return -1;

  if (leftDate.isBefore(rightDate)) return -1;
  if (leftDate.isAfter(rightDate)) return 1;
  return 0;
}

function extractStatCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function resolveStatNumber(row, keys = []) {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function resolveStatMonth(row) {
  return String(row?.month || row?.key || row?.period || '').slice(0, 7);
}

function buildEconomyTimelineFromStats({
  honorariosStats: initialHonorariosStats = [],
  gastosStats: initialGastosStats = [],
  now = new Date(),
} = {}) {
  const honorariosStats = extractStatCollection(initialHonorariosStats);
  const gastosStats = extractStatCollection(initialGastosStats);

  const nowDate = dayjs(now);
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const cursor = nowDate.subtract(11 - i, 'month');
    return {
      key: cursor.format('YYYY-MM'),
      shortLabel: cursor.format('MMM'),
      monthLabel: cursor.format('MMMM YYYY'),
      honorarios: 0,
      entregas: 0,
      gastos: 0,
    };
  });
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const row of honorariosStats) {
    const key = resolveStatMonth(row);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    bucket.honorarios += resolveStatNumber(row, ['monto_total', 'total_amount', 'amount']);
    bucket.entregas += resolveStatNumber(row, ['pagado_total', 'total_paid', 'paid_amount']);
  }

  for (const row of gastosStats) {
    const key = resolveStatMonth(row);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    bucket.gastos += resolveStatNumber(row, ['monto_total', 'total_amount', 'amount']);
  }

  return buckets;
}

export function buildReportsMetrics({
  cases: initialCases = [],
  clients: initialClients = [],
  events: initialEvents = [],
  deadlines: initialDeadlines = [],
  honorariosStats: initialHonorariosStats = [],
  gastosStats: initialGastosStats = [],
  caseClientMap = new Map(),
  resolvedCaseClientsByCaseId = null,
  now = new Date(),
} = {}) {
  const nowDate = dayjs(now);
  const today = nowDate.startOf('day');

  // Normalización defensiva para asegurar que siempre operamos sobre arrays
  const cases = Array.isArray(initialCases) ? initialCases : [];
  const clients = Array.isArray(initialClients) ? initialClients : [];
  const events = Array.isArray(initialEvents) ? initialEvents : [];
  const deadlines = Array.isArray(initialDeadlines) ? initialDeadlines : [];
  const honorariosStats = extractStatCollection(initialHonorariosStats);
  const gastosStats = extractStatCollection(initialGastosStats);

  const normalizedCaseClientMap = caseClientMap instanceof Map
    ? new Map(caseClientMap)
    : new Map();

  if (resolvedCaseClientsByCaseId && typeof resolvedCaseClientsByCaseId === 'object') {
    Object.entries(resolvedCaseClientsByCaseId).forEach(([caseId, resolvedClients]) => {
      normalizedCaseClientMap.set(
        String(caseId),
        (Array.isArray(resolvedClients) ? resolvedClients : []).map((client) => client?.id),
      );
    });
  }

  cases.forEach((caseItem) => {
    const caseId = String(caseItem?.id ?? '');
    if (!caseId || normalizedCaseClientMap.has(caseId)) return;

    const embeddedClients = readEmbeddedCaseClients(caseItem);
    if (!embeddedClients) return;

    normalizedCaseClientMap.set(caseId, embeddedClients.map((client) => client?.id));
  });

  const activeCases = cases.filter((caseItem) => !isCaseClosed(caseItem));
  const pendingEvents = events
    .filter((eventItem) => {
      if (isDeadlineEvent(eventItem)) return false;
      const eventDate = resolveEventDate(eventItem);
      return eventDate?.isValid() && (eventDate.isAfter(nowDate) || eventDate.isSame(nowDate));
    })
    .sort((left, right) => sortByDateAsc(left, right, resolveEventDate));

  const actionableDeadlines = deadlines
    .filter((deadline) => {
      const deadlineDate = resolveDeadlineDate(deadline);
      return isPendingDeadline(deadline) && deadlineDate?.isValid();
    })
    .sort((left, right) => sortByDateAsc(left, right, resolveDeadlineDate));

  const nextDeadlines = actionableDeadlines.filter((deadline) => {
    const deadlineDate = resolveDeadlineDate(deadline);
    return deadlineDate?.isSame(today) || deadlineDate?.isAfter(today);
  });

  const urgentDeadlines = nextDeadlines.filter((deadline) => isUrgentDeadline(deadline));
  const activeClientIds = buildActiveClientIds(activeCases, normalizedCaseClientMap);
  const activityTimeline = buildActivityTimeline({
    cases,
    clients,
    events,
    now,
  });

  const currentMonthKey = nowDate.format('YYYY-MM');
  const previousMonthKey = nowDate.subtract(1, 'month').format('YYYY-MM');
  const currentYear = nowDate.year();
  const previousYear = currentYear - 1;
  const currentMonthActivity = activityTimeline.find((bucket) => bucket.key === currentMonthKey) ?? {
    events: 0,
    cases: 0,
    clients: 0,
    total: 0,
  };
  const previousMonthActivity = activityTimeline.find((bucket) => bucket.key === previousMonthKey) ?? {
    total: 0,
  };

  const yearTotals = activityTimeline.reduce((accumulator, bucket) => {
    const [bucketYear] = bucket.key.split('-');
    const numericYear = Number(bucketYear);

    if (numericYear === currentYear) {
      accumulator.current.events += bucket.events;
      accumulator.current.cases += bucket.cases;
      accumulator.current.clients += bucket.clients;
      accumulator.current.total += bucket.total;
    }

    if (numericYear === previousYear) {
      accumulator.previous.total += bucket.total;
    }

    return accumulator;
  }, {
    current: { events: 0, cases: 0, clients: 0, total: 0 },
    previous: { total: 0 },
  });

  // Métricas de Economía
  const totalHonorarios = honorariosStats.reduce((acc, row) => acc + resolveStatNumber(row, ['monto_total', 'total_amount', 'amount']), 0);
  const totalEntregas = honorariosStats.reduce((acc, row) => acc + resolveStatNumber(row, ['pagado_total', 'total_paid', 'paid_amount']), 0);
  const totalGastos = gastosStats.reduce((acc, row) => acc + resolveStatNumber(row, ['monto_total', 'total_amount', 'amount']), 0);

  return {
    counts: {
      activeCases: activeCases.length,
      pendingEvents: pendingEvents.length,
      deadlines: actionableDeadlines.length,
      activeClients: activeClientIds.size,
    },
    upcoming: {
      nextEvent: pendingEvents[0] ?? null,
      nextDeadline: nextDeadlines[0] ?? null,
      nextUrgentDeadline: urgentDeadlines[0] ?? null,
    },
    activity: {
      month: {
        ...currentMonthActivity,
        previousTotal: previousMonthActivity.total,
      },
      year: {
        ...yearTotals.current,
        previousTotal: yearTotals.previous.total,
      },
      timeline: activityTimeline,
      peakValue: Math.max(0, ...activityTimeline.map((bucket) => bucket.total)),
    },
    economy: {
      totalHonorarios,
      totalEntregas,
      totalGastos,
      pendingBalance: Math.max(0, totalHonorarios - totalEntregas),
    },
  };
}

export {
  buildEconomyTimelineFromStats,
  readEmbeddedCaseClients,
};
