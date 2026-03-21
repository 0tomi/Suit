import { AlertCircle, X } from 'lucide-react';

const AgendaErrorBanner = ({ error, onDismiss }) => {
    if (!error) return null;

    return (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-600 px-4 py-3 rounded-lg text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={onDismiss} className="ml-auto text-red-500 hover:text-red-700">
                <X size={16} />
            </button>
        </div>
    );
};

export default AgendaErrorBanner;
