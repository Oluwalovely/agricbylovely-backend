# API request limits

The old global middleware allowed 200 requests per IP in 15 minutes. Navigation, notification cache refreshes and repeated testing all shared this budget, which could block otherwise valid notification reads.

General API traffic now uses separate buckets: 600 requests per verified signed-in farmer per 15 minutes, and 200 per IP for anonymous/invalid/expired tokens. A JWT signature and expiry are checked before selecting the farmer bucket; arbitrary token claims cannot create buckets. Authentication middleware still verifies the account for private routes. Renewed tokens share the same farmer budget. Existing login, upload, weather and external-search limits remain in place.

GET health/liveness probes are excluded from the general navigation budget. HTTP 429 responses include Retry-After and a `retryAfterSeconds` body field with a concrete wait message. The existing MemoryStore resets limits on service restart and does not share counters across replicas.

Verification uses an isolated local Express server, valid/invalid/expired test tokens and no database/provider calls. It exhausts one account's 600-request budget, confirms another account on the same IP still works, checks the anonymous limit and verifies health probes remain available. Configuration follows the package's supported [custom key generator](https://github.com/express-rate-limit/express-rate-limit) API.
