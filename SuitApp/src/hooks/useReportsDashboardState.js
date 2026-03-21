import { useCallback, useReducer, useState } from 'react';

const initialEconomy = {
    globalHonorarios: [],
    globalGastos: [],
    previousHonorarios: [],
    honorarios12: [],
    gastos12: [],
};

function economyReducer(state, action) {
    switch (action.type) {
        // Batches los 5 arrays financieros en un único re-render.
        // Antes eran 5 setState separados tras el Promise.all de loadEconomy.
        case 'SET_ECONOMY_DATA':
            return {
                globalHonorarios: action.hCurrent,
                globalGastos: action.gCurrent,
                previousHonorarios: action.hPrev,
                honorarios12: action.h12,
                gastos12: action.g12,
            };
        default:
            return state;
    }
}

/**
 * Encapsula los 9 useState de ReportsDashboard.
 * Usa useReducer para los datos económicos para que la carga de los 5 arrays
 * sea un único dispatch → un único re-render.
 */
export function useReportsDashboardState() {
    const [economy, dispatchEconomy] = useReducer(economyReducer, initialEconomy);

    // Selector de usuario (admin)
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [usersList, setUsersList]           = useState([]);

    // Mapa caso↔cliente cargado desde SQLite
    const [caseClientMap, setCaseClientMap]   = useState(new Map());

    // Estado de refresco manual
    const [isRefreshing, setIsRefreshing]     = useState(false);

    /** Actualiza los 5 arrays económicos en un único re-render. */
    const setEconomyData = useCallback(({ hCurrent, gCurrent, hPrev, h12, g12 }) => {
        dispatchEconomy({ type: 'SET_ECONOMY_DATA', hCurrent, gCurrent, hPrev, h12, g12 });
    }, []);

    return {
        ...economy,
        selectedUserId, setSelectedUserId,
        usersList, setUsersList,
        caseClientMap, setCaseClientMap,
        isRefreshing, setIsRefreshing,
        setEconomyData,
    };
}
