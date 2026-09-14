-- The app is about building habits, not about the environment.
--
-- The eco suggestions are retired, not deleted: families' past assignments
-- still join them, and deleting would cascade those away. GET /missions only
-- lists status 'activa', so retired ones simply stop being offered.
update "mission" set "status" = 'retirada'
 where "familyId" is null
   and "id" in ('sug-recicla', 'sug-agua', 'sug-arboles', 'sug-energia', 'sug-transporte');

-- The habit set the designer drew icons for (CLUB BLUE PLANET ASSETES/Club-Iconos).
-- 'sug-mascota' stays: looking after a pet is a habit too.
insert into "mission" ("id","familyId","title","subtitle","icon","color","points","createdAt","status") values
  ('sug-cuarto',     null, 'Ordena tu cuarto',     'Tiende la cama y guarda tus juguetes.', 'bed',               'blue',   50, 1, 'activa'),
  ('sug-manos',      null, 'Lávate las manos',     'Antes de comer y al llegar a casa.',    'clean_hands',       'green',  30, 2, 'activa'),
  ('sug-mochila',    null, 'Prepara tu mochila',   'Déjala lista desde la noche anterior.', 'backpack',          'amber',  40, 3, 'activa'),
  ('sug-lectura',    null, 'Lee 20 minutos',       'Elige un libro que te guste.',          'menu_book',         'purple', 50, 4, 'activa'),
  ('sug-tarea',      null, 'Haz tu tarea',         'Sin que nadie te lo tenga que pedir.',  'school',            'blue',   60, 5, 'activa'),
  ('sug-ejercicio',  null, 'Haz ejercicio',        '30 minutos de juego o deporte.',        'directions_run',    'green',  50, 6, 'activa'),
  ('sug-escritorio', null, 'Ordena tu escritorio', 'Deja despejado tu lugar de estudio.',   'desk',              'purple', 40, 7, 'activa'),
  ('sug-casa',       null, 'Ayuda en casa',        'Pon la mesa o ayuda a limpiar.',        'cleaning_services', 'pink',   40, 8, 'activa');
