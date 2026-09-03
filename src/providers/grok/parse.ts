/** Grok escalation-review output parser. */

import type { ApprovalReviewDecision } from '../../auto-review.js'

const GROK_REVIEW_OUTCOMES = ['allow', 'deny'] as const
const GROK_REVIEW_OUTPUT_KEYS = new Set(['thinking', 'outcome', 'reason'])

export type GrokApprovalDecision = ApprovalReviewDecision & { readonly decision: 'allow' | 'deny' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse a strict allow/deny object, tolerating one prose wrapper. */
export function parseGrokApprovalReview(raw: string): GrokApprovalDecision | undefined {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) return undefined
    try {
      value = JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
  if (!isRecord(value)) return undefined
  if (Object.keys(value).some(key => !GROK_REVIEW_OUTPUT_KEYS.has(key))) return undefined
  if (value.outcome !== 'allow' && value.outcome !== 'deny') return undefined
  if (value.thinking !== undefined && typeof value.thinking !== 'string') return undefined
  if (value.reason !== undefined && typeof value.reason !== 'string') return undefined
  const reason = typeof value.reason === 'string' ? value.reason.trim() : ''
  return {
    decision: value.outcome,
    reason: reason.length > 0
      ? reason
      : value.outcome === 'allow'
        ? 'Auto-review allowed this sandbox escalation.'
        : 'Auto-review denied this sandbox escalation.',
  }
}
