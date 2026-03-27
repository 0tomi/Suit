import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tiptap/react', () => ({
    EditorContent: () => (
        <div
            data-testid="editor-content"
            contentEditable
            suppressContentEditableWarning
        >
            Contenido editable
        </div>
    ),
}));

vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }) => <div data-testid="bubble-menu">{children}</div>,
}));

vi.mock('../../src/components/Editor/EditorToolbar.jsx', () => ({
    default: () => <div data-testid="editor-toolbar" />,
}));

vi.mock('../../src/components/Editor/EditorStatusBar.jsx', () => ({
    default: () => <div data-testid="editor-status-bar" />,
}));

vi.mock('../../src/components/Editor/FindReplacePanel.jsx', () => ({
    default: ({ open, replaceMode }) => (
        open ? <div data-testid="editor-find-replace-panel">replace:{String(replaceMode)}</div> : null
    ),
}));

vi.mock('../../src/components/Editor/KeyboardShortcutsModal.jsx', () => ({
    default: ({ open }) => (open ? <div data-testid="editor-shortcuts-modal" /> : null),
}));

vi.mock('../../src/components/Editor/DocumentRuler.jsx', () => ({
    default: () => <div data-testid="document-ruler" />,
}));

vi.mock('../../src/components/Editor/DocumentVerticalRuler.jsx', () => ({
    default: () => <div data-testid="document-vertical-ruler" />,
}));

vi.mock('../../src/components/Editor/FontFamilyPicker.jsx', () => ({
    FontFamilyPicker: () => <div data-testid="font-family-picker" />,
}));

vi.mock('../../src/components/Editor/extensions/SearchAndReplace.js', () => ({
    getSearchAndReplaceState: () => ({
        searchTerm: '',
        replaceTerm: '',
        matches: [],
        activeIndex: -1,
    }),
}));

vi.mock('../../src/components/Editor/marginsUtils.js', () => ({
    DEFAULT_MARGINS: { top: 72, bottom: 72, left: 72, right: 72, unit: 'pt', mirrored: false },
    getVisualPageMargins: (margins) => margins,
    getPagePixelSize: () => ({ widthPx: 794, heightPx: 1123 }),
    normalizeMargins: (margins) => margins,
}));

vi.mock('../../src/components/Editor/selectionTextTransform.js', () => ({
    transformSelectedText: vi.fn(),
}));

vi.mock('../../src/components/Editor/extensions/AutoPagination.js', () => ({
    autoPaginationPluginKey: {
        getState: () => ({ breakPositions: [] }),
    },
}));

vi.mock('../../src/components/Editor/pageLayoutUtils.js', () => ({
    PAGE_GAP_PX: 24,
}));

import EditorCanvas from '../../src/components/Editor/EditorCanvas.jsx';

function createChainStub() {
    const chain = {
        focus: vi.fn(() => chain),
        run: vi.fn(),
        unsetLink: vi.fn(() => chain),
        setLink: vi.fn(() => chain),
        unsetFontSize: vi.fn(() => chain),
        setFontSize: vi.fn(() => chain),
        setFontFamily: vi.fn(() => chain),
        toggleBold: vi.fn(() => chain),
        toggleItalic: vi.fn(() => chain),
        toggleStrike: vi.fn(() => chain),
        setPageBreak: vi.fn(() => chain),
        setIndentLevel: vi.fn(() => chain),
    };

    return chain;
}

function createEditorStub() {
    const chain = createChainStub();
    const editor = {
        state: { selection: { empty: true } },
        on: vi.fn(),
        off: vi.fn(),
        commands: {
            clearSearch: vi.fn(),
            setSearchTerm: vi.fn(),
            focusCurrentSearchMatch: vi.fn(),
            setReplaceTerm: vi.fn(),
            findPrev: vi.fn(),
            findNext: vi.fn(),
            replaceCurrent: vi.fn(),
            replaceAll: vi.fn(),
        },
        chain: vi.fn(() => chain),
        getAttributes: vi.fn(() => ({})),
        isActive: vi.fn(() => false),
    };

    Object.defineProperty(editor, 'view', {
        configurable: true,
        get() {
            throw new Error('EditorCanvas no debe acceder a editor.view antes del montaje');
        },
    });

    return editor;
}

describe('EditorCanvas', () => {
    it('no toca editor.view antes del montaje y abre búsqueda con Ctrl+F', () => {
        render(
            <EditorCanvas
                editor={createEditorStub()}
                margins={{ top: 72, bottom: 72, left: 72, right: 72, unit: 'pt', mirrored: false }}
            />,
        );

        fireEvent.keyDown(screen.getByTestId('editor-content'), {
            key: 'f',
            ctrlKey: true,
        });

        expect(screen.getByTestId('editor-find-replace-panel')).toHaveTextContent('replace:false');
    });

    it('abre reemplazo con Ctrl+Shift+H solo cuando el editor es editable', () => {
        const { rerender } = render(
            <EditorCanvas
                editor={createEditorStub()}
                margins={{ top: 72, bottom: 72, left: 72, right: 72, unit: 'pt', mirrored: false }}
                readOnly
            />,
        );

        fireEvent.keyDown(screen.getByTestId('editor-content'), {
            key: 'H',
            ctrlKey: true,
            shiftKey: true,
        });

        expect(screen.queryByTestId('editor-find-replace-panel')).not.toBeInTheDocument();

        rerender(
            <EditorCanvas
                editor={createEditorStub()}
                margins={{ top: 72, bottom: 72, left: 72, right: 72, unit: 'pt', mirrored: false }}
            />,
        );

        fireEvent.keyDown(screen.getByTestId('editor-content'), {
            key: 'H',
            ctrlKey: true,
            shiftKey: true,
        });

        expect(screen.getByTestId('editor-find-replace-panel')).toHaveTextContent('replace:true');
    });
});
