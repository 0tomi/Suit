import { useMemo } from 'react';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    SelectGroup,
    SelectLabel,
    SelectSeparator,
} from '../ui/Select.jsx';
import { ALL_AGENDAS_VIEW } from '../../utils/agenda/defaultAgendaView.js';
import { splitVisibleAgendas } from '../../utils/agenda/visibleAgendas.js';
import { getPersonalAgendaLabel } from '../../utils/agenda/personalAgendaLabel.js';

const EMPTY_USERS = [];
const EMPTY_AGENDAS = [];
const EMPTY_CASES = [];

const AgendaFilterSelect = ({
    selectedFilterAgenda,
    setSelectedFilterAgenda,
    agendas = EMPTY_AGENDAS,
    cases = EMPTY_CASES,
    user,
    users = EMPTY_USERS,
    caseId = null,
}) => {
    const usersById = useMemo(
        () => new Map((users || []).map((entry) => [String(entry.id), entry])),
        [users],
    );

    const { personalAgendas, caseAgendas } = useMemo(() => {
        return splitVisibleAgendas(agendas, cases);
    }, [agendas, cases]);
    const caseScopedAgendas = useMemo(() => {
        if (!caseId) return [];
        return agendas.filter((agenda) => String(agenda.suit_case_id) === String(caseId));
    }, [agendas, caseId]);

    if (caseId) {
        const currentCaseAgenda = caseScopedAgendas[0];
        return (
            <div className="inline-flex min-w-[220px] items-center rounded-lg border border-(--border-default) bg-(--bg-card) px-4 py-2 text-sm font-medium text-(--text-primary) shadow-sm">
                {currentCaseAgenda?.name ? currentCaseAgenda.name.replace(/^Agenda:\s*/i, '') : 'Agenda del caso'}
            </div>
        );
    }

    return (
        <Select
            value={selectedFilterAgenda}
            onValueChange={(val) => setSelectedFilterAgenda(val)}
        >
            <SelectTrigger className="min-w-[180px] py-1.5 h-auto">
                <SelectValue placeholder="Seleccionar agenda" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem
                    value={ALL_AGENDAS_VIEW}
                    className="pl-8"
                >
                    Todas las agendas
                </SelectItem>

                {(personalAgendas.length > 0 || caseAgendas.length > 0) && (
                    <SelectSeparator />
                )}

                {personalAgendas.length > 0 && (
                    <SelectGroup>
                        <SelectLabel>Personal</SelectLabel>
                        {personalAgendas.map((a) => (
                            <SelectItem
                                key={a.id}
                                value={String(a.id)}
                                className="pl-8"
                            >
                                {getPersonalAgendaLabel({
                                    agenda: a,
                                    currentUser: user,
                                    usersById,
                                })}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                )}

                {personalAgendas.length > 0 && caseAgendas.length > 0 && (
                    <SelectSeparator />
                )}

                {caseAgendas.length > 0 && (
                    <SelectGroup>
                        <SelectLabel>Casos</SelectLabel>
                        {caseAgendas.map((a) => (
                            <SelectItem
                                key={a.id}
                                value={String(a.id)}
                                className="pl-8"
                            >
                                {a.name ? a.name.replace(/^Agenda:\s*/i, '') : `Agenda #${a.id}`}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                )}
            </SelectContent>
        </Select>
    );
};

export default AgendaFilterSelect;
