import { Calendar, Mail, MapPin, Phone } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return format(parseISO(String(dateStr).replace(' ', 'T')), 'dd/MM/yyyy');
    } catch {
        return '—';
    }
}

export function buildContactSection(personData) {
    return {
        title: 'Datos de contacto',
        fields: [
            { label: 'Teléfono', value: personData.phone ?? personData.telefono, icon: Phone },
            { label: 'Email', value: personData.email, icon: Mail },
            { label: 'Dirección', value: personData.address ?? personData.direccion, icon: MapPin, fullWidth: true },
        ],
    };
}

export function buildDateFields(personData) {
    return [
        {
            label: 'Fecha de registro',
            value: personData.created_at,
            icon: Calendar,
            render: () => formatDate(personData.created_at),
        },
        {
            label: 'Última actualización',
            value: personData.updated_at,
            icon: Calendar,
            render: () => formatDate(personData.updated_at),
        },
    ];
}

export function normalizeGender(genderCode) {
    if (!genderCode) return '—';
    const norm = String(genderCode).toUpperCase();
    if (norm === 'M') return 'Masculino';
    if (norm === 'F') return 'Femenino';
    if (norm === 'X') return 'No binario';
    return genderCode;
}
