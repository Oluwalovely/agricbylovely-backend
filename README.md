# AgricByLovely API

The backend for AgricByLovely, a portfolio project for keeping farm records. It provides account access, fields, crop guides, planting and harvest records, weather advisories, notifications, calendar data, reports, and photo uploads.

- Website: https://agricbylovely.onrender.com
- API: https://agricbylovely-api.onrender.com
- Frontend repository: https://github.com/Oluwalovely/agricbylovelyfrontend

Built with Node.js, Express, Prisma, PostgreSQL, and Socket.IO. OpenWeather supplies weather, Cloudinary stores photos, and Brevo supplies transactional email through its HTTPS API. Provider keys belong on the backend.

## Run locally

Use Node.js 24 and a development PostgreSQL database. Copy `.env.example` to `.env`, then set `DATABASE_URL` and two separate random JWT secrets. Generate each secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm start
```

The example environment serves the API on port 8001 and allows the frontend at `http://localhost:5173`. Without optional provider credentials, affected features report that they are unavailable while ordinary farm records remain usable.

Use an existing development database or import your own development copy if you need crop catalogue entries. Migrations create the schema, not the catalogue. Do not run reset or seed commands against the recovered or hosted database.

## Checks

```sh
npm test
```

Tests cover account ownership, validation, crop lifecycle, reports, weather caching, notification receipts, password recovery, and photo persistence. They use isolated fixtures and provider mocks rather than modifying hosted farm records.

## Deployment and feature notes

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting and environment settings, [FOUNDATION.md](FOUNDATION.md) for account isolation, [EMAIL-PHOTOS.md](EMAIL-PHOTOS.md) for provider setup, and [WEATHER-NOTIFICATIONS.md](WEATHER-NOTIFICATIONS.md) for alerts.

`/api/health/live` checks the running server without querying the database; `/api/health` also checks PostgreSQL. Free hosting can introduce cold starts. In-process scheduled reminders run only while the server is awake, and scheduled email is disabled by default. Welcome and password-reset email are separate from scheduled email.
