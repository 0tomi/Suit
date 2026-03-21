import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle, Server } from 'lucide-react';
import { useApi } from '../context/ApiContext';

const ServerUnavailableAlert = () => {
    const {
        showServerUnavailableAlert,
        setShowServerUnavailableAlert,
        setShowSetup,
        apiHost,
        apiPort,
    } = useApi();

    if (!showServerUnavailableAlert) return null;

    const hostPort = apiHost && apiPort ? `${apiHost}:${apiPort}` : null;

    return (
        <AlertDialog.Root
            open={showServerUnavailableAlert}
            onOpenChange={setShowServerUnavailableAlert}
        >
            <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-in fade-in" />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-[70] w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 bg-red-50 text-red-600 rounded-lg p-2 border border-red-100">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <AlertDialog.Title className="text-lg font-bold text-gray-900">
                                Servidor de Suit no disponible
                            </AlertDialog.Title>
                            <AlertDialog.Description className="text-sm text-gray-600 mt-1">
                                No se pudo conectar al servidor configurado{hostPort ? ` (${hostPort})` : ''}.
                            </AlertDialog.Description>
                        </div>
                    </div>

                    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900 mb-2">Sugerencias</p>
                        <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">
                            <li>Comprobar que la PC con el servidor está ejecutándolo correctamente.</li>
                            <li>La app ya intentó localizar el servidor automáticamente antes de mostrar este aviso.</li>
                            <li>Abre el modal de conexión para volver a intentar el descubrimiento o ingresar la dirección manualmente.</li>
                        </ul>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <AlertDialog.Cancel asChild>
                            <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
                                Cerrar
                            </button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action asChild>
                            <button
                                onClick={() => {
                                    setShowServerUnavailableAlert(false);
                                    setShowSetup(true);
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Server className="w-4 h-4" />
                                Ubicar Servidor
                            </button>
                        </AlertDialog.Action>
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
};

export default ServerUnavailableAlert;
