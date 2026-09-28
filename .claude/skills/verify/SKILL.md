---
name: verify
description: Launch and drive the Zalo mini app marketplace (Chợ Zalo, React + zmp-ui) as a user does, in real Chrome at 375x812 through Playwright, and capture proof. Use to confirm a frontend change works in the running app, to reproduce a UI bug, or before saying a feature is done. The feature map in features/ lists every user path to cover.
---

# Verify the marketplace

The app is a mobile web UI. Outside Zalo it signs in with `VITE_DEV_ZALO_TOKEN` from `.env.local`, which must equal the backend's `AUTH_DEV_ZALO_TOKEN`. Never print either file. All commands below run from the repo root, and `scripts/verify` is `.claude/skills/verify/scripts/verify`.

## Isolate

The local stack is shared with other sessions.

- Postgres (`nest-postgres`, 5432) and Floci S3 (`marketplace-floci`, 4566) are shared Docker containers. Never restart them.
- Vite and the API run on any port. Start your own on free ports. The defaults are 3123 and 3013. Ports 3100 and 3002 usually belong to the user or another session.
- The media worker cannot be isolated. There is one pg-boss queue in the one local database, so a second worker competes for jobs. Never start a worker while one runs, and never stop one you did not start. `launch --with-worker` refuses when any worker runs.
- Drive only an instance this run started. `doctor` says `DO NOT DRIVE` when the Vite port belongs to another process.
- A borrowed API (`--api-url`) is read-only. The drive fixture blocks every non-GET call to it and to storage, except sign-in, and fails the drive if the app tried one.

## Launch

```bash
.claude/skills/verify/scripts/verify launch --vite-port 3123 --api-port 3013
export VERIFY_DIR=...   # the line launch prints
```

- `--api-port` starts the API from `../backend/dist` with `PORT` and `S3_PUBLIC_ENDPOINT=http://localhost:4566`. Set `BACKEND_DIR` for another checkout. Build it first with `npm run build` there when `doctor` warns that `dist` is stale.
- `--api-url http://localhost:3002/api/v1` borrows a running API instead, read-only.
- Vite starts from this checkout with `VITE_API_BASE_URL` set to that API and `VITE_FEED_AUTOPLAY=true`.
- Launch refuses a taken port and names its owner. It is ready when it prints `ready:` and the `export` line.
- Without a running worker, uploads never leave processing. Create-listing and edit drives that post need a worker. Say whose worker ran in your report.

## Doctor

```bash
.claude/skills/verify/scripts/verify doctor
```

Read-only. It reports the Vite and API owners and checkouts, the Vite env flags, the API's S3 endpoint, a CORS check, whether the dev token matches (values never printed), Postgres, Floci, each worker with its checkout, and whether the backend build is older than its last commit. The last line is `verdict DRIVE`, `verdict DRIVE read-only (borrowed API)` or `verdict DO NOT DRIVE` with the problems listed. Run it first whenever anything looks off.

## Drive

```bash
.claude/skills/verify/scripts/verify drive home-feed
```

`drive <name>` runs the doctor, then `drives/<name>.spec.ts` with Playwright in the installed Chrome (`channel: 'chrome'`, Pixel 7 touch profile, 375x812). Extra arguments go to Playwright, for example `--headed`.

To prove a feature that has no drive yet, add `drives/<feature>.spec.ts`.

- Import `test`, `expect` and `settled` from `./support`, and the stable handles (`tab`, `openSellPage`, `sellForm`, `fillFields`, `addPhotos`, `photoTiles`, `postButton`, `expectReadyToPost`, `answerPost`, `fixture`) from `../../../../e2e/support`.
- Take the recipe from the matching file in [features/](features/README.md). Use ARIA roles and the Vietnamese names as rendered.
- Call `await proof('step-name')` after each user action whose result you assert.
- Commit a drive only when it is a lasting recipe.

For a look by hand, open the app URL in the Browser pane at 375x812 and leave the tab open afterwards: the user tests in it.

## Evidence

Each drive writes to `$VERIFY_DIR/evidence/<name>-<HHMMSS>/`:

- `NN-<step>.png` and `NN-<step>.aria.yml`: the screen and its ARIA snapshot after each action.
- `api-calls.txt`: every API call with its status. This is the side effect a UI proof must show, such as `GET /products?hasVideo=true` for a filter or `POST /products -> 201` for a post.
- `doctor.txt`, `run.log`, `report.json`, and `playwright/` with the trace.

Proof standards:

- Drive the real user path. Mock an API answer only to reach a state the local stack cannot produce, such as a 409 or 422 answer to Post, and name the mock in the report.
- Capture the action and the resulting state, not only the final screen.
- Confirm a mutation from a second view. After a post or edit, reopen the listing, or read it back with `GET /products/:id` or `GET /me/products`.
- A screenshot taken mid-slide shows two pages. Call `settled(locator)` on the new page's heading before `proof`.

## Cleanup

```bash
.claude/skills/verify/scripts/verify cleanup
```

Stops only the processes this run recorded, after checking that each PID still runs the recorded command, and removes `$VERIFY_DIR/run`. `$VERIFY_DIR/evidence` and `$VERIFY_DIR/logs` stay. Run cleanup after every failed attempt too. Listings that a drive posted stay in the database. Title them `E2E verify <what> <timestamp>` and list them in your report. `npm run clean:test-data` in the backend lists what it would delete. With `--apply` it deletes every listing and media item that is not seed data, including the user's hand tests and other sessions' work, so run `--apply` only when the user asks.

## Keep the map honest

The map in [features/](features/README.md) is the verification source. A proof that drives one entry point is incomplete when the map lists others. Run `/maintain-verification-skill` to re-check the map against the app.
