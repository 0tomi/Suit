import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutTemplate,
    Plus,
    FileText,
    PenTool,
    Loader2,
    Trash2,
    Eye,
} from 'lucide-react';
import { PrimaryActionButton } from '../components/ui/PrimaryActionButton';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal.jsx';
import { useTemplates } from '../context/TemplatesContext.jsx';
import { useTemplateCategories } from '../context/TemplateCategoriesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import { createTemplateCategory, deleteTemplate, getTemplate } from '../services/templateService.js';
import { buildDocumentCreatePath } from '../utils/appRoutes.js';
import { Button } from '../components/ui/Button.jsx';
import TemplatePreviewModal from '../components/Editor/TemplatePreviewModal.jsx';
import { createLogger } from '../services/logService.js';
const logger = createLogger('page:template-gallery');

const INITIAL_STATE = {
    selectedCategory: 'all',
    searchTerm: '',
    categoryModalOpen: false,
    creatingCategory: false,
    newCategoryName: '',
    newCategoryDescription: '',
    previewModalOpen: false,
    previewLoading: false,
    previewTemplate: null,
};

function templateGalleryReducer(state, action) {
    switch (action.type) {
        case 'SET_SEARCH_TERM':
            return { ...state, searchTerm: action.payload };
        case 'SET_CATEGORY':
            return { ...state, selectedCategory: action.payload };
        case 'OPEN_CATEGORY_MODAL':
            return { ...state, categoryModalOpen: true };
        case 'CLOSE_CATEGORY_MODAL':
            return {
                ...state,
                categoryModalOpen: false,
                creatingCategory: false,
                newCategoryName: '',
                newCategoryDescription: '',
            };
        case 'SET_CREATING_CATEGORY':
            return { ...state, creatingCategory: action.payload };
        case 'SET_NEW_CATEGORY_NAME':
            return { ...state, newCategoryName: action.payload };
        case 'SET_NEW_CATEGORY_DESCRIPTION':
            return { ...state, newCategoryDescription: action.payload };
        case 'OPEN_PREVIEW_MODAL':
            return {
                ...state,
                previewModalOpen: true,
                previewLoading: action.payload.loading,
                previewTemplate: action.payload.template,
            };
        case 'SET_PREVIEW_LOADING':
            return { ...state, previewLoading: action.payload };
        case 'SET_PREVIEW_TEMPLATE':
            return { ...state, previewTemplate: action.payload };
        case 'CLOSE_PREVIEW_MODAL':
            return {
                ...state,
                previewModalOpen: false,
                previewLoading: false,
                previewTemplate: null,
            };
        default:
            return state;
    }
}

function getTemplateDescription(template, categoryMap) {
    const category = categoryMap.get(String(template.template_category_id));
    if (category?.description) return category.description;
    if (category?.name) return `Categoría: ${category.name}`;
    return 'Plantilla lista para iniciar un nuevo documento.';
}

function getDeleteTemplateErrorMessage(result) {
    if (result?.status === 403) return 'No tienes permisos para eliminar esta plantilla.';
    if (result?.status === 422) return result?.data?.message || 'No se pudo eliminar la plantilla.';
    return result?.data?.message || result?.error || 'Error al eliminar plantilla.';
}

const TemplateGalleryHeader = ({
    isRefreshing,
    canCreateCategory,
    onOpenCategoryModal,
    onCreateBlankDocument,
}) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <div className="flex items-center gap-3">
                <h1 data-testid="page-templates-title" className="text-3xl font-bold text-(--text-primary)">Galería de Modelos</h1>
                {isRefreshing && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sincronizando
                    </span>
                )}
            </div>
            <p className="text-(--text-secondary) mt-1">Modelos sincronizados con la API y cacheados localmente.</p>
        </div>
        <div className="flex gap-2">
            {canCreateCategory && (
                <PrimaryActionButton
                    onClick={onOpenCategoryModal}
                    icon={Plus}
                    label="Nueva Categoría"
                />
            )}
            <PrimaryActionButton
                onClick={onCreateBlankDocument}
                icon={PenTool}
                label="Documento en Blanco"
            />
        </div>
    </div>
);

const TemplateGalleryFilters = ({
    searchTerm,
    onSearchChange,
    categoryOptions,
    activeCategory,
    onSelectCategory,
}) => (
    <div className="space-y-4 rounded-xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-sm">
        <SearchBar
            value={searchTerm}
            onChange={onSearchChange}
            placeholder="Buscar modelo o categoría..."
        />

        <div className="flex flex-wrap gap-2">
            {categoryOptions.map((category) => {
                const isSelected = String(activeCategory) === String(category.id);

                return (
                    <button
                        key={category.id}
                        type="button"
                        onClick={() => onSelectCategory(String(category.id))}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${isSelected
                            ? 'bg-blue-500/10 text-blue-600 ring-2 ring-blue-500/30'
                            : 'bg-(--bg-input) text-(--text-secondary) hover:bg-(--bg-card-hover)'
                            }`}
                    >
                        {category.name}
                    </button>
                );
            })}
        </div>
    </div>
);

const BlankTemplateCard = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="group relative bg-(--bg-card) rounded-xl shadow-sm border-2 border-dashed border-(--border-default) hover:border-blue-500 hover:bg-blue-500/10 transition-all p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]"
    >
        <div className="h-14 w-14 bg-(--bg-input) border border-(--border-subtle) rounded-full flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <Plus className="h-7 w-7 text-(--text-tertiary) group-hover:text-blue-500" />
        </div>
        <div>
            <h3 className="font-semibold text-(--text-primary) group-hover:text-blue-500">Diseño en Blanco</h3>
            <p className="text-sm text-(--text-secondary) mt-1">Comenzar sin base</p>
        </div>
    </button>
);

const TemplateCard = ({
    template,
    categoryName,
    description,
    canDeleteTemplates,
    onDelete,
    onPreview,
    onUseTemplate,
}) => (
    <article className="group bg-(--bg-card) rounded-xl shadow-sm border border-(--border-subtle) hover:shadow-lg hover:border-blue-500 transition-all overflow-hidden flex flex-col relative">
        {canDeleteTemplates && (
            <button
                type="button"
                onClick={(event) => onDelete(template, event)}
                className="absolute top-3 right-3 z-20 rounded-md p-1.5 text-(--text-tertiary) bg-(--bg-card)/90 backdrop-blur-sm border border-(--border-subtle) transition-colors hover:text-red-600 hover:bg-red-500/10"
                title="Eliminar plantilla"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        )}
        <button
            type="button"
            onClick={() => onUseTemplate(template.id)}
            className="w-full text-left"
            data-testid={`template-card-use-${template.id}`}
        >
            <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600 w-full" />
            <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <LayoutTemplate size={22} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-(--text-secondary) bg-(--bg-input) px-2 py-1 rounded-full">
                        {categoryName}
                    </span>
                </div>

                <h3
                    className="text-lg font-bold text-(--text-primary) mb-2 group-hover:text-blue-500 transition-colors line-clamp-2"
                    title={template.title}
                >
                    {template.title || `Modelo #${template.id}`}
                </h3>
                <p className="text-sm text-(--text-secondary) line-clamp-3 mb-4">
                    {description}
                </p>

                <div className="mt-auto flex items-center justify-between pt-3 border-t border-(--border-subtle)">
                    <span className="text-xs text-(--text-tertiary)">Modelo #{template.id}</span>
                    <div className="flex items-center text-blue-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                        Usar <FileText size={16} className="ml-1" />
                    </div>
                </div>
            </div>
        </button>

        <div className="flex items-center justify-end gap-2 border-t border-(--border-subtle) bg-(--bg-header) px-4 py-3">
            <Button
                variant="outline"
                size="sm"
                icon={Eye}
                onClick={() => onPreview(template)}
                data-testid={`template-card-preview-${template.id}`}
            >
                Vista previa
            </Button>
            <Button
                variant="primary"
                size="sm"
                icon={FileText}
                onClick={() => onUseTemplate(template.id)}
            >
                Usar
            </Button>
        </div>
    </article>
);

const TemplateGalleryGrid = ({
    filteredTemplates,
    categoryMap,
    canDeleteTemplates,
    onDeleteTemplate,
    onCreateBlankDocument,
    onPreviewTemplate,
    onUseTemplate,
}) => {
    if (filteredTemplates.length === 0) {
        return (
            <EmptyState
                icon={LayoutTemplate}
                title="No hay modelos para mostrar"
                description="No se encontraron plantillas para los filtros actuales o todavía no existen modelos sincronizados."
                actionLabel="Documento en blanco"
                onAction={onCreateBlankDocument}
            />
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 flex-1 overflow-y-auto p-1">
            <BlankTemplateCard onClick={onCreateBlankDocument} />

            {filteredTemplates.map((template) => (
                <TemplateCard
                    key={template.id}
                    template={template}
                    categoryName={categoryMap.get(String(template.template_category_id))?.name || 'Sin categoría'}
                    description={getTemplateDescription(template, categoryMap)}
                    canDeleteTemplates={canDeleteTemplates}
                    onDelete={onDeleteTemplate}
                    onPreview={onPreviewTemplate}
                    onUseTemplate={onUseTemplate}
                />
            ))}
        </div>
    );
};

const CategoryModal = ({
    open,
    creatingCategory,
    newCategoryName,
    newCategoryDescription,
    onClose,
    onSubmit,
    onNameChange,
    onDescriptionChange,
}) => (
    <Modal
        open={open}
        onClose={onClose}
        title="Crear categoría de plantilla"
        maxWidth="max-w-xl"
        footer={(
            <>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={creatingCategory}
                    className="rounded-lg border border-(--border-default) bg-(--bg-card) px-4 py-2 text-sm font-medium text-(--text-primary) hover:bg-(--bg-card-hover) disabled:opacity-60"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    form="template-category-form"
                    disabled={creatingCategory}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                    {creatingCategory ? 'Guardando...' : 'Guardar categoría'}
                </button>
            </>
        )}
    >
        <form id="template-category-form" onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
                <label htmlFor="template-category-name" className="block text-sm font-medium text-(--text-secondary) mb-1">
                    Nombre *
                </label>
                <input
                    id="template-category-name"
                    type="text"
                    value={newCategoryName}
                    onChange={onNameChange}
                    className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Laboral, Penal, Comercial"
                />
            </div>
            <div>
                <label htmlFor="template-category-description" className="block text-sm font-medium text-(--text-secondary) mb-1">
                    Descripción (opcional)
                </label>
                <textarea
                    id="template-category-description"
                    value={newCategoryDescription}
                    onChange={onDescriptionChange}
                    className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24 resize-y"
                    placeholder="Breve descripción de uso para esta categoría"
                />
            </div>
        </form>
    </Modal>
);

const TemplateGallery = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const {
        templates,
        refreshTemplates,
        syncing: syncingTemplates,
        initialized: templatesInitialized,
    } = useTemplates();
    const {
        template_categories: categories,
        refreshTemplateCategories,
        syncing: syncingCategories,
        initialized: categoriesInitialized,
    } = useTemplateCategories();
    const [state, dispatch] = useReducer(templateGalleryReducer, INITIAL_STATE);
    const previewRequestIdRef = useRef(0);

    const canDeleteTemplates = Boolean(user?.role && user.role !== 'user');
    const canCreateCategory = user?.role === 'admin';

    useEffect(() => {
        void refreshTemplateCategories();
        void refreshTemplates();
    }, [refreshTemplateCategories, refreshTemplates]);

    const categoryMap = useMemo(
        () => new Map(categories.map((category) => [String(category.id), category])),
        [categories]
    );

    const categoryOptions = useMemo(
        () => [{ id: 'all', name: 'Todas' }, ...categories],
        [categories]
    );

    const activeCategory = useMemo(() => {
        if (state.selectedCategory === 'all') return 'all';
        const categoryStillExists = categories.some((category) => String(category.id) === String(state.selectedCategory));
        return categoryStillExists ? state.selectedCategory : 'all';
    }, [categories, state.selectedCategory]);

    const isLoading = (!templatesInitialized || !categoriesInitialized) && templates.length === 0 && categories.length === 0;
    const isRefreshing = syncingTemplates || syncingCategories;

    const filteredTemplates = useMemo(() => {
        const normalizedSearch = state.searchTerm.trim().toLowerCase();

        return templates.filter((template) => {
            const matchesCategory =
                activeCategory === 'all' || String(template.template_category_id) === String(activeCategory);
            const title = String(template.title || '').toLowerCase();
            const categoryName = String(categoryMap.get(String(template.template_category_id))?.name || '').toLowerCase();
            const matchesSearch =
                normalizedSearch.length === 0 ||
                title.includes(normalizedSearch) ||
                categoryName.includes(normalizedSearch);

            return matchesCategory && matchesSearch;
        });
    }, [activeCategory, categoryMap, state.searchTerm, templates]);

    const handleUseTemplate = (templateId) => {
        navigate(buildDocumentCreatePath(templateId));
    };

    const handleCreateBlankDocument = () => {
        navigate(buildDocumentCreatePath());
    };

    const resolvePreviewTemplate = async (template) => {
        if (typeof template?.content === 'string') {
            return template;
        }

        const fetched = await getTemplate(template.id);
        if (!fetched) {
            throw new Error('No se pudo cargar el contenido de la plantilla.');
        }

        return {
            ...template,
            ...fetched,
            content: typeof fetched.content === 'string' ? fetched.content : '',
        };
    };

    const handlePreviewTemplate = async (template) => {
        const requestId = previewRequestIdRef.current + 1;
        previewRequestIdRef.current = requestId;

        dispatch({
            type: 'OPEN_PREVIEW_MODAL',
            payload: {
                loading: true,
                template,
            },
        });

        try {
            // La galería trabaja contra caché local; si el listado no trae `content`,
            // rehidratamos sólo la plantilla elegida para no forzar un reload global.
            const previewTemplate = await resolvePreviewTemplate(template);
            if (previewRequestIdRef.current !== requestId) return;

            dispatch({ type: 'SET_PREVIEW_TEMPLATE', payload: previewTemplate });
            dispatch({ type: 'SET_PREVIEW_LOADING', payload: false });
        } catch (error) {
            if (previewRequestIdRef.current !== requestId) return;

            dispatch({ type: 'CLOSE_PREVIEW_MODAL' });
            showAppToast({
                title: 'Error al cargar la vista previa',
                description: error.message || 'No se pudo abrir la plantilla.',
                variant: 'danger',
            });
        }
    };

    const handleClosePreview = () => {
        previewRequestIdRef.current += 1;
        dispatch({ type: 'CLOSE_PREVIEW_MODAL' });
    };

    const handleUsePreviewTemplate = () => {
        const templateId = state.previewTemplate?.id;
        if (!templateId) return;

        handleClosePreview();
        handleUseTemplate(templateId);
    };

    const requestDeleteTemplate = (template, event) => {
        event.stopPropagation();

        openDialog({
            title: '¿Eliminar plantilla?',
            desc: `Se eliminará permanentemente "${template.title || `Modelo #${template.id}`}".`,
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await deleteTemplate(template.id);
                    if (!result.ok) {
                        throw new Error(getDeleteTemplateErrorMessage(result));
                    }

                    if (window.electronAPI?.db?.deleteById) {
                        try {
                            await window.electronAPI.db.deleteById('templates', template.id);
                        } catch (error) {
                            void logger.warn('no se pudo eliminar plantilla de caché local', error);
                        }
                    }

                    await refreshTemplates();
                    showAppToast({
                        title: 'Plantilla eliminada',
                        description: `${template.title || `Modelo #${template.id}`} eliminada correctamente.`,
                        variant: 'success',
                    });
                    closeDialog();
                } catch (error) {
                    showAppToast({
                        title: 'Error al eliminar',
                        description: error.message || 'No se pudo eliminar la plantilla.',
                        variant: 'danger',
                    });
                } finally {
                    setDialogLoading(false);
                }
            },
        });
    };

    const handleCreateCategory = async (event) => {
        event.preventDefault();
        const name = state.newCategoryName.trim();

        if (!name) {
            showAppToast({
                title: 'Nombre requerido',
                description: 'Ingresa un nombre para la categoría.',
                variant: 'warning',
            });
            return;
        }

        dispatch({ type: 'SET_CREATING_CATEGORY', payload: true });
        try {
            const result = await createTemplateCategory({
                name,
                description: state.newCategoryDescription.trim() || null,
            });

            if (!result.ok) {
                throw new Error(result.data?.message || result.error || 'No se pudo crear la categoría.');
            }

            await refreshTemplateCategories();
            dispatch({ type: 'CLOSE_CATEGORY_MODAL' });
            showAppToast({
                title: 'Categoría creada',
                description: `La categoría "${name}" fue creada correctamente.`,
                variant: 'success',
            });
        } catch (error) {
            showAppToast({
                title: 'Error al crear categoría',
                description: error.message || 'No se pudo crear la categoría.',
                variant: 'danger',
            });
            dispatch({ type: 'SET_CREATING_CATEGORY', payload: false });
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-(--text-secondary)">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-sm">Cargando modelos...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <TemplateGalleryHeader
                isRefreshing={isRefreshing}
                canCreateCategory={canCreateCategory}
                onOpenCategoryModal={() => dispatch({ type: 'OPEN_CATEGORY_MODAL' })}
                onCreateBlankDocument={handleCreateBlankDocument}
            />

            <TemplateGalleryFilters
                searchTerm={state.searchTerm}
                onSearchChange={(event) => dispatch({ type: 'SET_SEARCH_TERM', payload: event.target.value })}
                categoryOptions={categoryOptions}
                activeCategory={activeCategory}
                onSelectCategory={(categoryId) => dispatch({ type: 'SET_CATEGORY', payload: categoryId })}
            />

            <TemplateGalleryGrid
                filteredTemplates={filteredTemplates}
                categoryMap={categoryMap}
                canDeleteTemplates={canDeleteTemplates}
                onDeleteTemplate={requestDeleteTemplate}
                onCreateBlankDocument={handleCreateBlankDocument}
                onPreviewTemplate={handlePreviewTemplate}
                onUseTemplate={handleUseTemplate}
            />

            <ConfirmDialog {...dialogProps} />

            <TemplatePreviewModal
                open={state.previewModalOpen}
                loading={state.previewLoading}
                template={state.previewTemplate}
                categoryName={categoryMap.get(String(state.previewTemplate?.template_category_id))?.name || 'Sin categoría'}
                onClose={handleClosePreview}
                onUseTemplate={handleUsePreviewTemplate}
            />

            <CategoryModal
                open={state.categoryModalOpen}
                creatingCategory={state.creatingCategory}
                newCategoryName={state.newCategoryName}
                newCategoryDescription={state.newCategoryDescription}
                onClose={() => dispatch({ type: 'CLOSE_CATEGORY_MODAL' })}
                onSubmit={handleCreateCategory}
                onNameChange={(event) => dispatch({ type: 'SET_NEW_CATEGORY_NAME', payload: event.target.value })}
                onDescriptionChange={(event) => dispatch({ type: 'SET_NEW_CATEGORY_DESCRIPTION', payload: event.target.value })}
            />
        </div>
    );
};

export default TemplateGallery;
