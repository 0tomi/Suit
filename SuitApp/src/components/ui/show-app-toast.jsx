import { sileo } from 'sileo';

const VARIANT_TO_TYPE = {
    success: 'success',
    danger: 'error',
    warning: 'warning',
    info: 'info',
};

export function showAppToast({
    id,
    title,
    description,
    variant = 'success',
    duration = 3000,
    position,
    icon,
}) {
    return sileo.show({
        id,
        title,
        description,
        type: VARIANT_TO_TYPE[variant] || 'info',
        duration,
        position,
        icon,
    });
}
