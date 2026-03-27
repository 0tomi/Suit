/**
 * TemplateEditor.jsx — Editor de plantillas con asignación de requisitos.
 *
 * Flujos soportados:
 *  - Crear desde cero: editor vacío, modo edición activado
 *  - Importar: recibe htmlContent vía location.state con #n# ya convertidos
 *  - Editar existente: carga template + requirements desde la API/caché
 *
 * Layout: header (título, categoría, lock/unlock, guardar) + dos columnas:
 *   [Editor TipTap con extensión TemplatePlaceholder]  |  [RequirementsPanel]
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Lock, LockOpen, Save, ArrowLeft, Loader2 } from 'lucide-react';

import Variable from '../components/Editor/extensions/Variable';
import FontSize from '../components/Editor/extensions/FontSize';
import Indent from '../components/Editor/extensions/Indent.js';
import PageBreak from '../components/Editor/extensions/PageBreak.js';
import SearchAndReplace from '../components/Editor/extensions/SearchAndReplace.js';
import { Mention } from '@tiptap/extension-mention';
import suggestion from '../components/Editor/extensions/suggestion';
import VerticalSpacing from '../components/Editor/extensions/VerticalSpacing.js';
import AutoPagination from '../components/Editor/extensions/AutoPagination.js';
import TemplatePlaceholder from '../components/Editor/extensions/TemplatePlaceholder.js';

import EditorCanvas from '../components/Editor/EditorCanvas.jsx';
import MarginsModal from '../components/Editor/MarginsModal.jsx';
import { loadMarginPreference, normalizeMargins } from '../components/Editor/marginsUtils.js';
import RequirementsPanel from '../components/templates/RequirementsPanel.jsx';

import { Button } from '../components/ui/Button.jsx';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';

import { useAuth } from '../context/AuthContext.jsx';
import { useTemplateCategories } from '../context/TemplateCategoriesContext.jsx';
import { useTemplates } from '../context/TemplatesContext.jsx';
import { useHotkeysSystem } from '../hotkeys/useHotkeysSystem.js';
import { getTemplate } from '../services/templateService.js';
import {
    getTemplateRequirements,
    replaceCachedTemplateRequirements,
} from '../services/sync/templateRequirementsSyncService.js';
import { createTemplateWithRequirements, updateTemplateWithRequirements } from '../services/templateCreationService.js';
import { injectPlaceholderNodes, extractTemplateData, getNextFieldId, countAssignedFields } from '../components/templates/templateEditorUtils.js';
import { pickBestTemplateRequirements } from '../utils/templateRequirements.js';
import { templateEditorSteps } from '../constants/tutorialSteps.js';

// ─── Página principal ──────────────────────────────────────────────────────────

const TemplateEditor = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();

    const isNew = !id;
    const locationState = location.state || {};

    const { user } = useAuth();
    const { template_categories: categories } = useTemplateCategories();
    const { refreshTemplates } = useTemplates();
    const { suspendAllHotkeysExceptEscape } = useHotkeysSystem();

    // Estado de la plantilla
    const [title, setTitle] = useState(typeof locationState.prefillTitle === 'string' ? locationState.prefillTitle : '');
    const [categoryId, setCategoryId] = useState('');
    const [isLoading, setIsLoading] = useState(!isNew);
    const [isSaving, setIsSaving] = useState(false);

    // Modo edición: al importar arranca en vista (texto bloqueado); desde cero en edición
    const [isEditing, setIsEditing] = useState(locationState.fromImport ? false : true);

    const isUpdatingFromOutside = useRef(false);
    const lastInternalHtmlRef = useRef('');
    const marginsRef = useRef(null);

    const [margins, setMargins] = useState(normalizeMargins(
        locationState.margins
        || loadMarginPreference(user?.id)
        || { top: 72, bottom: 72, left: 72, right: 72, unit: 'pt', mirrored: false }
    ));
    const [isMarginsModalOpen, setIsMarginsModalOpen] = useState(false);
    const [marginsModalContext, setMarginsModalContext] = useState({ indentLevel: 0, onIndentChange: null });
    // Fuente extraída del DOCX importado; se usa como font-family base del editor (fallback: Arial).
    const defaultFont = locationState.defaultFont ?? null;

    // Stats de campos asignados: { assigned, total } — bloquea el guardado si hay campos sin asignar
    const [editorStats, setEditorStats] = useState({ assigned: 0, total: 0 });

    // Estado para el ancho del panel lateral
    const [panelWidth, setPanelWidth] = useState(300);
    const isResizing = useRef(false);

    const handleSidebarResize = useCallback((e) => {
        if (!isResizing.current) return;
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 240 && newWidth <= 600) {
            setPanelWidth(newWidth);
        }
    }, []);

    const stopSidebarResizing = useCallback(() => {
        isResizing.current = false;
        window.removeEventListener('mousemove', handleSidebarResize);
        window.removeEventListener('mouseup', stopSidebarResizing);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, [handleSidebarResize]);

    const startResizing = useCallback((e) => {
        e.preventDefault(); // Detiene selección de texto accidental
        isResizing.current = true;
        window.addEventListener('mousemove', handleSidebarResize);
        window.addEventListener('mouseup', stopSidebarResizing);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }, [handleSidebarResize, stopSidebarResizing]);

    // Contenido inicial: desde location.state (import) o vacío; se sobreescribirá si hay id
    const initialContent = locationState.htmlContent
        ? injectPlaceholderNodes(locationState.htmlContent)
        : '';

    useEffect(() => {
        marginsRef.current = margins;
    }, [margins]);

    useEffect(() => {
        return suspendAllHotkeysExceptEscape();
    }, [suspendAllHotkeysExceptEscape]);

    // ─── Inicialización del editor TipTap ──────────────────────────────────────
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: 'Escribe el contenido de tu modelo aquí...' }),
            Underline,
            Typography,
            TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
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
            TemplatePlaceholder,
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
                HTMLAttributes: { class: 'text-blue-600 underline hover:text-blue-800 cursor-pointer', rel: 'noopener noreferrer', target: '_blank' },
            }),
            VerticalSpacing,
        ],
        content: initialContent,
        editable: isEditing,
        onUpdate: ({ editor: e }) => {
            if (isUpdatingFromOutside.current) {
                isUpdatingFromOutside.current = false;
                return;
            }
            lastInternalHtmlRef.current = e.getHTML();
        },
        editorProps: {
            attributes: {
                // Estilo mínimo: el contenedor visual (bg, shadow, padding) vive en EditorCanvas.
                class: 'focus:outline-none',
            },
            handleDOMEvents: {
                /**
                 * Permite soltar requisitos del panel sobre cualquier área del documento.
                 * Sin esto, el navegador no permite el drop si ProseMirror no reconoce
                 * el tipo de dato custom 'requisito' durante el dragover.
                 */
                dragover(view, event) {
                    if (event.dataTransfer?.types?.includes('requisito')) {
                        event.preventDefault();
                        return true;
                    }
                    return false;
                },
            },
            /**
             * Intercepta drops sobre el área del editor.
             * Si el drop es de un requisito del panel (no sobre una burbuja existente),
             * inserta un nuevo placeholder en la posición donde se soltó.
             * Si cae sobre una burbuja, devuelve false para que el onDrop de React la maneje.
             */
            handleDrop(view, event) {
                const raw = event.dataTransfer?.getData('requisito');
                if (!raw) return false;

                let data;
                try { data = JSON.parse(raw); } catch { return false; }
                if (!data?.id) return false;

                // Si cayó sobre una burbuja existente, su onDrop (React) lo maneja
                if (event.target?.closest?.('[data-field-id]')) return false;

                event.preventDefault();

                // Calcular el próximo fieldId buscando el máximo actual en el doc
                let maxId = 0;
                view.state.doc.descendants((node) => {
                    if (node.type.name === 'templatePlaceholder' && node.attrs?.fieldId) {
                        maxId = Math.max(maxId, node.attrs.fieldId);
                    }
                });

                // Obtener la posición en el documento bajo el cursor al soltar
                const posResult = view.posAtCoords({ left: event.clientX, top: event.clientY });
                const insertAt = posResult?.pos ?? view.state.doc.content.size - 1;

                // Crear e insertar el nodo templatePlaceholder con el requisito ya asignado
                const nodeType = view.state.schema.nodes.templatePlaceholder;
                if (!nodeType) return false;

                const newNode = nodeType.create({
                    fieldId: maxId + 1,
                    requisitoId: data.id,
                    requisitoTitle: data.title,
                    NEntidad: 1,
                });

                view.dispatch(view.state.tr.insert(insertAt, newNode));
                return true;
            },
        },
    });

    // Sincronizar modo edición con el editor
    useEffect(() => {
        if (editor) editor.setEditable(isEditing);
    }, [editor, isEditing]);

    // Mantener editorStats sincronizado con el contenido del editor para bloquear el guardado
    // cuando hay placeholders sin requisito asignado.
    useEffect(() => {
        if (!editor) return;
        const updateStats = () => setEditorStats(countAssignedFields(editor));
        updateStats();
        editor.on('update', updateStats);
        return () => editor.off('update', updateStats);
    }, [editor]);

    // ─── Carga de template existente ──────────────────────────────────────────
    useEffect(() => {
        if (!id || !editor) return;

        let cancelled = false;
        setIsLoading(true);

        (async () => {
            try {
                const [templateData, requirements] = await Promise.all([
                    getTemplate(id),
                    getTemplateRequirements(id),
                ]);

                if (cancelled) return;

                if (!templateData) throw new Error('No se encontró la plantilla.');

                // getTemplate devuelve el body crudo de la API, que envuelve en { data: { ... } }
                const tpl = templateData?.data ?? templateData;
                const resolvedRequirements = pickBestTemplateRequirements(
                    requirements,
                    tpl.requirements,
                );

                setTitle(tpl.title || '');
                setCategoryId(String(tpl.template_category_id || ''));

                if (tpl.margins) {
                    setMargins(tpl.margins);
                }

                const content = tpl.content || tpl.body || '';
                const processedHtml = injectPlaceholderNodes(content, resolvedRequirements);

                // Autocorrige el caché local si el detalle remoto vino más completo.
                if (resolvedRequirements.length > requirements.length) {
                    void replaceCachedTemplateRequirements(parseInt(id, 10), resolvedRequirements);
                }

                isUpdatingFromOutside.current = true;
                lastInternalHtmlRef.current = processedHtml;
                editor.commands.setContent(processedHtml, false);
            } catch (error) {
                if (!cancelled) {
                    showAppToast({ title: 'Error al cargar', description: error.message, variant: 'danger' });
                    navigate('/templates');
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [id, editor, navigate]);

    // ─── Acciones ──────────────────────────────────────────────────────────────

    const handleInsertRequirement = useCallback(() => {
        if (!editor) return;
        const nextId = getNextFieldId(editor);
        editor.chain().focus().insertContent({
            type: 'templatePlaceholder',
            attrs: { fieldId: nextId, requisitoId: null, requisitoTitle: null },
        }).run();
    }, [editor]);

    const handleSave = async () => {
        if (!title.trim()) {
            showAppToast({ title: 'Título requerido', description: 'Ingresá un título para el modelo.', variant: 'warning' });
            return;
        }
        if (!editor) return;

        setIsSaving(true);
        try {
            const { html, requirements } = extractTemplateData(editor);

            const payload = {
                title: title.trim(),
                content: html,
                template_category_id: categoryId ? parseInt(categoryId, 10) : null,
                margins, // Guardar márgenes en el payload
                requirements,
            };

            const result = isNew
                ? await createTemplateWithRequirements(payload)
                : await updateTemplateWithRequirements(parseInt(id, 10), payload);

            if (!result.ok) throw new Error(result.error || 'No se pudo guardar el modelo.');

            await refreshTemplates();

            showAppToast({
                title: isNew ? 'Modelo creado' : 'Modelo actualizado',
                description: `"${title.trim()}" guardado correctamente.`,
                variant: 'success',
            });

            navigate('/templates');
        } catch (error) {
            showAppToast({ title: 'Error al guardar', description: error.message, variant: 'danger' });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Render ────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-(--text-secondary)">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-sm">Cargando modelo...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-(--border-default) bg-(--bg-header) px-4 py-3">
                <button
                    type="button"
                    onClick={() => navigate('/templates')}
                    className="rounded-lg p-1.5 text-(--text-tertiary) hover:bg-(--bg-card-hover) hover:text-(--text-primary) transition-colors"
                    title="Volver a la galería"
                >
                    <ArrowLeft size={18} />
                </button>

                {/* Título editable */}
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título del modelo..."
                    className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-(--text-primary) placeholder-text-(--text-tertiary) hover:border-(--border-default) focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <SectionTutorialTrigger
                    steps={templateEditorSteps}
                    ariaLabel="Ver tutorial del editor de modelos"
                    testId="template-editor-tutorial-trigger"
                    className="shrink-0"
                />

                {/* Selector de categoría */}
                <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-1.5 text-sm text-(--text-secondary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                    ))}
                </select>

                {/* Botón lock/unlock */}
                <button
                    type="button"
                    onClick={() => setIsEditing((e) => !e)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                        isEditing
                            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                            : 'border-(--border-default) bg-(--bg-card) text-(--text-secondary) hover:bg-(--bg-card-hover)'
                    }`}
                    title={isEditing ? 'Bloquear edición' : 'Desbloquear edición'}
                >
                    {isEditing ? <LockOpen size={14} /> : <Lock size={14} />}
                    <span>{isEditing ? 'Edición' : 'Vista'}</span>
                </button>



                {/* Guardar: bloqueado si hay placeholders sin requisito asignado */}
                <Button
                    variant="primary"
                    icon={isSaving ? Loader2 : Save}
                    onClick={handleSave}
                    disabled={isSaving || (editorStats.total > 0 && editorStats.assigned < editorStats.total)}
                    title={
                        editorStats.total > 0 && editorStats.assigned < editorStats.total
                            ? `Faltan ${editorStats.total - editorStats.assigned} campo${editorStats.total - editorStats.assigned !== 1 ? 's' : ''} por asignar`
                            : undefined
                    }
                    className={isSaving ? '[&_svg]:animate-spin' : ''}
                >
                    {isSaving ? 'Guardando...' : 'Guardar modelo'}
                </Button>
            </div>

            {/* Cuerpo: editor + panel */}
            <div className="flex flex-1 overflow-hidden">
                {/* Editor */}
                <div className="flex-1 overflow-auto px-4 py-4">
                    <EditorCanvas
                        editor={editor}
                        readOnly={!isEditing}
                        margins={margins}
                        onMarginsChange={setMargins}
                        onEditMargins={(context) => {
                            setMarginsModalContext({
                                indentLevel: context?.indentLevel ?? 0,
                                onIndentChange: context?.onIndentChange ?? null,
                            });
                            setIsMarginsModalOpen(true);
                        }}
                        defaultFont={defaultFont}
                    />
                </div>

                {/* Panel de requisitos */}
                <div
                    className="relative flex shrink-0 flex-col overflow-hidden transition-[width] duration-75 pl-1.5 min-h-0"
                    style={{ width: `${panelWidth}px`, height: '100%' }}
                >
                    {/* Resizer Handle */}
                    <div
                        className="absolute left-0 top-0 bottom-0 w-1 group cursor-col-resize z-20"
                        onMouseDown={startResizing}
                    >
                        <div className="mx-auto h-full w-[1px] bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-500 group-active:bg-blue-600 transition-colors" />
                    </div>
                    <RequirementsPanel
                        editor={editor}
                        isEditing={isEditing}
                        onInsertRequirement={handleInsertRequirement}
                    />
                </div>
            </div>

            {/* Modales */}
            <MarginsModal
                open={isMarginsModalOpen}
                onClose={() => setIsMarginsModalOpen(false)}
                margins={margins}
                onSave={setMargins}
                userId={user?.id}
                indentLevel={marginsModalContext.indentLevel}
                onIndentChange={marginsModalContext.onIndentChange}
            />
        </div>
    );
};

export default TemplateEditor;
