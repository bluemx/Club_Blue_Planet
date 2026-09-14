-- familyId replaced parentId as the access key on these tables. Keeping both
-- means two sources of truth that can drift, and the old column is NOT NULL,
-- so leaving it would force writing a value nothing reads.
-- user.parentId and kid_code.parentId stay: they record who added a child /
-- issued a code, which is real information, not a scoping key.
--
-- Indexes must go first: SQLite refuses to drop a column an index still names.
drop index if exists "assignment_parentId_idx";
drop index if exists "redemption_parentId_idx";
drop index if exists "mission_parentId_idx";
drop index if exists "reward_parentId_idx";

alter table "assignment" drop column "parentId";
alter table "redemption" drop column "parentId";
alter table "mission"    drop column "parentId";
alter table "reward"     drop column "parentId";
