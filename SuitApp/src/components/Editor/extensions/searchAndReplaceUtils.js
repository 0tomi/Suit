export function normalizeSearchTerm(value) {
    return String(value || '').trim().toLowerCase();
}

export function normalizeActiveMatchIndex(matchCount, nextIndex) {
    if (matchCount === 0) return -1;
    if (typeof nextIndex !== 'number' || Number.isNaN(nextIndex)) return 0;
    return Math.min(Math.max(nextIndex, 0), matchCount - 1);
}

export function collectSearchMatches(doc, searchTerm) {
    const normalizedSearch = normalizeSearchTerm(searchTerm);
    if (!normalizedSearch) return [];

    const matches = [];
    doc.descendants((node, pos) => {
        if (!node.isText || typeof node.text !== 'string' || node.text.length === 0) {
            return true;
        }

        const haystack = node.text.toLowerCase();
        let offset = 0;

        while (offset < haystack.length) {
            const foundAt = haystack.indexOf(normalizedSearch, offset);
            if (foundAt === -1) break;

            const from = pos + foundAt;
            matches.push({
                from,
                to: from + normalizedSearch.length,
                text: node.text.slice(foundAt, foundAt + normalizedSearch.length),
            });

            offset = foundAt + normalizedSearch.length;
        }

        return true;
    });

    return matches;
}
