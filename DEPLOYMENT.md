# Free portfolio hosting

Use a Render Free Web Service for this backend and Neon Free for PostgreSQL. The repository's `render.yaml` provides the deployment settings for a Render Blueprint; you can also enter the same settings manually.

- Build command: `npm ci && npx prisma generate`
- Start command: `npx prisma migrate deploy && npm start`
- Node version: 24
- Health endpoint: `/api/health`
- Instance: Free

Set `DATABASE_URL` to Neon's connection URL and `CLIENT_URL` to the frontend's HTTPS origin without a trailing slash. The Blueprint generates separate JWT secrets automatically. When creating a service manually, supply separate random values for `JWT_SECRET` and `JWT_REFRESH_SECRET`. Set `NODE_ENV=production`. Let Render supply `PORT`.

## Preserve the recovered database

Before deploying against the new database, restore the recovered `../database-backup/agricbylovely.dump` into an empty Neon database, using the direct connection rather than the pooled connection. Restore with `pg_restore --no-owner --no-acl --exit-on-error`; credentials belong in a private local configuration or environment variables, not command history or GitHub. Verify 4 users, 1 field, 4 planted crops, and 106 crop entries after importing. Use PostgreSQL 18 for the Neon project when available to match the recovered source.

Keep the existing local `.env` unchanged for development. Do not run `db:reset` or the seed script on the recovered database. Render's free service has no pre-deploy command, so the configured start command applies committed migrations before starting the API. Never deploy `prisma migrate dev` to the hosted database.

## Optional integrations

Add the appropriate OpenWeather, Perenual, Anthropic, and Cloudinary keys in Render's environment settings to enable their corresponding features. Keep these credentials on the backend.

Email now uses an HTTPS API: configure `BREVO_API_KEY` (or `RESEND_API_KEY`) and `EMAIL_FROM` for a verified sender. SMTP variables are no longer used. See EMAIL-PHOTOS.md for provider setup, reset testing and photo requirements. Scheduled email remains disabled by default.

## Free-tier behavior

For UptimeRobot, create an HTTP monitor for `https://agricbylovely-api.onrender.com/api/health/live` with a 5-minute interval. This endpoint returns HTTP 200 when the server responds and does not query PostgreSQL, allowing Neon to suspend its compute between database requests. The existing `/api/health` endpoint also checks database connectivity; avoid using it for frequent uptime monitoring. Monitoring does not guarantee continuous availability or remove hosting quotas.

The backend sleeps after 15 minutes without incoming traffic. The next request can take about a minute to wake it. Socket.IO reconnects when the service is available. Scheduled jobs inside the server do not run while it is asleep, so reminders are demonstrations rather than continuously running automation on this plan.

Verify the backend, frontend, old account login, and farm data on the new hosting before retiring Railway. Local PostgreSQL and backups remain separate from Neon; changes do not sync automatically.

## Account foundation

Run `npm test` for validation and account-isolation checks. Notification sockets require `auth: { token: accessToken }`; the server derives the farmer room. Manual `/api/jobs/run/*` routes are disabled unless `NODE_ENV=development`. See FOUNDATION.md for Phase 1 verification.
