-- In-app notifications, one row per recipient.
--
-- Keyed to the user, not the family: what one guardian has read is not what
-- another has, and a kid must only ever see their own. Rows go when the user
-- does (cascade), so deleting a child takes their notifications with them.
create table "notification" (
  "id" text not null primary key,
  "userId" text not null references "user" ("id") on delete cascade,
  -- asignada | revision | aprobada | canje | premio | devuelto
  -- | propuesta | aceptada | descartada
  "kind" text not null,
  "title" text not null,
  "body" text,
  -- In-app route to open when tapped, e.g. /kid/misiones
  "link" text,
  "createdAt" integer not null,
  "readAt" integer
);

create index "notification_user_idx" on "notification" ("userId", "createdAt");
