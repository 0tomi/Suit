import { apiGet, apiRequest } from './api.js';

function extractCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

export async function getUsersDirectory() {
    const result = await apiGet('/users', { dedupe: false });
    return result.ok ? extractCollection(result.data) : [];
}

export async function getUserProfile(userId) {
    const result = await apiGet(`/users/${userId}`, { dedupe: false });
    if (!result.ok) {
        throw new Error(result.data?.message || result.error || 'No se pudo obtener el perfil del usuario.');
    }
    return result.data?.data || result.data;
}

export async function registerUser({ tag, name, password, role, email, photo }) {
    const hasPhoto = Boolean(photo);

    const body = hasPhoto
        ? (() => {
            const formData = new FormData();
            formData.append('tag', tag);
            formData.append('name', name);
            formData.append('password', password);
            formData.append('role', role);
            if (email) formData.append('email', email);
            formData.append('photo', photo);
            return formData;
        })()
        : {
            tag,
            name,
            password,
            role,
            ...(email ? { email } : {}),
        };

    const result = await apiRequest('/register', {
        method: 'POST',
        body,
    });

    if (!result.ok) {
        throw new Error(result.data?.message || result.error || 'No se pudo registrar el usuario.');
    }

    return result.data?.user || result.data;
}

export async function deleteUser(userId) {
    const result = await apiRequest(`/users/${userId}`, {
        method: 'DELETE',
    });

    if (!result.ok) {
        throw new Error(result.data?.message || result.error || 'No se pudo eliminar el usuario.');
    }

    return true;
}

export async function updateUser(currentTag, payload) {
    // El backend acepta edición parcial; solo enviamos los cambios necesarios.
    const result = await apiRequest(`/users/tag/${currentTag}`, {
        method: 'PUT',
        body: payload,
    });

    if (!result.ok) {
        throw new Error(result.data?.message || result.error || 'No se pudo actualizar el usuario.');
    }

    return result.data?.user || result.data;
}
