# NULLPONT story steward

Agent: **`nullpont-story-steward`**, definition:
`.opencode/agents/nullpont-story-steward.md` (OpenCode V2 Markdown subagent).
No pinned model: it inherits the invoking session's configured model.

The agent independently assesses canon, chronology, relevance, character agency,
interest/pacing, fair reveal timing, playable narrative, storybook accuracy and
append-only extension. It maintains a high-level private narrative architecture
without imposing a final game ending. Published facts take priority over plans.

## Privacy and persistence

Private workspace: `D:/!nas/.runtime/nullpont-story/`. `storyboard.md` holds the
unpublished architecture; `canon-ledger.md` separates published facts, unresolved
interpretations and private plans, with chapter/rule/milestone provenance.
Detailed reviews remain there too. No private file is committed, shipped, served
or quoted to the user. Restore this workspace separately on a new development
machine; without it the steward must return BLOCKED. CI does not need to read it.

## Every-module acceptance workflow

1. Author the proposed chapter and register it in the catalog; retain stable IDs.
2. Invoke the story-steward subagent with the module/diff. It reads all existing
   chapters, save/storybook contracts, and its private storyboard.
3. REJECTED/BLOCKED stops publication. Revise and obtain a fresh independent review.
4. An actual approval updates the spoiler-free `apps/nullpont/story/reviews.json`.
5. `npm run check:story` must pass. Tests and release packaging execute the same gate;
   adding, changing or removing chapter files or reviewed shared context invalidates
   approval until the steward re-reviews and updates the receipt.
6. GitHub review/tests and deployment authorization remain separate requirements.

## Receipt schema (strict; no free-form plot text)

`{ "version": 1, "reviews": [ ... ] }`. One receipt per discovered chapter file:

- `module`: `lib/game/chapters/<name>.ts` (nested modules also covered).
- `sha256`: chapter bytes, 64 lowercase hex characters.
- `contextSha256`: canonical digest of catalog/types/engine/view file hash pairs.
- `storyboardSha256`: opaque fingerprint of the steward's private storyboard.
- `reviewer`: exactly `nullpont-story-steward`; `status`: exactly `approved`.
- `reviewedAt`: ISO-8601 UTC timestamp.
- `checks`: all required rubric categories, exactly once (see checker).

`node scripts/Check-Story.mjs --inputs` prints only public-source hash metadata for
the steward. The checker rejects missing/stale/duplicate/extra/non-approved records,
unknown fields, unsupported schema, unsafe paths and linked inputs.
The public `story/` directory may contain only `reviews.json`; any extra file blocks
release. Packaging copies that one allowlisted receipt, not the directory, and
rejects named private-memory artifacts in any packaged source tree.

This is an editorial workflow gate, not cryptographic proof of model identity or
an automatic literary-quality evaluator. A developer could forge an approval by
editing JSON; independent agent review, private evidence and GitHub review remain
the trust boundary. CI rechecks exact-byte coverage without exposing the storyboard.
