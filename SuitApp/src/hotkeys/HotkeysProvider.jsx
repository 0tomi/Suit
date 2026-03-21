import { createContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getCustomHotkeysConfig, resetCustomHotkeysConfig, saveCustomHotkey } from './hotkeys';

const HotkeysContext = createContext(null);

const KEY_ALIASES = {
    esc: 'escape',
    escape: 'escape',
    return: 'enter',
    enter: 'enter',
    del: 'delete',
    delete: 'delete',
    space: ' ',
    comma: ',',
    ',': ',',
    period: '.',
    '.': '.',
};

const isTextInput = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    if (!tag) return false;
    if (target.isContentEditable) return true;
    if (tag === 'INPUT') {
        const type = (target.getAttribute('type') || '').toLowerCase();
        const ignoredTypes = ['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'];
        return !ignoredTypes.includes(type);
    }
    return tag === 'TEXTAREA' || tag === 'SELECT';
};

const normalizeKeyToken = (token) => {
    if (!token) return '';
    const normalized = token.toLowerCase();
    return KEY_ALIASES[normalized] ?? normalized;
};

const parseHotkeyCombo = (combo) => {
    const tokens = combo.split('+').map((token) => token.trim()).filter(Boolean);
    if (!tokens.length) return null;
    const descriptor = {
        key: null,
        mod: false,
        ctrl: false,
        meta: false,
        shift: false,
        alt: false,
    };
    tokens.forEach((token) => {
        const normalized = normalizeKeyToken(token);
        switch (normalized) {
            case 'mod':
                descriptor.mod = true;
                break;
            case 'ctrl':
            case 'control':
                descriptor.ctrl = true;
                break;
            case 'cmd':
            case 'meta':
                descriptor.meta = true;
                break;
            case 'shift':
                descriptor.shift = true;
                break;
            case 'alt':
            case 'option':
                descriptor.alt = true;
                break;
            default:
                descriptor.key = normalized;
                break;
        }
    });
    return descriptor.key ? descriptor : null;
};

const parseHotkeyString = (value = '') => (
    value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map(parseHotkeyCombo)
        .filter(Boolean)
);

const normalizeEventKey = (key) => normalizeKeyToken(key);

const matchCombo = (combo, event) => {
    if (combo.mod) {
        if (!(event.ctrlKey || event.metaKey)) return false;
    } else {
        if (combo.ctrl && !event.ctrlKey) return false;
        if (!combo.ctrl && event.ctrlKey) return false;
        if (combo.meta && !event.metaKey) return false;
        if (!combo.meta && event.metaKey) return false;
    }

    if (combo.shift && !event.shiftKey) return false;
    if (!combo.shift && event.shiftKey) return false;
    if (combo.alt && !event.altKey) return false;
    if (!combo.alt && event.altKey) return false;

    const eventKey = normalizeEventKey(event.key);
    return combo.key === eventKey;
};

const resolveScopeFromPath = (pathname = '') => {
    if (!pathname) return 'global';
    if (pathname.startsWith('/clients')) return 'clientes';
    if (pathname.startsWith('/cases')) return 'casos';
    if (pathname.startsWith('/documents')) return 'documentos';
    if (pathname.startsWith('/agenda') || pathname === '/') return 'agenda';
    if (pathname.startsWith('/settings')) return 'sistema';
    return 'global';
};

export const HotkeysProvider = ({ children }) => {
    const location = useLocation();
    const [hotkeysConfig, setHotkeysConfig] = useState(() => getCustomHotkeysConfig());
    const [isEnabled, setIsEnabled] = useState(() => {
        if (typeof window === 'undefined') return true;
        const stored = window.localStorage?.getItem('hotkeys-enabled');
        return stored !== 'false';
    });

    const listenersRef = useRef(new Map());

    const currentScope = useMemo(
        () => resolveScopeFromPath(location.pathname),
        [location.pathname],
    );

    const parsedConfigs = useMemo(() => {
        return hotkeysConfig.map((config) => ({
            ...config,
            combos: parseHotkeyString(config.keys),
        }));
    }, [hotkeysConfig]);

    const dispatchAction = useCallback((actionName, event) => {
        const listeners = listenersRef.current.get(actionName);
        if (!listeners || listeners.size === 0) return;
        listeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                console.error(`[Hotkeys] Error ejecutando handler de ${actionName}`, error);
            }
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!isEnabled) return;
            const target = event.target;
            if (isTextInput(target) && !(event.metaKey || event.ctrlKey || event.altKey)) {
                return;
            }
            for (const config of parsedConfigs) {
                const listeners = listenersRef.current.get(config.action);
                if (!listeners || listeners.size === 0) continue;
                if (config.scope !== 'global' && config.scope !== currentScope) continue;
                if (!config.combos.length) continue;
                const matches = config.combos.some((combo) => matchCombo(combo, event));
                if (matches) {
                    event.preventDefault();
                    dispatchAction(config.action, event);
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [parsedConfigs, currentScope, isEnabled, dispatchAction]);

    const onAction = useCallback((actionName, handler) => {
        if (!actionName || typeof handler !== 'function') return;
        const map = listenersRef.current;
        if (!map.has(actionName)) {
            map.set(actionName, new Set());
        }
        map.get(actionName).add(handler);
    }, []);

    const offAction = useCallback((actionName, handler) => {
        const map = listenersRef.current;
        const listeners = map.get(actionName);
        if (!listeners) return;
        listeners.delete(handler);
        if (listeners.size === 0) {
            map.delete(actionName);
        }
    }, []);

    const toggleHotkeys = useCallback(() => {
        setIsEnabled((prev) => {
            const next = !prev;
            if (typeof window !== 'undefined') {
                window.localStorage?.setItem('hotkeys-enabled', String(next));
            }
            return next;
        });
    }, []);

    const updateHotkey = useCallback((id, newKeys) => {
        saveCustomHotkey(id, newKeys);
        setHotkeysConfig(getCustomHotkeysConfig());
    }, []);

    const resetHotkeys = useCallback(() => {
        resetCustomHotkeysConfig();
        setHotkeysConfig(getCustomHotkeysConfig());
    }, []);

    const contextValue = useMemo(() => ({
        isEnabled,
        toggleHotkeys,
        currentScope,
        hotkeysConfig,
        updateHotkey,
        resetHotkeys,
        onAction,
        offAction,
    }), [
        currentScope,
        hotkeysConfig,
        isEnabled,
        offAction,
        onAction,
        resetHotkeys,
        toggleHotkeys,
        updateHotkey,
    ]);

    return (
        <HotkeysContext.Provider value={contextValue}>
            {children}
        </HotkeysContext.Provider>
    );
};

export default HotkeysContext;
