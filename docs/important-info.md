# Fontos infók (web 1.2.1)

`/important-info` is a private, dynamic page for admins and the new **`info-reader`** role. Add/change that role under **Konfig → Felhasználók**. Existing admins and Pokémon readers retain their permissions; the owner remains an immutable admin.

- Admins edit one shared large WYSIWYG document (paragraph/headings, bold/italic/underline, lists, quotes, HTTPS links, undo/redo). **Saving is explicit.** Stale revisions cannot overwrite another admin's edit. An audit records each successful change.
- Readers receive sanitized text, the latest saved financial month/date, net total, asset/debt totals, category subtotals and individual account values. Rows with missing balances and groups without recorded balances are omitted on this page; genuine zero values are shown. Filtering affects only this view, not stored balances or totals. Historical months, finance notes, imports, source-cell paths, finance audit, service information and provider credentials are not projected. No market calls or automatic finance writes occur.
- The latest month is selected by the stored month, not by last edit timestamp or a query parameter. A new monthly save appears on the next page opening/refresh.
- Stored/displayed HTML is reconstructed from a small allowlist. Scripts, handler/style attributes, media/embeds/forms, unsafe protocols and credential-bearing links are removed. Paste is plain text; third-party editor/CDN services are not used.
- `info-reader` can view **only this module**, not Pokémon, the full finance/history page, configuration, notes, news, system/weather APIs or OpenCode. All access/mutations are checked server-side, including direct requests and stale sessions after role changes. App pairing/session/revocation and APK/update access are technical exceptions so the same Android app can display this one page. No module/test/deployment/deadline pushes are enabled for this role.
- Role changes are still audited. Downgrading to `info-reader` clears registered push tokens and cancels pending pushes without revoking its remaining read-only app session. Disabled users/devices lose all access as before.

The SQLite role CHECK is widened in a transaction without losing users, timestamps, notification preferences or child foreign keys; FK enforcement is restored afterwards. New document/audit tables are additive. No live data is seeded or overwritten, no existing account is automatically granted the new role.

Worker packaging needs no new whitelist/deployment-broker privilege: shared schema/role changes stay in its existing `db-schema.ts` / `users.ts` modules. Web-only editor/sanitizer/projection modules are bundled in the staged web release. Android source/signing/version remain unchanged; the current native app already follows the server's role-based home redirect.

Required checks: full Node tests and typecheck, staging production build, isolated production HTTP role/action/RSC checks, browser editor/reader checks, offline migration verification on a SQLite backup. Implementation does **not** authorize a new production activation or another GitHub merge; handoff is an open PR.
