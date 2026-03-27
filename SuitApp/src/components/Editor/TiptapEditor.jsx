/**
 * TiptapEditor.jsx — Wrapper de TipTap para DocumentEditor.
 *
 * Responsabilidades de este componente:
 *  - Instanciar el editor (useEditor) con todas las extensiones necesarias
 *  - Sincronizar el contenido externo (prop `content`) con el editor
 *  - Manejar la inserción de imágenes via Electron dialog
 *  - Delegar todo el rendering al componente compartido EditorCanvas
 *
 * El estado de búsqueda, atajos de teclado y reglas de márgenes
 * está encapsulado en EditorCanvas.
 *
 * Rendimiento: el callback `onChange` (que actualiza el estado React del padre)
 * se llama con debounce de 300 ms para evitar que `getHTML()` + re-render
 * bloqueen el hilo principal en cada tecla. El contenido más reciente siempre
 * está disponible via el ref expuesto (getLatestContent).
 */
import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { useEditor } from '@tiptap/react';
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
import Variable from './extensions/Variable';
import FontSize from './extensions/FontSize';
import Indent from './extensions/Indent.js';
import PageBreak from './extensions/PageBreak.js';
import SearchAndReplace from './extensions/SearchAndReplace.js';
import suggestion from './extensions/suggestion';
import VerticalSpacing from './extensions/VerticalSpacing.js';
import AutoPagination from './extensions/AutoPagination.js';
import { showAppToast } from '../ui/show-app-toast.jsx';
import EditorCanvas from './EditorCanvas.jsx';

const IMAGE_ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const IMAGE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const TiptapEditorInner = ({
    content,
    onChange,
    placeholder = 'Escribe tu documento aquí...',
    readOnly = false,
    isTemplateMode = false,
    margins,
    onMarginsChange,
    onEditMargins,
    defaultFont,
}, ref) => {
    const isUpdatingFromOutside = useRef(false);
    const marginsRef = useRef(margins);
    const lastInternalHtmlRef = useRef(content ?? '');

    // Cuando es true, TipTap tiene edits que React aún no conoce (debounce pendiente).
    // Bloquea el useEffect de sync de contenido para evitar que React sobreescriba
    // el editor con el HTML desactualizado del estado.
    const hasUnsyncedEdits = useRef(false);
    const onUpdateTimerRef = useRef(null);

    useEffect(() => {
        marginsRef.current = margins;
    }, [margins]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder }),
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
                HTMLAttributes: { class: 'variable-node' },
                suggestion,
                renderHTML({ options, node }) {
                    return ['span', this.HTMLAttributes, `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`];
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
            AutoPagination.configure({
                getPageLayout: () => marginsRef.current,
            }),
            Image.configure({ allowBase64: true, inline: false }),
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
            VerticalSpacing,
        ],
        content: content ?? '',
        editable: !readOnly,
        onUpdate: ({ editor: nextEditor }) => {
            if (isUpdatingFromOutside.current) {
                isUpdatingFromOutside.current = false;
                return;
            }

            // Marca que TipTap está por delante de React: bloquea el sync useEffect
            // hasta que el debounce resuelva y actualice lastInternalHtmlRef.
            hasUnsyncedEdits.current = true;

            // Debounce de 300 ms: getHTML() + el setState del padre solo se llaman
            // cuando el usuario hace una pausa, no en cada tecla. Esto elimina el
            // bloqueo del hilo principal que producía el efecto de "letras por lote".
            clearTimeout(onUpdateTimerRef.current);
            onUpdateTimerRef.current = setTimeout(() => {
                const html = nextEditor.getHTML();
                lastInternalHtmlRef.current = html;
                hasUnsyncedEdits.current = false;
                onChange(html);
            }, 300);
        },
        editorProps: {
            attributes: {
                // El estilo visual (prose, tamaño, padding, sombra) lo maneja EditorCanvas
                // en su wrapper div para que los márgenes sean reactivos sin conflictos con TipTap.
                class: 'focus:outline-none',
                spellcheck: 'true',
                lang: 'es-AR',
            },
        },
    });

    // Expone getLatestContent() al padre via ref para que handleSave/handleExportPdf
    // puedan obtener el HTML actual incluso durante el debounce.
    useImperativeHandle(ref, () => ({
        getLatestContent: () => {
            if (editor) return editor.getHTML();
            return lastInternalHtmlRef.current ?? '';
        },
    }), [editor]);

    // Limpia el timer al desmontar para evitar llamadas a onChange con editor destruido.
    useEffect(() => {
        return () => clearTimeout(onUpdateTimerRef.current);
    }, []);

    // Sincronizar contenido externo → editor.
    // Se salta si hay edits pendientes (hasUnsyncedEdits) para no pisar lo que el usuario
    // está escribiendo con el HTML viejo que aún tiene el estado de React.
    useEffect(() => {
        if (!editor) return;
        if (hasUnsyncedEdits.current) return;
        const nextContent = content ?? '';
        if (nextContent === lastInternalHtmlRef.current) return;
        lastInternalHtmlRef.current = null;
        isUpdatingFromOutside.current = true;
        editor.commands.setContent(nextContent, false);
    }, [content, editor]);

    // Sincronizar readOnly → editor.editable
    useEffect(() => {
        if (editor) editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    // ─── Inserción de imagen via Electron dialog ──────────────────────────────

    const handleInsertImage = useCallback(async () => {
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
            if (!result?.dataUrl) throw new Error(result?.error || 'No se pudo cargar la imagen seleccionada.');

            const fileName = result.fileName || 'Imagen';
            editor.chain().focus().setImage({ src: result.dataUrl, alt: fileName, title: fileName }).run();
            showAppToast({ title: 'Imagen insertada', description: `Se agregó "${fileName}" al documento.`, variant: 'success' });
        } catch (error) {
            showAppToast({ title: 'Error al insertar imagen', description: error.message || 'No se pudo insertar la imagen.', variant: 'danger' });
        }
    }, [editor, readOnly]);

    // ─── Inserción de variable @ (modo plantilla) ─────────────────────────────

    const addVariable = useCallback(() => {
        editor.chain().focus().insertContent('@').run();
    }, [editor]);

    return (
        <EditorCanvas
            editor={editor}
            readOnly={readOnly}
            margins={margins}
            onMarginsChange={onMarginsChange}
            onEditMargins={onEditMargins}
            defaultFont={defaultFont}
            onInsertImage={handleInsertImage}
            onAddVariable={isTemplateMode ? addVariable : null}
        />
    );
};

export default React.memo(React.forwardRef(TiptapEditorInner));
