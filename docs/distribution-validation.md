# Distribution validation — 0.1.1

Checked on 2026-09-11, macOS arm64, Node.js 26.7.0. These results cover the
packaging change from source baseline `27bf03e`; they are not an independent
security audit or a full DSH runtime compatibility certification.

## Reproducible build and archive

```
npm ci --ignore-scripts --legacy-peer-deps
npm run build
npm test
npm pack --ignore-scripts
```

Clean locked installation and build passed. All 56 tests passed, including
approval denial/unavailability handling, reviewer transport fixtures, composition,
RPC, settings persistence, and host/client package exports. Provider tests use
synthetic transports and make no authenticated model calls.

The manifest declares Node.js >=22.13.0 and the DSH 0.1.2-alpha.3 contract target.
The minimum Node version and other DSH releases have not received full runtime
acceptance in this check. No `dshReleases: compatible` claims are made.

The archive contains MIT `LICENSE`, the matching manifest, Bundle Patch, host
and browser entries, declarations, README, and this document. No install-time
lifecycle hooks are present. `prepublishOnly` remains a publisher-side build/test
gate. Git installs consume committed `lib/`; CI checks it against a clean rebuild.
The development lockfile and explicit transitive type/test peers prevent reliance
on packages accidentally supplied by another workspace.

## Disposable-profile checks

A temporary npm installation of `@deepseek-ai/dsh@0.1.2-alpha.3` was used, with
`DSH_HOME=/tmp/dsh-store-442-profile` and profile `review-check`. Official host
transitive ranges resolved some services to `0.1.2-rc.1`, so this is CLI/package
integration evidence, not an exact alpha.3 host compatibility result. Dependency
lifecycle scripts were disabled; the missing `cordis-plugin-group` boot peer was
installed explicitly in that temporary host.

- **Install passed:** `dsh plugin --profile review-check add
  /tmp/dsh-store-442/dsh-plugin-auto-review-0.1.1.tgz --ignore-scripts
  --config.auto-install-peers=false` installed the archive without running build
  scripts. Peer warnings are expected because the profile consumes host services.
- **Composition passed:** `dsh --profile review-check --dump-config` contained
  exactly one `auto-review` entry referencing `dsh-plugin-auto-review`.
- **Startup failed in the temporary host:** the base profile could not import
  several missing official peers, including `@deepseek-ai/dsh-sandbox`,
  `@deepseek-ai/dsh-settings`, and `@deepseek-ai/dsh-session-query`. The host was
  installed without automatic peer resolution. This is not a successful plugin
  startup; Web rendering and live provider review remain unverified.
- **Uninstall passed:** `dsh plugin --profile review-check remove
  dsh-plugin-auto-review`; the subsequent composed configuration no longer
  contained the plugin.

No real DSH profiles were changed. Telemetry was disabled for the startup attempt.
No store approval, npm publication, or rollback validation is claimed.

## Remaining store policy boundary

GitHub reports MIT and the manifest/license agree. The stale distribution entry
for the removed THIRD_PARTY_LICENSES directory is gone. Node/DSH target metadata,
script-free Git packaging, and permission/service disclosures are now explicit.

Filesystem persistence and approval-policy capabilities are intentional. Policy
prompts also discuss credentials; that text must not be removed to evade a source
scanner. Review inputs can contain sensitive data and are sent through the chosen
LLM adapter. Consequently the store may retain `blocked` or require `user-reviewed`
status. Passing source metadata checks does not imply installation eligibility,
latest-release compatibility, or independent security approval.
