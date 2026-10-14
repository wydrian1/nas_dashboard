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
