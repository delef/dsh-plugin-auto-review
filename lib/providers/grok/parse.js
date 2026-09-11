/** Grok escalation-review output parser. */
const GROK_REVIEW_OUTCOMES = ['allow', 'deny'];
const GROK_REVIEW_OUTPUT_KEYS = new Set(['thinking', 'outcome', 'reason']);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Parse a strict allow/deny object, tolerating one prose wrapper. */
export function parseGrokApprovalReview(raw) {
    const trimmed = raw.trim();
    if (trimmed.length === 0)
        return undefined;
    let value;
    try {
        value = JSON.parse(trimmed);
    }
    catch {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start < 0 || end <= start)
            return undefined;
        try {
            value = JSON.parse(trimmed.slice(start, end + 1));
        }
        catch {
            return undefined;
        }
    }
    if (!isRecord(value))
        return undefined;
    if (Object.keys(value).some(key => !GROK_REVIEW_OUTPUT_KEYS.has(key)))
        return undefined;
    if (value.outcome !== 'allow' && value.outcome !== 'deny')
        return undefined;
    if (value.thinking !== undefined && typeof value.thinking !== 'string')
        return undefined;
    if (value.reason !== undefined && typeof value.reason !== 'string')
        return undefined;
    const reason = typeof value.reason === 'string' ? value.reason.trim() : '';
    return {
        decision: value.outcome,
        reason: reason.length > 0
            ? reason
            : value.outcome === 'allow'
                ? 'Auto-review allowed this sandbox escalation.'
                : 'Auto-review denied this sandbox escalation.',
    };
}
