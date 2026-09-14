import { createAvatar } from '@dicebear/core'
import * as neutral from '@dicebear/adventurer-neutral'

// Face: "Adventurer Neutral" by Lisa Wischofsky, CC BY 4.0 — credited in data/legal.js.
// Everything else (hats, hair, accessories) is ours: see assets/avatar/README.md.
const props = neutral.schema.properties
const enumOf = (key) => [...(props[key].items?.enum ?? props[key].default)]
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

// The face fills the circle, so its background *is* the skin.
const SKIN = ['fde2c8', 'f2d3b1', 'ecad80', 'd08b5b', '9e5622', '763900']

// ---------------------------------------------------------------- layers

/*
 * Our own pieces, drawn over the face on the same 400×400 canvas. Each folder
 * under assets/avatar/ is a category; each SVG in it is an option. A designer
 * adds one by dropping a file in — no code, and no API change (the API checks
 * key shape, not a fixed list). Files or folders starting with "_" are skipped
 * (the template lives there).
 */
const files = import.meta.glob('../assets/avatar/*/*.svg', { query: '?raw', import: 'default', eager: true })

const LAYERS = {}
for (const [path, raw] of Object.entries(files)) {
  const [, category, name] = path.match(/avatar\/([^/]+)\/([^/]+)\.svg$/) ?? []
  if (!category || category.startsWith('_') || name.startsWith('_')) continue
  // Keep only what's inside <svg>…</svg>; it is appended into the face's own SVG.
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  ;(LAYERS[category] ??= {})[name] = inner
}

const LAYER_LABELS = { peinados: 'Peinados', sombreros: 'Sombreros', accesorios: 'Accesorios' }
// Drawn bottom → top: a hat goes over hair. Unknown categories go last, A→Z.
const LAYER_ORDER = ['peinados', 'accesorios', 'sombreros']
const rank = (k) => (LAYER_ORDER.includes(k) ? LAYER_ORDER.indexOf(k) : LAYER_ORDER.length)
const layerKeys = Object.keys(LAYERS).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, ' ')

// ----------------------------------------------------------------- parts

/**
 * What a kid can choose, in editor order. `zoom` frames the thumbnails on the
 * part being chosen, so 26 pairs of eyes aren't 26 tiny faces. `null` = none.
 */
export const PARTS = [
  { key: 'skin', label: 'Piel', values: SKIN, swatch: true },
  { key: 'eyes', label: 'Ojos', values: enumOf('eyes'), zoom: { scale: 160, translateY: 12 } },
  { key: 'eyebrows', label: 'Cejas', values: enumOf('eyebrows'), zoom: { scale: 160, translateY: 22 } },
  { key: 'mouth', label: 'Boca', values: enumOf('mouth'), zoom: { scale: 160, translateY: -18 } },
  { key: 'glasses', label: 'Lentes', values: [null, ...enumOf('glasses')], zoom: { scale: 130, translateY: 8 } },
  ...layerKeys.map(key => ({
    key,
    label: LAYER_LABELS[key] ?? titleCase(key),
    values: [null, ...Object.keys(LAYERS[key]).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))],
    layer: true,
  })),
]

const byKey = Object.fromEntries(PARTS.map(p => [p.key, p.values]))

/** Accepts the stored JSON string, an object, or nothing. */
export function parseAvatar (value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

// FNV-1a: the same kid id always yields the same default face.
function hash (text) {
  let h = 2166136261
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

const faceWith = (next) => ({
  skin: next(byKey.skin),
  eyes: next(byKey.eyes),
  eyebrows: next(byKey.eyebrows),
  mouth: next(byKey.mouth),
  glasses: null,
})

/** A kid who hasn't designed one yet still gets their own, stable face. */
export function defaultAvatar (seed = 'club') {
  let h = hash(seed)
  return faceWith((list) => {
    const value = list[h % list.length]
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    return value
  })
}

/** "Sorpréndeme": fully random, glasses and our own pieces now and then. */
export function randomAvatar () {
  const any = (list) => list[Math.floor(Math.random() * list.length)]
  const avatar = faceWith(any)
  if (Math.random() < 0.25) avatar.glasses = any(byKey.glasses.slice(1))
  for (const key of layerKeys) {
    if (Math.random() < 0.45) avatar[key] = any(byKey[key].slice(1))
  }
  return avatar
}

// ----------------------------------------------------------------- render

const one = (value) => (value ? [value] : [])

const faceOptions = (a, extra) => ({
  seed: 'club',
  backgroundColor: one(a.skin),
  eyes: one(a.eyes),
  eyebrows: one(a.eyebrows),
  mouth: one(a.mouth),
  glasses: one(a.glasses),
  glassesProbability: a.glasses ? 100 : 0,
  ...extra,
})

// ~1 ms per render, but lists re-render on every poll; don't redo the same face.
const cache = new Map()

/**
 * A data: URI for <img> — CSP allows data: images, and <img> runs no script,
 * which is also what makes it safe to splice designer SVG into the face.
 * `extra` zooms the face for part thumbnails; our layers are left off then,
 * since they don't zoom with it.
 */
export function avatarUri (value, seed, extra = null) {
  // Merge over the default so a partial or older saved avatar still draws whole.
  const avatar = { ...defaultAvatar(seed ?? 'club'), ...(parseAvatar(value) ?? {}) }
  const key = JSON.stringify([avatar, extra])
  let uri = cache.get(key)
  if (!uri) {
    let svg = createAvatar(neutral, faceOptions(avatar, extra)).toString()
    if (!extra) {
      const layers = layerKeys.map(k => avatar[k] && LAYERS[k]?.[avatar[k]]).filter(Boolean)
      if (layers.length) svg = svg.replace(/<\/svg>\s*$/, `${layers.join('')}</svg>`)
    }
    uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    if (cache.size > 400) cache.clear()
    cache.set(key, uri)
  }
  return uri
}
