-- Better Auth's rate limiter only covers /api/auth/*. The app's own routes had
-- none, which left /guardians/join — a 6-digit code that grants access to a
-- family's children and their photos — brute-forceable.
create table "api_rate_limit" (
  "key" text not null primary key,
  "count" integer not null default 0,
  "resetAt" integer not null
);
