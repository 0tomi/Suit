import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function defaultIsSameEntity(item, id) {
    return String(item?.id) === String(id);
}

export function useEntityDetail({
    id,
    items,
    fetchById,
    initialEntity = null,
    notFoundMessage,
    loadErrorMessage,
    isSameEntity = defaultIsSameEntity,
}) {
    const localEntity = useMemo(() => {
        if (!Array.isArray(items)) return null;
        return items.find((item) => isSameEntity(item, id)) || null;
    }, [id, isSameEntity, items]);

    const initialMatch = useMemo(() => {
        if (!initialEntity) return null;
        return isSameEntity(initialEntity, id) ? initialEntity : null;
    }, [id, initialEntity, isSameEntity]);

    const resolvedInitialEntity = localEntity || initialMatch || null;

    const [state, setState] = useState(() => ({
        entity: resolvedInitialEntity,
        loading: !resolvedInitialEntity,
        error: null,
    }));

    const requestGenerationRef = useRef(0);

    const resolveRemoteEntity = useCallback(async (generation) => {
        try {
            const result = await fetchById(id);
            if (requestGenerationRef.current !== generation) return;

            if (result) {
                setState({
                    entity: result,
                    loading: false,
                    error: null,
                });
                return;
            }

            setState({
                entity: null,
                loading: false,
                error: notFoundMessage,
            });
        } catch {
            if (requestGenerationRef.current !== generation) return;

            setState({
                entity: null,
                loading: false,
                error: loadErrorMessage,
            });
        }
    }, [fetchById, id, loadErrorMessage, notFoundMessage]);

    useEffect(() => {
        if (localEntity || initialMatch) {
            requestGenerationRef.current += 1;
        }
    }, [id, initialMatch, localEntity]);

    useEffect(() => {
        if (localEntity || initialMatch) return;
        const generation = ++requestGenerationRef.current;

        void resolveRemoteEntity(generation);
    }, [id, initialMatch, localEntity, resolveRemoteEntity]);

    useEffect(() => () => {
        requestGenerationRef.current += 1;
    }, []);

    const setEntity = useCallback((updaterOrValue) => {
        setState((prev) => ({
            entity: typeof updaterOrValue === 'function' ? updaterOrValue(prev.entity) : updaterOrValue,
            loading: false,
            error: null,
        }));
    }, []);

    const reload = useCallback(async () => {
        const generation = ++requestGenerationRef.current;

        setState((prev) => ({
            ...prev,
            entity: isSameEntity(prev.entity, id) ? prev.entity : null,
            loading: true,
            error: null,
        }));

        await resolveRemoteEntity(generation);
    }, [id, isSameEntity, resolveRemoteEntity]);

    const resolvedStateEntity = isSameEntity(state.entity, id) ? state.entity : null;
    const entity = resolvedStateEntity || localEntity || initialMatch || null;
    const error = entity ? null : state.error;
    const loading = resolvedStateEntity || localEntity || initialMatch
        ? false
        : (state.loading || !state.error);

    return {
        entity,
        loading,
        error,
        setEntity,
        reload,
    };
}
