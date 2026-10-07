# Phase 1: account and API foundation

Implemented 7 October 2026.

- Invalid requests return HTTP 400 with field-level errors; handlers use validated values.
- Registration can finish without GPS. Zero coordinates remain valid.
- Protected pages wait for the saved account profile; transient outages show a retry rather than discarding login tokens.
- Wrong credentials remain visible on the login page. Concurrent expired requests share one refresh.
- Private queries are scoped to the farmer. Logout/account changes cancel and clear caches, and stale responses cannot update a new session. Account changes synchronize across tabs.
- Planting requires an owned field. Socket connections authenticate with an access token and join only that farmer's room; expired connections reauthenticate.
- Global manual job routes return HTTP 403 outside development.
- Passwords are not trimmed; login responses exclude password-reset credentials. Password changes revoke refresh tokens.

Run `npm test` in each repository. Frontend checks also include `npm run lint` and `npm run build`. Tests use mocked database/provider calls and do not modify production records or send emails.

Browser checks with mocked APIs cover saved-session deep links/reload, logout, incorrect credentials, account switching, and outage retry. Production checks must also confirm Render serves the new frontend bundle and backend validation/liveness responses.

Phase 2 remains: build Profile and Fields, finish onboarding saves/error handling and query invalidation. Crop harvest consistency, truthful report totals, email delivery, photo persistence and the remaining page interfaces belong to later phases in the project plan.
