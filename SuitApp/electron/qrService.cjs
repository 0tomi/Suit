const { getConfig } = require('./database.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');

/**
 * qrService.cjs
 * 
 * Lógica modularizada para la generación de enlaces temporales (QR) 
 * consumiendo los endpoints de SuitAPI.
 */

async function generatePublicFileUploadLink({ catalogId, permissions }) {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');
    const url = `http://${host}:${port}/api/public-files/generate-upload-link`;

    const response = await performHttpRequest({
        url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: {
            kind: 'json',
            value: {
                public_file_catalog_id: catalogId || undefined,
                permissions: permissions || []
            }
        },
        responseType: 'json',
    });

    if (!response.ok) {
        throw new Error(response.error || `La API respondió con error ${response.status}`);
    }

    return response.data; // { upload_url, expires_at }
}

async function generateCaseLink(payload) {
    console.log('[qrService] Incoming payload:', JSON.stringify(payload));
    const caseId = payload.caseId || payload.suit_case_id;
    const type = payload.type;
    const modelType = payload.modelType || payload.model_type;
    const modelId = payload.modelId || payload.model_id;

    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');
    
    const url = `http://${host}:${port}/api/suit-cases/${caseId}/generate-link`;

    const bodyValue = {
        type,
        model_type: modelType,
        ...(modelId !== undefined && { model_id: modelId }),
    };

    console.log('[qrService] Outgoing API Request:', url, 'Body:', JSON.stringify(bodyValue));

    const response = await performHttpRequest({
        url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: {
            kind: 'json',
            value: bodyValue
        },
        responseType: 'json',
    });

    if (!response.ok) {
        console.error('[qrService] API Error:', response.status, response.error, 'Data:', JSON.stringify(response.data));
        throw new Error(response.error || `La API respondió con error ${response.status}`);
    }

    console.log('[qrService] API Success:', JSON.stringify(response.data));
    return response.data; // { upload_url | download_url, expires_at }
}

module.exports = {
    generatePublicFileUploadLink,
    generateCaseLink
};
