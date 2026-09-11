/** Provider-neutral routing for automatic reviews of native approval requests. */
import { ApprovalRequestId } from '@deepseek-ai/dsh-user-approval';
/** Keep dynamic option reads from waiting indefinitely on a provider probe. */
const REVIEWER_AVAILABILITY_TIMEOUT_MS = 1_000;
async function probeReviewerAvailability(reviewer) {
    if (reviewer.available === undefined)
        return true;
    const controller = new AbortController();
    let timeout;
    const timeoutResult = new Promise(resolve => {
        timeout = setTimeout(() => {
            controller.abort();
            resolve(false);
        }, REVIEWER_AVAILABILITY_TIMEOUT_MS);
    });
    const probe = Promise.resolve()
        .then(() => reviewer.available?.(controller.signal) ?? true)
        .catch(() => false);
    try {
        return await Promise.race([probe, timeoutResult]);
    }
    finally {
        if (timeout !== undefined)
            clearTimeout(timeout);
    }
}
/** Routes one real approval request to the reviewer selected for that session. */
export class ApprovalReviewRouter {
    reviewerFor;
    reviewers = new Map();
    constructor(reviewers, reviewerFor) {
        this.reviewerFor = reviewerFor;
        for (const reviewer of reviewers) {
            if (this.reviewers.has(reviewer.reviewerId)) {
                throw new Error(`duplicate approval reviewer: ${reviewer.reviewerId}`);
            }
            this.reviewers.set(reviewer.reviewerId, reviewer);
        }
    }
    async review(request, onRouted) {
        const reviewerId = await this.reviewerFor(request.agent);
        if (reviewerId === undefined)
            return undefined;
        const reviewer = this.reviewers.get(reviewerId);
        if (reviewer === undefined)
            return undefined;
        onRouted?.(reviewerId, reviewer.reviewerLabel);
        return reviewer.reviewApproval(request);
    }
    /** Whether this agent currently selects one registered machine reviewer. */
    async hasReviewer(agent) {
        const reviewerId = await this.reviewerFor(agent);
        return reviewerId !== undefined && this.reviewers.has(reviewerId);
    }
    /** Whether a reviewer id belongs to this configured router, independent of availability. */
    hasConfiguredReviewer(reviewerId) {
        return reviewerId !== 'none' && this.reviewers.has(reviewerId);
    }
    /** Only currently usable reviewers belong in UI/RPC option lists. */
    async availableOptions() {
        const result = [];
        for (const reviewer of this.reviewers.values()) {
            if (await probeReviewerAvailability(reviewer))
                result.push({ reviewer: reviewer.reviewerId, label: reviewer.reviewerLabel });
        }
        return result;
    }
    /** Backward-compatible internal name for existing standalone composition. */
    options() { return this.availableOptions(); }
}
/**
 * Local safeguard, not a Codex constant. Sixty-four is above a plausible
 * parallel approval burst while bounding orphaned `ask` calls that never reach
 * `approval/request`. An evicted call stays denied while a reviewer is selected.
 */
const MAX_RECENT_CANDIDATES = 64;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Build the single narrowest retry sanctioned by a structured Bash denial. */
function sandboxRetryArguments(exec, result) {
    if (exec.name !== 'bash' || result.isError || !isRecord(exec.arguments) || !isRecord(result.value)) {
        return undefined;
    }
    if (result.value.kind !== 'foreground' || !isRecord(result.value.sandbox))
        return undefined;
    const sandbox = result.value.sandbox;
    if (sandbox.denied !== true)
        return undefined;
    // A requested mode equal to the mode that actually ran is not a completed
    // widening. DSH may tolerate that same-mode request as a no-op, and child
    // models commonly emit it up front. A different requested mode is an
    // inconsistent result, so leave it to the native flow rather than guess.
    const requestedMode = exec.arguments.sandbox_permissions;
    if (requestedMode !== undefined && requestedMode !== sandbox.mode)
        return undefined;
    const target = sandbox.mode === 'read-only'
        ? 'workspace-write'
        : sandbox.mode === 'workspace-write'
            ? 'danger-full-access'
            : undefined;
    if (target === undefined)
        return undefined;
    return {
        ...exec.arguments,
        sandbox_permissions: target,
        justification: `The sandbox denied this exact command under ${sandbox.mode}; retry it once with ${target}.`,
    };
}
/**
 * Bridges the tool lifecycle to the native approval waterfall. Capturing is
 * deliberately model-free: the router is called only by `answerApproval`,
 * after the tool has actually asked the user for permission.
 */
export class AutoReviewGate {
    router;
    candidates = new WeakMap();
    constructor(router) {
        this.router = router;
    }
    async preExecute(exec, next) {
        const downstream = await next();
        // Approval may follow either directly from an `ask` decision or later from
        // inside an allowed tool (bash/fs sandbox escalation). Retain both without
        // invoking a reviewer; only a matching real `approval/request` does that.
        if (downstream.kind !== 'deny' && exec.agent !== undefined)
            this.remember(exec.agent, exec);
        return downstream;
    }
    async answerApproval(request, next) {
        const machineReview = await this.router.hasReviewer(request.agent);
        const failClosed = machineReview || request.agent.session.header?.origin === 'subagent';
        const fallback = (signal) => failClosed
            ? Promise.resolve(signal?.aborted ? 'cancelled' : 'rejected')
            : next();
        if (request.callId === undefined)
            return fallback(request.signal);
        const callId = request.callId;
        const action = this.candidates.get(request.agent)?.get(callId);
        if (action === undefined || action.name !== request.toolName)
            return fallback(request.signal);
        this.consume(request.agent, callId);
        const signal = request.signal ?? action.signal;
        let reviewId;
        let decision;
        try {
            decision = await this.router.review({
                agent: request.agent,
                action: { name: action.name, callId: action.callId, arguments: action.arguments },
                ...request.reason === undefined ? {} : { reason: request.reason },
                signal,
            }, (reviewerId, reviewerLabel) => {
                reviewId = ApprovalRequestId(`auto-review-${String(callId)}`);
                request.agent.session.append('approval/asked', {
                    id: reviewId,
                    toolName: `auto-review/${reviewerId}`,
                    callId,
                    reason: reviewerLabel,
                });
            });
        }
        catch {
            if (reviewId !== undefined) {
                request.agent.session.append('approval/decided', {
                    id: reviewId,
                    outcome: signal.aborted ? 'cancelled' : 'unavailable',
                });
            }
            return fallback(signal);
        }
        if (reviewId !== undefined) {
            request.agent.session.append('approval/decided', {
                id: reviewId,
                outcome: decision?.decision === 'allow'
                    ? 'allowed-once'
                    : decision?.decision === 'deny'
                        ? 'rejected'
                        : 'unavailable',
            });
        }
        if (decision?.decision === 'allow')
            return 'allowed-once';
        if (decision?.decision === 'deny')
            return 'rejected';
        return fallback(signal);
    }
    /** Collapse a denied Bash call and its sanctioned escalation into one model-visible call. */
    async postExecute(exec, result, next, retry) {
        const retryArguments = sandboxRetryArguments(exec, result);
        if (retryArguments === undefined || exec.agent === undefined)
            return next();
        try {
            if (!await this.router.hasReviewer(exec.agent))
                return next();
            // This completed denial will not ask for approval itself; only its nested
            // escalation can do so, and that call receives its own correlation id.
            this.consume(exec.agent, exec.callId);
            const retried = await retry({
                callId: `${String(exec.callId)}:auto-review-retry`,
                name: exec.name,
                arguments: retryArguments,
                signal: exec.signal,
            });
            if (retried.isError) {
                return {
                    kind: 'block',
                    feedback: retried.content,
                    ...retried.additionalContexts === undefined ? {} : { additionalContexts: retried.additionalContexts },
                };
            }
            return {
                kind: 'accept',
                value: retried.value,
                ...retried.additionalContexts === undefined ? {} : { additionalContexts: retried.additionalContexts },
            };
        }
        catch {
            // A retry plumbing failure must not hide the original structured denial.
            return next();
        }
    }
    remember(agent, exec) {
        let recent = this.candidates.get(agent);
        if (recent === undefined) {
            recent = new Map();
            this.candidates.set(agent, recent);
        }
        recent.delete(exec.callId);
        recent.set(exec.callId, exec);
        while (recent.size > MAX_RECENT_CANDIDATES) {
            const oldest = recent.keys().next().value;
            if (oldest === undefined)
                break;
            recent.delete(oldest);
        }
    }
    consume(agent, callId) {
        const recent = this.candidates.get(agent);
        recent?.delete(callId);
        if (recent?.size === 0)
            this.candidates.delete(agent);
    }
}
/** Mount capture and approval wrappers around one shared reviewer router. */
export function installAutoReview(context, router) {
    const gate = new AutoReviewGate(router);
    context.on('tools/pre-execute', (exec, next) => gate.preExecute(exec, next), { prepend: true });
    context.on('tools/post-execute', (exec, result, next) => gate.postExecute(exec, result, next, retry => context.tools.execute({
        ...retry,
        rootCallId: exec.rootCallId,
        parent: exec.token,
        ...exec.agent === undefined ? {} : { agent: exec.agent },
    })), { prepend: true });
    context.on('approval/request', (request, next) => gate.answerApproval(request, next), { prepend: true });
}
/** Install the same hooks only after the optional Tools service is available. */
export function installAutoReviewWhenToolsAvailable(context, router) {
    context.inject(['tools'], toolsContext => installAutoReview(toolsContext, router));
}
