import { useState } from 'react';
import { Users, Shield, Lock, Settings, BookOpen } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { useAuth } from '../context/AuthContext.jsx';
import SideMenuPageLayout from '../components/ui/SideMenuPageLayout.jsx';
import AdminUsersTab from '../components/admin/AdminUsersTab.jsx';
import AdminSettingsTab from '../components/admin/AdminSettingsTab.jsx';
import AdminBitacoraTab from '../components/admin/AdminBitacoraTab.jsx';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
import { adminPanelSteps } from '../constants/tutorialSteps.js';

const TABS = [
    { id: 'users', label: 'Usuarios', icon: Users, testId: 'admin-tab-users' },
    { id: 'bitacora', label: 'Bitácora', icon: BookOpen, testId: 'admin-tab-bitacora' },
    { id: 'settings', label: 'Configuración', icon: Settings, testId: 'admin-tab-settings' },
];

const AdminPanel = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('users');
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    const dialogCallbacks = { openDialog, closeDialog, setDialogLoading };
    const contentByTab = {
        users: <AdminUsersTab {...dialogCallbacks} />,
        bitacora: <AdminBitacoraTab {...dialogCallbacks} />,
        settings: <AdminSettingsTab />,
    };

    if (user?.role !== 'admin') {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
                    <h1 className="text-2xl font-semibold text-(--text-primary) flex items-center gap-2">
                        <Lock className="h-6 w-6 text-red-500 dark:text-red-400" />
                        Acceso denegado
                    </h1>
                    <p className="mt-2 text-(--text-secondary)">
                        Solo los usuarios administradores pueden acceder al Panel de Administración.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <SideMenuPageLayout
            title="Panel de Administración"
            titleTestId="page-admin-title"
            description="Gestiona usuarios, bitácora operativa y tareas reservadas para administradores."
            icon={Shield}
            titleAction={(
                <SectionTutorialTrigger
                    steps={adminPanelSteps}
                    ariaLabel="Ver tutorial del panel de administración"
                    testId="adminpanel-tutorial-trigger"
                />
            )}
            sections={TABS}
            activeSection={activeTab}
            onSectionChange={setActiveTab}
            sectionIdPrefix="admin-tab"
            maxWidthClass="max-w-full"
        >
            {contentByTab[activeTab] || null}
            <ConfirmDialog {...dialogProps} />
        </SideMenuPageLayout>
    );
};

export default AdminPanel;
