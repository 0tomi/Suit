import { ArrowLeft, Scale, FileText, HelpCircle, Pencil } from 'lucide-react';
import { isCaseClosed } from '../../utils/caseStatus.js';
import { Button } from '../ui/Button.jsx';
import { SectionTutorialTrigger } from '../ui/SectionTutorialTrigger.jsx';
import { selectedCaseSteps } from '../../constants/tutorialSteps.js';

const CaseDetailHeader = ({ caseData, onBack, onCloseCase, onGenerateReport, onEditCase, canEditCase, isLoadingReport }) => (
    <div className="flex items-center gap-4">
        <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            icon={ArrowLeft}
            className="rounded-full"
            aria-label="Volver"
        />
        <div className="flex-1">
            <div className="flex items-center gap-3">
                <Scale className="text-blue-600 h-7 w-7" />
                <div>
                    <h1 className="flex items-center gap-3 text-2xl font-bold text-(--text-primary) tracking-tight">
                        <span>{caseData.title}</span>
                        <SectionTutorialTrigger
                            steps={selectedCaseSteps}
                            ariaLabel="Ver tutorial del expediente"
                            testId="case-detail-tutorial-trigger"
                        />
                    </h1>
                    <p className="mt-1 text-sm text-(--text-secondary)">
                        Numero de carpeta: {caseData.id}
                    </p>
                </div>
            </div>
        </div>

        <div className="flex gap-2 items-center">
            {canEditCase && (
                <Button
                    variant="outline"
                    icon={Pencil}
                    onClick={onEditCase}
                    className="font-semibold"
                >
                    Editar Caso
                </Button>
            )}

            <Button
                variant="outline"
                icon={FileText}
                onClick={onGenerateReport}
                className="font-semibold"
                isLoading={isLoadingReport}
            >
                {isLoadingReport ? 'Generando...' : 'Generar Reporte'}
            </Button>
            
            {!isCaseClosed(caseData) && (
                <Button
                    variant="danger"
                    onClick={onCloseCase}
                    className="font-semibold"
                >
                    Cerrar Caso
                </Button>
            )}
        </div>
    </div>
);

export default CaseDetailHeader;
