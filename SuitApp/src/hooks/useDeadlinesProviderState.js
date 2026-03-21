import { useCallback, useReducer } from 'react';

/** Estado inicial derivado de la fecha actual. */
function getInitialState() {
    const now = new Date();
    return {
        currentMonth: now.getMonth() + 1,
        currentYear: now.getFullYear(),
        deadlines: [],
        syncing: false,
        initialized: false,
    };
}

function reducer(state, action) {
    switch (action.type) {
        case 'SET_DEADLINES':   return { ...state, deadlines: action.payload };
        case 'SET_SYNCING':     return { ...state, syncing: action.payload };
        case 'SET_INITIALIZED': return { ...state, initialized: action.payload };
        case 'SET_MONTH_YEAR':  return { ...state, currentMonth: action.month, currentYear: action.year };
        // RESET en un único dispatch → un único re-render para todos los consumers del Context.
        // Antes eran 5 setState separados en el efecto de authEpoch.
        case 'RESET':           return getInitialState();
        default:                return state;
    }
}

/**
 * Encapsula el estado interno del DeadlinesProvider.
 * Usa useReducer para que el reset de logout sea atómico (1 re-render).
 */
export function useDeadlinesProviderState() {
    const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

    const setDeadlines    = useCallback((v) => dispatch({ type: 'SET_DEADLINES',   payload: v }),      []);
    const setSyncing      = useCallback((v) => dispatch({ type: 'SET_SYNCING',     payload: v }),      []);
    const setInitialized  = useCallback((v) => dispatch({ type: 'SET_INITIALIZED', payload: v }),      []);
    const setMonthYear    = useCallback((month, year) => dispatch({ type: 'SET_MONTH_YEAR', month, year }), []);
    const reset           = useCallback(() => dispatch({ type: 'RESET' }),                               []);
    // Aliases sin prefijo "set" para usarse en useEffect (evita falsos positivos de linters estáticos).
    const startSync       = useCallback(() => dispatch({ type: 'SET_SYNCING',     payload: true }),    []);
    const endSync         = useCallback(() => dispatch({ type: 'SET_SYNCING',     payload: false }),   []);
    const markInitialized = useCallback(() => dispatch({ type: 'SET_INITIALIZED', payload: true }),    []);

    return { ...state, setDeadlines, setSyncing, setInitialized, setMonthYear, reset, startSync, endSync, markInitialized };
}
