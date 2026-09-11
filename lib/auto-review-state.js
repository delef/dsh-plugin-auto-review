import { inheritedSessionSetting } from './session-settings.js';
const DELEGATION_CONTEXT = 'subagent:delegation';
const MACHINE_DELEGATION_CONTEXT = 'Automatic approval review is enabled for this delegated subagent. Operations that require '
    + 'approval may request it through the configured reviewer; no human prompt is available, and a denied or '
    + 'unavailable review remains denied.';
/**
 * In-memory per-session overrides and durable global default composition.
 * Dynamic route availability is intentionally consulted only for offered
 * options and new writes; configured selections remain visible and fail closed.
 */
export class AutoReviewStateStore {
    router;
    defaults;
    parentOf;
    sessionReviewers = new Map();
    constructor(router, defaults, parentOf) {
        this.router = router;
        this.defaults = defaults;
        this.parentOf = parentOf;
    }
    /** Resolve the effective configured selection without probing route availability. */
    selectedReviewer(sessionId) {
        return inheritedSessionSetting(this.sessionReviewers, sessionId, this.parentOf)
            ?? this.defaults.currentValue();
    }
    /** Resolve the selected route for the approval gate (`none` means no reviewer). */
    async reviewerFor(sessionId) {
        const selected = await this.selectedReviewerAsync(sessionId);
        return selected === 'none' ? undefined : selected;
    }
    async autoReview(sessionId) {
        const reviewers = await this.router.availableOptions();
        return { reviewer: await this.selectedReviewerAsync(sessionId), reviewers };
    }
    async setAutoReview(sessionId, reviewer) {
        const options = await this.router.availableOptions();
        if (reviewer !== 'none' && !options.some(option => option.reviewer === reviewer))
            return false;
        // Remove first so setting the effective inherited/default value does not
        // create a redundant override. A deliberate `none` still overrides a
        // machine-enabled parent/default and is therefore retained.
        this.sessionReviewers.delete(sessionId);
        if (reviewer !== this.selectedReviewer(sessionId))
            this.sessionReviewers.set(sessionId, reviewer);
        return true;
    }
    async autoReviewDefault() {
        const reviewers = await this.router.availableOptions();
        return { reviewer: await this.defaults.get(), reviewers };
    }
    async setAutoReviewDefault(reviewer) {
        const reviewers = await this.router.availableOptions();
        if (reviewer !== 'none' && !reviewers.some(option => option.reviewer === reviewer))
            return undefined;
        await this.defaults.set(reviewer);
        return { reviewer: await this.defaults.get(), reviewers };
    }
    /** Whether a selection identifies a configured machine reviewer, regardless of availability. */
    hasConfiguredReviewer(reviewer) {
        return this.router.hasConfiguredReviewer(reviewer);
    }
    /**
     * Snapshot the parent's effective selection before a delegated session is
     * published. This callback is synchronous by design: the child policy must
     * be committed before its first prompt can assemble.
     */
    onSessionCreated(session) {
        if (session.header?.origin !== 'subagent' || session.header.parentSession === undefined)
            return;
        const reviewer = this.selectedReviewer(String(session.header.parentSession));
        this.sessionReviewers.set(String(session.id), reviewer);
        const policy = this.hasConfiguredReviewer(reviewer) ? 'ask' : 'never';
        if (this.lastPolicy(session) !== policy)
            session.append('approval/policy', { policy, source: 'delegation' });
    }
    /** Replace only the delegated denial statement when this child has a machine reviewer selected. */
    onSystemPromptAssemble(assembly, context) {
        const agent = context.agent;
        if (agent === undefined)
            return assembly;
        const session = agent.session;
        if (session?.header?.origin !== 'subagent')
            return assembly;
        const reviewer = this.sessionReviewers.get(String(agent.id));
        if (reviewer === undefined || !this.hasConfiguredReviewer(reviewer))
            return assembly;
        const delegation = assembly.contexts.find(entry => entry.name === DELEGATION_CONTEXT);
        if (delegation !== undefined)
            delegation.text = MACHINE_DELEGATION_CONTEXT;
        return assembly;
    }
    /** Expose a read-only snapshot for focused tests and diagnostics. */
    sessionOverride(sessionId) {
        return this.sessionReviewers.get(sessionId);
    }
    async selectedReviewerAsync(sessionId) {
        // `get()` is intentionally retained for a single source of truth while
        // the synchronous path is used at session publication and router reads.
        return inheritedSessionSetting(this.sessionReviewers, sessionId, this.parentOf)
            ?? await this.defaults.get();
    }
    lastPolicy(session) {
        for (let index = session.events.length - 1; index >= 0; index -= 1) {
            const event = session.events[index];
            if (event?.type !== 'approval/policy')
                continue;
            const policy = event.data?.policy;
            if (policy === 'ask' || policy === 'never')
                return policy;
        }
        return undefined;
    }
}
