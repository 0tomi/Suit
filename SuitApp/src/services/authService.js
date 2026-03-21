/**
 * authService.js — Servicio de autenticación contra la API SuitAPI (Laravel Sanctum).
 */
import { apiGet, apiRequest, setAuthToken, getAuthToken } from './api.js';

/**
 * Inicia sesión con tag (nombre de usuario) y contraseña.
 * @returns {Promise<{success: boolean, user?: object, token?: string, error?: string}>}
 */
export async function login(tag, password) {
    const result = await apiRequest('/login', {
        method: 'POST',
        body: { tag, password },
        auth: false,
    });

    if (result.ok && result.data?.access_token) {
        setAuthToken(result.data.access_token, { reason: 'login' });
        return {
            success: true,
            user: result.data.user || result.data,
            token: result.data.access_token,
        };
    }

    return {
        success: false,
        error: result.data?.message || 'Credenciales incorrectas',
    };
}

/**
 * Cierra la sesión actual (invalida el token en el servidor).
 */
export async function logout() {
    await apiRequest('/logout', { method: 'POST' });
    setAuthToken(null, { reason: 'logout' });
}

/**
 * Obtiene los datos del usuario autenticado actual.
 * @returns {Promise<{success: boolean, user?: object}>}
 */
export async function getCurrentUser() {
    const result = await apiGet('/user');
    if (result.ok && result.data) {
        return { success: true, user: result.data };
    }
    return { success: false };
}

/**
 * Valida si el token actual sigue siendo válido y devuelve los datos del usuario.
 * @returns {Promise<{valid: boolean, user?: object}>}
 */
export async function validateToken() {
    if (!getAuthToken()) return { valid: false };
    const result = await getCurrentUser();
    return { valid: result.success, user: result.user || null };
}
