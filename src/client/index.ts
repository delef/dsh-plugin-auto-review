/** Browser half: standalone Settings, composer, locale, and Chat registrations. */
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { AutoReviewSelect, createAutoReviewLoader, createAutoReviewSetter } from './AutoReviewSelect.js'
import type { AutoReviewSelectInjected } from './AutoReviewSelect.js'
import { AutoReviewSection, createAutoReviewDefaultLoader, createAutoReviewDefaultSetter } from './AutoReviewSection.js'
import type { AutoReviewSectionInjected } from './AutoReviewSection.js'
import { registerAutoReviewActivity } from './AutoReviewActivity.js'
import { en, zh } from './locales.js'
import type { AutoReviewKey } from './locales.js'

/** Required browser services; each registration remains owned by its slot fiber. */
export const inject = ['slots', 'connection', 'locale']
const NS = 'settings.autoReview' as const

export type {
  AutoReviewMode,
  AutoReviewOption,
  AutoReviewSelectInjected,
  AutoReviewSelectProps,
  AutoReviewState,
} from './AutoReviewSelect.js'
export type { AutoReviewSectionInjected, AutoReviewSectionProps } from './AutoReviewSection.js'
export type { AutoReviewKey } from './locales.js'
export { AutoReviewRpcError, callAutoReview } from './rpc.js'
export type { AutoReviewRpc } from './rpc.js'

/** Register this plugin's copy and all UI contribution points. */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as unknown as ConnectionHandle
  const translate = ctx.locale.bind(NS) as (key: AutoReviewKey, params?: Record<string, unknown>) => string

  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-plugin-auto-review: copy dictionaries')
  registerAutoReviewActivity(ctx)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'auto-review',
    order: 90,
    locale: NS,
    label: () => translate('nav'),
    inject: (): AutoReviewSectionInjected => ({
      loadAutoReviewDefault: createAutoReviewDefaultLoader(connection.rpc),
      setAutoReviewDefault: createAutoReviewDefaultSetter(connection.rpc),
    }),
  }, AutoReviewSection))

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'auto-review',
    order: 90,
    locale: NS,
    inject: (sessionId: string): AutoReviewSelectInjected => ({
      loadAutoReview: createAutoReviewLoader(connection.rpc, sessionId),
      setAutoReview: createAutoReviewSetter(connection.rpc, sessionId),
    }),
  }, AutoReviewSelect))
}
