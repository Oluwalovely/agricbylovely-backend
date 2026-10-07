# Phase 4: crop lifecycle contract

PUT /api/crops/my-crops/:id supports active stage/notes updates and atomic harvest stage/date/yield/notes updates. HARVESTED requires an explicit date for the first harvest. Sending a harvest date implies HARVESTED; pairing it with an active stage is rejected. Completed plantings cannot reopen, but harvest details can be corrected. Dates must be on/after planting and no later than today, using UTC calendar days. Yield must be nonnegative or null (unknown), and may only be saved for a harvest. Null clears a previously recorded yield; zero remains zero.

Writes include owner and the version read in updatedAt. A competing update returns 409 with a refresh/retry message rather than overwriting lifecycle state. Removal is owner-scoped and permanently removes one planting record. No schema migration or historic-record rewrite is needed.

Dashboard totals count all active crops/unread notifications independently of six/five display limits. Field dashboard counts include only active crops. Report summary adds totalYieldKg and replaces the misleading successRate with harvestCompletionRate. Harvest-history totalYieldKg covers all matching harvests, independently of pagination. Calendar uses actual completed harvest dates, and shared UTC day calculations treat today as due, keep future progress nonnegative and prevent date/time inconsistencies.

Verification: npm test passes 35 mocked tests covering lifecycle combinations, dates, unknown/zero yield, ownership, concurrent write conflicts, totals beyond card/page limits, actual calendar dates and due-today reminders. No real database, provider or email was contacted.
