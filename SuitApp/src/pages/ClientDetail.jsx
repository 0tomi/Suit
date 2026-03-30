import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClients } from '../context/ClientsContext';
import { useEntityDetail } from '../hooks/useEntityDetail.js';
import { getClient } from '../services/clientService.js';
import ClientDetailHeader from '../components/clients/ClientDetailHeader';
import ClientDetailTabs from '../components/clients/ClientDetailTabs';
import ClientProfileTab from '../components/clients/ClientProfileTab';
import ClientDocumentsTab from '../components/clients/ClientDocumentsTab';
import { EditClientModal } from '../components/clients/EditClientModal';
import { useApi } from '../context/ApiContext.jsx';

const ClientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [isEditOpen, setIsEditOpen] = useState(false);
    const { connected } = useApi();
    
    // Soporte para atajos de salto de pestañas
    useEffect(() => {
        const handler = (e) => {
            const tabs = ['profile', 'documents'];
            if (tabs[e.detail.index]) {
                setActiveTab(tabs[e.detail.index]);
            }
        };
        window.addEventListener('app:tab-change', handler);
        return () => window.removeEventListener('app:tab-change', handler);
    }, []);

    const { clients, updateItem } = useClients();

    const {
        entity: clientData,
        loading,
        error,
        setEntity: setClientData,
    } = useEntityDetail({
        id,
        items: clients,
        fetchById: getClient,
        initialEntity: null,
        notFoundMessage: 'Cliente no encontrado.',
        loadErrorMessage: 'Error al cargar cliente.',
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full p-8">
                <p className="text-(--text-secondary)">Cargando cliente...</p>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex justify-center items-center h-full p-8">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }
    if (!clientData) {
        return (
            <div className="flex justify-center items-center h-full p-8">
                <p className="text-(--text-secondary)">Cliente no encontrado.</p>
            </div>
        );
    }

    const fullName = `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim() || 'Sin nombre';

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 h-full flex flex-col px-1">
            <ClientDetailHeader
                clientData={clientData}
                fullName={fullName}
                onBack={() => navigate('/people')}
                onEdit={() => setIsEditOpen(true)}
            />

            <ClientDetailTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                disabledTabs={connected ? [] : ['documents']}
            />

            <div className="flex-1 min-h-0 flex flex-col">
                {activeTab === 'profile' && (
                    <ClientProfileTab clientData={clientData} fullName={fullName} />
                )}
                {activeTab === 'documents' && (
                    <ClientDocumentsTab clientData={clientData} isOnline={connected} />
                )}
            </div>

            <EditClientModal
                key={`${clientData.id}-${isEditOpen ? 'open' : 'closed'}`}
                open={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                clientData={clientData}
                onUpdate={(updatedData) => {
                    setClientData({ ...clientData, ...updatedData });
                    updateItem(id, updatedData);
                }}
            />
        </div>
    );
};

export default ClientDetail;
