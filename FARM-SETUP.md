# Phase 2 API updates

Profile and field updates accept explicit null for optional size and coordinates. Coordinates must be provided or cleared together; omitted values leave existing values unchanged. Controllers retain parsed numbers/null rather than converting null into NaN. Notes, phone and state have bounded lengths, and changing a password accepts at most 100 characters.

Field summary counts only records with harvestedAt null as active plantings. Owner checks apply to field reads, edits and deletion. The existing field foreign key uses ON DELETE SET NULL, preserving planting history when deleting a field. No schema migration is needed.

Run npm test: 18 tests cover foundation and farm setup with mocked Prisma methods, including nullable edits, zero coordinates, foreign-field rejection, deletion behavior and active summaries. No real database or email provider is contacted.
