# Chợ Zalo verification map

This directory is the maintained source for verifying what a user of the marketplace sees and does. Read this index, then use the matching feature file as the recipe. The harness, launch and cleanup are in [../SKILL.md](../SKILL.md).

## Baseline preconditions

- `scripts/verify launch` started Vite and, for any drive that writes, the API. `scripts/verify doctor` ends with `verdict DRIVE`.
- The app signs in as the dev user (`POST /auth/zalo -> 200` in `api-calls.txt`). The dev user is the owner of the listings it posts.
- The seed data holds published listings in every category, many of them with a video, and repeats titles. Match a card by its full accessible name and take `.first()`.
- Drives that post or edit need a running media worker. Never start one while another session's worker runs, and name the worker's checkout in your report.
- Never drive an instance this run did not start.

## Driving conventions

- Drive the phone UI in Chrome at 375x812 through `scripts/verify drive <name>`.
- Prefer ARIA roles and the Vietnamese accessible names below over CSS or DOM position. Quote names exactly, diacritics included.
- The tab bar is `navigation` "Điều hướng chính". Use `tab(page, name)` from `e2e/support.ts`. The sell form has its own "Đăng tin" button, so never take the first button with that name.
- zmp-ui sheets have no role or name. Find their buttons by name, or scope to `.zaui-sheet`.
- Pages slide in, and the previous page stays in the DOM. Scope locators to the page you are on and call `settled()` before a proof.
- Title every listing a drive creates `E2E verify <what> <Date.now()>`.

## Proof and skip reporting

- A UI proof has a screenshot and an ARIA snapshot per asserted step (`proof()`), plus `api-calls.txt` with the requests that the action caused.
- A mutation proof reads the stored value back from a second view: the listing reopened from "Quản lý tin", or `GET /products/:id` or `GET /me/products`.
- A mocked answer (`answerPost`, `page.route`) is named in the report together with what it replaced.
- Record the feature ID and the entry point used with each artifact.
- Report a path you could not reach with the command you tried and the unmet precondition, such as no worker running. Do not report it as verified through another path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph on the user-visible behavior, then exactly these H2s in order.

1. `Sub-features`: short IDs, one line each.
2. `How to get to it (user POV)`: every entry point.
3. `Driving it with Playwright (verify drive)`: `Preconditions:` then labeled bullets, each with a user action, the exact locator calls, and the observable result.
4. `Gotchas`: traps that waste or invalidate a run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands and observable proof.

## Features

- [Home feed](./home-feed.md): categories, search, filters including "Có video", video card autoplay, and state kept across detail. Driven by `drives/home-feed.spec.ts`.
- [Listing detail](./listing-detail.md): gallery, full-screen viewer with pinch zoom and video, contact, share, report, and owner actions.
- [Create listing](./create-listing.md): photo and video pick, tile states, fields, a draft that survives navigation, and Post with its 201, 202, 400, 409 and 422 answers.
- [My listings](./my-listings.md): five status tabs, mark sold, hide and show again, and edit listing including replacing media.
- [Profile](./profile.md): the signed-in user and the sign-in state.

Not mapped yet:

- Reels. The tab shows but is disabled on `main`. Another branch is building it. Map it once it merges.
- The media lab (Profile, "Media lab (dev)"). It is the user's device-test page. Never drive or edit it.
