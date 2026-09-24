-- A child's year of birth, set by a parent: AI mission ideas are pitched at
-- their age. NULL until someone sets it.
alter table "user" add column "birthYear" integer;
