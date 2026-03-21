import { useState } from 'react';
import { Users, Shield, Lock, Settings } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { useAuth } from '../context/AuthContext.jsx';
import SideMenuPageLayout from '../components/ui/SideMenuPageLayout.jsx';
import AdminUsersTab from '../components/admin/AdminUsersTab.jsx';
import AdminSettingsTab from '../components/admin/AdminSettingsTab.jsx';

const TABS = [
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'settings', label: 'Configuración', icon: Settings },
];

const AdminPanel = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('users');
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    const dialogCallbacks = { openDialog, closeDialog, setDialogLoading };
    const contentByTab = {
        users: <AdminUsersTab {...dialogCallbacks} />,
        settings: <AdminSettingsTab />,
    };

    if (user?.role !== 'admin') {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
                    <h1 className="text-2xl font-semibold text-(--text-primary) flex items-center gap-2">
                        <Lock className="h-6 w-6 text-red-500" />
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
            description="Gestiona usuarios y tareas reservadas para administradores."
            icon={Shield}
            sections={TABS}
            activeSection={activeTab}
            onSectionChange={setActiveTab}
            sectionIdPrefix="admin-tab"
            maxWidthClass="max-w-7xl"
        >
            {contentByTab[activeTab] || null}
            <ConfirmDialog {...dialogProps} />
        </SideMenuPageLayout>
    );
};

export default AdminPanel;
