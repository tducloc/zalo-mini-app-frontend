# Authentication and loading states

## Zalo integration

The Zalo SDK provides the user access token. The API verifies identity with Zalo and issues application tokens. Application refresh tokens and session storage are application design choices, not a Zalo-mandated protocol.

Official reference: https://docs.zaloplatforms.com/docs/MA/api/user/user-information/getAccessToken

Since SDK 2.35.0 the default access-token permission identifies the user. Name/avatar require scope.userInfo authorization; apps containing multiple Mini Apps may still prompt for access-token permission. Silent authentication is not guaranteed. Device testing inside Zalo remains required.

## Implemented recovery

- On startup, restore/validate the saved session in the background. Public content remains visible.
- Protected request 401: reuse an already-renewed token or share one refresh operation.
- Refresh 401: get a Zalo SDK token and exchange it at POST /auth/zalo.
- Network error, timeout, 429 or 5xx: retain saved session, show retry, avoid a Zalo exchange.
- Retry the original protected request at most once. A second 401 does not loop.
- Rejected/empty SDK token or SDK timeout: show retry; do not invent a browser login token.
- Concurrent recoveries share one promise; automatic failures have a five-second cooldown. Manual retry bypasses it.
- Do not replay a request under a changed user or after cancellation.
- Do not overwrite a session cleared/replaced during recovery.
- /auth/zalo rejection clears the invalid saved session. A malformed server session response is rejected.

The backend still uses AuthSession. A stateless refresh-token design was discussed but has not been selected or implemented. Reauthentication is not permission to bypass account blocking: the backend must enforce any account policy on both refresh and Zalo sign-in.

## Categories

React Query fetches GET /categories. A five-item skeleton appears while pending. Error offers retry; an empty successful response shows an empty state. Cached data stays visible during background fetching. The backend categories endpoint has not been implemented yet, so local preview may show the error state until it is available.

## Verification

Run npm run test:auth (reuses the backend workspace Vitest installation), npm run format:check, and Vite build. Tests use mocked SDK/network responses, not a live Zalo account. Test on a real device for permissions, suspend/resume, switching Zalo accounts, and network reconnection. Existing browser storage alone cannot prove that the current Zalo account is unchanged; this needs device verification/identity checking if switching accounts without closing the webview is supported.

Source filenames for components, pages and features use PascalCase. Build entry app.ts and generic lib modules retain their existing names. Prettier uses single quotes, trailing commas, two-space indentation and a 100-character print width. The supplied reference repository returned 404 and its settings could not be verified.
