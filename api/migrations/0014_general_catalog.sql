-- The suggestion catalog was half "save the planet". The app is about kids'
-- everyday habits, so add general ones (the eco ones stay retired).
insert or ignore into mission (id, familyId, title, subtitle, icon, color, points, createdAt, status) values
  ('sug-dientes',   null, 'Lávate los dientes',          'Mañana y noche, dos minutos.',   'clean_hands',       'green',  30, 1789900000000, 'activa'),
  ('sug-cama',      null, 'Tiende tu cama',              'Antes de salir del cuarto.',     'bed',               'blue',   30, 1789900000000, 'activa'),
  ('sug-dormir',    null, 'Acuéstate a tu hora',         'Sin pantallas antes de dormir.', 'wb_sunny',          'amber',  40, 1789900000000, 'activa'),
  ('sug-mesa',      null, 'Pon la mesa',                 'Platos, vasos y cubiertos.',     'cleaning_services', 'pink',   30, 1789900000000, 'activa'),
  ('sug-verduras',  null, 'Cómete tus verduras',         'Todo el plato, sin quejas.',     'restaurant',        'amber',  40, 1789900000000, 'activa'),
  ('sug-agua2',     null, 'Toma agua en lugar de refresco', 'Todo el día.',                'restaurant',        'amber',  40, 1789900000000, 'activa'),
  ('sug-amable',    null, 'Comparte y di gracias',       'Con tus hermanos y amigos.',     'favorite',          'pink',   40, 1789900000000, 'activa'),
  ('sug-dibujo',    null, 'Haz un dibujo o manualidad',  'Lo que tú quieras.',             'palette',           'purple', 40, 1789900000000, 'activa'),
  ('sug-juguetes',  null, 'Recoge tus juguetes',         'Cada cosa en su lugar.',         'bed',               'blue',   30, 1789900000000, 'activa');
