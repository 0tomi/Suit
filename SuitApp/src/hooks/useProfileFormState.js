import { useCallback, useReducer } from 'react';

/**
 * @param {object|null} user - Usuario actual del AuthContext.
 */
function getInitialState(user) {
    return {
        name: user?.name || '',
        lastName: user?.last_name || '',
        email: user?.email || '',
        password: '',
        saving: false,
    };
}

function reducer(state, action) {
    switch (action.type) {
        case 'SET_NAME':     return { ...state, name: action.payload };
        case 'SET_LASTNAME': return { ...state, lastName: action.payload };
        case 'SET_EMAIL':    return { ...state, email: action.payload };
        case 'SET_PASSWORD': return { ...state, password: action.payload };
        case 'SET_SAVING':   return { ...state, saving: action.payload };
        // Sincroniza los campos del formulario con el usuario en un único re-render.
        // Antes eran 4 setState separados en el efecto de [user].
        case 'SYNC_USER':
            return {
                ...state,
                name: action.user?.name || '',
                lastName: action.user?.last_name || '',
                email: action.user?.email || '',
                password: '',
            };
        default:
            return state;
    }
}

/**
 * Encapsula el estado del formulario de perfil en Settings.
 * El sync con el objeto `user` es atómico (1 dispatch → 1 re-render).
 */
export function useProfileFormState(user) {
    const [state, dispatch] = useReducer(reducer, user, getInitialState);

    const setName     = useCallback((v) => dispatch({ type: 'SET_NAME',     payload: v }), []);
    const setLastName = useCallback((v) => dispatch({ type: 'SET_LASTNAME', payload: v }), []);
    const setEmail    = useCallback((v) => dispatch({ type: 'SET_EMAIL',    payload: v }), []);
    const setPassword = useCallback((v) => dispatch({ type: 'SET_PASSWORD', payload: v }), []);
    const setSaving   = useCallback((v) => dispatch({ type: 'SET_SAVING',   payload: v }), []);
    /** Sincroniza nombre, apellido, email y password desde el objeto user. */
    const syncUser    = useCallback((u) => dispatch({ type: 'SYNC_USER',    user: u }),    []);

    return { ...state, setName, setLastName, setEmail, setPassword, setSaving, syncUser };
}
