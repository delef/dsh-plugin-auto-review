/** Codex Guardian output parser. */

import type { ApprovalReviewDecision } from '../../auto-review.js'

const CODEX_REVIEW_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
const CODEX_REVIEW_AUTHORIZATION_LEVELS = ['unknown', 'low', 'medium', 'high'] as const
const CODEX_REVIEW_OUTCOMES = ['allow', 'deny'] as const
const CODEX_REVIEW_OUTPUT_KEYS = new Set(['risk_level', 'user_authorization', 'outcome', 'rationale'])

type CodexApprovalDecision = ApprovalReviewDecision & { readonly decision: 'allow' | 'deny' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringEnum<const T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && options.includes(value)
}

/** Parse one strict Guardian result, tolerating exactly one prose wrapper. */
export function parseCodexApprovalReview(raw: string): CodexApprovalDecision | undefined {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return undefined
    try {
      value = JSON.parse(raw.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
  if (!isRecord(value)) return undefined
  if (Object.keys(value).some(key => !CODEX_REVIEW_OUTPUT_KEYS.has(key))) return undefined
  if (!isStringEnum(value.outcome, CODEX_REVIEW_OUTCOMES)) return undefined
  if (value.risk_level !== undefined && !isStringEnum(value.risk_level, CODEX_REVIEW_RISK_LEVELS)) return undefined
  if (value.user_authorization !== undefined
    && !isStringEnum(value.user_authorization, CODEX_REVIEW_AUTHORIZATION_LEVELS)) return undefined
  if (value.rationale !== undefined && typeof value.rationale !== 'string') return undefined
  const rationale = typeof value.rationale === 'string' ? value.rationale.trim() : undefined
  const reason = rationale === undefined || rationale.length === 0
    ? value.outcome === 'allow'
      ? 'Auto-review returned a low-risk allow decision.'
      : 'Auto-review returned a deny decision without a rationale.'
    : rationale
  return { decision: value.outcome, reason }
}
