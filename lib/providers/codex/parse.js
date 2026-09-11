/** Codex Guardian output parser. */
const CODEX_REVIEW_RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const CODEX_REVIEW_AUTHORIZATION_LEVELS = ['unknown', 'low', 'medium', 'high'];
const CODEX_REVIEW_OUTCOMES = ['allow', 'deny'];
const CODEX_REVIEW_OUTPUT_KEYS = new Set(['risk_level', 'user_authorization', 'outcome', 'rationale']);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isStringEnum(value, options) {
    return typeof value === 'string' && options.includes(value);
}
/** Parse one strict Guardian result, tolerating exactly one prose wrapper. */
export function parseCodexApprovalReview(raw) {
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start < 0 || end <= start)
            return undefined;
        try {
            value = JSON.parse(raw.slice(start, end + 1));
        }
        catch {
            return undefined;
        }
    }
    if (!isRecord(value))
        return undefined;
    if (Object.keys(value).some(key => !CODEX_REVIEW_OUTPUT_KEYS.has(key)))
        return undefined;
    if (!isStringEnum(value.outcome, CODEX_REVIEW_OUTCOMES))
        return undefined;
    if (value.risk_level !== undefined && !isStringEnum(value.risk_level, CODEX_REVIEW_RISK_LEVELS))
        return undefined;
    if (value.user_authorization !== undefined
        && !isStringEnum(value.user_authorization, CODEX_REVIEW_AUTHORIZATION_LEVELS))
        return undefined;
    if (value.rationale !== undefined && typeof value.rationale !== 'string')
        return undefined;
    const rationale = typeof value.rationale === 'string' ? value.rationale.trim() : undefined;
    const reason = rationale === undefined || rationale.length === 0
        ? value.outcome === 'allow'
            ? 'Auto-review returned a low-risk allow decision.'
            : 'Auto-review returned a deny decision without a rationale.'
        : rationale;
    return { decision: value.outcome, reason };
}
