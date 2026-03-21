import { Button } from './Button';

export const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }) => (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-(--bg-card) rounded-xl border border-(--border-subtle) animate-in fade-in">
        <div className="h-16 w-16 bg-(--bg-card-hover) rounded-full flex items-center justify-center mb-4">
            {Icon && <Icon className="h-8 w-8 text-(--text-tertiary)" />}
        </div>
        <h3 className="text-lg font-semibold text-(--text-primary) mb-2">{title}</h3>
        <p className="text-(--text-secondary) max-w-sm mb-6">{description}</p>

        {actionLabel && onAction && (
            <Button variant="primary" onClick={onAction}>
                {actionLabel}
            </Button>
        )}
    </div>
);
