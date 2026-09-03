/** Compact Settings page for the persisted Auto Review default. */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { callAutoReview, type AutoReviewRpc } from './rpc.js'
import type { AutoReviewKey } from './locales.js'
import { en } from './locales.js'
import type { AutoReviewOption, AutoReviewState } from './AutoReviewSelect.js'

export interface AutoReviewSectionInjected {
  loadAutoReviewDefault: () => Promise<AutoReviewState>
  setAutoReviewDefault: (reviewer: string) => Promise<AutoReviewState>
}

export type AutoReviewSectionProps = PropsRuntime<'settings.section'>
  & Partial<AutoReviewSectionInjected>
  & Partial<PropsLocale<'settings.autoReview'>>

/** Bind the Settings read endpoint to one Connection RPC face. */
export function createAutoReviewDefaultLoader(
  rpc: AutoReviewRpc,
): AutoReviewSectionInjected['loadAutoReviewDefault'] {
  return () => callAutoReview<AutoReviewState>(rpc, 'autoReviewDefault', {})
}

/** Bind the Settings write endpoint to one Connection RPC face. */
export function createAutoReviewDefaultSetter(
  rpc: AutoReviewRpc,
): AutoReviewSectionInjected['setAutoReviewDefault'] {
  return reviewer => callAutoReview<AutoReviewState>(rpc, 'setAutoReviewDefault', { reviewer })
}

function fallbackTranslate(key: AutoReviewKey): string {
  return en[key]
}

/** Settings section intentionally stays compact so the page remains scannable. */
export function AutoReviewSection({ loadAutoReviewDefault, setAutoReviewDefault, t }: AutoReviewSectionProps) {
  const translate = t ?? fallbackTranslate
  const [state, setState] = useState<AutoReviewState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (loadAutoReviewDefault === undefined) return
    let cancelled = false
    void loadAutoReviewDefault().then(
      value => { if (!cancelled) setState(value) },
      reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)) },
    )
    return () => { cancelled = true }
  }, [loadAutoReviewDefault])

  if (loadAutoReviewDefault === undefined || setAutoReviewDefault === undefined) return null
  if (state === null) {
    return <p data-plugin="dsh-plugin-auto-review">{error ?? translate('loading')}</p>
  }

  const liveReviewers: readonly AutoReviewOption[] = state.reviewers
  const stale = state.reviewer !== 'none' && !liveReviewers.some(option => option.reviewer === state.reviewer)
  const options: readonly AutoReviewOption[] = [
    { reviewer: 'none', label: translate('none') },
    ...stale ? [{ reviewer: state.reviewer, label: `${state.reviewer} (${translate('unavailable')})` }] : [],
    ...liveReviewers,
  ]

  const choose = (reviewer: string): void => {
    if (saving || reviewer === state.reviewer || reviewer === (stale ? state.reviewer : '')) return
    setSaving(true)
    setError(null)
    void setAutoReviewDefault(reviewer).then(
      value => { setState(value); setSaving(false) },
      reason => { setError(reason instanceof Error ? reason.message : String(reason)); setSaving(false) },
    )
  }

  return (
    <section data-plugin="dsh-plugin-auto-review" style={styles.section}>
      <h2 style={styles.title}>{translate('defaultTitle')}</h2>
      <p style={styles.hint}>{translate('defaultHint')}</p>
      <label style={styles.label}>
        <span>{translate('default')}</span>
        <select
          aria-label={translate('default')}
          value={state.reviewer}
          disabled={saving}
          onChange={event => { choose(event.target.value) }}
          style={styles.select}
        >
          {options.map(option => <option key={option.reviewer} value={option.reviewer} disabled={option.reviewer === state.reviewer && stale}>{option.label}</option>)}
        </select>
      </label>
      {saving && <p style={styles.status}>{translate('saving')}</p>}
      {error !== null && <p style={styles.error}>{error}</p>}
    </section>
  )
}

const styles: Record<string, CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560, color: 'var(--dsw-alias-label-primary)' },
  title: { margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600 },
  hint: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 13, lineHeight: '20px' },
  label: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14, lineHeight: '22px' },
  select: { minWidth: 180, height: 32, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: '0 8px', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit' },
  status: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: '18px' },
  error: { margin: 0, color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, lineHeight: '18px' },
}
