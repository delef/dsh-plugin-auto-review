import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const REVIEW_TOOL_PREFIX = 'auto-review/';
const REVIEW_ID_PREFIX = 'auto-review-';
/** Stable user-facing status text for live and replayed Chat cards. */
export function formatAutoReviewActivity(provider, outcome) {
    const result = outcome === undefined
        ? 'Reviewing...'
        : outcome === 'allowed-once'
            ? 'Allowed'
            : outcome === 'rejected'
                ? 'Denied'
                : outcome === 'unavailable'
                    ? 'Unavailable'
                    : outcome === 'cancelled'
                        ? 'Cancelled'
                        : 'Completed';
    return `Auto Review · ${provider} · ${result}`;
}
/** Fold `auto-review/<id>` asked/decided events into one visible Chat node. */
export const autoReviewActivityDefinition = {
    kind: 'auto-review',
    target: 'chat',
    match(event) {
        if (event.type === 'approval/asked' && event.data.toolName.startsWith(REVIEW_TOOL_PREFIX)) {
            return { id: String(event.data.id), role: 'start' };
        }
        if (event.type === 'approval/decided' && String(event.data.id).startsWith(REVIEW_ID_PREFIX)) {
            return { id: String(event.data.id), role: 'update' };
        }
        return null;
    },
    start(_context, match) {
        if (match.event.type !== 'approval/asked' || match.event.data.callId === undefined) {
            throw new Error('auto-review activity start requires an approval/asked event with a call id');
        }
        const reviewerId = match.event.data.toolName.slice(REVIEW_TOOL_PREFIX.length);
        return {
            provider: match.event.data.reason ?? reviewerId,
            callId: String(match.event.data.callId),
            seq: match.event.seq,
        };
    },
    update(context, match) {
        if (match.event.type !== 'approval/decided')
            return context.state;
        return { ...context.state, outcome: match.event.data.outcome };
    },
    buildViewNode(context) {
        if (context.state === undefined)
            return null;
        const data = {
            provider: context.state.provider,
            callId: context.state.callId,
            ...context.state.outcome === undefined ? {} : { outcome: context.state.outcome },
        };
        const node = {
            key: context.key,
            kind: 'auto-review',
            id: context.id,
            target: 'chat',
            anchorSeq: context.state.seq,
            location: context.start?.location ?? { kind: 'unresolved' },
            visibility: 'visible',
            data,
        };
        return node;
    },
};
/** Compact status row that stays outside the model-visible transcript. */
export function AutoReviewActivity({ node }) {
    const outcome = node.data.outcome;
    return (_jsxs("div", { className: "dsh-plugin-auto-review-activity", "data-plugin": "dsh-plugin-auto-review", "data-outcome": outcome ?? 'reviewing', role: "status", children: [_jsx("span", { className: "dsh-plugin-auto-review-activity-dot", "aria-hidden": "true" }), _jsx("span", { children: formatAutoReviewActivity(node.data.provider, outcome) })] }));
}
/** Register the definition against whichever Conversation event service exists. */
export function registerAutoReviewActivity(ctx) {
    let registered = false;
    const register = (registry) => {
        if (registered)
            return;
        registered = true;
        registry.register(autoReviewActivityDefinition);
    };
    ctx.inject(['conversationEvents'], scope => { register(scope.conversationEvents); });
    ctx.inject(['uiConversation'], scope => { register(scope.uiConversation.events); });
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
        name: 'conversation.chat.node',
        key: 'auto-review',
    }, AutoReviewActivity));
    ctx.effect(() => {
        if (typeof document === 'undefined')
            return () => undefined;
        const style = document.createElement('style');
        style.setAttribute('data-plugin', 'dsh-plugin-auto-review');
        style.textContent = `
      .dsh-plugin-auto-review-activity {
        color: var(--dsw-alias-label-tertiary);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 0;
        font-size: 13px;
        line-height: 20px;
      }
      .dsh-plugin-auto-review-activity-dot {
        width: 7px;
        height: 7px;
        flex: none;
        border-radius: 999px;
        background: var(--dsw-alias-state-business-primary);
      }
      .dsh-plugin-auto-review-activity[data-outcome="allowed-once"] .dsh-plugin-auto-review-activity-dot { background: #28a745; }
      .dsh-plugin-auto-review-activity[data-outcome="rejected"] .dsh-plugin-auto-review-activity-dot { background: #dc3545; }
      .dsh-plugin-auto-review-activity[data-outcome="unavailable"] .dsh-plugin-auto-review-activity-dot,
      .dsh-plugin-auto-review-activity[data-outcome="cancelled"] .dsh-plugin-auto-review-activity-dot { background: #d99a00; }
    `;
        document.head.appendChild(style);
        return () => style.remove();
    }, 'dsh-plugin-auto-review: Chat activity style');
}
