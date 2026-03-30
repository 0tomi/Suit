import { Plus, Upload, Loader2, RefreshCw } from 'lucide-react';
import { PrimaryActionButton } from '../ui/PrimaryActionButton';
import { SectionTutorialTrigger } from '../ui/SectionTutorialTrigger.jsx';
import { bibliotecaSteps } from '../../constants/tutorialSteps.js';
import { Button } from '../ui/Button.jsx';

export const BibliotecaHeader = ({
    isRefreshing,
    canCreateCatalog,
    onOpenCatalogModal,
    onOpenUploadModal,
    onRefresh,
}) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <div className="flex items-center gap-3">
                <h1 data-testid="page-biblioteca-title" className="flex items-center gap-3 text-3xl font-bold text-(--text-primary)">
                    Biblioteca
                    <SectionTutorialTrigger
                        steps={bibliotecaSteps}
                        ariaLabel="Ver tutorial de Biblioteca"
                        testId="biblioteca-tutorial-trigger"
                    />
                </h1>
                {isRefreshing && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sincronizando
                    </span>
                )}
            </div>
            <p className="text-(--text-secondary) mt-1">
                Explorá, compartí y descargá archivos públicos disponibles para todo el estudio.
            </p>
        </div>
        <div className="flex gap-2">
            <Button
                variant="outline"
                icon={RefreshCw}
                onClick={() => void onRefresh?.()}
                isLoading={isRefreshing}
                className="min-w-fit whitespace-nowrap"
            >
                Refrescar
            </Button>
            {canCreateCatalog && (
                <PrimaryActionButton
                    onClick={onOpenCatalogModal}
                    icon={Plus}
                    label="Nuevo Catálogo"
                />
            )}
            <PrimaryActionButton
                onClick={onOpenUploadModal}
                icon={Upload}
                label="Subir Archivo"
            />
        </div>
    </div>
);
