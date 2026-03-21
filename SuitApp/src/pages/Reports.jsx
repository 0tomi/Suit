import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import ReportsDashboard from '../components/reports/ReportsDashboard.jsx';

function Reports() {
    const { user } = useAuth();

    if (user?.role !== 'admin') {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
                    <h1 className="text-2xl font-semibold text-(--text-primary) flex items-center gap-2">
                        <Lock className="h-6 w-6 text-red-500" />
                        Acceso denegado
                    </h1>
                    <p className="mt-2 text-(--text-secondary)">
                        Solo los usuarios administradores pueden acceder al dashboard de Reportes.
                    </p>
                </div>
            </div>
        );
    }

    return <ReportsDashboard />;
}

export default Reports;
