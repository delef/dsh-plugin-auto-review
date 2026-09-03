/** Per-session automatic reviewer selector for the conversation composer. */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AutoReviewKey } from './locales.js'
import { en } from './locales.js'
import { callAutoReview, type AutoReviewRpc } from './rpc.js'

export type { AutoReviewRpc } from './rpc.js'

/** None preserves DSH's native manual approval flow. */
export type AutoReviewMode = 'none' | string

/** One route currently usable by the host LLM runtime. */
export interface AutoReviewOption {
  readonly reviewer: string
  readonly label: string
}

/** Value returned by the host `autoReview` endpoint. */
export interface AutoReviewState {
  readonly reviewer: AutoReviewMode
  readonly reviewers: readonly AutoReviewOption[]
}

/** Session-bound callbacks injected by the client slot registration. */
export interface AutoReviewSelectInjected {
  loadAutoReview: () => Promise<AutoReviewState>
  setAutoReview: (reviewer: AutoReviewMode) => Promise<boolean>
}

export type AutoReviewSelectProps = PropsRuntime<'conversation.input.right'>
  & Partial<AutoReviewSelectInjected>
  & Partial<PropsLocale<'settings.autoReview'>>

/** Bind the per-session read endpoint to one Connection RPC face. */
export function createAutoReviewLoader(
  rpc: AutoReviewRpc,
  sessionId: string,
): AutoReviewSelectInjected['loadAutoReview'] {
  return () => callAutoReview<AutoReviewState>(rpc, 'autoReview', { sessionId })
}

/** Bind the per-session write endpoint and reduce business errors to `false`. */
export function createAutoReviewSetter(
  rpc: AutoReviewRpc,
  sessionId: string,
): AutoReviewSelectInjected['setAutoReview'] {
  return reviewer => callAutoReview(rpc, 'setAutoReview', { sessionId, reviewer }).then(
    () => true,
    () => false,
  )
}

function fallbackTranslate(key: AutoReviewKey): string {
  return en[key]
}

/** Render a compact menu beside other composer controls. */
export function AutoReviewSelect({ loadAutoReview, setAutoReview, t }: AutoReviewSelectProps) {
  const translate = t ?? fallbackTranslate
  const [state, setState] = useState<AutoReviewState | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const loadRef = useRef(loadAutoReview)
  loadRef.current = loadAutoReview

  useEffect(() => {
    const load = loadRef.current
    if (load === undefined) return
    let cancelled = false
    void load().then(
      value => { if (!cancelled) setState(value) },
      () => { /* An absent host endpoint hides this optional control. */ },
    )
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => { document.removeEventListener('mousedown', closeOutside) }
  }, [open])

  if (loadAutoReview === undefined || setAutoReview === undefined || state === null) return null

  const liveReviewers = state.reviewers
  const selected = state.reviewer
  const selectedIsStale = selected !== 'none'
    && !liveReviewers.some(option => option.reviewer === selected)
  const staleOption: AutoReviewOption | undefined = selectedIsStale
    ? { reviewer: selected, label: `${selected} (${translate('unavailable')})` }
    : undefined
  const choices: readonly AutoReviewOption[] = [
    { reviewer: 'none', label: translate('none') },
    ...staleOption === undefined ? [] : [staleOption],
    ...liveReviewers,
  ]
  const selectedLabel = choices.find(option => option.reviewer === selected)?.label ?? selected
  const triggerLabel = `${translate('autoReview')} · ${selectedLabel}`

  const choose = (reviewer: AutoReviewMode): void => {
    if (busy) return
    if (reviewer === state.reviewer) {
      setOpen(false)
      return
    }
    setBusy(true)
    void setAutoReview(reviewer).then(ok => {
      setBusy(false)
      if (ok) {
        setState(current => current === null ? current : { ...current, reviewer })
        setOpen(false)
      }
    }, () => { setBusy(false) })
  }

  const show = (): void => {
    setOpen(true)
    const load = loadRef.current
    if (load !== undefined) void load().then(setState, () => { /* Keep last good state. */ })
  }

  return (
    <div
      ref={rootRef}
      data-plugin="dsh-plugin-auto-review"
      style={styles.root}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
        }
      }}
    >
      {open && (
        <div style={styles.menu} role="menu" aria-label={translate('autoReview')}>
          {choices.map(option => {
            const stale = option.reviewer === selected && selectedIsStale
            return (
              <button
                key={option.reviewer}
                type="button"
                role="menuitemradio"
                aria-checked={option.reviewer === selected}
                aria-disabled={stale}
                style={styles.item}
                disabled={busy || stale}
                onClick={() => { choose(option.reviewer) }}
              >
                <span style={styles.itemCheck}>{option.reviewer === selected ? '✓' : ''}</span>
                <span style={styles.itemText}>
                  <span style={styles.itemName}>{option.label}</span>
                  <span style={styles.itemDescription}>
                    {option.reviewer === 'none' ? translate('noneDescription') : translate('reviewerDescription')}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
      <button
        type="button"
        style={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={triggerLabel}
        disabled={busy}
        onClick={() => { if (open) setOpen(false); else show() }}
      >
        {triggerLabel}
      </button>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  root: { position: 'relative', display: 'inline-flex' },
  trigger: {
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8,
    background: 'transparent', color: 'var(--dsw-alias-label-secondary)',
    font: 'inherit', fontSize: 12, lineHeight: '18px',
    padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  menu: {
    position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
    minWidth: 220, padding: 4, zIndex: 20,
    background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 2,
  },
  item: {
    display: 'flex', alignItems: 'flex-start', gap: 6, width: '100%',
    border: 'none', borderRadius: 6, background: 'transparent',
    padding: '6px 8px', cursor: 'pointer', font: 'inherit', textAlign: 'left',
  },
  itemCheck: { width: 14, flexShrink: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-primary)' },
  itemText: { display: 'flex', flexDirection: 'column' },
  itemName: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-primary)' },
  itemDescription: { fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' },
}
