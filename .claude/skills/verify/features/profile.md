# Profile

"Cá nhân" shows the signed-in Zalo user's name and whether sign-in worked. Outside Zalo, the dev token signs in as the dev user.

## Sub-features

- `profile-user` shows the user's name, or "Người dùng Zalo" before sign-in.
- `profile-auth-state` reads "Đã xác thực với Zalo", "Đang xác thực với Zalo…" or "Chưa thể xác thực trong trình duyệt".

## How to get to it (user POV)

- Choose "Cá nhân" in the tab bar.

## Driving it with Playwright (verify drive)

Preconditions:

- Baseline from the [README](./README.md). Read-only.

- **Open.** Run `page.goto('/')`, then `tab(page, 'Cá nhân').click()`. The header reads "Cá nhân" and `tab(page, 'Cá nhân')` has `aria-current="page"`.
- **Signed in.** The card shows the dev user's name and "Đã xác thực với Zalo". `api-calls.txt` has `POST /auth/zalo -> 200`.
- **Proof.** Screenshot and ARIA snapshot of the card.

## Gotchas

- "Chưa thể xác thực trong trình duyệt" means the dev token is missing or does not match the backend. `doctor` checks both.
- "Media lab (dev)" shows here in dev builds. It is the user's device-test page. Do not open or drive it.
