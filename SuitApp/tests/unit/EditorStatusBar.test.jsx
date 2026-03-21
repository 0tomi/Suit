import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EditorStatusBar from '../../src/components/Editor/EditorStatusBar.jsx';

// Build a minimal editor mock that satisfies EditorStatusBar's requirements.
// The component only accesses editor.storage.characterCount.words() and .characters().
function makeEditorMock({ words = 0, characters = 0 } = {}) {
    return {
        storage: {
            characterCount: {
                words: () => words,
                characters: () => characters,
            },
        },
    };
}

describe('EditorStatusBar', () => {
    describe('word count display', () => {
        it('shows "0 palabras" when the editor is empty', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 0, characters: 0 })} />);
            expect(screen.getByText('0 palabras')).toBeInTheDocument();
        });

        it('uses the singular form "palabra" when word count is exactly 1', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 1, characters: 5 })} />);
            expect(screen.getByText('1 palabra')).toBeInTheDocument();
        });

        it('uses the plural form "palabras" when word count is 2', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 2, characters: 10 })} />);
            expect(screen.getByText('2 palabras')).toBeInTheDocument();
        });

        it('uses the plural form "palabras" for any count greater than 1', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 150, characters: 900 })} />);
            expect(screen.getByText('150 palabras')).toBeInTheDocument();
        });
    });

    describe('character count display', () => {
        it('shows "0 caracteres" when the editor is empty', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 0, characters: 0 })} />);
            expect(screen.getByText('0 caracteres')).toBeInTheDocument();
        });

        it('uses the singular form "carácter" when character count is exactly 1', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 1, characters: 1 })} />);
            expect(screen.getByText('1 carácter')).toBeInTheDocument();
        });

        it('uses the plural form "caracteres" when character count is 2', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 1, characters: 2 })} />);
            expect(screen.getByText('2 caracteres')).toBeInTheDocument();
        });

        it('uses the plural form "caracteres" for large counts', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 42, characters: 253 })} />);
            expect(screen.getByText('253 caracteres')).toBeInTheDocument();
        });
    });

    describe('fallback when characterCount storage is missing', () => {
        it('falls back to 0 for both counts when storage.characterCount is undefined', () => {
            const editor = { storage: {} };
            render(<EditorStatusBar editor={editor} />);
            expect(screen.getByText('0 palabras')).toBeInTheDocument();
            expect(screen.getByText('0 caracteres')).toBeInTheDocument();
        });
    });

    describe('layout', () => {
        it('renders both the words span and the characters span together', () => {
            render(<EditorStatusBar editor={makeEditorMock({ words: 3, characters: 15 })} />);
            expect(screen.getByText('3 palabras')).toBeInTheDocument();
            expect(screen.getByText('15 caracteres')).toBeInTheDocument();
        });
    });
});
