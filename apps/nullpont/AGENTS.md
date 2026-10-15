# NULLPONT narrative acceptance

Before accepting, committing as ready, or publishing any new/changed story module,
delegate an independent review to **nullpont-story-steward** using the project
definition `.opencode/agents/nullpont-story-steward.md`.

Provide the proposed module/diff and current catalog. The steward reads the full
published canon and its private storyboard; the author may not self-approve.
If the named profile is not yet discovered in this session, a `general` subagent
may execute that exact profile, explicitly identified as the steward review.

REJECTED or BLOCKED stops acceptance. Revise and rerun the review after any changes.
Only the steward writes `story/reviews.json` approvals for the exact reviewed
chapter/catalog/engine/view/type hashes. Run `npm run check:story`, the full tests,
typecheck and staging build after the final edit. Release packaging runs the gate.

The private storyboard/canon ledger are in `D:/!nas/.runtime/nullpont-story/`, NOT
in Git, the application or its release package. Never print/quote future-story
content in the parent conversation, PR, logs, browser payload or player storybook.
The user explicitly requested not to be told the overarching plot.

The gate validates recorded editorial approval; it does not pretend deterministic
code can decide whether fiction is good or attest who edited a JSON receipt.
Changes to this agent, its rubric or the gate require explicit review, not weakening
the gate to make a rejected chapter pass. No production deployment is implied.

## Persistent world-state and illustration rules

These are standing owner requirements for all future NULLPONT content and fixes:

- Every subsequent examination, scene description, repeated interaction and ASCII
  illustration must reflect the current saved world state. A taken object must not
  still be described or drawn as present at its former location, including after
  it has been combined, after returning to a scene/detail, or after save/reload.
- Opened doors, operated controls, latched mechanisms and submitted documents must
  remain consistent in their descriptions and illustrations. Repeat actions must
  not narrate a first-time discovery or change that has already happened.
- Meaningful visible inscriptions, labels and clues in ASCII art must also be
  acknowledged in the relevant examination prose. For example, “NEM VAGY EGYEDÜL”
  cannot exist only in the picture. Preserve the distinction between what a sign
  claims and what the player has actually established; do not explain mysteries
  away, invent certainty, or expose puzzle recipes and future revelations.
- Use server-selected state variants where needed; do not expose conditions,
  unused variants or solutions to the browser. Preserve existing saves and IDs.
  Historical journal/storybook entries describe past events and must not be
  rewritten to match the present scene.
- Cover these requirements with before/after, repeat-inspection, return/navigation,
  crafting and save/reload regression tests as applicable, including agreement
  between rendered art and prose. Include them in independent narrative review;
  passing structural checks alone does not establish narrative consistency.
