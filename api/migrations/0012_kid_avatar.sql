-- The avatar a kid designs for themselves, shown to their guardians.
--
-- Stored as the choices, not the picture: a small JSON of option names
-- (skinColor, hair, eyes, …) that the app renders to SVG on the device.
-- Nothing goes to R2, and there is no uploaded image to moderate.
-- NULL = not designed yet; the app draws a default seeded by the kid's id.
alter table "user" add column "avatar" text;
