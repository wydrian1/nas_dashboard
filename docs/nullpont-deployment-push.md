# NULLPONT completed-deployment announcement

Operator-only source CLI: `scripts/Announce-Nullpont-Deployment.mjs`. It writes the existing
`release_announcements` and `mobile_push_outbox` tables; it neither sends FCM nor deploys,
starts services, migrates schemas, loads `.env.local`, or accesses the game's database.
Run only after the owner-approved NULLPONT deployment and its real checks have succeeded.
Never manufacture a dashboard broker signature/receipt for an independent game release.

## Required private evidence

The deployment owner creates a UTF-8 JSON file in the parent-created protected directory
`D:\!nas\.runtime\worktrees\dashboard-cleanup-layout\.runtime\nullpont-archive-deploy`,
from actual verification results. Schema (hashes/build/time below are placeholders):

```json
{
  "schemaVersion": 1,
  "application": "nullpont",
  "state": "succeeded",
  "phase": "complete",
  "errorCode": 0,
  "commit": "<exact approved 40-character lowercase Git commit>",
  "manifestSha256": "<SHA-256 of approved installed release-manifest.json bytes>",
  "releaseDirectory": "D:\\!nullpont",
  "url": "https://wydrian.hu/nullpont",
  "buildId": "<installed .next/BUILD_ID, trimmed>",
  "completedAt": 1800000000000,
  "checks": {
    "approved": true,
    "storyApproved": true,
    "sourceCommitVerified": true,
    "packageVerified": true,
    "backupVerified": true,
    "serviceTargetVerified": true,
    "localHealth": true,
    "publicHealth": true,
    "dataPreserved": true,
    "rollbackNotNeeded": true
  }
}
```

`completedAt` is the real completion time in Unix milliseconds, at most 15 minutes old.
Source verification means the package was built from the exact approved commit of the
NULLPONT repository (`https://github.com/wydrian1/nullpont`) with no uncommitted source
edits; story approval must be the successful independent steward gate.
Service verification means `WydrianNullpont` actually runs the installed `D:\!nullpont`
directory/build; local and public HTTPS checks must verify that deployment, not merely
that an old process answers. Check authenticated functionality as appropriate without
putting cookies, account identifiers, tokens or credentials in evidence. Backups/data
preservation and no rollback must be verified, not inferred from a successful build.

This is an **unsigned trusted local operator attestation**, not cryptographic proof of
remote health, Git ancestry, editorial review or service identity. The independent
commit/manifest pins and evidence hash prevent accidentally announcing a different job;
they do not defend against an operator who can forge local evidence. Keep evidence in
the existing private ACL-protected runtime area and never accept it from a web request.
The previous `.runtime/nullpont-quiet-deploy/result.json` is absent here and is not an
accepted substitute unless regenerated from fresh actual checks in the schema above.

## Safe activation (parent only)

Run the tested/published source CLI by absolute path using explicit Node 24; no dashboard
deployment, environment-file loading or game credential changes are necessary:

```powershell
& 'D:\!nas\.runtime\node-v24.21.0-win-x64\node.exe' --experimental-strip-types `
  'D:\!nas\.runtime\worktrees\dashboard-cleanup-layout\scripts\Announce-Nullpont-Deployment.mjs' `
  --evidence 'D:\!nas\.runtime\worktrees\dashboard-cleanup-layout\.runtime\nullpont-archive-deploy\notification-result.json' `
  --evidence-sha256 '<SHA-256 of exact approved evidence bytes>' `
  --commit '<approved commit>' `
  --manifest-sha256 '<approved manifest SHA-256>' `
  --release 'D:\!nullpont'
```

The CLI rehashes every manifest-listed installed artifact, verifies the package version,
build ID, required runtime artifacts and release test flags. Evidence must remain under
the protected NAS runtime; the installed release is allowed only at exact `D:\!nullpont`
(`D:/!nullpont` is also accepted as a CLI separator spelling and canonicalized to
`D:\!nullpont`). Runtime/sibling/child roots, traversal and aliases are rejected.
Installed artifacts and ancestors must remain unlinked; canonical directory identity is
checked. The existing live dashboard database must already exist. No schema creation,
credential sharing or access to the independent game's private environment/database.
Compute pins from the owner's verified approval/package, not by trusting unverified JSON.
Output contains only application name and queued count. A failure requires private
inspection; never generate a new identity or requeue an uncertain send.

Only explicitly active `dashboard_users` admins with currently paired, unrevoked,
unexpired, push-enabled/token-bearing devices are selected (including an explicit
active-user check for the owner). Existing sender authorization rechecks role and device
opt-in immediately before send. Regular account deactivation revokes devices/cancels jobs.
The sender's existing owner-role override remains unchanged: do not bypass normal account
management by directly deactivating the owner's database row after enqueueing.

Event identity is deterministic over the approved commit and package manifest. The same
package cannot notify twice, even after a sent/expired/uncertain row is cleaned up; the
release marker persists. No eligible admin device fails atomically without consuming the
identity. Different package bytes are a different release, not a retry mechanism.

## Existing worker / Android compatibility

The current `WydrianPokemon.xml` points at deployment release
`76245b50b367899d5e32c2adc49d1a5f`; its existing `push.ts` accepts `kind: release`,
checks admin at dispatch, and treats ambiguous network sends/crashed leases as uncertain
with no automatic resend. Its reminder loop already consumes the shared live outbox.
No dashboard/worker redeploy is needed for this payload. Reconfirm that configured worker
version if deployment configuration changes; older `.runtime/pokemon` releases inspected
do **not** all enforce release-admin authorization and must not be substituted.
FCM enablement/credentials and actual worker health must be checked privately by the parent;
this implementation did not authenticate, enqueue live messages, or send notifications.

Fixed title/body mention only successful NULLPONT deployment and the exact allowed URL
`https://wydrian.hu/nullpont`. No caller-supplied text or URLs are sent. Existing Android
notification routing does not accept that external URL: the tap opens dashboard home (`/`)
and the exact game URL appears in the body. Direct-to-game tap would need a separately
reviewed Android change; this integration does not widen notification URL policy.

## Advisory post-release player review

After every successful release, the deploying agent also starts the isolated
`nullpont-player-reviewer` procedure from the NULLPONT repository
(`https://github.com/wydrian1/nullpont`: `docs/nullpont-player-review.md`,
`scripts/Nullpont-Player-Review.mjs`), bound to the installed manifest hash. The
budget and the reporting rules are defined by that repository's `AGENTS.md`.
This is not a release or notification prerequisite: send the normal completed
deployment announcement without waiting for its scores. Record partial play,
timeout or unavailability honestly; never roll back a healthy release because
of the advisory review. Only its generated spoiler-free summary is public.
