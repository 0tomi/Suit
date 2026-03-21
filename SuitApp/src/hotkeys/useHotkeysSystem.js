import { useContext, useEffect, useRef } from 'react';
import HotkeysContext from './HotkeysProvider';

export const useHotkeysSystem = () => {
    const ctx = useContext(HotkeysContext);
    if (!ctx) {
        throw new Error('useHotkeysSystem debe usarse dentro de HotkeysProvider');
    }
    return ctx;
};

export const useHotkeyAction = (actionName, callback) => {
    const { onAction, offAction } = useHotkeysSystem();
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!actionName) return undefined;
        const handler = (event) => callbackRef.current?.(event);
        onAction(actionName, handler);
        return () => offAction(actionName, handler);
    }, [actionName, onAction, offAction]);
};
