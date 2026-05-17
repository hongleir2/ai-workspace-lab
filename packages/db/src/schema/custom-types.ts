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

// vector stores pgvector embeddings. Dimension must match the embedding model.
export const vector = (dimensions: number) =>
  customType<{ data: number[] | null; driverData: string | null }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    fromDriver(value: string | null): number[] | null {
      if (value === null) return null;
      // pgvector returns "[0.1,0.2,...]" — strip brackets and parse
      return value.slice(1, -1).split(',').map(Number);
    },
    toDriver(value: number[] | null): string | null {
      if (value === null) return null;
      return `[${value.join(',')}]`;
    },
  });
