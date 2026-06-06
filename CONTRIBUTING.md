# Contributing to DreamerZ

This document covers **how code flows from your laptop to production**.
For first-time local setup (installing deps, env vars, running the dev
servers), see [`README.md`](./README.md).

---

## 1. Branch model

We use a two-branch flow:

| Branch    | Role                                                | Pushable directly?              | Auto-deploys to |
| --------- | --------------------------------------------------- | ------------------------------- | --------------- |
| `develop` | Day-to-day work happens here. Default branch.       | ✅ Yes — push from local        | **Test** env    |
| `main`    | Production marker. Only reached via reviewed PR.    | ❌ No — protected, PR-only      | **Prod** env    |

The rule is simple: **`main` always reflects what's live in prod.**
`develop` is one or more commits ahead of `main`, holding the next
release.

---

## 2. Environments

| Env       | Frontend URL                                    | Backend URL                                       | Database              |
| --------- | ----------------------------------------------- | ------------------------------------------------- | --------------------- |
| **Local** | http://localhost:3000                           | http://localhost:8001                             | `backend/dreamerz.db` (SQLite) |
| **Test**  | https://dreamerz-frontend-test.onrender.com<br>(or `test.dreamer-z.com` once DNS is set) | https://dreamerz-backend-test.onrender.com | `dreamerz-db-test` (Render Postgres) |
| **Prod**  | https://dreamer-z.com                           | https://dreamerz-backend.onrender.com             | `dreamerz-db` (Render Postgres) |

Both Render environments are provisioned from the same `render.yaml`
blueprint — the only differences are the bound branch (`develop` vs
`main`) and the environment-specific values for `DATABASE_URL`,
`JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`, and `SENDER_NAME`.

---

## 3. Quick start — pushing a change

```bash
# 1. Make sure your local develop is current.
git checkout develop
git pull origin develop

# 2. Code, run locally, verify.
#    (See README for `start_dev.bat` and local servers.)

# 3. Commit. See §6 for message style.
git add -A
git commit -m "Short summary of the change"

# 4. Push to develop. This triggers a test-env deploy on Render.
git push origin develop
```

Within ~3 minutes the test backend + frontend rebuild. Verify on the
**Test** URLs above.

---

## 4. Releasing — promoting develop → main

When the change is verified on Test and you're ready to ship to prod:

```bash
# Option A — via GitHub UI:
# Open a PR  develop -> main, review the diff one last time, merge.

# Option B — via gh CLI:
gh pr create --base main --head develop \
   --title "Release $(Get-Date -Format yyyy-MM-dd)" \
   --body "What's shipping this release: ..."
gh pr merge --merge   # OR --squash if you prefer a single commit
```

Once merged, Render auto-deploys prod within ~3 minutes. After the
deploy is green:

```bash
git checkout main
git pull origin main
git tag -a "release/$(Get-Date -Format yyyy-MM-dd)" -m "Production release"
git push origin --tags
```

Tags give you a clean rollback target if anything goes wrong.

---

## 5. Hot-fix flow (urgent prod-only fix)

When something's burning in prod and you can't wait for the normal
develop cycle:

```bash
# 1. Branch from main (not develop — develop may contain WIP).
git checkout main
git pull origin main
git checkout -b hotfix/short-description

# 2. Fix, commit, push.
git add -A
git commit -m "Hotfix: brief description"
git push origin hotfix/short-description

# 3. Open PR  hotfix -> main. Self-review. Merge.
#    Render redeploys prod.

# 4. Back-merge the fix into develop so it doesn't regress next release.
git checkout develop
git pull origin develop
git merge main
git push origin develop
```

Don't skip the back-merge — every time it gets forgotten, the next
`develop → main` PR re-introduces the original bug.

---

## 6. Feature branches (optional, for larger work)

For changes that need review *before* even hitting test (e.g., schema
changes, security-sensitive code, big refactors):

```bash
git checkout develop
git pull origin develop
git checkout -b feat/short-description
# code, commit
git push origin feat/short-description
# Open PR  feat/short-description -> develop
# Get a review, merge to develop. Test env redeploys.
```

For solo small changes, skipping the feature branch and pushing
directly to `develop` is fine.

---

## 7. Commit message style

We use a one-line summary, a blank line, then a few short paragraphs
explaining **why** (not just what — the diff already shows what):

```
Short summary in present tense, ~70 chars max

The first paragraph explains the user-visible behaviour change or the
problem this fix targets. Aim for "if I'm reading the log six months
from now, will this tell me what I need to know?"

The second paragraph (optional) lists the mechanical changes in bullet
form if the diff spans several files:
- file A: what changed and why
- file B: what changed and why

Anything deliberately NOT changed gets called out at the end so the
next reader doesn't second-guess your scope.
```

Real example from the log:

> ```
> Fix roleplay/lab/services losing auth after token-key migration
>
> useAuth migrated localStorage from 'dreamerz_beta_auth_v1' (JSON blob
> with .token) to 'dreamerz_beta_token_v1' (raw JWT string) and deletes
> the legacy key on first sign-in. Several consumers kept reading the
> old key with JSON.parse(...).token, silently lost the token, and sent
> unauthenticated requests …
> ```

**Avoid**: `"fixes"`, `"updates"`, `"WIP"`, `"minor changes"`. They're
not useful when bisecting a regression six months in.

---

## 8. Pull-request expectations

PR description should answer three questions:

1. **What's changing?** One paragraph.
2. **Why?** What was the trigger — a bug, a feature request, a perf
   problem? Link the issue/incident if there is one.
3. **How was it tested?** "Verified on test env" / "Unit tests added" /
   "Manual smoke test of /learn".

If the change affects:

- **Database** — note the migration name and whether it's idempotent.
- **Auth** — note whether existing sessions are affected.
- **Public API** — note any contract changes (URL paths, request/response shapes).
- **Env vars** — list any new vars and which env(s) need them set.

For `develop → main` release PRs, the description is just a list of
what's shipping this release (subject lines of the develop commits is
usually enough).

---

## 9. Things to NEVER do

| Don't                                                       | Why                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Push directly to `main`                                     | It's branch-protected. Even if the protection were off — prod gets a hot deploy with no review. Hot-fix flow exists for emergencies. |
| `git push --force` on `main` or `develop`                  | Rewrites history that other people may have pulled. Force-pushes are reserved for your own short-lived feature branches. |
| Point local backend at the prod DB                          | Risk of accidental writes to prod. Use the `sync_from_remote.py` script (READ-ONLY) to copy content into local SQLite instead. |
| Copy prod's `JWT_SECRET` into test or local                 | Defeats the env isolation. Test JWTs become valid in prod. Each env gets its own secret. |
| Commit files matching `.env`, `*.db`, `*credentials*`       | They're `.gitignore`d. If you have to force-add, ask first. |
| Commit `backend/scripts/sync_from_remote.py`                | `.gitignore`d. Dev-only — has a runtime guard refusing to run on Render even if it ever did get deployed. |
| Hand-edit Render dashboard env vars for blueprint-managed services | `render.yaml` is the source of truth. Dashboard edits get overwritten on the next blueprint sync. Use `sync: false` for values you need to set in the dashboard. |
| Run a content-changing script directly against prod DB      | Always test against the test DB first. If the script truly needs to touch prod, add an explicit `--prod` flag + a confirmation prompt + log the operator's name. |

---

## 10. Where the gotchas live

A few things have bitten us in the past — worth knowing before they
bite you too:

- **Render free tier blocks outbound SMTP on ports 25/465/587.**
  Confirmed against Render's docs. Free-tier prod backend can't send
  email; either upgrade the prod backend to Starter, or migrate to an
  HTTPS-API email provider (Resend, Postmark, SendGrid).
- **CORS errors that look like CORS are usually 500s.** When FastAPI
  raises before the CORS middleware emits headers, the browser reports
  a CORS error rather than the underlying status. Check the **Network**
  tab's response status, not just the Console.
- **Migrations written for Postgres often don't run on SQLite.**
  `ALTER TABLE ... DROP COLUMN IF EXISTS` is Postgres-only. Local dev
  uses `Base.metadata.create_all` to build the schema from current
  models, bypassing migrations entirely. If you need to start fresh
  locally: stop backend, `Remove-Item backend/dreamerz.db`, restart.
- **PWA caches the SPA aggressively.** After a prod deploy users may
  see the old bundle for one navigation. The service-worker
  `controllerchange` auto-reload from commit `439bb4c` mitigates this,
  but if testing across envs in the same browser: open DevTools →
  Application → Service Workers → Unregister.
- **The Google OAuth `client_id`** must include `localhost:3000` AND
  each Render frontend URL in the Authorized JavaScript origins +
  redirect URIs. Otherwise `redirect_uri_mismatch`.

---

## 11. Need help?

- **Render deploy logs** — Render dashboard → service → Logs. Most
  build/runtime failures are obvious there.
- **Render DB connection details** — Render dashboard → dreamerz-db
  (or -test) → Connections. "External Database URL" is the one you'd
  paste anywhere outside Render. "Internal URL" only resolves inside
  Render's network.
- **Local SMTP/auth/etc issues** — see the troubleshooting section of
  `README.md`, or open an issue.
- **Support email** — `dreamerz.support@gmail.com` for user-facing
  issues (the same address shown in the app footer).
