import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { FontFamily } from '@tiptap/extension-font-family';
import { Mention } from '@tiptap/extension-mention';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Bold, Italic, Strikethrough, Link2, Link2Off } from 'lucide-react';
import Variable from './extensions/Variable';
import FontSize from './extensions/FontSize';
import Indent from './extensions/Indent.js';
import PageBreak from './extensions/PageBreak.js';
import SearchAndReplace, { getSearchAndReplaceState } from './extensions/SearchAndReplace.js';
import suggestion from './extensions/suggestion';
import EditorToolbar from './EditorToolbar';
import EditorStatusBar from './EditorStatusBar';
import FindReplacePanel from './FindReplacePanel.jsx';
import KeyboardShortcutsModal from './KeyboardShortcutsModal.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';

const IMAGE_ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const IMAGE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const EMPTY_SEARCH_STATE = {
    searchTerm: '',
    replaceTerm: '',
    matches: [],
    activeIndex: -1,
};

const TiptapEditor = ({
    content,
    onChange,
    placeholder = 'Escribe tu documento aquí...',
    readOnly = false,
    isTemplateMode = false,
}) => {
    const isUpdatingFromOutside = useRef(false);
    // Guarda el último HTML emitido por el editor internamente (usuario escribiendo).
    // Permite al useEffect de sincronización de contenido evitar llamar editor.getHTML()
    // en cada render, lo que serializa el documento completo innecesariamente.
    const lastInternalHtmlRef = useRef(content ?? '');
    const readOnlyRef = useRef(readOnly);
    const [searchUi, setSearchUi] = useState({
        open: false,
        replaceMode: false,
    });
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [searchState, setSearchState] = useState(EMPTY_SEARCH_STATE);

    useEffect(() => {
        readOnlyRef.current = readOnly;
    }, [readOnly]);

    const openSearchPanel = (replaceMode = false) => {
        setSearchUi({
            open: true,
            replaceMode: readOnlyRef.current ? false : replaceMode,
        });
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder,
            }),
            Underline,
            Typography,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
                alignments: ['left', 'center', 'right', 'justify'],
            }),
            TextStyle,
            Color.configure({ types: ['textStyle'] }),
            Highlight.configure({ multicolor: true }),
            FontFamily,
            Mention.configure({
                HTMLAttributes: {
                    class: 'variable-node',
                },
                suggestion,
                renderHTML({ options, node }) {
                    return [
                        'span',
                        this.HTMLAttributes,
                        `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`,
                    ];
                },
            }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            Variable,
            FontSize,
            Indent,
            PageBreak,
            Superscript,
            Subscript,
            CharacterCount,
            SearchAndReplace,
            Image.configure({
                allowBase64: true,
                inline: false,
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
                HTMLAttributes: {
                    class: 'text-blue-600 underline hover:text-blue-800 cursor-pointer',
                    rel: 'noopener noreferrer',
                    target: '_blank',
                },
            }),
        ],
        content: content ?? '',
        editable: !readOnly,
        onUpdate: ({ editor: nextEditor }) => {
            if (isUpdatingFromOutside.current) {
                isUpdatingFromOutside.current = false;
                return;
            }
            const html = nextEditor.getHTML();
            lastInternalHtmlRef.current = html;
            onChange(html);
        },
        editorProps: {
            handleKeyDown: (_view, event) => {
                const isModifierPressed = event.metaKey || event.ctrlKey;
                const key = event.key.toLowerCase();

                if (isModifierPressed && key === 'f') {
                    event.preventDefault();
                    openSearchPanel(false);
                    return true;
                }

                if (isModifierPressed && event.shiftKey && key === 'h') {
                    event.preventDefault();
                    openSearchPanel(true);
                    return true;
                }

                return false;
            },
            attributes: {
                class: 'prose prose-sm xl:prose-base dark:prose-invert focus:outline-none min-h-[1123px] w-[794px] max-w-full p-12 bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/60 rounded-sm border border-gray-200 dark:border-gray-600 mx-auto transition-shadow',
            },
        },
    });

    useEffect(() => {
        if (!editor) return;

        const nextContent = content ?? '';
        // Evita serializar el documento completo con editor.getHTML() en cada render.
        // Si el contenido proviene del propio editor (user typing), lastInternalHtmlRef
        // ya lo registró y podemos hacer early-return sin tocar el editor.
        if (nextContent === lastInternalHtmlRef.current) return;

        lastInternalHtmlRef.current = null;
        isUpdatingFromOutside.current = true;
        editor.commands.setContent(nextContent, false);
    }, [content, editor]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly);
        }
    }, [editor, readOnly]);

    useEffect(() => {
        // Solo suscribir el listener cuando el panel está visible.
        // Escuchar cada transacción con el panel cerrado causaba un re-render de React
        // en cada keystroke/cursor move sin ningún beneficio para el usuario.
        if (!editor || !searchUi.open) return undefined;

        const syncSearchState = () => {
            const nextState = getSearchAndReplaceState(editor.state);
            setSearchState({
                searchTerm: nextState.searchTerm,
                replaceTerm: nextState.replaceTerm,
                matches: nextState.matches,
                activeIndex: nextState.activeIndex,
            });
        };

        syncSearchState();
        editor.on('transaction', syncSearchState);
        return () => {
            editor.off('transaction', syncSearchState);
        };
    }, [editor, searchUi.open]);

    const addVariable = () => {
        editor.chain().focus().insertContent('@').run();
    };

    const openLinkInBubble = () => {
        const { href } = editor.getAttributes('link');
        const url = window.prompt('URL del enlace:', href || '');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().unsetLink().run();
        } else {
            const href2 = /^https?:\/\//i.test(url) ? url : `https://${url}`;
            editor.chain().focus().setLink({ href: href2 }).run();
        }
    };

    const handleInsertImage = async () => {
        if (!editor || readOnly) return;

        const openImage = window.electronAPI?.dialog?.openImage;
        if (typeof openImage !== 'function') {
            showAppToast({
                title: 'Inserción no disponible',
                description: 'La selección de imágenes solo está disponible en Electron.',
                variant: 'danger',
            });
            return;
        }

        try {
            const result = await openImage({
                allowedExtensions: IMAGE_ALLOWED_EXTENSIONS,
                maxFileSizeBytes: IMAGE_MAX_FILE_SIZE_BYTES,
            });

            if (result?.canceled) return;

            if (!result?.dataUrl) {
                throw new Error(result?.error || 'No se pudo cargar la imagen seleccionada.');
            }

            const fileName = result.fileName || 'Imagen';
            editor.chain().focus().setImage({
                src: result.dataUrl,
                alt: fileName,
                title: fileName,
            }).run();

            showAppToast({
                title: 'Imagen insertada',
                description: `Se agregó "${fileName}" al documento.`,
                variant: 'success',
            });
        } catch (error) {
            showAppToast({
                title: 'Error al insertar imagen',
                description: error.message || 'No se pudo insertar la imagen.',
                variant: 'danger',
            });
        }
    };

    const closeSearchPanel = () => {
        if (!editor) return;
        editor.commands.clearSearch();
        editor.chain().focus().run();
        setSearchUi({
            open: false,
            replaceMode: false,
        });
    };

    const handleSearchTermChange = (value) => {
        if (!editor) return;
        editor.commands.setSearchTerm(value);
        if (value.trim()) {
            editor.commands.focusCurrentSearchMatch();
        }
    };

    const handleReplaceTermChange = (value) => {
        if (!editor) return;
        editor.commands.setReplaceTerm(value);
    };

    return (
        <div className="flex h-full w-full flex-col gap-4">
            <div className="w-full">
                <EditorToolbar
                    editor={editor}
                    onAddVariable={isTemplateMode ? addVariable : null}
                    onInsertImage={!readOnly ? handleInsertImage : null}
                    onInsertPageBreak={!readOnly ? () => editor.chain().focus().setPageBreak().run() : null}
                    onToggleSearch={() => openSearchPanel(false)}
                    onOpenShortcuts={() => setShortcutsOpen(true)}
                    searchActive={searchUi.open}
                    readOnly={readOnly}
                />
            </div>

            <KeyboardShortcutsModal
                open={shortcutsOpen}
                onClose={() => setShortcutsOpen(false)}
            />

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
                onPrev={() => editor?.commands.findPrev()}
                onNext={() => editor?.commands.findNext()}
                onReplaceCurrent={() => editor?.commands.replaceCurrent(searchState.replaceTerm)}
                onReplaceAll={() => editor?.commands.replaceAll(searchState.replaceTerm)}
                onToggleReplaceMode={() => setSearchUi((current) => ({
                    ...current,
                    replaceMode: !current.replaceMode,
                }))}
                onClose={closeSearchPanel}
            />

            <div className="relative flex w-full justify-center">
                {editor && !readOnly && (
                    <BubbleMenu
                        editor={editor}
                        tippyOptions={{ duration: 100 }}
                        className="flex bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1 gap-1 relative z-50"
                    >
                        <button
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={`p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${editor.isActive('bold') ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}
                            title="Negrita"
                        >
                            <Bold size={16} />
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={`p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${editor.isActive('italic') ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}
                            title="Cursiva"
                        >
                            <Italic size={16} />
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                            className={`p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${editor.isActive('strike') ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}
                            title="Tachado"
                        >
                            <Strikethrough size={16} />
                        </button>
                        <div className="w-px h-4 bg-gray-200 self-center mx-0.5" />
                        <button
                            onClick={openLinkInBubble}
                            className={`p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${editor.isActive('link') ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'}`}
                            title={editor.isActive('link') ? 'Editar enlace' : 'Insertar enlace'}
                        >
                            <Link2 size={16} />
                        </button>
                        {editor.isActive('link') && (
                            <button
                                onClick={() => editor.chain().focus().unsetLink().run()}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors focus:outline-none"
                                title="Quitar enlace"
                            >
                                <Link2Off size={16} />
                            </button>
                        )}
                    </BubbleMenu>
                )}
                <EditorContent editor={editor} className="flex w-full justify-center" />
            </div>

            {editor && <EditorStatusBar editor={editor} />}
        </div>
    );
};

export default React.memo(TiptapEditor);
