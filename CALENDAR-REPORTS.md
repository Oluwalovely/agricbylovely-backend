# Phase 5 calendar/report semantics

Calendar month filtering uses inclusive UTC month boundaries and includes active plantings from their planting date onward, even when harvest estimates are missing or overdue. Completed plantings use actual harvest dates. Events expose isHarvested for the frontend to distinguish ongoing records.

Annual summary now separates harvests (actual completed harvests) from plannedHarvests (active estimated harvest dates). It also returns yieldKg and recordedYieldCount by actual harvest month. Zero yield is a recorded value; null yield is unknown. Planting and harvest entries include their planting record ID. Completing a crop replaces its annual estimate with its actual completed harvest date rather than counting both.

Harvest history retains farmer-scoped totals across pagination and sorts by harvestedAt then id, descending, to make same-date pages deterministic. Existing API validation limits month/year/page inputs. No schema migration or historical data update is required.

Run npm test: 41 mocked tests include active crops with unknown/overdue dates, final-day/month/year boundaries, separate estimated/completed counts, zero versus unknown yield, farmer scope, stable pagination and prior lifecycle/session foundations. No real database or provider is contacted.
