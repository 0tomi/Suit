import { Mail, Shield, Tag, UserRound } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';

function resolveInitials(profile) {
    const initials = [profile?.name, profile?.last_name]
        .filter(Boolean)
        .map((chunk) => String(chunk).charAt(0).toUpperCase())
        .join('');

    if (initials) return initials;
    return (profile?.tag || 'U').charAt(0).toUpperCase();
}

const DetailRow = ({ icon, label, value }) => {
    const IconComponent = icon;

    return (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-(--text-tertiary) flex items-center gap-2">
            {IconComponent ? <IconComponent className="h-3.5 w-3.5" /> : null}
            {label}
        </p>
        <p className="mt-1 text-sm font-medium text-(--text-primary)">{value || '—'}</p>
    </div>
    );
};

const AdminUserDetailModal = ({ open, onClose, profile, loading }) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Detalle de usuario"
            maxWidth="max-w-xl"
        >
            {loading ? (
                <div className="py-10 text-center text-(--text-secondary)">Cargando perfil...</div>
            ) : (
                <div className="space-y-5">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full overflow-hidden bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 font-semibold text-xl">
                            {profile?.profile_photo_url ? (
                                <img
                                    src={profile.profile_photo_url}
                                    alt={`Foto de ${profile?.name || profile?.tag || 'usuario'}`}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                resolveInitials(profile)
                            )}
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-(--text-primary)">
                                {profile?.name || 'Sin nombre'}
                            </p>
                            <p className="text-sm text-(--text-secondary)">
                                {profile?.tag || 'Sin tag'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <DetailRow icon={Tag} label="Tag" value={profile?.tag} />
                        <DetailRow icon={UserRound} label="Nombre" value={profile?.name} />
                        <DetailRow icon={Mail} label="Email" value={profile?.email} />
                        <DetailRow icon={Shield} label="Rol" value={profile?.role} />
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default AdminUserDetailModal;
