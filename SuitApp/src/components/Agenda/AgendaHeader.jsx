import { Clock } from 'lucide-react';
import AgendaFilterSelect from './AgendaFilterSelect.jsx';
import { PrimaryActionButton } from '../ui/PrimaryActionButton.jsx';
import { SectionTutorialTrigger } from '../ui/SectionTutorialTrigger.jsx';
import { agendaSteps } from '../../constants/tutorialSteps.js';

const AgendaHeader = ({
    caseId,
    selectedFilterAgenda,
    setSelectedFilterAgenda,
    agendas,
    cases,
    user,
    users,
    openNewEventAtDate,
}) => {
    return (
        <div className="flex justify-between items-center">
            <div>
                <h1 data-testid="page-agenda-title" className="text-3xl font-bold text-(--text-primary) flex items-center gap-3">
                    {caseId ? 'Agenda del Caso' : 'Agenda General'}
                    {!caseId && (
                        <SectionTutorialTrigger
                            steps={agendaSteps}
                            ariaLabel="Ver tutorial de la Agenda"
                            testId="agenda-tutorial-trigger"
                        />
                    )}
                </h1>
                {!caseId && (
                    <p className="text-(--text-secondary) mt-1">
                        Gestiona tus eventos y audiencias
                    </p>
                )}
            </div>
            <div className="flex items-center gap-3">
                <AgendaFilterSelect
                    caseId={caseId}
                    selectedFilterAgenda={selectedFilterAgenda}
                    setSelectedFilterAgenda={setSelectedFilterAgenda}
                    agendas={agendas}
                    cases={cases}
                    user={user}
                    users={users}
                />

                <PrimaryActionButton
                    onClick={() => openNewEventAtDate(new Date())}
                    icon={Clock}
                    label="Nuevo Evento"
                    data-testid="agenda-new-event-button"
                />
            </div>
        </div>
    );
};

export default AgendaHeader;
