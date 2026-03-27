/**
 * Devuelve el nombre visible de un archivo a partir de una ruta,
 * quitando únicamente la última extensión cuando existe.
 */
export function getBaseNameWithoutExtension(filePath) {
    if (!filePath) return '';

    const fileName = String(filePath).split(/[\\/]/).pop()?.trim() || '';
    if (!fileName) return '';

    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex <= 0) return fileName;

    return fileName.slice(0, lastDotIndex).trim();
}
