-- Until now "family" was just the parent's own user id, so a second guardian
-- would have been their own separate family. This introduces a real family
-- entity that several adults can belong to.

create table "family" (
  "id" text not null primary key,
  "name" text,
  "createdAt" integer not null
);

-- Every adult in a family. All members are equivalent; "owner" only records
-- who created it, for display.
create table "family_member" (
  "familyId" text not null references "family" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "role" text not null default 'guardian',
  "joinedAt" integer not null,
  primary key ("familyId", "userId")
);

create index "family_member_userId_idx" on "family_member" ("userId");

-- Six-digit code an existing guardian issues so another adult can join.
create table "family_invite" (
  "id" text not null primary key,
  "familyId" text not null references "family" ("id") on delete cascade,
  "invitedBy" text not null references "user" ("id") on delete cascade,
  "codeHash" text not null,
  "expiresAt" integer not null,
  "createdAt" integer not null,
  "usedAt" integer,
  "usedBy" text references "user" ("id") on delete set null
);

create unique index "family_invite_codeHash_idx" on "family_invite" ("codeHash");
create index "family_invite_familyId_idx" on "family_invite" ("familyId");

-- Family key on the data tables. Nullable during backfill, then populated.
alter table "user" add column "familyId" text;
alter table "mission" add column "familyId" text;
alter table "assignment" add column "familyId" text;
alter table "reward" add column "familyId" text;
alter table "redemption" add column "familyId" text;
alter table "kid_code" add column "familyId" text;

-- Backfill: one family per existing parent, keyed by that parent's id so the
-- old parentId values map straight across.
insert into "family" ("id", "name", "createdAt")
  select id, name, unixepoch() * 1000 from "user" where role != 'kid' or role is null;

insert into "family_member" ("familyId", "userId", "role", "joinedAt")
  select id, id, 'owner', unixepoch() * 1000 from "user" where role != 'kid' or role is null;

-- Adults belong to their own family; kids to their parent's.
update "user" set "familyId" = case when role = 'kid' then "parentId" else id end;

update "mission"    set "familyId" = "parentId" where "parentId" is not null;
update "assignment" set "familyId" = "parentId";
update "reward"     set "familyId" = "parentId" where "parentId" is not null;
update "redemption" set "familyId" = "parentId";
update "kid_code"   set "familyId" = "parentId";

create index "user_familyId_idx"       on "user" ("familyId");
create index "mission_familyId_idx"    on "mission" ("familyId");
create index "assignment_familyId_idx" on "assignment" ("familyId");
create index "reward_familyId_idx"     on "reward" ("familyId");
create index "redemption_familyId_idx" on "redemption" ("familyId");
