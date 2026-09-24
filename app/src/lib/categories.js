/**
 * Mission categories, shared by the parent's and the kid's mission creators.
 * The app is about everyday habits, so these are broad. The icon is what gets
 * stored on the mission; badges in the API match some of them (bed/desk,
 * clean_hands, menu_book, directions_run), so keep those icons as they are.
 * `ideas` fill the title with one tap in the parent's creator.
 */
export const CATEGORIES = [
  { label: 'Rutina', icon: 'wb_sunny', color: 'amber', ideas: ['Levántate a tiempo', 'Prepara tu ropa para mañana', 'Acuéstate a tu hora'] },
  { label: 'Higiene', icon: 'clean_hands', color: 'green', ideas: ['Lávate los dientes', 'Báñate', 'Lávate las manos antes de comer'] },
  { label: 'Orden', icon: 'bed', color: 'blue', ideas: ['Tiende tu cama', 'Recoge tus juguetes', 'Guarda tu ropa'] },
  { label: 'Ayudar en casa', icon: 'cleaning_services', color: 'pink', ideas: ['Pon la mesa', 'Ayuda a lavar los platos', 'Saca la basura'] },
  { label: 'Escuela', icon: 'school', color: 'blue', ideas: ['Haz tu tarea', 'Prepara tu mochila', 'Estudia 15 minutos'] },
  { label: 'Lectura', icon: 'menu_book', color: 'purple', ideas: ['Lee 20 minutos', 'Cuéntanos lo que leíste', 'Termina un capítulo'] },
  { label: 'Deporte', icon: 'directions_run', color: 'green', ideas: ['Haz 20 minutos de ejercicio', 'Sal a jugar afuera', 'Anda en bici'] },
  { label: 'Alimentación', icon: 'restaurant', color: 'amber', ideas: ['Cómete tus verduras', 'Toma agua en lugar de refresco', 'Prueba algo nuevo'] },
  { label: 'Convivencia', icon: 'favorite', color: 'pink', ideas: ['Comparte con tu hermano', 'Di gracias y por favor', 'Ayuda a un amigo'] },
  { label: 'Creatividad', icon: 'palette', color: 'purple', ideas: ['Haz un dibujo', 'Practica tu instrumento', 'Construye algo'] },
  { label: 'Responsabilidad', icon: 'task_alt', color: 'blue', ideas: ['Cuida a tu mascota', 'Riega las plantas', 'Cumple lo que prometiste'] },
  { label: 'Otra', icon: 'star', color: 'amber', ideas: [] },
]
