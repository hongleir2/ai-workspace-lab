import { customType } from 'drizzle-orm/pg-core';

// citext is a Postgres extension (enabled in migration 0000).
// Comparisons are case-insensitive — used for email and org slugs.
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

// inet stores an IPv4 or IPv6 host address and validates the format at insert time.
export const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'inet';
  },
});
