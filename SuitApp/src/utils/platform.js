export const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI;

export async function loadSaved(key) {
    if (isElectron()) return await window.electronAPI.config.get(key);
    return localStorage.getItem(key);
}

export async function savePersistent(key, value) {
    if (isElectron()) await window.electronAPI.config.set(key, value);
    else localStorage.setItem(key, value);
}

export async function deletePersistent(key) {
    if (isElectron()) await window.electronAPI.config.delete(key);
    else localStorage.removeItem(key);
}
