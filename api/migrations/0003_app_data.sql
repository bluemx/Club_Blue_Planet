-- Missions, rewards and the assignment/redemption flow.
-- "Family" is keyed by the parent's user id: children carry it in user.parentId.

-- Catalog. parentId NULL = suggested mission shipped with the app.
create table "mission" (
  "id" text not null primary key,
  "parentId" text references "user" ("id") on delete cascade,
  "title" text not null,
  "subtitle" text,
  "icon" text not null default 'eco',
  "color" text not null default 'blue',
  "points" integer not null default 50,
  "createdAt" integer not null
);

create index "mission_parentId_idx" on "mission" ("parentId");

-- A mission handed to one child.
create table "assignment" (
  "id" text not null primary key,
  "missionId" text not null references "mission" ("id") on delete cascade,
  "childId" text not null references "user" ("id") on delete cascade,
  "parentId" text not null references "user" ("id") on delete cascade,
  -- pendiente -> revision (kid reported) -> lista (parent approved)
  "status" text not null default 'pendiente',
  "points" integer not null,
  "note" text,
  "createdAt" integer not null,
  "reportedAt" integer,
  "approvedAt" integer
);

create index "assignment_childId_idx" on "assignment" ("childId");
create index "assignment_parentId_idx" on "assignment" ("parentId");

create table "reward" (
  "id" text not null primary key,
  "parentId" text references "user" ("id") on delete cascade,
  "title" text not null,
  "subtitle" text,
  "icon" text not null default 'redeem',
  "color" text not null default 'blue',
  "points" integer not null,
  "createdAt" integer not null
);

create index "reward_parentId_idx" on "reward" ("parentId");

create table "redemption" (
  "id" text not null primary key,
  "rewardId" text not null references "reward" ("id") on delete cascade,
  "childId" text not null references "user" ("id") on delete cascade,
  "parentId" text not null references "user" ("id") on delete cascade,
  -- pedida -> entregada | rechazada
  "status" text not null default 'pedida',
  "points" integer not null,
  "createdAt" integer not null,
  "resolvedAt" integer
);

create index "redemption_childId_idx" on "redemption" ("childId");
create index "redemption_parentId_idx" on "redemption" ("parentId");

-- Suggested catalog (parentId NULL): visible to every family.
insert into "mission" ("id","parentId","title","subtitle","icon","color","points","createdAt") values
  ('sug-recicla',    null, 'Recicla 10 objetos',        'Separa la basura de tu casa.',            'recycling',      'blue',   50, 0),
  ('sug-agua',       null, 'Ahorra 200 litros de agua', 'Cierra la llave al lavarte los dientes.', 'water_drop',     'blue',   60, 0),
  ('sug-arboles',    null, 'Planta 5 árboles',          'Con ayuda de un adulto.',                 'park',           'green',  80, 0),
  ('sug-energia',    null, 'Ahorra energía 3 días',     'Apaga las luces que no uses.',            'lightbulb',      'purple', 40, 0),
  ('sug-transporte', null, 'Transporte ecológico',      'Ve en bici o caminando.',                 'pedal_bike',     'blue',   80, 0),
  ('sug-mascota',    null, 'Mascota',                   'Pasa tiempo con tu mascota.',             'pets',           'pink',   40, 0);

-- Default rewards (parentId NULL): a starting point each family can extend.
insert into "reward" ("id","parentId","title","subtitle","icon","color","points","createdAt") values
  ('rw-libro',    null, 'Libro nuevo',            'Elige el libro que más te guste.',   'menu_book',      'blue',   350, 0),
  ('rw-deporte',  null, 'Accesorios deportivos',  'Para seguir jugando al aire libre.', 'sports_soccer',  'green',  550, 0),
  ('rw-videojuego', null, 'Tiempo de videojuegos', 'Una hora extra el fin de semana.',  'sports_esports', 'purple', 550, 0),
  ('rw-parque',   null, 'Parque de atracciones',  'Un día entero de diversión.',        'attractions',    'amber',  950, 0);
