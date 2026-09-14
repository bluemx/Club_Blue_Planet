-- Two loops that dead-ended:
--   * a kid could fill in "propón tu aventura" and nothing was stored;
--   * a kid could redeem a reward and no adult was ever told.

-- A proposal is a mission that is not assignable until an adult accepts it.
-- Reusing the mission table means accepting one is a status flip, not a copy.
alter table "mission" add column "status" text not null default 'activa';
alter table "mission" add column "proposedBy" text references "user" ("id") on delete cascade;
alter table "mission" add column "difficulty" text;

create index "mission_status_idx" on "mission" ("familyId", "status");

-- Redemptions already had a status; nothing could move it off 'pedida'.
create index "redemption_status_idx" on "redemption" ("familyId", "status");
