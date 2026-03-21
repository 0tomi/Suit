import { useCallback, useMemo, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useEventTypes } from '../context/EventTypesContext';
import { useCaseTypes } from '../context/CaseTypesContext';
import { useCases } from '../context/CasesContext';
import { getCase } from '../services/caseService.js';
import { resolveAgendaEventColor } from '../utils/agendaColor/resolveAgendaEventColor.js';
import { readCaseId } from '../utils/eventNormalization.js';
import {
    logColorResolutionError,
    logColorResolutionFallback,
} from '../utils/agendaColor/colorResolutionDiagnostics.js';
import { normalizeAgendaColorMode } from '../utils/agendaColor/normalizeAgendaColorMode.js';

const MAX_CASE_FETCH_CONCURRENCY = 3;
const FAILED_CASE_FETCH_RETRY_MS = 30_000;

function drainCaseFetchQueue({
    inFlightRef,
    queueRef,
    queuedRef,
    fetchedRef,
    canRetryCaseFetch,
    upsertExtraCases,
    failedAtRef,
}) {
    while (inFlightRef.current.size < MAX_CASE_FETCH_CONCURRENCY && queueRef.current.length > 0) {
        const caseId = queueRef.current.shift();
        queuedRef.current.delete(caseId);

        if (!caseId) continue;
        if (fetchedRef.current.has(caseId)) continue;
        if (inFlightRef.current.has(caseId)) continue;
        if (!canRetryCaseFetch(caseId)) continue;

        const request = Promise.resolve(getCase(caseId))
            .then((fetchedCase) => {
                if (!fetchedCase?.id) return;
                fetchedRef.current.add(caseId);
                failedAtRef.current.delete(caseId);
                upsertExtraCases([fetchedCase]);
            })
            .catch(() => {
                failedAtRef.current.set(caseId, Date.now());
            })
            .finally(() => {
                inFlightRef.current.delete(caseId);
                drainCaseFetchQueue({
                    inFlightRef,
                    queueRef,
                    queuedRef,
                    fetchedRef,
                    canRetryCaseFetch,
                    upsertExtraCases,
                    failedAtRef,
                });
            });

        inFlightRef.current.set(caseId, request);
    }
}

export function useEventColorResolver() {
    const { agendaColorMode, personalEventColor } = useSettings();
    const { event_types: eventTypes } = useEventTypes();
    const { case_types: caseTypes } = useCaseTypes();
    const { cases } = useCases();
    const fetchedRef = useRef(new Set());
    const inFlightRef = useRef(new Map());
    const queueRef = useRef([]);
    const queuedRef = useRef(new Set());
    const failedAtRef = useRef(new Map());
    const [extraCases, setExtraCases] = useState([]);

    const allCases = useMemo(() => [...cases, ...extraCases], [cases, extraCases]);

    const eventTypesById = useMemo(
        () => new Map((eventTypes || []).map((item) => [String(item.id), item])),
        [eventTypes],
    );
    const caseTypesById = useMemo(
        () => new Map((caseTypes || []).map((item) => [String(item.id), item])),
        [caseTypes],
    );
    const casesById = useMemo(
        () => new Map((allCases || []).map((item) => [String(item.id), item])),
        [allCases],
    );

    const normalizedMode = useMemo(
        () => normalizeAgendaColorMode(agendaColorMode),
        [agendaColorMode],
    );

    const resolveColorDetails = useCallback((event) => (
        resolveAgendaEventColor({
            event,
            mode: normalizedMode,
            eventTypesById,
            caseTypesById,
            casesById,
            personalColor: personalEventColor,
            onFallback: logColorResolutionFallback,
            onError: logColorResolutionError,
        })
    ), [normalizedMode, caseTypesById, casesById, eventTypesById, personalEventColor]);

    const resolveColor = useCallback(
        (event) => resolveColorDetails(event).color,
        [resolveColorDetails],
    );

    const upsertExtraCases = useCallback((fetchedCases) => {
        if (!Array.isArray(fetchedCases) || fetchedCases.length === 0) return;

        setExtraCases((previous) => {
            const byId = new Map(previous.map((item) => [String(item.id), item]));
            for (const item of fetchedCases) {
                if (!item?.id) continue;
                byId.set(String(item.id), item);
            }
            return [...byId.values()];
        });
    }, []);

    const canRetryCaseFetch = useCallback((caseId) => {
        const failedAt = failedAtRef.current.get(caseId);
        if (!failedAt) return true;

        if ((Date.now() - failedAt) > FAILED_CASE_FETCH_RETRY_MS) {
            failedAtRef.current.delete(caseId);
            return true;
        }

        return false;
    }, []);

    const pumpCaseFetchQueue = useCallback(() => {
        drainCaseFetchQueue({
            inFlightRef,
            queueRef,
            queuedRef,
            fetchedRef,
            canRetryCaseFetch,
            upsertExtraCases,
            failedAtRef,
        });
    }, [canRetryCaseFetch, upsertExtraCases]);

    const fetchMissingCases = useCallback((events) => {
        if (!Array.isArray(events) || events.length === 0) return;

        const knownIds = new Set(allCases.map((item) => String(item.id)));
        let queuedNewFetch = false;

        for (const event of events) {
            const rawCaseId = readCaseId(event);
            if (!rawCaseId) continue;

            const caseId = String(rawCaseId);
            if (knownIds.has(caseId)) continue;
            if (fetchedRef.current.has(caseId)) continue;
            if (inFlightRef.current.has(caseId)) continue;
            if (queuedRef.current.has(caseId)) continue;
            if (!canRetryCaseFetch(caseId)) continue;

            queueRef.current.push(caseId);
            queuedRef.current.add(caseId);
            queuedNewFetch = true;
        }

        if (!queuedNewFetch) return;
        pumpCaseFetchQueue();
    }, [allCases, canRetryCaseFetch, pumpCaseFetchQueue]);

    return {
        agendaColorMode: normalizedMode,
        fetchMissingCases,
        resolveColor,
        resolveColorDetails,
    };
}
