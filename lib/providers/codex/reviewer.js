/** Codex Guardian reviewer over a configured generic DSH LLM route. */
import { BlockAssembler, createAssistantMessage, createUserMessage, } from '@deepseek-ai/dsh-llm';
import { CODEX_GUARDIAN_POLICY } from './policy.js';
import { codexReviewPrompt, isNodePrefix, bounded } from './prompt.js';
import { parseCodexApprovalReview } from './parse.js';
const CODEX_REVIEW_TIMEOUT_MS = 90_000;
const CODEX_REVIEW_MAX_ATTEMPTS = 3;
const CODEX_REVIEW_MAX_HISTORY_PAIRS = 8;
const CODEX_REVIEW_MAX_HISTORY_MESSAGES = CODEX_REVIEW_MAX_HISTORY_PAIRS * 2;
const CODEX_REVIEW_ASSISTANT_RESPONSE_BYTES = 4_096;
const CODEX_REVIEW_MAX_OUTPUT_TOKENS = 512;
const CODEX_REVIEW_MAX_CONSECUTIVE_DENIALS = 3;
const CODEX_REVIEW_MAX_RECENT_DENIALS = 10;
const CODEX_REVIEW_DENIAL_WINDOW = 50;
function resetCodexReviewHistoryIfNeeded(state) {
    if (state.messages.length + 2 <= CODEX_REVIEW_MAX_HISTORY_MESSAGES)
        return;
    state.messages.length = 0;
    state.surfaceNodes = [];
}
function approvalTurnId(agent) {
    for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
        const event = agent.session.events[index];
        if (event?.type === 'turn/start')
            return String(event.data.turn);
    }
    return '<unknown-turn>';
}
/** Codex Guardian policy over any configured DSH LLM route. */
export class CodexGuardianReviewer {
    ctx;
    config;
    reviewerId;
    reviewerLabel;
    approvalReviewSessions = new WeakMap();
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.reviewerId = config.reviewerId;
        this.reviewerLabel = config.label;
    }
    /** Route and model capability are checked independently of selected state. */
    async available(signal) {
        try {
            if (!this.ctx.llm.listProviders().some(provider => provider.id === this.config.provider))
                return false;
            if (signal?.aborted)
                return false;
            const modelInfo = this.ctx.llm.resolveModelInfo(this.config.provider, this.config.model, signal);
            if (signal === undefined)
                return Boolean(await modelInfo);
            let onAbort;
            const aborted = new Promise(resolve => {
                onAbort = () => resolve(undefined);
                if (signal.aborted)
                    onAbort();
                else
                    signal.addEventListener('abort', onAbort, { once: true });
            });
            try {
                return Boolean(await Promise.race([modelInfo, aborted]));
            }
            finally {
                if (onAbort !== undefined)
                    signal.removeEventListener('abort', onAbort);
            }
        }
        catch {
            return false;
        }
    }
    /** Serialize one review stream per agent while reusing its transcript state. */
    reviewApproval(request) {
        let state = this.approvalReviewSessions.get(request.agent);
        if (state === undefined) {
            state = {
                messages: [],
                surfaceNodes: [],
                tail: Promise.resolve(),
                consecutiveDenials: 0,
                recentDenials: [],
                interruptionScheduled: false,
            };
            this.approvalReviewSessions.set(request.agent, state);
        }
        const review = state.tail.then(() => this.runApprovalReview(request, state));
        state.tail = review.then(() => undefined, () => undefined);
        return review;
    }
    async runApprovalReview(request, state) {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(CODEX_REVIEW_TIMEOUT_MS)]);
        if (!await this.available(signal))
            return undefined;
        resetCodexReviewHistoryIfNeeded(state);
        const { prompt, nodes } = codexReviewPrompt(request, state);
        const userMessage = createUserMessage({
            source: { kind: 'plugin', plugin: 'dsh-plugin-auto-review' },
            content: [{ type: 'text', text: prompt }],
        });
        for (let attempt = 0; attempt < CODEX_REVIEW_MAX_ATTEMPTS && !signal.aborted; attempt += 1) {
            const assembler = new BlockAssembler();
            try {
                const options = {
                    provider: this.config.provider,
                    model: this.config.model,
                    system: CODEX_GUARDIAN_POLICY,
                    messages: [...state.messages, userMessage],
                    maxTokens: CODEX_REVIEW_MAX_OUTPUT_TOKENS,
                    signal,
                };
                if (this.config.reasoningEffort !== undefined) {
                    ;
                    options.reasoningEffort = this.config.reasoningEffort;
                }
                for await (const chunk of this.ctx.llm.stream(options))
                    assembler.push(chunk);
                if (assembler.finish.kind === 'error' || assembler.finish.kind === 'aborted' || assembler.finish.kind === 'max-tokens')
                    continue;
                const raw = assembler.blocks()
                    .filter(block => block.type === 'text')
                    .map(block => block.type === 'text' ? block.text : '')
                    .join('')
                    .trim();
                const decision = parseCodexApprovalReview(raw);
                if (decision === undefined)
                    continue;
                state.messages.push(userMessage, createAssistantMessage({
                    source: { provider: this.config.provider, model: this.config.model },
                    content: [{ type: 'text', text: bounded(raw, CODEX_REVIEW_ASSISTANT_RESPONSE_BYTES) }],
                }));
                state.surfaceNodes = nodes;
                this.recordApprovalReviewDecision(request, state, decision.decision);
                return decision;
            }
            catch {
                // The LLM runtime already owns transport details; retry terminal stream
                // failures and malformed assembly, then fail closed at the gate.
            }
        }
        return undefined;
    }
    /** Match Guardian's three-consecutive / ten-of-fifty per-turn breaker. */
    recordApprovalReviewDecision(request, state, decision) {
        const turnId = approvalTurnId(request.agent);
        if (state.denialTurnId !== turnId) {
            state.denialTurnId = turnId;
            state.consecutiveDenials = 0;
            state.recentDenials = [];
            state.interruptionScheduled = false;
        }
        const denied = decision === 'deny';
        state.consecutiveDenials = denied ? state.consecutiveDenials + 1 : 0;
        state.recentDenials.push(denied);
        if (state.recentDenials.length > CODEX_REVIEW_DENIAL_WINDOW)
            state.recentDenials.shift();
        const recentDenials = state.recentDenials.filter(Boolean).length;
        if (!denied || state.interruptionScheduled
            || (state.consecutiveDenials < CODEX_REVIEW_MAX_CONSECUTIVE_DENIALS
                && recentDenials < CODEX_REVIEW_MAX_RECENT_DENIALS))
            return;
        state.interruptionScheduled = true;
        const cancel = request.agent.cancel;
        setTimeout(() => {
            try {
                const cause = {
                    kind: 'hook',
                    reason: 'Automatic approval review rejected too many requests in this turn.',
                };
                Reflect.apply(cancel, request.agent, [cause]);
            }
            catch {
                // A disappearing agent must not turn a valid denial into a fallback.
            }
        }, 0);
    }
}
