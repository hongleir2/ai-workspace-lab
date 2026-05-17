import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { jobs } from './jobs';

export const jobAttemptStatusEnum = pgEnum('job_attempt_status', [
  'started',
  'succeeded',
  'failed',
  'timed_out',
]);

export const jobAttempts = pgTable(
  'job_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id),
    attemptNumber: integer('attempt_number').notNull(),
    status: jobAttemptStatusEnum('status').notNull().default('started'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    unique('job_attempts_job_id_attempt_number_unique').on(t.jobId, t.attemptNumber),
    index('job_attempts_job_id_idx').on(t.jobId),
  ],
);

export type JobAttempt = typeof jobAttempts.$inferSelect;
export type NewJobAttempt = typeof jobAttempts.$inferInsert;
