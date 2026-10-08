# Email recovery and photos

The backend delivers welcome and password-reset email through HTTPS with a 15-second timeout. Brevo is used when BREVO_API_KEY is present; otherwise RESEND_API_KEY is used. EMAIL_FROM must be a verified sender's plain email address. SMTP configuration is unused. Do not set both provider keys unless Brevo is intended. Provider acceptance is not proof of inbox delivery; check provider delivery logs and spam folders.

## Setup on Render

1. Create an email provider account and verify a sender you control. Brevo supports sender verification by email; a personal Gmail/Yahoo sender cannot authenticate its domain and may have poorer deliverability. A verified custom domain is preferable. Resend's default test sender only reaches the account owner's email; use a verified domain to send resets to other users.
2. Enable transactional sending if the provider requires account approval. Create an API key (not an SMTP password).
3. Add BREVO_API_KEY or RESEND_API_KEY, EMAIL_FROM, and CLIENT_URL=https://agricbylovely.onrender.com to the Render backend environment. Save/redeploy. Keep keys out of GitHub and the frontend.
4. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to that backend environment. Existing local credentials have passed a read-only account ping; production presence must be checked separately.
5. Start command remains `npx prisma migrate deploy && npm start`; build remains `npm ci && npx prisma generate`.

Password reset requests return a generic acknowledgement for existing and absent accounts. The response says a reset was requested, not that delivery succeeded. Missing provider configuration returns the same 503 for all addresses; connection/server errors stay visible in the UI. Rejected email invalidates only that request's token, and is recorded as failed. A log-write failure cannot change successful provider acceptance. Ambiguous provider timeouts are not retried automatically.

New tokens use SHA-256 storage, a one-hour expiry, and an atomic conditional update that consumes the token while changing the password and clearing the refresh token. Stored hashes cannot be used as links. Links issued by the old plaintext-token implementation must be requested again. Existing access tokens retain their short lifetime, as with the current change-password flow.

HTML escapes personal names, farm/field/crop names, advisory text and links. Sample `/api/email/test/*` sending endpoints are development-only. Scheduled emails stay off (`SCHEDULED_EMAILS_ENABLED=false`) until preferences and scheduled delivery safeguards are built.

## Photos

Profile, field details and planting records support upload, replacement and confirmed removal. Each owns its separate Cloudinary image; planting photos do not change the shared encyclopedia. JPEG/PNG/WebP up to 5 MB are accepted, with signature checks followed by Cloudinary image decoding. No files are stored on Render's temporary disk.

The additive migration `20261008080000_record_photos` adds nullable photoUrl columns to fields/farmer_crops. It does not reset or seed records. Prisma must be generated after schema changes and committed migrations applied before the new API starts.

Uploads use unique Cloudinary IDs. Database writes compare the previous URL and owner; conflicts clean the unused upload. Old photos are removed after a successful save. Provider deletion is best effort: failures may leave unused storage requiring manual cleanup. Deleting an entire field, planting or account also requires periodic cleanup of its old Cloudinary assets; it does not affect farm data.

## Verification

Run `npm test`: 64 backend tests include mock HTTPS acceptance/rejection, logging failures, safe HTML, absent accounts, hash security, expired/reused/concurrent reset links, scoped uploads, upload conflicts, cleanup and forged image content. No real recipients or farm records are modified by these tests.

After provider setup, use Forgot password for one user-controlled test account. Confirm receipt, frontend HTTPS link, password change, old-password rejection, new-password login and used-link rejection. Upload/replace/reload/remove a profile photo on that same test account. Do not send test messages to other users.

References: [Brevo sender setup](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [Brevo HTTPS API](https://developers.brevo.com/reference/send-transac-email), [Render free limits](https://render.com/docs/free), [Resend test sender](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
