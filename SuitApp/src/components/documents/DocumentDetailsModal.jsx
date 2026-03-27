import { useMemo, useState } from 'react';
import { Eye, FileClock, FileText, History, UserRound } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { useUsers } from '../../context/UsersContext.jsx';
import { useCases } from '../../context/CasesContext.jsx';
import DocumentVersionHistoryModal from './DocumentVersionHistoryModal.jsx';
import { getDocumentStatusLabel } from '../../utils/documentStatus.js';

function formatDateTime(value) {
    if (!value) return 'No disponible';

    try {
        return new Date(value).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return 'No disponible';
    }
}

function resolveDisplayUser({ documentData, users, type }) {
    if (!documentData) return 'No disponible';

    if (type === 'creator') {
        const explicitName =
            documentData.user?.name ??
            documentData.creator?.name ??
            documentData.created_by_user?.name ??
            null;
        if (explicitName) return explicitName;

        const matchedUser = users.find((user) => String(user.id) === String(documentData.user_id));
        if (matchedUser?.name) return matchedUser.name;
    }

    const latestVersion = documentData.latest_version ?? {};
    const explicitModifierName =
        latestVersion.creator?.name ??
        documentData.latest_version_creator_name ??
        documentData.last_editor?.name ??
        documentData.updated_by_user?.name ??
        null;

    if (explicitModifierName) return explicitModifierName;

    const matchedModifier = users.find((user) => String(user.id) === String(documentData.latest_version_created_by));
    if (matchedModifier?.name) return matchedModifier.name;

    return 'No disponible';
}

function resolveDocumentCaseLabel(documentData, cases) {
    if (!documentData) return 'Sin caso asociado';

    const explicitCaseTitle =
        documentData.case?.title ??
        documentData.suit_case?.title ??
        documentData.case_title ??
        documentData.case_name ??
        null;

    if (explicitCaseTitle) return explicitCaseTitle;

    const caseId = documentData.suit_case_id ?? documentData.case_id ?? null;
    if (caseId === null || caseId === undefined || caseId === '') {
        return 'Sin caso asociado';
    }

    const matchedCase = cases.find((caseItem) => String(caseItem.id) === String(caseId));
    if (matchedCase?.title) return matchedCase.title;

    return `Caso #${caseId}`;
}

function InfoItem(props) {
    const IconComponent = props.icon;
    const { label, value } = props;

    return (
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) p-4">
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--text-tertiary)">
                <IconComponent className="h-4 w-4" />
                <span>{label}</span>
            </div>
            <p className="text-sm font-medium text-(--text-primary) break-words">{value}</p>
        </div>
    );
}

function InfoSection({ title, children }) {
    return (
        <section className="rounded-2xl border border-(--border-subtle) bg-(--bg-input) p-4">
            <div className="mb-3">
                <h3 className="text-sm font-semibold text-(--text-primary)">{title}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {children}
            </div>
        </section>
    );
}

export default function DocumentDetailsModal({
    open,
    onClose,
    documentData,
}) {
    const { users = [] } = useUsers();
    const { cases = [] } = useCases();
    const [historyModalOpen, setHistoryModalOpen] = useState(false);

    const documentCreator = useMemo(
        () => resolveDisplayUser({ documentData, users, type: 'creator' }),
        [documentData, users]
    );
    const latestModifier = useMemo(
        () => resolveDisplayUser({ documentData, users, type: 'modifier' }),
        [documentData, users]
    );
    const caseLabel = useMemo(
        () => resolveDocumentCaseLabel(documentData, cases),
        [cases, documentData]
    );

    return (
        <>
            <Modal
                open={open}
                onClose={onClose}
                title={documentData?.name || documentData?.title || 'Detalle del documento'}
                subtitle="Resumen del documento y acceso al historial de versiones."
                maxWidth="max-w-5xl"
                footer={(
                    <Button
                        variant="primary"
                        icon={History}
                        onClick={() => setHistoryModalOpen(true)}
                    >
                        Ver historial de versiones
                    </Button>
                )}
                footerAlignment="justify-center"
            >
                <div className="space-y-6">
                    <div className="flex flex-col gap-4">
                        <InfoSection title="Estado y contexto">
                            <InfoItem icon={FileText} label="Estado" value={getDocumentStatusLabel(documentData?.status)} />
                            <InfoItem icon={FileText} label="Caso" value={caseLabel} />
                            <InfoItem
                                icon={Eye}
                                label="Última versión"
                                value={documentData?.latest_version?.version_number
                                    ?? documentData?.latest_version_number
                                    ?? 'No disponible'}
                            />
                            <InfoItem
                                icon={FileText}
                                label="ID del documento"
                                value={documentData?.id ? `#${documentData.id}` : 'No disponible'}
                            />
                        </InfoSection>

                        <InfoSection title="Creación">
                            <InfoItem icon={UserRound} label="Creado por" value={documentCreator} />
                            <InfoItem icon={FileClock} label="Fecha de creación" value={formatDateTime(documentData?.created_at)} />
                        </InfoSection>

                        <InfoSection title="Última modificación">
                            <InfoItem icon={UserRound} label="Última versión por" value={latestModifier} />
                            <InfoItem icon={FileClock} label="Fecha de modificación" value={formatDateTime(documentData?.updated_at)} />
                        </InfoSection>
                    </div>
                </div>
            </Modal>

            <DocumentVersionHistoryModal
                open={open && historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                documentData={documentData}
            />
        </>
    );
}
