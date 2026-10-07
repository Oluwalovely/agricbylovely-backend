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

Outbound SMTP is blocked on Render's free service. The current email service uses SMTP and must be adapted to an HTTPS email API before welcome and password-reset emails will work online. Do not configure SMTP credentials as a substitute for this adaptation.

## Free-tier behavior

The backend sleeps after 15 minutes without incoming traffic. The next request can take about a minute to wake it. Socket.IO reconnects when the service is available. Scheduled jobs inside the server do not run while it is asleep, so reminders are demonstrations rather than continuously running automation on this plan.

Verify the backend, frontend, old account login, and farm data on the new hosting before retiring Railway. Local PostgreSQL and backups remain separate from Neon; changes do not sync automatically.
