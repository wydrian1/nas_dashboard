# NULLPONT: ten-minute player review

`nullpont-player-reviewer` is a blind, player-perspective subagent, separate from
the pre-release `nullpont-story-steward`. It reviews **story, puzzles, UI and
difficulty**, each scored 1–10 for quality; difficulty also has a separate
too easy / balanced / too hard / mixed assessment. Unknown categories get `null`,
not invented scores. All judgments are limited to the route actually played.

## After every release

After each successful NULLPONT deployment, the deploying developer must launch
this advisory review once against the exact installed release manifest. Record
the result or explicit unavailability alongside that deployment. Do not wait for
the review to declare deployment success or send its ordinary completion push.
Low scores, timeout and infrastructure failure **do not block or roll back** a
release. They become follow-up development suggestions, not automatic edits.

1. From the repository root, launch (as a background shell command):
   `D:/!nas/.runtime/node-v24.21.0-win-x64/node.exe scripts/Nullpont-Player-Review.mjs start`.
2. Delegate a **fresh** session to `nullpont-player-reviewer`, providing only the
   release manifest hash, this profile's identity and that the fixture is starting.
   Do not pass chapter source, prior detailed reviews, routes, codes or answers.
   If not discovered yet, use a fresh `general` subagent executing the exact
   `.opencode/agents/nullpont-player-reviewer.md` profile.
3. The reviewer calls the fixed `observe`, `act`, `finish` runner operations.
   `act` reads the permitted `.runtime/nullpont-player-review/action.json` file.
   Actions target only a currently visible UI control: `{kind:"click"|"hover",
   control:0}` or `{kind:"fill",control:0,value:"..."}`. No evaluate, network,
   state injection, source reading, solution scripts or production gameplay.
4. The watchdog closes gameplay at **600 seconds** after fixture readiness,
   including model reasoning and tool latency. It independently records timeout
    even if the agent never responds. The reviewer profile allows **50,000 model
    steps** as a fallback ceiling, not as the clock or a promise of full coverage.
    The deadline cannot be reset/extended by the reviewer. Reporting on
   already observed material is allowed after timeout; further play is not.
5. The reviewer writes `review.json` per its profile and calls `finish`. The runner
   keeps detailed findings in an ignored UUID-named `*-developer.json`; only the
   generated `public.json` goes into user-facing messages. Do not copy private
   text, plot details, codes or puzzle solutions into Git, PRs or pushes.

## Isolation and evidence

The runner verifies the installed `D:/!nullpont/release-manifest.json` and all
listed file hashes before copying its build into a fresh temporary fixture.
It never reads `.env.local`, real player databases or service configuration.
The synthetic account and database are created only in that fixture; fresh
session secrets exist only in memory. Browser requests are limited to the fixture
origin. Nothing restarts, reconfigures or plays the production service.

Reports identify the actual manifest SHA-256 and observed coverage. NULLPONT has
no real ending yet: the reviewer must not look for credits, a final scene or an
explicit ending marker. Stop early when further progress is not possible after
reasonable investigation of visible objects, exits, inventory and return paths.
Distinguish a likely current-content boundary (`completed` + `content_exhausted`)
from an unsolved puzzle (`incomplete` + `stuck`), technical blockage (`blocked` +
`technical_block`) and uncertainty (`incomplete` + `uncertain`). An unsolved gate
is not itself proof that content ran out. Record the stopping evidence privately.
Public reports always declare `storyFinished: false`; a deadline overrides the
stopping reason to `time_limit`. Partial play is honestly incomplete.
If no review arrives, the timeout report keeps all unassessed ratings `null`.

Private developer findings use visible scene/object labels, observed vs expected
behavior and concrete improvement suggestions, so a developer can locate issues
without exposing the overarching plot. The reviewer has no storyboard access.
For extensive coverage beyond ten minutes, request a separate explicitly scoped
session; never silently turn this review into a walkthrough or extend its budget.

`smoke` is an operator-only fixture startup check: it does not call a model or
produce fictional ratings. Policy unit tests use injected time rather than
waiting ten minutes; the real watchdog uses a monotonic elapsed-time check as
well as a timer. This facility is deliberately absent from packaging/CI gates.
