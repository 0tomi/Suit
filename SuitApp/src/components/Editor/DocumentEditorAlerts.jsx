import { AlertTriangle } from 'lucide-react';

export default function DocumentEditorAlerts({
    id,
    isEditing,
    isLockedByOther,
    lockerName,
}) {
    return (
        <>
            {isLockedByOther && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    {lockerName === 'sin conexión' ? (
                        <p className="text-sm text-amber-800">
                            Sin conexión al servidor. El documento quedó en modo solo lectura.
                        </p>
                    ) : (
                        <p className="text-sm text-amber-800">
                            Este documento está siendo editado por <strong>{lockerName || 'otro usuario'}</strong>. Estás en modo solo lectura.
                        </p>
                    )}
                </div>
            )}

            {id && !isEditing && !isLockedByOther && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700">
                    Documento abierto en modo solo lectura. Presiona <strong>Editar</strong> para solicitar bloqueo y habilitar cambios.
                </div>
            )}
        </>
    );
}
