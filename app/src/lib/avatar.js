import { createAvatar } from '@dicebear/core'
import * as neutral from '@dicebear/adventurer-neutral'

// Face: "Adventurer Neutral" by Lisa Wischofsky, CC BY 4.0 — credited in data/legal.js.
// Everything else (hats, hair, accessories) is ours: see assets/avatar/README.md.
const props = neutral.schema.properties
const enumOf = (key) => [...(props[key].items?.enum ?? props[key].default)]
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

// The face fills the circle, so its background *is* the skin.
const SKIN = ['fde2c8', 'f2d3b1', 'ecad80', 'd08b5b', '9e5622', '763900']

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, ' ')
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null

// ---------------------------------------------------------------- layers

/*
 * Our own pieces, drawn over the face on the same 400×400 canvas. Each folder
 * under assets/avatar/ is a category; each SVG in it is an option. A designer
 * adds one by dropping a file in — no code, and no API change (the API checks
 * key shape, not a fixed list). Files or folders starting with "_" are skipped
 * (the template lives there).
 *
 * The root <svg> may carry:
 *   data-name="Corona"         what the kid sees
 *   data-unlock="imparable"    the badge id that unlocks it (see BADGES in the API)
 */
const files = import.meta.glob('../assets/avatar/*/*.svg', { query: '?raw', import: 'default', eager: true })

const LAYERS = {}
for (const [path, raw] of Object.entries(files)) {
  const [, category, name] = path.match(/avatar\/([^/]+)\/([^/]+)\.svg$/) ?? []
  if (!category || category.startsWith('_') || name.startsWith('_')) continue
  const root = raw.match(/<svg[^>]*>/)?.[0] ?? ''
  ;(LAYERS[category] ??= {})[name] = {
    // Only what's inside <svg>…</svg>; it is appended into the face's own SVG.
    inner: raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''),
    title: attr(root, 'data-name') ?? titleCase(name),
    unlock: attr(root, 'data-unlock'),
  }
}

const LAYER_LABELS = { peinados: 'Peinados', sombreros: 'Sombreros', accesorios: 'Accesorios' }
// Drawn bottom → top: a hat goes over hair. Unknown categories go last, A→Z.
const LAYER_ORDER = ['peinados', 'accesorios', 'sombreros']
const rank = (k) => (LAYER_ORDER.includes(k) ? LAYER_ORDER.indexOf(k) : LAYER_ORDER.length)
const layerKeys = Object.keys(LAYERS).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

/** Every piece of ours, with what it needs. `id` is "category/value". */
export const PIECES = layerKeys.flatMap(key =>
  Object.entries(LAYERS[key]).map(([value, p]) => ({
    id: `${key}/${value}`, key, value, title: p.title, unlock: p.unlock,
  }))
)

/** The badge id a piece needs, or null if it's free (and for face parts). */
export const unlockOf = (key, value) => LAYERS[key]?.[value]?.unlock ?? null
export const pieceTitle = (key, value) => LAYERS[key]?.[value]?.title ?? value
export const piecesUnlockedBy = (badgeId) => PIECES.filter(p => p.unlock === badgeId)

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
    // Free pieces first, then the ones to earn — a kid sees what they can wear now.
    values: [null, ...Object.keys(LAYERS[key]).sort((a, b) =>
      Number(!!LAYERS[key][a].unlock) - Number(!!LAYERS[key][b].unlock) ||
      a.localeCompare(b, 'es', { numeric: true }))],
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

/**
 * "Sorpréndeme": fully random, glasses and our pieces now and then — only
 * pieces `canUse(key, value)` allows, so it never dresses a kid in a locked hat.
 */
export function randomAvatar (canUse = () => true) {
  const any = (list) => list[Math.floor(Math.random() * list.length)]
  const avatar = faceWith(any)
  if (Math.random() < 0.25) avatar.glasses = any(byKey.glasses.slice(1))
  for (const key of layerKeys) {
    const open = byKey[key].slice(1).filter(v => canUse(key, v))
    if (open.length && Math.random() < 0.45) avatar[key] = any(open)
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
      const layers = layerKeys.map(k => avatar[k] && LAYERS[k]?.[avatar[k]]?.inner).filter(Boolean)
      if (layers.length) svg = svg.replace(/<\/svg>\s*$/, `${layers.join('')}</svg>`)
    }
    uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    if (cache.size > 400) cache.clear()
    cache.set(key, uri)
  }
  return uri
}
