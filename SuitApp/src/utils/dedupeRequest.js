const inFlightGets = new Map();

export function dedupeGetRequest(key, requestFn) {
    if (inFlightGets.has(key)) {
        return inFlightGets.get(key);
    }

    const promise = requestFn().finally(() => {
        // Keep resolved promise cached for 2s to handle StrictMode double-mounts
        setTimeout(() => inFlightGets.delete(key), 2000);
    });

    inFlightGets.set(key, promise);
    return promise;
}

export function clearDedupedGetRequests() {
    inFlightGets.clear();
}
