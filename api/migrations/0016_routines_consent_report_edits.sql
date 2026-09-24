-- Recurring missions: a routine hands a child the same mission on chosen
-- weekdays. `days` is a bitmask, Sunday = 1 … Saturday = 64 (Mexico time).
create table "routine" (
  "id" text not null primary key,
  "familyId" text not null,
  "missionId" text not null references "mission" ("id") on delete cascade,
  "childId" text not null references "user" ("id") on delete cascade,
  "days" integer not null,
  "createdAt" integer not null,
  "stoppedAt" integer
);
create index "routine_family" on "routine" ("familyId");

-- Each day's copy of a routine; the unique pair makes creating it idempotent.
alter table "assignment" add column "routineId" text;
alter table "assignment" add column "day" text;
create unique index "assignment_routine_day" on "assignment" ("routineId", "day");

-- A parent's consent before the family holds a child's data.
alter table "user" add column "parentConsentAt" integer;
-- Weekly report email, on unless a parent turns it off.
alter table "user" add column "weeklyReport" integer not null default 1;

-- Rewards: a deadline, a streak to earn first, and archiving instead of deleting.
alter table "reward" add column "expiresAt" integer;
alter table "reward" add column "requiredStreak" integer;
alter table "reward" add column "archivedAt" integer;
