import { ArrowLeft, Scale, FileText } from 'lucide-react';
import { isCaseClosed } from '../../utils/caseStatus.js';
import { Button } from '../ui/Button.jsx';

const CaseDetailHeader = ({ caseData, onBack, onCloseCase, onGenerateReport, isLoadingReport }) => (
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
                <h1 className="text-2xl font-bold text-(--text-primary) tracking-tight">{caseData.title}</h1>
            </div>
        </div>

        <div className="flex gap-2 items-center">
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
