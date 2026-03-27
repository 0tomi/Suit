const FALLBACK_FONTS = [
    'Arial',
    'Courier New',
    'Georgia',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
];

let cachedFontsPromise = null;

function stripQuotes(value) {
    return String(value || '').trim().replace(/^["']+|["']+$/g, '').trim();
}

function sanitizeFontFamilies(fonts) {
    const families = new Set();

    for (const rawFont of Array.isArray(fonts) ? fonts : []) {
        const normalized = stripQuotes(rawFont);
        if (normalized) {
            families.add(normalized);
        }
    }

    if (families.size === 0) {
        return [...FALLBACK_FONTS];
    }

    return Array.from(families).sort((left, right) => left.localeCompare(right));
}

async function listSystemFonts({ fontListModule, forceRefresh = false } = {}) {
    if (!forceRefresh && cachedFontsPromise) {
        return cachedFontsPromise;
    }

    cachedFontsPromise = (async () => {
        try {
            const fontList = fontListModule || require('font-list');
            const fonts = await fontList.getFonts({ disableQuoting: true });
            return sanitizeFontFamilies(fonts);
        } catch {
            return [...FALLBACK_FONTS];
        }
    })();

    return cachedFontsPromise;
}

module.exports = {
    FALLBACK_FONTS,
    sanitizeFontFamilies,
    listSystemFonts,
};
