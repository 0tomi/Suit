import dayjs from 'dayjs';
import { isCaseClosed } from '../caseStatus.js';


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
    const clientIds = caseClientMap.get(caseId) || [];
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

export function buildReportsMetrics({
  cases: initialCases = [],
  clients: initialClients = [],
  events: initialEvents = [],
  deadlines: initialDeadlines = [],
  honorarios: initialHonorarios = [],
  gastos: initialGastos = [],
  caseClientMap = new Map(),
  now = new Date(),
} = {}) {
  const nowDate = dayjs(now);
  const today = nowDate.startOf('day');

  // Normalización defensiva para asegurar que siempre operamos sobre arrays
  const cases = Array.isArray(initialCases) ? initialCases : [];
  const clients = Array.isArray(initialClients) ? initialClients : [];
  const events = Array.isArray(initialEvents) ? initialEvents : [];
  const deadlines = Array.isArray(initialDeadlines) ? initialDeadlines : [];
  const honorarios = Array.isArray(initialHonorarios) ? initialHonorarios : [];
  const gastos = Array.isArray(initialGastos) ? initialGastos : [];

  const activeCases = cases.filter((caseItem) => !isCaseClosed(caseItem));
  const pendingEvents = events
    .filter((eventItem) => {
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
  const activeClientIds = buildActiveClientIds(activeCases, caseClientMap);
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
  const totalHonorarios = honorarios.reduce((acc, h) => acc + (Number(h.monto) || 0), 0);
  const totalEntregas = honorarios.reduce((acc, h) => acc + (Number(h.total_entregas) || 0), 0);
  const totalGastos = gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

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
      peakValue: Math.max(1, ...activityTimeline.map((bucket) => bucket.total)),
    },
    economy: {
      totalHonorarios,
      totalEntregas,
      totalGastos,
      pendingBalance: Math.max(0, totalHonorarios - totalEntregas),
    },
  };
}
