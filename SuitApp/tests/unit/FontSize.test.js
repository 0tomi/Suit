import { describe, it, expect } from 'vitest';
import FontSize from '../../src/components/Editor/extensions/FontSize.js';

// FontSize is a TipTap Extension. We test its configuration objects directly
// without mounting a real ProseMirror editor, since jsdom does not support
// the canvas/DOM APIs ProseMirror relies on at mount time.

describe('FontSize extension — attribute configuration', () => {
    // Resolve the attribute descriptor however the extension exposes it
    function getAttributeConfig() {
        // Access via the raw Extension config
        const raw = FontSize.config?.addGlobalAttributes?.();
        if (raw) return raw;

        // Fallback: instantiate and call
        const instance = FontSize.create ? FontSize.create() : FontSize;
        if (typeof instance.addGlobalAttributes === 'function') {
            return instance.addGlobalAttributes();
        }
        return [];
    }

    it('targets the textStyle type', () => {
        const attrs = getAttributeConfig();
        expect(attrs.length).toBeGreaterThan(0);
        const entry = attrs[0];
        expect(entry.types).toContain('textStyle');
    });

    it('has a fontSize attribute with null default', () => {
        const attrs = getAttributeConfig();
        const entry = attrs[0];
        expect(entry.attributes).toHaveProperty('fontSize');
        expect(entry.attributes.fontSize.default).toBeNull();
    });

    describe('parseHTML', () => {
        it('parses font-size from an element inline style', () => {
            const attrs = getAttributeConfig();
            const { parseHTML } = attrs[0].attributes.fontSize;

            const element = document.createElement('span');
            element.style.fontSize = '14pt';
            expect(parseHTML(element)).toBe('14pt');
        });

        it('returns null when element has no font-size style', () => {
            const attrs = getAttributeConfig();
            const { parseHTML } = attrs[0].attributes.fontSize;

            const element = document.createElement('span');
            expect(parseHTML(element)).toBeNull();
        });
    });

    describe('renderHTML', () => {
        it('returns an object with style containing the font-size value', () => {
            const attrs = getAttributeConfig();
            const { renderHTML } = attrs[0].attributes.fontSize;

            const result = renderHTML({ fontSize: '14pt' });
            expect(result).toEqual({ style: 'font-size: 14pt' });
        });

        it('returns an empty object when fontSize is null', () => {
            const attrs = getAttributeConfig();
            const { renderHTML } = attrs[0].attributes.fontSize;

            expect(renderHTML({ fontSize: null })).toEqual({});
        });

        it('returns an empty object when fontSize is undefined', () => {
            const attrs = getAttributeConfig();
            const { renderHTML } = attrs[0].attributes.fontSize;

            expect(renderHTML({})).toEqual({});
        });

        it('renders various valid pt sizes correctly', () => {
            const attrs = getAttributeConfig();
            const { renderHTML } = attrs[0].attributes.fontSize;

            for (const size of ['10pt', '11pt', '12pt', '16pt', '24pt', '36pt']) {
                expect(renderHTML({ fontSize: size })).toEqual({ style: `font-size: ${size}` });
            }
        });
    });

    describe('addCommands — shape check', () => {
        it('exposes setFontSize and unsetFontSize command factories', () => {
            // We only verify the commands are defined as functions — executing
            // them requires a live ProseMirror chain which is not available in jsdom.
            const commandMap = FontSize.config?.addCommands?.();
            expect(typeof commandMap.setFontSize).toBe('function');
            expect(typeof commandMap.unsetFontSize).toBe('function');
        });

        it('setFontSize command factory returns a function that accepts a chain', () => {
            const commandMap = FontSize.config?.addCommands?.();
            const innerFn = commandMap.setFontSize('12pt');
            expect(typeof innerFn).toBe('function');
        });

        it('unsetFontSize command factory returns a function that accepts a chain', () => {
            const commandMap = FontSize.config?.addCommands?.();
            const innerFn = commandMap.unsetFontSize();
            expect(typeof innerFn).toBe('function');
        });
    });
});
