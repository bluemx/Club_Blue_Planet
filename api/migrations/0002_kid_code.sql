-- One live 6-digit code per child. Only the SHA-256 hash is stored: the
-- plaintext is shown to the parent once, at issue time.
create table "kid_code" (
  "id" text not null primary key,
  "childId" text not null references "user" ("id") on delete cascade,
  "parentId" text not null references "user" ("id") on delete cascade,
  "codeHash" text not null,
  "expiresAt" integer not null,
  "attempts" integer not null default 0,
  "createdAt" integer not null,
  "lastUsedAt" integer
);

create unique index "kid_code_codeHash_idx" on "kid_code" ("codeHash");
create unique index "kid_code_childId_idx" on "kid_code" ("childId");
create index "kid_code_parentId_idx" on "kid_code" ("parentId");

-- Parents list their children on every visit to the code screen.
create index "user_parentId_idx" on "user" ("parentId");
