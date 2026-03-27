import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import React from 'react';
import { HotkeysProvider } from '../../src/hotkeys/HotkeysProvider.jsx';
import { useHotkeyAction, useHotkeysSystem } from '../../src/hotkeys/useHotkeysSystem.js';

describe('Hotkeys', () => {
    test('triggering mod+k', () => {
        const fn = vi.fn();
        const TestComponent = () => {
            useHotkeyAction('hotkey:open-global-search', fn);
            return <div>Test</div>;
        };

        render(
            <MemoryRouter>
                <HotkeysProvider>
                    <TestComponent />
                </HotkeysProvider>
            </MemoryRouter>
        );

        fireEvent.keyDown(window, {
            key: 'k',
            ctrlKey: true
        });

        expect(fn).toHaveBeenCalled();
    });

    test('suspende todas las hotkeys salvo escape', () => {
        const openSearch = vi.fn();
        const onEscape = vi.fn();

        const TestComponent = () => {
            const { suspendAllHotkeysExceptEscape } = useHotkeysSystem();

            React.useEffect(() => suspendAllHotkeysExceptEscape(), [suspendAllHotkeysExceptEscape]);
            useHotkeyAction('hotkey:open-global-search', openSearch);
            useHotkeyAction('hotkey:escape-current', onEscape);

            return <div>Test</div>;
        };

        render(
            <MemoryRouter>
                <HotkeysProvider>
                    <TestComponent />
                </HotkeysProvider>
            </MemoryRouter>
        );

        fireEvent.keyDown(window, {
            key: 'k',
            ctrlKey: true,
        });
        fireEvent.keyDown(window, {
            key: 'Escape',
        });

        expect(openSearch).not.toHaveBeenCalled();
        expect(onEscape).toHaveBeenCalledTimes(1);
    });
});
