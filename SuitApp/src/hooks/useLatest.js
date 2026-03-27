import { useRef, useLayoutEffect } from 'react';

/**
 * Hook para obtener la última versión de un valor (típicamente una función)
 * dentro de un efecto sin necesidad de re-invocar el efecto si el valor cambia.
 * @param {*} value El valor a referenciar.
 * @returns Un ref de React que contiene el valor más reciente.
 */
export const useLatest = (value) => {
    const ref = useRef(value);
    useLayoutEffect(() => {
        ref.current = value;
    });
    return ref;
};
