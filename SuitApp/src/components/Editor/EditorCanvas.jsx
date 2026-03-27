/**
 * EditorCanvas.jsx — Canvas visual compartido entre TemplateEditor y TiptapEditor.
 *
 * Recibe un editor TipTap ya instanciado y renderiza toda la UI del área de edición:
 * toolbar, búsqueda/reemplazo, atajos de teclado, reglas con márgenes, y el contenido.
 *
 * Gestiona internamente:
 *  - Estado de búsqueda/reemplazo (searchUi, searchState)
 *  - Modal de atajos de teclado (shortcutsOpen)
 *  - Atajos de teclado globales del editor (Ctrl+F, Ctrl+H)
 */
import React, { useState, useEffect } from 'react';
import { EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Italic, Strikethrough, Link2, Link2Off } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import EditorStatusBar from './EditorStatusBar';
import FindReplacePanel from './FindReplacePanel.jsx';
import KeyboardShortcutsModal from './KeyboardShortcutsModal.jsx';
import DocumentRuler from './DocumentRuler.jsx';
import DocumentVerticalRuler from './DocumentVerticalRuler.jsx';
import { FontFamilyPicker } from './FontFamilyPicker.jsx';
import { getSearchAndReplaceState } from './extensions/SearchAndReplace.js';
import { DEFAULT_MARGINS, getVisualPageMargins, getPagePixelSize, normalizeMargins } from './marginsUtils.js';
import { transformSelectedText } from './selectionTextTransform.js';
import { autoPaginationPluginKey } from './extensions/AutoPagination.js';
import { PAGE_GAP_PX } from './pageLayoutUtils.js';

const EMPTY_SEARCH_STATE = { searchTerm: '', replaceTerm: '', matches: [], activeIndex: -1 };
const INLINE_FONT_SIZE_OPTIONS = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt'];
const PROTOCOL_REGEX = /^https?:\/\//i;

// JSX estático: elevar fuera del componente evita recrear los nodos en cada render del BubbleMenu.
const FONT_SIZE_OPTION_NODES = INLINE_FONT_SIZE_OPTIONS.map((option) => (
    <option key={option} value={option}>{option.replace('pt', '')}</option>
));
const bubbleButtonClasses = (active = false) => [
    'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
    active
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
].join(' ');

/**
 * Canvas visual del editor.
 *
 * @param {object} editor - Instancia TipTap ya creada por el componente padre.
 * @param {boolean} readOnly - Si true, deshabilita toolbar de edición, reglas y BubbleMenu.
 * @param {object} margins - Objeto de márgenes { top, bottom, left, right, unit, mirrored }.
 * @param {function} onMarginsChange - Callback al arrastrar un handle de regla.
 * @param {function} onEditMargins - Callback para abrir el modal de márgenes (opcional).
 * @param {string} defaultFont - Fuente base del documento (opcional, p.ej. desde DOCX).
 * @param {function} onInsertImage - Callback para insertar imagen desde disco (opcional).
 * @param {function} onAddVariable - Callback para insertar variable @ (opcional).
 */
const EditorCanvas = ({
    editor,
    readOnly = false,
    margins,
    onMarginsChange,
    onEditMargins,
    defaultFont,
    onInsertImage,
    onAddVariable,
}) => {
    const [searchUi, setSearchUi] = useState({ open: false, replaceMode: false });
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [searchState, setSearchState] = useState(EMPTY_SEARCH_STATE);
    const [mirroredPreviewSide, setMirroredPreviewSide] = useState('odd');
    const [pageBreakCount, setPageBreakCount] = useState(0);

    // Sincroniza el conteo de saltos de página del plugin AutoPagination para
    // que minHeight del contenedor crezca con cada página nueva y la última
    // página siempre se vea completa (no truncada al alto del contenido).
    useEffect(() => {
        if (!editor) return undefined;
        const syncBreaks = () => {
            const count = autoPaginationPluginKey.getState(editor.state)?.breakPositions?.length ?? 0;
            // Evita llamar al setter si el valor no cambió, reduciendo el overhead del scheduler de React.
            setPageBreakCount((prev) => (prev === count ? prev : count));
        };
        syncBreaks();
        editor.on('transaction', syncBreaks);
        return () => editor.off('transaction', syncBreaks);
    }, [editor]);

    // Usa márgenes recibidos o el default de 1 pulgada en todos los lados
    const activeMargins = normalizeMargins(margins || DEFAULT_MARGINS);
    const currentPreviewSide = activeMargins.mirrored ? mirroredPreviewSide : 'odd';
    const pageMargins = getVisualPageMargins(activeMargins, currentPreviewSide);
    const { widthPx: pageWidthPx, heightPx: pageHeightPx } = getPagePixelSize(activeMargins);
    const canvasFrameWidthPx = pageWidthPx + 40;
    // Altura mínima del contenedor para que cada página se vea completa:
    // N páginas × altura de página + (N-1) gaps entre páginas.
    const minHeightPx = (pageBreakCount + 1) * pageHeightPx + pageBreakCount * PAGE_GAP_PX;

    // ─── Sincronización del estado de búsqueda ───────────────────────────────
    // Solo suscribir el listener cuando el panel está abierto para evitar re-renders
    // en cada keystroke/movimiento de cursor cuando la búsqueda está inactiva.
    useEffect(() => {
        if (!editor || !searchUi.open) return undefined;

        const sync = () => {
            const s = getSearchAndReplaceState(editor.state);
            setSearchState({
                searchTerm: s.searchTerm,
                replaceTerm: s.replaceTerm,
                matches: s.matches,
                activeIndex: s.activeIndex,
            });
        };

        sync();
        editor.on('transaction', sync);
        return () => editor.off('transaction', sync);
    }, [editor, searchUi.open]);

    if (!editor) return null;

    // ─── Handlers del panel de búsqueda ─────────────────────────────────────

    const openSearchPanel = (replaceMode = false) => {
        setSearchUi({ open: true, replaceMode: readOnly ? false : replaceMode });
    };

    const closeSearchPanel = () => {
        editor.commands.clearSearch();
        editor.chain().focus().run();
        setSearchUi({ open: false, replaceMode: false });
    };

    const getCurrentIndentLevel = () => {
        if (!editor) return 0;
        const attrs = editor.isActive('heading')
            ? editor.getAttributes('heading')
            : editor.getAttributes('paragraph');

        return Number(attrs?.indent) || 0;
    };

    const handleEditMargins = () => {
        if (typeof onEditMargins !== 'function') return;
        onEditMargins({
            indentLevel: getCurrentIndentLevel(),
            onIndentChange: (nextLevel) => editor.chain().focus().setIndentLevel(nextLevel).run(),
        });
    };

    const handleSearchTermChange = (value) => {
        editor.commands.setSearchTerm(value);
        if (value.trim()) editor.commands.focusCurrentSearchMatch();
    };

    const handleReplaceTermChange = (value) => {
        editor.commands.setReplaceTerm(value);
    };

    /**
     * Maneja Ctrl+F / Ctrl+Shift+H desde el wrapper React del editor.
     * Evita leer `editor.view.dom` antes de que EditorContent termine de montar.
     */
    const handleCanvasKeyDownCapture = (event) => {
        const mod = event.metaKey || event.ctrlKey;
        if (!mod) return;

        const key = event.key.toLowerCase();
        if (key === 'f') {
            event.preventDefault();
            setSearchUi({ open: true, replaceMode: false });
            return;
        }

        if (event.shiftKey && key === 'h' && !readOnly) {
            event.preventDefault();
            setSearchUi({ open: true, replaceMode: true });
        }
    };

    // ─── Handler de enlace (BubbleMenu) ─────────────────────────────────────

    const openLinkInBubble = () => {
        const { href } = editor.getAttributes('link');
        const url = window.prompt('URL del enlace:', href || '');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().unsetLink().run();
        } else {
            const href2 = PROTOCOL_REGEX.test(url) ? url : `https://${url}`;
            editor.chain().focus().setLink({ href: href2 }).run();
        }
    };

    const applyTextCaseTransform = (transformer) => {
        editor.chain().focus().run();
        transformSelectedText(editor, transformer);
    };

    const handleBubbleFontSizeChange = (value) => {
        if (!value) {
            editor.chain().focus().unsetFontSize().run();
            return;
        }

        editor.chain().focus().setFontSize(value).run();
    };

    return (
        <div className="flex h-full w-full flex-col gap-4">
            <div className="w-full">
                <EditorToolbar
                    editor={editor}
                    readOnly={readOnly}
                    onEditMargins={readOnly ? null : handleEditMargins}
                    onInsertImage={readOnly ? null : onInsertImage}
                    onAddVariable={readOnly ? null : onAddVariable}
                    onInsertPageBreak={readOnly ? null : () => editor.chain().focus().setPageBreak().run()}
                    onToggleSearch={() => openSearchPanel(false)}
                    onOpenShortcuts={() => setShortcutsOpen(true)}
                    searchActive={searchUi.open}
                />
            </div>

            <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

            <FindReplacePanel
                open={searchUi.open}
                readOnly={readOnly}
                replaceMode={searchUi.replaceMode}
                searchTerm={searchState.searchTerm}
                replaceTerm={searchState.replaceTerm}
                matchCount={searchState.matches.length}
                activeIndex={searchState.activeIndex}
                onSearchTermChange={handleSearchTermChange}
                onReplaceTermChange={handleReplaceTermChange}
                onPrev={() => editor.commands.findPrev()}
                onNext={() => editor.commands.findNext()}
                onReplaceCurrent={() => editor.commands.replaceCurrent(searchState.replaceTerm)}
                onReplaceAll={() => editor.commands.replaceAll(searchState.replaceTerm)}
                onToggleReplaceMode={() => setSearchUi((s) => ({ ...s, replaceMode: !s.replaceMode }))}
                onClose={closeSearchPanel}
                pageWidthPx={pageWidthPx}
            />

            <div className="relative flex w-full justify-center">
                {!readOnly && (
                    <BubbleMenu
                        editor={editor}
                        tippyOptions={{ duration: 100, interactive: true }}
                        shouldShow={({ editor: ed }) => {
                            if (ed.isActive('templatePlaceholder')) return false;
                            return !ed.state.selection.empty;
                        }}
                        className="relative z-50 flex max-w-[min(92vw,56rem)] flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                    >
                        <button
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={bubbleButtonClasses(editor.isActive('bold'))}
                            title="Negrita"
                        >
                            <Bold size={16} />
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={bubbleButtonClasses(editor.isActive('italic'))}
                            title="Cursiva"
                        >
                            <Italic size={16} />
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                            className={bubbleButtonClasses(editor.isActive('strike'))}
                            title="Tachado"
                        >
                            <Strikethrough size={16} />
                        </button>
                        <div className="w-px h-4 bg-gray-200 self-center mx-0.5" />
                        <button
                            onClick={openLinkInBubble}
                            className={bubbleButtonClasses(editor.isActive('link'))}
                            title={editor.isActive('link') ? 'Editar enlace' : 'Insertar enlace'}
                        >
                            <Link2 size={16} />
                        </button>
                        {editor.isActive('link') && (
                            <button
                                onClick={() => editor.chain().focus().unsetLink().run()}
                                className="flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:bg-red-50"
                                title="Quitar enlace"
                            >
                                <Link2Off size={16} />
                            </button>
                        )}
                        <div className="mx-0.5 h-4 w-px self-center bg-gray-200" />
                        <button
                            type="button"
                            onClick={() => applyTextCaseTransform((text) => text.toUpperCase())}
                            className={bubbleButtonClasses(false)}
                            title="Convertir a mayúsculas"
                        >
                            AA
                        </button>
                        <button
                            type="button"
                            onClick={() => applyTextCaseTransform((text) => text.toLowerCase())}
                            className={bubbleButtonClasses(false)}
                            title="Convertir a minúsculas"
                        >
                            aa
                        </button>
                        <div className="mx-0.5 h-4 w-px self-center bg-gray-200" />
                        <FontFamilyPicker
                            value={editor.getAttributes('textStyle').fontFamily || ''}
                            onChange={(font) => editor.chain().focus().setFontFamily(font).run()}
                            disabled={false}
                        />
                        <select
                            value={editor.getAttributes('textStyle').fontSize || ''}
                            onChange={(event) => handleBubbleFontSizeChange(event.target.value)}
                            className="h-8 w-[4.75rem] rounded-lg border border-transparent bg-transparent px-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            aria-label="Tamaño de fuente inline"
                        >
                            <option value="">Tam.</option>
                            {FONT_SIZE_OPTION_NODES}
                        </select>
                    </BubbleMenu>
                )}

                <div className="w-full overflow-x-auto bg-slate-100 dark:bg-slate-800 py-4">
                    <div
                        className="mx-auto flex flex-col items-center"
                        style={{ width: `${canvasFrameWidthPx}px`, minWidth: `${canvasFrameWidthPx}px` }}
                    >
                    {activeMargins.mirrored && (
                        <div className="mb-2 flex items-center gap-2 self-center rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-800 shadow-sm dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                            <span className="font-semibold uppercase tracking-wide">Vista espejada</span>
                            <button
                                type="button"
                                onClick={() => setMirroredPreviewSide('odd')}
                                className={`rounded-full px-2.5 py-1 transition-colors ${
                                    mirroredPreviewSide === 'odd'
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                }`}
                            >
                                Página impar
                            </button>
                            <button
                                type="button"
                                onClick={() => setMirroredPreviewSide('even')}
                                className={`rounded-full px-2.5 py-1 transition-colors ${
                                    mirroredPreviewSide === 'even'
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                }`}
                            >
                                Página par
                            </button>
                        </div>
                    )}
                    {!readOnly && (
                        <DocumentRuler
                            editor={editor}
                            margins={activeMargins}
                            onMarginsChange={onMarginsChange}
                            previewSide={currentPreviewSide}
                        />
                    )}
                    <div className="relative w-fit pl-10">
                        {!readOnly && (
                            <DocumentVerticalRuler
                                editor={editor}
                                margins={activeMargins}
                                onMarginsChange={onMarginsChange}
                            />
                        )}
                        {/*
                         * Contenedor visual de la página con márgenes aplicados via style.
                         * Se usa un wrapper React en lugar de editorProps.attributes porque
                         * TipTap re-aplica setOptions en cada render, borrando cambios inline.
                         * La clase `prose` en este wrapper cascadea a los elementos del editor
                         * mediante selectores descendientes de Tailwind Typography.
                         */}
                        <div
                            className="prose prose-sm xl:prose-base max-w-none dark:prose-invert bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/60 rounded-sm border border-gray-200 dark:border-gray-600 transition-shadow"
                            style={{
                                width: `${pageWidthPx}px`,
                                minHeight: `${minHeightPx}px`,
                                paddingTop:    `${pageMargins.top}${pageMargins.unit}`,
                                paddingBottom: `${pageMargins.bottom}${pageMargins.unit}`,
                                paddingLeft:   `${pageMargins.left}${pageMargins.unit}`,
                                paddingRight:  `${pageMargins.right}${pageMargins.unit}`,
                                fontFamily: defaultFont ? `"${defaultFont}", Arial, sans-serif` : undefined,
                            }}
                            onKeyDownCapture={handleCanvasKeyDownCapture}
                        >
                            <EditorContent editor={editor} />
                        </div>
                    </div>
                    </div>
                </div>
            </div>

            <EditorStatusBar editor={editor} pageWidthPx={pageWidthPx} />
        </div>
    );
};

export default EditorCanvas;
