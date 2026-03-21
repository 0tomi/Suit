import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';

const ClientDetailHeader = ({ clientData, fullName, onBack, onEdit }) => (
    <div className="flex items-center gap-4">
        <Button
            variant="ghost"
            size="icon"
            icon={ArrowLeft}
            onClick={onBack}
            className="text-(--text-secondary) hover:text-(--text-primary)"
        />
        <div className="flex-1">
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                    {fullName.charAt(0)}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-(--text-primary)">{fullName}</h1>
                    <p className="text-(--text-secondary) text-sm">
                        Cliente #{clientData.id}
                    </p>
                </div>
            </div>
        </div>
        <Button variant="outline" onClick={onEdit}>
            Editar Perfil
        </Button>
    </div>
);

export default ClientDetailHeader;
