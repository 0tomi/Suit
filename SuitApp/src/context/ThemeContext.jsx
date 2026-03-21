/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { createLogger } from '../services/logService.js';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'suit-theme';
const logger = createLogger('theme-context');

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
    return ctx;
};

export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'light';
        } catch (error) {
            void logger.warn('No se pudo leer la preferencia de tema desde localStorage', error);
            return 'light';
        }
    });

    // Aplicar la clase al <html> cuando cambia el theme
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme]);

    const setTheme = useCallback((newTheme) => {
        setThemeState(newTheme);
        try {
            localStorage.setItem(STORAGE_KEY, newTheme);
        } catch (error) {
            void logger.warn('No se pudo persistir la preferencia de tema', error);
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);

    const value = useMemo(() => ({
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === 'dark',
    }), [theme, setTheme, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
