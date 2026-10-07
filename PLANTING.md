# Phase 3: dependable catalogue reads

GET /api/crops now searches and paginates the saved catalogue exclusively. Empty searches retain requested pagination and return source=database with no writes, external import or AI enrichment. The external-provider search limiter no longer limits ordinary catalogue page reads; the existing application API limiter still applies.

Existing crop details, owned-field planting checks and My Crops endpoints support the new UI. Planting saves the current farmer, optional owned field, validated planting date, quantity and notes; expected harvest is calculated from recorded daysToHarvest, or null when unknown. No schema or data migration is needed.

Run npm test: 24 mocked tests include search/category/pagination, empty catalogue results without writes, unknown crops, calculated harvest dates, unknown durations, optional field assignment and farmer-scoped records. No real database, email or external crop provider is contacted.
