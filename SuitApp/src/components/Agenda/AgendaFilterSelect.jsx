import { useMemo } from 'react';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
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
            <div className="inline-flex min-w-[220px] items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                {currentCaseAgenda?.name ? currentCaseAgenda.name.replace(/^Agenda:\s*/i, '') : 'Agenda del caso'}
            </div>
        );
    }

    return (
        <Select.Root
            value={selectedFilterAgenda}
            onValueChange={(val) => setSelectedFilterAgenda(val)}
        >
            <Select.Trigger className="inline-flex py-2 px-4 items-center justify-between gap-2 text-base font-normal bg-white text-gray-700 hover:bg-gray-50 rounded-lg shadow-sm border border-gray-200 outline-none transition-colors focus:border-blue-500 min-w-[180px]">
                <Select.Value placeholder="Seleccionar agenda" />
                <Select.Icon>
                    <ChevronDown size={16} className="opacity-50" />
                </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
                <Select.Content className="overflow-hidden bg-white rounded-lg shadow-lg border border-gray-100 min-w-[180px] z-50">
                    <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white shrink-0 text-gray-700 cursor-default">
                        <ChevronDown size={14} className="rotate-180" />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="p-1">
                        <Select.Item
                            value={ALL_AGENDAS_VIEW}
                            className="relative flex items-center px-6 py-2 text-sm font-medium text-gray-700 rounded-md select-none hover:bg-blue-50 outline-none cursor-pointer data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700"
                        >
                            <Select.ItemText>Todas las agendas</Select.ItemText>
                            <Select.ItemIndicator className="absolute left-1.5 inline-flex items-center justify-center text-blue-600">
                                <Check size={14} />
                            </Select.ItemIndicator>
                        </Select.Item>

                        {(personalAgendas.length > 0 || caseAgendas.length > 0) && (
                            <Select.Separator className="h-px bg-gray-100 m-1" />
                        )}

                        {personalAgendas.length > 0 && (
                            <Select.Group>
                                <Select.Label className="px-6 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Personal
                                </Select.Label>
                                {personalAgendas.map((a) => (
                                    <Select.Item
                                        key={a.id}
                                        value={String(a.id)}
                                        className="relative flex items-center px-6 py-2 text-sm text-gray-700 rounded-md select-none hover:bg-blue-50 outline-none cursor-pointer data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700"
                                    >
                                        <Select.ItemText>
                                            {getPersonalAgendaLabel({
                                                agenda: a,
                                                currentUser: user,
                                                usersById,
                                            })}
                                        </Select.ItemText>
                                        <Select.ItemIndicator className="absolute left-1.5 inline-flex items-center justify-center text-blue-600">
                                            <Check size={14} />
                                        </Select.ItemIndicator>
                                    </Select.Item>
                                ))}
                            </Select.Group>
                        )}

                        {personalAgendas.length > 0 && caseAgendas.length > 0 && (
                            <Select.Separator className="h-px bg-gray-100 m-1" />
                        )}

                        {caseAgendas.length > 0 && (
                            <Select.Group>
                                <Select.Label className="px-6 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Casos
                                </Select.Label>
                                {caseAgendas.map((a) => (
                                    <Select.Item
                                        key={a.id}
                                        value={String(a.id)}
                                        className="relative flex items-center px-6 py-2 text-sm text-gray-700 rounded-md select-none hover:bg-blue-50 outline-none cursor-pointer data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700"
                                    >
                                        <Select.ItemText>
                                            {a.name ? a.name.replace(/^Agenda:\s*/i, '') : `Agenda #${a.id}`}
                                        </Select.ItemText>
                                        <Select.ItemIndicator className="absolute left-1.5 inline-flex items-center justify-center text-blue-600">
                                            <Check size={14} />
                                        </Select.ItemIndicator>
                                    </Select.Item>
                                ))}
                            </Select.Group>
                        )}
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white shrink-0 text-gray-700 cursor-default">
                        <ChevronDown size={14} />
                    </Select.ScrollDownButton>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    );
};

export default AgendaFilterSelect;
