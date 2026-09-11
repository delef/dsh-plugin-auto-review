export function inheritedSessionSetting(values, sessionId, parentOf) {
    const seen = new Set();
    let current = sessionId;
    while (current !== undefined && !seen.has(current)) {
        seen.add(current);
        if (values.has(current))
            return values.get(current);
        current = parentOf(current);
    }
    return undefined;
}
