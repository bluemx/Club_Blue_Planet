-- A delivered reward is celebrated full-screen on the kid's phone with the
-- reward's own icon, so the notice carries the art of what it announces.
-- Nullable: most notices are fine with the icon of their kind.
alter table "notification" add column "icon" text;
alter table "notification" add column "color" text;
