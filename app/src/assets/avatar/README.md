# Piezas del avatar

La cara la dibuja DiceBear («Adventurer Neutral»). Todo lo que va encima
—sombreros, peinados, accesorios— es nuestro y vive aquí.

## Agregar una pieza

1. Abre `_plantilla.svg`: marca el círculo que se ve y las zonas que no se
   deben tapar (ojos y boca).
2. Dibuja la pieza en un lienzo de **400 × 400**. Borra las guías.
3. Guárdala como `<categoría>/<nombre>.svg`, por ejemplo
   `sombreros/vaquero.svg`. Aparece sola en el editor del niño: no hay que
   tocar código ni la API.

- **Carpeta = categoría.** Crear una carpeta nueva (`peinados/`, `mascotas/`…)
  agrega una categoría. Las conocidas tienen nombre bonito en
  `src/lib/avatar.js` (`LAYER_LABELS`); las demás usan el nombre de la carpeta.
- **Nombre del archivo = id de la opción**: minúsculas, números y guiones
  (`gorra-roja.svg`). Se guarda en la base, así que no lo cambies después.
- **Orden de capas:** peinados → accesorios → sombreros (un sombrero tapa el
  pelo). Categorías nuevas van al final.
- Archivos o carpetas que empiezan con `_` se ignoran.

## Nombre y desbloqueo

En la etiqueta `<svg>` de la pieza:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"
     data-name="Banda deportiva" data-unlock="atleta">
```

- `data-name` — cómo la ve el niño. Sin él, se usa el nombre del archivo.
- `data-unlock` — la insignia que la desbloquea. Sin él, la pieza es libre.
  Ids válidos (los define la API, `BADGES` en `api/src/routes.js`):
  `explorador`, `orden`, `manos`, `lector`, `atleta`, `imparable`.

Cuando un niño gana esa insignia, la app se lo celebra con su cara ya
llevando la pieza. El candado vive en la app (es cosmético): los puntos y los
premios sí los protege el servidor.

## Estilo

Para que case con la cara: contorno `#1A1A1A` de 8 px, uniones redondeadas,
rellenos planos con un brillo sencillo. Nada de degradados complejos ni
sombras difusas.

## Reglas técnicas

- Solo formas: sin `<script>`, sin fuentes, sin imágenes enlazadas ni
  incrustadas.
- Evita `id` dentro del SVG; si hace falta, ponle un prefijo único
  (`vaquero-ala`). La pieza se inserta dentro del SVG de la cara, y dos ids
  iguales chocan.
- Queda recortado en círculo: lo que salga del círculo no se ve (un ala de
  sombrero puede salirse a propósito).
