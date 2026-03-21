const fs = require('fs/promises');
const path = require('path');

const SUPPORTED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const MIME_BY_EXTENSION = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

function normalizeExtensions(allowedExtensions = SUPPORTED_IMAGE_EXTENSIONS) {
    const normalized = allowedExtensions
        .map((extension) => String(extension).trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean)
        .filter((extension, index, list) => list.indexOf(extension) === index)
        .filter((extension) => Object.hasOwn(MIME_BY_EXTENSION, extension));

    return normalized.length > 0 ? normalized : [...SUPPORTED_IMAGE_EXTENSIONS];
}

function getImageMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase().replace(/^\./, '');
    return MIME_BY_EXTENSION[extension] || null;
}

function toDataUrl(mimeType, buffer) {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function openImageDialog({
    browserWindow = null,
    dialogModule = null,
    fsModule = fs,
    maxFileSizeBytes = MAX_IMAGE_FILE_SIZE_BYTES,
    allowedExtensions = SUPPORTED_IMAGE_EXTENSIONS,
} = {}) {
    const { dialog } = dialogModule ? { dialog: dialogModule } : require('electron');
    const normalizedExtensions = normalizeExtensions(allowedExtensions);

    const result = await dialog.showOpenDialog(browserWindow, {
        title: 'Seleccionar imagen',
        properties: ['openFile'],
        filters: [
            {
                name: 'Imágenes',
                extensions: normalizedExtensions,
            },
        ],
    });

    if (result.canceled || !result.filePaths?.length) {
        return { canceled: true };
    }

    const selectedPath = result.filePaths[0];
    const mimeType = getImageMimeType(selectedPath);

    if (!mimeType) {
        return {
            canceled: false,
            error: 'Formato de imagen no soportado. Usa PNG, JPG, JPEG o WEBP.',
        };
    }

    const stats = await fsModule.stat(selectedPath);
    if (stats.size > maxFileSizeBytes) {
        return {
            canceled: false,
            error: `La imagen supera el límite de ${(maxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB.`,
        };
    }

    const fileBuffer = await fsModule.readFile(selectedPath);

    return {
        canceled: false,
        fileName: path.basename(selectedPath),
        mimeType,
        dataUrl: toDataUrl(mimeType, fileBuffer),
    };
}

module.exports = {
    MAX_IMAGE_FILE_SIZE_BYTES,
    SUPPORTED_IMAGE_EXTENSIONS,
    getImageMimeType,
    normalizeExtensions,
    openImageDialog,
    toDataUrl,
};
