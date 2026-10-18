# NAS dashboard — working agreement

## Required GitHub workflow

The owner requires every project modification to be represented in GitHub after successful tests. Repository: `https://github.com/wydrian1/nas_dashboard` (private); integration branch: `main`.

1. Inspect the working tree and any existing user changes before starting. Never reset, discard or overwrite unrelated changes.
2. Fetch `origin` and create a separate, descriptive task branch from the current `origin/main` before editing. Use names such as `feat/<topic>`, `fix/<topic>` or `chore/<topic>`. Do not work directly on `main`. If continuing the same task, reuse its existing branch and PR.
3. Make only the requested changes, following the project's existing structure and conventions.
4. Run the relevant tests **after the final edit**. At minimum, run the full `npm test` suite and `npm run typecheck`. Application changes also require a successful production build, using `DASHBOARD_BUILD_DIR=.next-staging` so the live `.next` build is not overwritten. Run additional focused, HTTP or Android checks when the modified feature requires them.
5. If any required test or check fails, fix the issue and rerun it before committing/pushing the changes. Do not claim success or publish a ready PR while the required checks are failing. If a check is blocked by the environment or unavailable credentials, report the blocker; do not silently skip it.
6. Review the diff and the exact staged files for secrets, private data and unrelated modifications. Commit only the intended source changes after the tests pass, then push the task branch to `origin`.
7. Create or update a pull request with **base `main`** and the task branch as its head. Include a short change summary and the actual test commands/results in the PR description.
8. Verify the remote commit and PR base/head, and provide the PR URL in the final response. The expected handoff is an open PR; merge it only when the user separately authorizes merging. Never push directly to `main`, force-push, delete branches or bypass review without explicit authorization.

## Protect the running server and private files

- The active project is `D:\!nas`; do not run/edit the old rollback copy on C:.
- GitHub stores **source**, not the production database or server backups. Preserve `.gitignore` protections for `.env.local`, `data/`, `.runtime/`, logs, signing keys, Firebase configuration, OAuth client JSON, rclone tokens/configuration, SQLite files and encrypted archives. Never print credentials or add them to commits/PRs.
- OpenCode's GitHub skill is installed **globally** under `~/.config/opencode/skills/github`; do not add it to this project/repository.
- Do not restart/deploy production services solely to make a source commit or PR. Deployment is a separate action within the user's requested task and must retain the existing data-preservation and rollback checks.
- Git and GitHub CLI are project-local: `.runtime/git/cmd/git.exe` and `.runtime/github-cli/bin/gh.exe`. Node 24 is under `.runtime/node-v24*-win-x64`. Use their explicit paths or a process-local PATH; do not change the system PATH unnecessarily.
- For `gh` issue/PR text, prefer `--body-file` in a private, ignored working directory or the approved OpenCode temporary directory. Authentication is through the existing GitHub CLI login; never embed a token in a remote URL or source/configuration file.

## NULLPONT source, release and player review live elsewhere

NULLPONT's source, tests, art/story gate, release packaging and advisory
post-release player review are in its own private repository,
`https://github.com/wydrian1/nullpont` (see its `AGENTS.md`). This dashboard keeps
only the NULLPONT integration: the `NULLPONT_URL` link, the one-time PKCE login
handoff (`app/api/nullpont/*`), the external redirect and the owner release
announcement (`scripts/Announce-Nullpont-Deployment.mjs`,
[docs/nullpont-deployment-push.md](docs/nullpont-deployment-push.md)).

Run the advisory player review from the `nullpont` repository after a successful
release. It stays advisory: timeout, low scores or unavailability are recorded
honestly and never delay the deployment announcement or roll back a healthy
release, and its suggestions are not implemented without task scope.
