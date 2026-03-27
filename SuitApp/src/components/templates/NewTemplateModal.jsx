/**
 * NewTemplateModal.jsx — Modal de creación de nuevo modelo.
 *
 * Presenta dos opciones al usuario:
 *  1. Crear desde cero → navega al editor vacío en modo edición.
 *  2. Importar desde Word/PDF → pide keyword, selecciona archivo,
 *     convierte y navega al editor con el HTML resultante.
 *
 * La keyword se persiste en localStorage (opt-in con checkbox).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, PenLine, Loader2, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { convertDocumentToTemplate } from '../../services/documentConverterService.js';
import { buildTemplateCreatePath } from '../../utils/appRoutes.js';
import { getBaseNameWithoutExtension } from '../../utils/fileNameUtils.js';

/** Clave de localStorage para persistir la keyword del usuario. */
function getKeywordStorageKey(userId) {
    return `suit-template-keyword:${userId}`;
}

const NewTemplateModal = ({ open, onClose }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Vista activa: null (elección inicial) | 'import' | 'scratch'
    const [view, setView] = useState(null);

    // Estado del flujo de importación
    const [keyword, setKeyword] = useState('');
    const [rememberKeyword, setRememberKeyword] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    // Cargar keyword guardada al abrir el modal
    useEffect(() => {
        if (open && user?.id) {
            const saved = localStorage.getItem(getKeywordStorageKey(user.id));
            if (saved) {
                setKeyword(saved);
                setRememberKeyword(true);
            }
        }
    }, [open, user?.id]);

    // Resetear estado al cerrar
    const handleClose = () => {
        setView(null);
        setKeyword('');
        setRememberKeyword(false);
        setIsConverting(false);
        onClose();
    };

    /** Navega al editor vacío para crear desde cero. */
    const handleCreateScratch = () => {
        handleClose();
        navigate(buildTemplateCreatePath());
    };

    /** Abre el diálogo de archivo y ejecuta la conversión. */
    const handleSelectFile = async () => {
        if (!keyword.trim()) {
            showAppToast({
                title: 'Palabra clave requerida',
                description: 'Ingresá la palabra clave que marca los campos en el documento.',
                variant: 'warning',
            });
            return;
        }

        // Abrir diálogo de selección de archivo
        const dialogResult = await window.electronAPI?.dialog?.openFile({
            filters: [{ name: 'Documentos', extensions: ['docx', 'pdf'] }],
        });

        if (!dialogResult || dialogResult.canceled) return;

        // Persistir keyword si el usuario lo pidió
        if (rememberKeyword && user?.id) {
            localStorage.setItem(getKeywordStorageKey(user.id), keyword.trim());
        } else if (!rememberKeyword && user?.id) {
            localStorage.removeItem(getKeywordStorageKey(user.id));
        }

        setIsConverting(true);
        try {
            const result = await convertDocumentToTemplate(dialogResult.filePath, keyword.trim());

            if (!result.ok) {
                throw new Error(result.error || 'No se pudo convertir el documento.');
            }

            if (result.warnings?.length > 0) {
                showAppToast({
                    title: 'Conversión con advertencias',
                    description: result.warnings.join(' '),
                    variant: 'warning',
                });
            }

            handleClose();
            navigate(buildTemplateCreatePath(), {
                state: {
                    htmlContent: result.html,
                    prefillTitle: getBaseNameWithoutExtension(dialogResult.filePath),
                    margins: result.margins,
                    defaultFont: result.defaultFont ?? null, // Fuente por defecto extraída del DOCX
                    placeholderCount: result.placeholderCount ?? 0,
                    fromImport: true,
                },
            });
        } catch (error) {
            showAppToast({
                title: 'Error al importar',
                description: error.message || 'No se pudo procesar el archivo.',
                variant: 'danger',
            });
        } finally {
            setIsConverting(false);
        }
    };

    const title = view === 'import'
        ? 'Importar desde Word / PDF'
        : view === 'scratch'
            ? 'Crear desde cero'
            : 'Crear nuevo Modelo';

    return (
        <Modal
            open={open}
            onClose={isConverting ? undefined : handleClose}
            title={title}
            maxWidth="max-w-lg"
            footer={
                view === 'import' ? (
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setView(null)}
                            disabled={isConverting}
                        >
                            Volver
                        </Button>
                        <Button
                            variant="primary"
                            icon={isConverting ? Loader2 : FileUp}
                            onClick={handleSelectFile}
                            disabled={isConverting || !keyword.trim()}
                            className={isConverting ? '[&_svg]:animate-spin' : ''}
                        >
                            {isConverting ? 'Convirtiendo...' : 'Seleccionar archivo'}
                        </Button>
                    </div>
                ) : view === null ? (
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    </div>
                ) : null
            }
        >
            {/* Vista inicial: elección de método */}
            {view === null && (
                <div className="grid grid-cols-2 gap-4 py-2">
                    {/* Opción: importar */}
                    <button
                        type="button"
                        onClick={() => setView('import')}
                        className="group flex flex-col items-center gap-3 rounded-xl border-2 border-(--border-default) bg-(--bg-card) p-6 text-center hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all"
                    >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--bg-input) group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                            <FileUp size={26} className="text-(--text-secondary) group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                        </div>
                        <div>
                            <p className="font-semibold text-(--text-primary) group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                                Importar desde Word / PDF
                            </p>
                            <p className="mt-1 text-xs text-(--text-tertiary)">
                                Convertí un documento existente en modelo
                            </p>
                        </div>
                    </button>

                    {/* Opción: desde cero */}
                    <button
                        type="button"
                        onClick={handleCreateScratch}
                        className="group flex flex-col items-center gap-3 rounded-xl border-2 border-(--border-default) bg-(--bg-card) p-6 text-center hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all"
                    >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--bg-input) group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                            <PenLine size={26} className="text-(--text-secondary) group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                        </div>
                        <div>
                            <p className="font-semibold text-(--text-primary) group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                                Crear desde cero
                            </p>
                            <p className="mt-1 text-xs text-(--text-tertiary)">
                                Editor en blanco con todas las herramientas
                            </p>
                        </div>
                    </button>
                </div>
            )}

            {/* Vista de importación: keyword + opciones */}
            {view === 'import' && (
                <div className="space-y-5 py-1">
                    <p className="text-sm text-(--text-secondary)">
                        El programa va a buscar la palabra clave en el documento y reemplazará cada
                        ocurrencia por un campo vacío al que podrás asignar un requisito.
                    </p>

                    <div>
                        <label htmlFor="template-keyword" className="block text-sm font-medium text-(--text-secondary) mb-1.5">
                            Palabra clave <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="template-keyword"
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder='Ej: BLANCO, CAMPO, XXX'
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) placeholder-text-(--text-tertiary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isConverting}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSelectFile();
                            }}
                        />
                        <p className="mt-1.5 text-xs text-(--text-tertiary)">
                            La palabra clave distingue mayúsculas y minúsculas.
                        </p>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={rememberKeyword}
                            onChange={(e) => setRememberKeyword(e.target.checked)}
                            disabled={isConverting}
                            className="h-4 w-4 rounded border-(--border-default) accent-blue-600"
                        />
                        <span className="text-sm text-(--text-secondary)">
                            Recordar para la próxima vez
                        </span>
                    </label>

                    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-header) px-4 py-3 flex items-start gap-3">
                        <FileText size={16} className="shrink-0 mt-0.5 text-(--text-tertiary)" />
                        <p className="text-xs text-(--text-secondary)">
                            Se abrirá un selector de archivo. Admite <strong>.docx</strong> y{' '}
                            <strong>.pdf</strong>. Los PDFs escaneados sin OCR pueden no funcionar.
                        </p>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default NewTemplateModal;
