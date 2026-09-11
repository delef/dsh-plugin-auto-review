import { AutoReviewSelect, createAutoReviewLoader, createAutoReviewSetter } from './AutoReviewSelect.js';
import { AutoReviewSection, createAutoReviewDefaultLoader, createAutoReviewDefaultSetter } from './AutoReviewSection.js';
import { registerAutoReviewActivity } from './AutoReviewActivity.js';
import { en, zh } from './locales.js';
/** Required browser services; each registration remains owned by its slot fiber. */
export const inject = ['slots', 'connection', 'locale'];
const NS = 'settings.autoReview';
export { AutoReviewRpcError, callAutoReview } from './rpc.js';
/** Register this plugin's copy and all UI contribution points. */
export function apply(ctx) {
    const connection = ctx.get('connection');
    const translate = ctx.locale.bind(NS);
    ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-plugin-auto-review: copy dictionaries');
    registerAutoReviewActivity(ctx);
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'auto-review',
        order: 90,
        locale: NS,
        label: () => translate('nav'),
        inject: () => ({
            loadAutoReviewDefault: createAutoReviewDefaultLoader(connection.rpc),
            setAutoReviewDefault: createAutoReviewDefaultSetter(connection.rpc),
        }),
    }, AutoReviewSection));
    ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right',
        id: 'auto-review',
        order: 90,
        locale: NS,
        inject: (sessionId) => ({
            loadAutoReview: createAutoReviewLoader(connection.rpc, sessionId),
            setAutoReview: createAutoReviewSetter(connection.rpc, sessionId),
        }),
    }, AutoReviewSelect));
}
