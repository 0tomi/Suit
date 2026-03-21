import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import React from 'react';
import { HotkeysProvider } from '../../src/hotkeys/HotkeysProvider.jsx';
import { useHotkeyAction } from '../../src/hotkeys/useHotkeysSystem.js';

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
});
