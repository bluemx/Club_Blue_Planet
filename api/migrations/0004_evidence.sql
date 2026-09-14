-- Photo evidence for a completed mission. Only the R2 object key is stored;
-- the image itself is served through the Worker so it stays private.
alter table "assignment" add column "evidenceKey" text;
alter table "assignment" add column "evidenceType" text;
