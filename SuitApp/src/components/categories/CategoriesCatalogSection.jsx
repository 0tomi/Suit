import { useDeferredValue, useMemo, useState, useEffect } from 'react';
import { Check, Pencil, Plus, SearchX, Trash2, X } from 'lucide-react';
import { SearchBar } from '../ui/SearchBar.jsx';
import { Button } from '../ui/Button.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';

function createEmptyState(fields) {
    return fields.reduce((acc, field) => {
        acc[field.key] = field.type === 'color' ? (field.defaultValue || '#2563eb') : '';
        return acc;
    }, {});
}

function toInputValue(value, type) {
    if (type === 'color') return value || '#2563eb';
    return value ?? '';
}

function getFieldText(item, fields) {
    return fields
        .filter((field) => field.type !== 'color')
        .map((field) => String(item[field.key] ?? ''))
        .join(' ')
        .toLowerCase();
}

function getFormGridClass(fields) {
    if (fields.some((field) => field.type === 'color')) return 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px]';
    if (fields.length === 1) return 'md:grid-cols-1';
    if (fields.length === 2) return 'md:grid-cols-2';
    return 'md:grid-cols-3';
}

function InlineEditableRow({ item, fields, canEdit, isAdmin, onSave, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editState, setEditState] = useState(() => createEmptyState(fields));

    const beginEdit = () => {
        setEditState(fields.reduce((acc, field) => {
            acc[field.key] = toInputValue(item[field.key], field.type);
            return acc;
        }, {}));
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setSaving(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(item.id, editState);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <tr className="bg-(--bg-input)/40">
                {fields.map((field) => (
                    <td key={field.key} className="px-4 py-3 align-top">
                        {field.type === 'color' ? (
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={toInputValue(editState[field.key], field.type)}
                                    onChange={(event) => setEditState((current) => ({ ...current, [field.key]: event.target.value }))}
                                    className="h-10 w-12 cursor-pointer rounded-lg border border-(--border-default) bg-(--bg-input) p-1"
                                />
                                <span className="text-xs font-medium uppercase tracking-wide text-(--text-secondary)">
                                    {editState[field.key]}
                                </span>
                            </div>
                        ) : (
                            <input
                                type="text"
                                value={toInputValue(editState[field.key], field.type)}
                                onChange={(event) => setEditState((current) => ({ ...current, [field.key]: event.target.value }))}
                                className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary)"
                            />
                        )}
                    </td>
                ))}
                {canEdit ? (
                    <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                            <Button size="sm" onClick={handleSave} isLoading={saving} icon={Check}>
                                Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit} icon={X}>
                                Cancelar
                            </Button>
                        </div>
                    </td>
                ) : null}
            </tr>
        );
    }

    return (
        <tr className="transition-colors hover:bg-(--bg-card-hover)">
            {fields.map((field) => (
                <td key={field.key} className="px-4 py-3">
                    {field.type === 'color' ? (
                        <div className="flex items-center gap-3">
                            <span className="h-4 w-4 rounded-full border border-(--border-default)" style={{ backgroundColor: item[field.key] || '#cbd5e1' }} />
                            <span className="text-sm uppercase tracking-wide text-(--text-secondary)">{item[field.key] || 'Sin color'}</span>
                        </div>
                    ) : (
                        <span className={field.emphasis ? 'font-semibold text-(--text-primary)' : 'text-(--text-secondary)'}>
                            {item[field.key] || field.emptyLabel || '—'}
                        </span>
                    )}
                </td>
            ))}
            {canEdit ? (
                <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={beginEdit} icon={Pencil}>
                            Editar
                        </Button>
                        {isAdmin && (
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-500/10 hover:text-red-700" onClick={() => onDelete(item)} icon={Trash2}>
                                Eliminar
                            </Button>
                        )}
                    </div>
                </td>
            ) : null}
        </tr>
    );
}

/**
 * Sección CRUD reutilizable para todos los catálogos nuevos.
 * Lee datos normalizados desde contexts y traduce solo las mutaciones necesarias.
 */
export default function CategoriesCatalogSection({ catalog, isAdmin, canEdit, CreateModal = null }) {
    const [isCreating, setIsCreating] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());
    const [formState, setFormState] = useState(() => createEmptyState(catalog.fields));
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    // Sincronizar con la API al entrar al tab
    useEffect(() => {
        if (catalog.onRefresh) {
            catalog.onRefresh();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalog.id]); 

    const filteredItems = useMemo(() => {
        if (!deferredQuery) return catalog.items;
        return catalog.items.filter((item) => getFieldText(item, catalog.fields).includes(deferredQuery));
    }, [catalog.fields, catalog.items, deferredQuery]);

    const isEmpty = !catalog.loading && catalog.items.length === 0;
    const hasSearchResults = filteredItems.length > 0;

    const resetForm = () => {
        setFormState(createEmptyState(catalog.fields));
    };

    const handleCreate = async (event) => {
        event.preventDefault();

        try {
            await catalog.onCreate(formState);
            resetForm();
            showAppToast({
                title: `${catalog.singularLabel} creado`,
                description: `Se creó correctamente en ${catalog.label.toLowerCase()}.`,
                variant: 'success',
            });
        } catch (error) {
            showAppToast({
                title: `Error al crear ${catalog.singularLabel.toLowerCase()}`,
                description: error.message || 'No se pudo completar la operación.',
                variant: 'danger',
            });
        }
    };

    const handleSave = async (id, payload) => {
        try {
            await catalog.onUpdate(id, payload);
            showAppToast({
                title: `${catalog.singularLabel} actualizado`,
                description: 'Los cambios se guardaron correctamente.',
                variant: 'success',
            });
        } catch (error) {
            showAppToast({
                title: `Error al actualizar ${catalog.singularLabel.toLowerCase()}`,
                description: error.message || 'No se pudo guardar la edición.',
                variant: 'danger',
            });
            throw error;
        }
    };

    const handleDeleteRequest = (item) => {
        openDialog({
            title: `¿Eliminar ${catalog.singularLabel.toLowerCase()}?`,
            desc: `Se eliminará ${item[catalog.primaryField] || `#${item.id}`} de ${catalog.label.toLowerCase()}.`,
            type: 'danger',
            confirmText: 'Eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    await catalog.onDelete(item.id);
                    closeDialog();
                    showAppToast({
                        title: `${catalog.singularLabel} eliminado`,
                        description: 'El catálogo se actualizó correctamente.',
                        variant: 'success',
                    });
                } catch (error) {
                    setDialogLoading(false);
                    openDialog({
                        title: 'Error al eliminar',
                        desc: error.message || 'No se pudo eliminar el elemento seleccionado.',
                        type: 'danger',
                        confirmText: 'Aceptar',
                        onConfirm: closeDialog,
                    });
                }
            },
        });
    };

    return (
        <>
            <section data-testid={`categories-section-${catalog.testId}`} className="rounded-2xl border border-(--border-default) bg-(--bg-card) shadow-sm">
                <header className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-6 py-5">
                    <div className="flex flex-col gap-6">
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-semibold text-(--text-primary)">{catalog.label}</h3>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${canEdit ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-500/10 text-slate-700'}`}>
                                    {canEdit ? 'Edición habilitada' : 'Solo lectura'}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-(--text-secondary)">{catalog.description}</p>
                        </div>
                        <div className="w-full xl:max-w-md">
                            <SearchBar
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={catalog.searchPlaceholder}
                                inputTestId={`categories-search-${catalog.id}`}
                            />
                        </div>
                    </div>
                </header>

                {canEdit && (
                    <div data-testid={`categories-create-area-${catalog.testId}`} className="border-b border-(--border-subtle) overflow-hidden transition-all duration-300">
                        {!isCreating ? (
                            <button
                                onClick={() => {
                                    if (CreateModal) {
                                        setIsCreateModalOpen(true);
                                    } else {
                                        setIsCreating(true);
                                    }
                                }}
                                className="flex w-full items-center justify-between px-6 py-4 text-blue-600 transition-all hover:bg-blue-50/30 group"
                            >
                                <div className="flex items-center gap-3 font-semibold">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 transition-colors group-hover:bg-blue-500/20">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                    <span>Cargar un nuevo {catalog.singularLabel.toLowerCase()}</span>
                                </div>
                                <span className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                                    {CreateModal ? 'Abrir modal' : 'Abrir formulario'}
                                </span>
                            </button>
                        ) : (
                            <div className="px-6 py-6">
                                <div className="mb-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-(--text-primary)">
                                            Nuevo {catalog.singularLabel}
                                        </h4>
                                    </div>
                                    <button
                                        onClick={() => setIsCreating(false)}
                                        className="rounded-lg p-2 text-(--text-secondary) transition-colors hover:bg-slate-100 hover:text-red-500"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>
                                    {/* Campos de texto principales */}
                                    <div className={`grid gap-4 ${getFormGridClass(catalog.fields.filter(f => f.type !== 'color'))}`}>
                                        {catalog.fields.filter(f => f.type !== 'color').map((field) => (
                                            <div key={field.key} className="min-w-0">
                                                <label htmlFor={`${catalog.id}-${field.key}`} className="mb-2 block text-sm font-semibold tracking-tight text-(--text-secondary)">
                                                    {field.label}
                                                </label>
                                                <input
                                                    id={`${catalog.id}-${field.key}`}
                                                    type="text"
                                                    required={field.required}
                                                    value={toInputValue(formState[field.key], field.type)}
                                                    placeholder={field.placeholder || ''}
                                                    onChange={(event) => setFormState((current) => ({ ...current, [field.key]: event.target.value }))}
                                                    className="w-full h-[46px] rounded-xl border border-(--border-default) bg-(--bg-input) px-4 py-2.5 text-sm text-(--text-primary) shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Fila inferior para Color y Botón de Acción */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        {catalog.fields.some(f => f.type === 'color') ? (
                                            <div className="w-full">
                                                {catalog.fields.filter(f => f.type === 'color').map((field) => (
                                                    <div key={field.key}>
                                                        <label htmlFor={`${catalog.id}-${field.key}`} className="mb-1.5 block text-sm font-semibold tracking-tight text-(--text-secondary)">
                                                            {field.label}
                                                        </label>
                                                        <div className="flex h-[42px] items-center gap-3 rounded-xl border border-(--border-default) bg-(--bg-input) px-3 py-2 shadow-sm transition-all focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10">
                                                            <input
                                                                id={`${catalog.id}-${field.key}`}
                                                                type="color"
                                                                value={toInputValue(formState[field.key], field.type)}
                                                                onChange={(event) => setFormState((current) => ({ ...current, [field.key]: event.target.value }))}
                                                                className="h-6 w-10 cursor-pointer appearance-none rounded border border-(--border-default) bg-transparent p-0 overflow-hidden"
                                                            />
                                                            <span className="text-sm font-mono font-medium tracking-tight text-(--text-primary)">
                                                                {formState[field.key]}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <div />}

                                        <div className="flex items-end">
                                            <Button
                                                type="submit"
                                                icon={Plus}
                                                className="h-[42px] w-full text-sm shadow-md shadow-blue-500/5 items-center justify-center"
                                                data-testid={`categories-create-button-${catalog.testId}`}
                                            >
                                                Cargar {catalog.singularLabel}
                                            </Button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                <div className="px-6 py-5">
                    {isEmpty ? (
                        <EmptyState
                            icon={catalog.emptyIcon}
                            title={`No hay ${catalog.emptyPluralLabel}`}
                            description={catalog.emptyMessage}
                        />
                    ) : !hasSearchResults ? (
                        <EmptyState
                            icon={SearchX}
                            title="Sin resultados"
                            description="No encontramos coincidencias para la búsqueda actual."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[620px] text-left">
                                <thead className="border-b border-(--border-subtle)">
                                    <tr>
                                        {catalog.fields.map((field) => (
                                            <th key={field.key} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary)">
                                                {field.label}
                                            </th>
                                        ))}
                                        {canEdit && (
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary)">
                                                Acciones
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-(--border-subtle)">
                                    {catalog.loading ? (
                                        <tr>
                                            <td colSpan={catalog.fields.length + (canEdit ? 1 : 0)} className="px-4 py-8 text-center text-sm text-(--text-secondary)">
                                                Cargando {catalog.emptyPluralLabel}...
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <InlineEditableRow
                                                key={item.id}
                                                item={item}
                                                fields={catalog.fields}
                                                canEdit={canEdit}
                                                isAdmin={isAdmin}
                                                onSave={handleSave}
                                                onDelete={handleDeleteRequest}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            {CreateModal && (
                <CreateModal
                    open={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSave={async (data) => {
                        await catalog.onCreate(data);
                    }}
                />
            )}

            <ConfirmDialog {...dialogProps} />
        </>
    );
}
