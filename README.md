# Auto Review

`dsh-plugin-auto-review` is a provider-backed approval policy for DeepSeek
Harness. Its identity is Auto Review, not subscription login: a configured
review route may be supplied by a subscription adapter or an ordinary API
adapter. Both use the same `ctx.llm.stream()` runtime seam, so this plugin
does not duplicate OAuth, token refresh, provider wire protocols, or retry
transport.

## Configuration

The default configuration registers Codex Guardian and Grok escalation
policies. Each route appears only when its provider exposes the exact model:

```yaml
autoReview: codex
reviewers:
  - policy: codex
    reviewerId: codex
    label: Codex
    provider: codex
    model: codex-auto-review
    reasoningEffort: low
  - policy: grok
    reviewerId: grok
    label: Grok
    provider: grok
    model: grok-4-fast-reasoning
```

`policy` selects the provider-specific review logic; `provider` and `model`
select the generic DSH LLM route used to run it. Existing entries without a
`policy` keep Codex Guardian behavior. An API-backed route has the same shape:

```yaml
reviewers:
  - policy: codex
    reviewerId: api-guardian
    label: Company API Guardian
    provider: openai-api
    model: gpt-5
  - policy: grok
    reviewerId: api-grok-review
    label: Company Grok Review
    provider: xai-api
    model: grok-4-fast-reasoning
```

For example, the legacy Codex-only form remains valid:

```yaml
reviewers:
  - reviewerId: codex
    label: Codex
    provider: codex
    model: codex-auto-review
    reasoningEffort: low
```

`reviewerId` values are unique configuration identities. `none` selects native
manual approval. The global bootstrap is persisted at
`plugins/auto-review/auto-review.json`; a session choice is an in-memory
override and inherits the nearest parent session.

## Safety behavior

Auto Review is an answerer at the existing DSH approval boundary. It invokes a
model only after the exact tool call has reached a real `approval/request`;
ordinary allowed calls remain model-free. It never widens filesystem roots,
network access, sandbox modes, or approval permissions. Correlation is by the
captured tool call id and name, and a captured action is consumed once.

With a machine reviewer selected, unavailable routes, timeouts, aborted or
incomplete streams, malformed results, and explicit denials fail closed as a
rejection. With `none`, the native DSH manual approval answerer is preserved.
Delegated subagents never create an unattended human prompt: an inherited
machine reviewer reopens the approval waterfall, while `none` keeps the
delegation policy at `never`. The delegated prompt states that no human prompt
is available and that unavailable review remains denied.

The reviewer list is dynamic. RPC and UI reads probe the currently registered
provider and exact model on every request, so only usable routes are offered.
A configured or persisted reviewer remains visible in state when its route is
temporarily unavailable and continues to fail closed. No subscriptions login
query or subscriptions-side compatibility API is required.

## Scope and compatibility

Version 1 publishes the common reviewer/router/state/RPC architecture with two
provider-specific implementations: Codex Guardian and Grok escalation review.
Their policy, parsing, transcript, and reviewer logic live independently under
`src/providers/codex/` and `src/providers/grok/`. Adding another provider means
implementing its directory and registering a route, not adding branches to the
shared gate, RPC, or UI.

The package targets the DSH `0.1.2-alpha.3` service contracts and browser
client slots. It is compatible with subscription-backed and API-backed LLM
adapters that register a route on `ctx.llm` and resolve the configured model.

## Security permissions

The plugin needs the existing DSH LLM service to evaluate a selected review,
and optionally the Tools and Connection services to install approval hooks and
the loopback-only `/auto-review` RPC channel. It does not request credentials,
network permissions, filesystem permissions, shell access, or subscription
tokens. Review transcripts exclude injected plugin context from user
authorization anchors and are bounded before being sent to the reviewer.

## Development

From a checkout with the verified `0.1.2-alpha.3` toolchain:

```sh
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/tsc -p tsconfig.test.json
node --test lib-test/test/*.js
./node_modules/.bin/tsdown
./node_modules/.bin/tsdown -c tsdown.prepare.config.ts
```

The Cordis patch mounts the Host half as `auto-review`; the browser half is
discovered from the `dsh.client` declaration in `package.json`.
