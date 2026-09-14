<template>
  <!--
    The kid's evidence, taken in the app: live camera (either lens), then
    stickers dragged over the shot, then one flattened JPEG goes up. The photo
    is the proof and the stickers make taking it fun.
  -->
  <q-dialog
    :model-value="modelValue"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @update:model-value="$emit('update:modelValue', $event)"
    @show="startCamera"
    @hide="reset"
  >
    <div class="bp-studio">
      <header class="bp-studio-top">
        <button v-if="stage === 'edit'" type="button" class="bp-studio-icon" aria-label="Tomar otra foto" @click="retake">
          <q-icon name="arrow_back" size="24px" />
        </button>
        <button v-else type="button" class="bp-studio-icon" aria-label="Cerrar" @click="$emit('update:modelValue', false)">
          <q-icon name="close" size="24px" />
        </button>
        <div class="bp-studio-title">
          <strong>{{ stage === 'edit' ? '¡Decora tu foto!' : 'Tomar foto' }}</strong>
          <span v-if="title">{{ title }}</span>
        </div>
        <span class="bp-studio-icon bp-studio-icon--ghost" />
      </header>

      <!-- ─────────────── camera ─────────────── -->
      <template v-if="stage === 'camera'">
        <div class="bp-studio-view">
          <video
            v-show="!camError"
            ref="video"
            class="bp-studio-video"
            :class="{ 'is-mirror': facing === 'user' }"
            autoplay muted playsinline
          />
          <div v-if="camError" class="bp-studio-nocam">
            <q-icon name="no_photography" size="48px" />
            <p>{{ camError }}</p>
            <button type="button" class="bp-submit" @click="gallery.click()">
              <q-icon name="photo_library" size="20px" /> Elegir una foto
            </button>
          </div>
        </div>

        <div class="bp-studio-controls">
          <button type="button" class="bp-studio-round" aria-label="Elegir de la galería" @click="gallery.click()">
            <q-icon name="photo_library" size="26px" />
          </button>
          <button
            type="button"
            class="bp-studio-shutter"
            aria-label="Tomar foto"
            :disabled="!ready"
            @click="shoot"
          />
          <button
            type="button"
            class="bp-studio-round"
            :class="{ 'is-hidden': !canFlip }"
            aria-label="Cambiar de cámara"
            @click="flip"
          >
            <q-icon name="cameraswitch" size="26px" />
          </button>
        </div>
      </template>

      <!-- ─────────────── stickers ─────────────── -->
      <template v-else>
        <div class="bp-studio-view">
          <div
            ref="box"
            class="bp-studio-photo"
            :style="photoStyle"
            @pointerdown.self="selected = null"
          >
            <img :src="photo.url" alt="Tu foto" class="bp-studio-shot" draggable="false" @pointerdown="selected = null" />
            <div
              v-for="st in stickers"
              :key="st.id"
              class="bp-sticker"
              :class="{ 'is-on': selected === st.id }"
              :style="{ left: `${st.x * 100}%`, top: `${st.y * 100}%`, width: `${st.s * 100}%`, zIndex: st.z, transform: `translate(-50%, -50%) rotate(${st.r}deg)` }"
              @pointerdown="grab($event, st, 'move')"
              @pointermove="drag"
              @pointerup="drop"
              @pointercancel="drop"
            >
              <img :src="st.src" alt="" draggable="false" />
              <template v-if="selected === st.id">
                <button type="button" class="bp-sticker-x" aria-label="Quitar sticker" @pointerdown.stop @click="remove(st)">
                  <q-icon name="close" size="16px" />
                </button>
                <span class="bp-sticker-turn" aria-label="Girar y cambiar tamaño" @pointerdown.stop="grab($event, st, 'turn')">
                  <q-icon name="open_in_full" size="15px" />
                </span>
              </template>
            </div>
          </div>
        </div>

        <div class="bp-studio-tray">
          <div class="bp-studio-hint">Toca un sticker para ponerlo. Arrástralo, y gíralo o agrándalo con <q-icon name="open_in_full" size="13px" />.</div>
          <div class="bp-studio-groups" role="tablist">
            <button
              v-for="g in groups"
              :key="g.key"
              type="button"
              role="tab"
              class="bp-studio-group"
              :class="{ 'is-on': group === g.key }"
              :aria-selected="group === g.key"
              @click="group = g.key"
            >
              {{ g.label }}
            </button>
          </div>
          <div class="bp-studio-picks">
            <button
              v-for="(src, i) in currentGroup.items"
              :key="i"
              type="button"
              class="bp-studio-pick"
              @click="add(src)"
            >
              <img :src="src" alt="" draggable="false" />
            </button>
          </div>

          <p v-if="sendError" class="bp-auth-error q-mt-sm q-mb-none">{{ sendError }}</p>
          <button type="button" class="bp-submit q-mt-sm" :disabled="sending" @click="finish">
            <q-icon name="send" size="18px" /> {{ sending ? 'Enviando…' : 'Enviar a mis papás' }}
          </button>
        </div>
      </template>

      <input ref="gallery" type="file" accept="image/*" class="hidden" @change="fromGallery" />
    </div>
  </q-dialog>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { avatarUri } from '@/lib/avatar'
import { currentUser } from '@/lib/session'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // the mission, shown under the header
  title: { type: String, default: '' },
  // async (file) => void — throws to keep the studio open with the error
  send: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue'])

// px — evidence is looked at on a phone or in a dialog; more is weight, not detail
const MAX_SIDE = 1280

// ------------------------------------------------------------------ stickers

const svgUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

// The kid's own face, pulling faces. Picked from the style's parts by eye.
const MOODS = [
  { eyes: 'variant19', eyebrows: 'variant12', mouth: 'variant26' }, // feliz
  { eyes: 'variant21', eyebrows: 'variant10', mouth: 'variant28' }, // guiño
  { eyes: 'variant23', eyebrows: 'variant11', mouth: 'variant15' }, // ¡sorpresa!
  { eyes: 'variant23', eyebrows: 'variant13', mouth: 'variant24' }, // me encanta
  { eyes: 'variant01', eyebrows: 'variant09', mouth: 'variant16' }, // lengua
  { eyes: 'variant17', eyebrows: 'variant02', mouth: 'variant29' }, // cool
  { eyes: 'variant20', eyebrows: 'variant10', mouth: 'variant17' }, // beso
  { eyes: 'variant08', eyebrows: 'variant03', mouth: 'variant13' }, // guácala
]

/** The face, round, with a white ring — a sticker, not a square photo. */
function faceSticker (mood) {
  const me = currentUser.value
  const saved = (() => { try { return JSON.parse(me?.avatar || 'null') ?? {} } catch { return {} } })()
  const uri = avatarUri({ ...saved, ...mood }, me?.id)
  const face = decodeURIComponent(uri.slice(uri.indexOf(',') + 1))
  const root = face.match(/<svg[^>]*>/)[0]
  const nested = face.replace(root, root.replace(/\s(width|height|x|y)="[^"]*"/g, '').replace('<svg', '<svg x="16" y="16" width="368" height="368"'))
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs><clipPath id="bp-st-clip"><circle cx="200" cy="200" r="184"/></clipPath></defs>
    <circle cx="200" cy="200" r="198" fill="#fff"/>
    <g clip-path="url(#bp-st-clip)">${nested}</g>
  </svg>`)
}

/** A comic burst with a word on it. */
function burst ([word, fill, bg]) {
  const pts = []
  for (let i = 0; i < 28; i++) {
    const rr = i % 2 ? 70 : 96
    const a = (Math.PI * i) / 14
    pts.push(`${(100 + rr * Math.cos(a)).toFixed(1)},${(100 + rr * Math.sin(a) * 0.82).toFixed(1)}`)
  }
  const len = Math.min(170, word.length * 29)
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <polygon points="${pts.join(' ')}" fill="${bg}" stroke="#0B2A5B" stroke-width="5" stroke-linejoin="round"/>
    <text x="100" y="100" dy="15" text-anchor="middle" transform="rotate(-8 100 100)"
      font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="42"
      textLength="${len}" lengthAdjust="spacingAndGlyphs"
      fill="${fill}" stroke="#0B2A5B" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${word}</text>
  </svg>`)
}

const WORDS = [
  ['¡WOW!', '#FF4FA0', '#FFE14D'],
  ['¡YUPI!', '#FFFFFF', '#1467E4'],
  ['¡POW!', '#FFE14D', '#FF5A36'],
  ['¡ZAS!', '#FFFFFF', '#7C4DEF'],
  ['¡LISTO!', '#16A66A', '#FFFFFF'],
  ['¡GUÁCALA!', '#B6F03C', '#6B3FA0'],
]

const EMOJI = ['🌱', '🌳', '🌍', '♻️', '💧', '⭐', '🦋', '🌈', '🐝', '☀️']
const emoji = (e) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><text x="100" y="100" dy="52" text-anchor="middle" font-size="150">${e}</text></svg>`)

const groups = computed(() => [
  { key: 'caras', label: 'Mis caras', items: MOODS.map(faceSticker) },
  { key: 'palabras', label: '¡Onomatopeyas!', items: WORDS.map(burst) },
  { key: 'planeta', label: 'Planeta', items: EMOJI.map(emoji) },
])
const group = ref('caras')
const currentGroup = computed(() => groups.value.find(g => g.key === group.value))

// ------------------------------------------------------------------ camera

const stage = ref('camera') // 'camera' | 'edit'
const video = ref(null)
const gallery = ref(null)
const facing = ref('environment') // the mission, not the kid — flip for a selfie
const canFlip = ref(false)
const ready = ref(false)
const camError = ref('')
let stream = null

function stopCamera () {
  stream?.getTracks().forEach(t => t.stop())
  stream = null
  ready.value = false
}

async function startCamera () {
  stopCamera()
  camError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    camError.value = 'Este navegador no deja usar la cámara. Elige una foto de tu galería.'
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing.value }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
    await nextTick()
    if (!video.value) return stopCamera() // closed while the permission prompt was up
    video.value.srcObject = stream
    // Ready once frames have a size; play() can stay pending (e.g. a tab in
    // the background) and must not hold the shutter hostage.
    video.value.onloadedmetadata = () => { ready.value = true }
    video.value.play().catch(() => {})
    // Labels and the full list only show up once permission is granted.
    const devices = await navigator.mediaDevices.enumerateDevices()
    canFlip.value = devices.filter(d => d.kind === 'videoinput').length > 1
  } catch (err) {
    camError.value = err?.name === 'NotAllowedError'
      ? 'No diste permiso para usar la cámara. Puedes activarlo en tu navegador o elegir una foto.'
      : 'No encontramos una cámara. Elige una foto de tu galería.'
  }
}

function flip () {
  facing.value = facing.value === 'user' ? 'environment' : 'user'
  startCamera()
}

// ------------------------------------------------------------------ photo

const photo = ref(null) // { url, w, h, canvas }

function setPhoto (source, w, h, mirror = false) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * k)
  canvas.height = Math.round(h * k)
  const ctx = canvas.getContext('2d')
  // A selfie is kept the way the kid saw it on screen.
  if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  // A data: URL for the preview: the CSP allows data: images, not blob: ones.
  photo.value = { url: canvas.toDataURL('image/jpeg', 0.92), w: canvas.width, h: canvas.height, canvas }
  stage.value = 'edit'
  stopCamera()
}

function shoot () {
  const v = video.value
  if (!v?.videoWidth) return
  setPhoto(v, v.videoWidth, v.videoHeight, facing.value === 'user')
}

async function fromGallery (event) {
  const file = event.target.files?.[0]
  event.target.value = '' // the same file picked again must still fire
  if (!file) return
  try {
    // Not through an <img>: the CSP blocks blob: image URLs.
    const bmp = await createImageBitmap(file)
    setPhoto(bmp, bmp.width, bmp.height)
    bmp.close()
  } catch {
    camError.value = 'Esa imagen no se pudo abrir. Prueba con otra (JPG o PNG).'
  }
}

function retake () {
  stickers.value = []
  selected.value = null
  sendError.value = ''
  stage.value = 'camera'
  startCamera()
}

// The photo box keeps the shot's shape and fits the space above the tray.
const photoStyle = computed(() => photo.value && {
  aspectRatio: `${photo.value.w} / ${photo.value.h}`,
  width: `min(100%, calc((100dvh - 330px) * ${(photo.value.w / photo.value.h).toFixed(4)}))`,
})

// -------------------------------------------------------- placing stickers

// Position and size are fractions of the photo box, so the same numbers
// place them on the full-size canvas at the end.
const stickers = ref([]) // { id, src, x, y, s, r, z }
const selected = ref(null)
let nextId = 1

function add (src) {
  const st = { id: nextId, z: nextId++, src, x: 0.5, y: 0.5, s: 0.32, r: Math.round(Math.random() * 20 - 10) }
  stickers.value.push(st)
  selected.value = st.id
}

function remove (st) {
  stickers.value = stickers.value.filter(s => s !== st)
  selected.value = null
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
let grip = null

function grab (e, st, mode) {
  e.preventDefault()
  selected.value = st.id
  // Last touched goes on top. By z-index: reordering the list would move the
  // node, and a moved node loses its pointer capture mid-drag.
  st.z = nextId++
  const rect = box.value.getBoundingClientRect()
  const cx = rect.left + st.x * rect.width
  const cy = rect.top + st.y * rect.height
  grip = {
    st, mode, rect, cx, cy,
    px: e.clientX, py: e.clientY, x0: st.x, y0: st.y, s0: st.s, r0: st.r,
    d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
    a0: Math.atan2(e.clientY - cy, e.clientX - cx),
  }
  e.currentTarget.setPointerCapture?.(e.pointerId)
}

function drag (e) {
  if (!grip) return
  const { st, rect } = grip
  if (grip.mode === 'move') {
    st.x = clamp(grip.x0 + (e.clientX - grip.px) / rect.width, 0, 1)
    st.y = clamp(grip.y0 + (e.clientY - grip.py) / rect.height, 0, 1)
  } else {
    // The corner handle: distance from the centre sizes it, angle turns it.
    st.s = clamp(grip.s0 * Math.hypot(e.clientX - grip.cx, e.clientY - grip.cy) / grip.d0, 0.08, 1.2)
    st.r = grip.r0 + (Math.atan2(e.clientY - grip.cy, e.clientX - grip.cx) - grip.a0) * 180 / Math.PI
  }
}

function drop () { grip = null }

const box = ref(null)

// ------------------------------------------------------------------ send

const sending = ref(false)
const sendError = ref('')

async function flatten () {
  const { canvas: shot, w, h } = photo.value
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  ctx.drawImage(shot, 0, 0)
  for (const st of [...stickers.value].sort((a, b) => a.z - b.z)) {
    const img = new Image()
    img.src = st.src
    await img.decode()
    const size = st.s * w
    ctx.save()
    ctx.translate(st.x * w, st.y * h)
    ctx.rotate(st.r * Math.PI / 180)
    ctx.drawImage(img, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
  // WebP where the browser can encode it (Chrome, Android, Firefox): about a
  // third smaller than JPEG at the same look. Safari hands back a PNG when
  // asked for WebP, so it gets JPEG. ponytail: no AVIF — no browser encodes it
  // from a canvas; it would take a WASM encoder, slow on a phone.
  const encode = (type, q) => new Promise(resolve => out.toBlob(resolve, type, q))
  let blob = await encode('image/webp', 0.8)
  if (blob?.type !== 'image/webp') blob = await encode('image/jpeg', 0.82)
  return new File([blob], blob.type === 'image/webp' ? 'mision.webp' : 'mision.jpg', { type: blob.type })
}

async function finish () {
  sending.value = true
  sendError.value = ''
  selected.value = null
  try {
    await props.send(await flatten())
    emit('update:modelValue', false)
  } catch (err) {
    sendError.value = err?.data?.error || 'No se pudo enviar. Inténtalo de nuevo.'
  } finally {
    sending.value = false
  }
}

function reset () {
  stopCamera()
  photo.value = null
  stickers.value = []
  selected.value = null
  sendError.value = ''
  camError.value = ''
  stage.value = 'camera'
}

onBeforeUnmount(reset)
</script>

<style scoped>
.bp-studio {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: radial-gradient(120% 80% at 50% 0%, #15315F 0%, #0A1733 70%);
  color: #fff;
  overflow: hidden;
}

.bp-studio-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: max(12px, env(safe-area-inset-top)) 16px 10px;
}

.bp-studio-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
}

.bp-studio-title strong { font-size: 17px; font-weight: 900; }

.bp-studio-title span {
  max-width: 100%;
  overflow: hidden;
  color: #A9C4EA;
  font-size: 12.5px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bp-studio-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, .12);
  color: #fff;
  cursor: pointer;
}

.bp-studio-icon--ghost { visibility: hidden; }

.bp-studio-view {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 0;
  padding: 0 16px;
}

.bp-studio-video {
  width: 100%;
  height: 100%;
  border-radius: 24px;
  background: #000;
  object-fit: cover;
}

.bp-studio-video.is-mirror { transform: scaleX(-1); }

.bp-studio-nocam {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 300px;
  color: #CFE1FB;
  font-weight: 700;
  text-align: center;
}

.bp-studio-nocam .bp-submit { width: auto; padding: 0 22px; }

.bp-studio-controls {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  padding: 18px 16px max(22px, env(safe-area-inset-bottom));
}

.bp-studio-round {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(180deg, rgba(255, 255, 255, .22), rgba(255, 255, 255, .1));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35), 0 8px 16px -8px rgba(0, 0, 0, .6);
  color: #fff;
  cursor: pointer;
}

.bp-studio-round.is-hidden { visibility: hidden; }

.bp-studio-shutter {
  width: 78px;
  height: 78px;
  border: 5px solid #fff;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #FFFFFF 0%, #DCE9FB 70%);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, .25), 0 12px 24px -8px rgba(0, 0, 0, .6);
  cursor: pointer;
  transition: transform .12s;
}

.bp-studio-shutter:active:not(:disabled) { transform: scale(.9); }
.bp-studio-shutter:disabled { opacity: .4; }

/* ── stickers ── */

.bp-studio-photo {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  border-radius: 18px;
  box-shadow: 0 18px 40px -16px rgba(0, 0, 0, .7);
  overflow: hidden;
  touch-action: none;
  user-select: none;
}

.bp-studio-shot {
  display: block;
  width: 100%;
  height: 100%;
}

.bp-sticker {
  position: absolute;
  aspect-ratio: 1;
  cursor: grab;
  touch-action: none;
}

.bp-sticker img {
  width: 100%;
  height: 100%;
  pointer-events: none;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .35));
}

.bp-sticker.is-on { outline: 2px dashed rgba(255, 255, 255, .9); outline-offset: 2px; border-radius: 8px; }

.bp-sticker-x,
.bp-sticker-turn {
  position: absolute;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 3px 8px rgba(0, 0, 0, .35);
  color: #fff;
  touch-action: none;
}

.bp-sticker-x { top: -14px; left: -14px; background: #E5484D; cursor: pointer; padding: 0; }
.bp-sticker-turn { right: -14px; bottom: -14px; background: #1467E4; cursor: nwse-resize; }

.bp-studio-tray {
  padding: 12px 16px max(16px, env(safe-area-inset-bottom));
  border-radius: 26px 26px 0 0;
  background: #fff;
  color: #0B2A5B;
  box-shadow: 0 -10px 30px -12px rgba(0, 0, 0, .5);
}

.bp-studio-hint {
  margin-bottom: 8px;
  color: #6F86A8;
  font-size: 11.5px;
  font-weight: 700;
  text-align: center;
}

.bp-studio-groups {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.bp-studio-group {
  flex: 1;
  padding: 7px 6px;
  border: 1.5px solid #E1ECFA;
  border-radius: 999px;
  background: #fff;
  color: #55708F;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}

.bp-studio-group.is-on { border-color: #1467E4; background: #EAF2FF; color: #1467E4; }

.bp-studio-picks {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px 8px;
  scrollbar-width: none;
}

.bp-studio-picks::-webkit-scrollbar { display: none; }

.bp-studio-pick {
  flex: 0 0 auto;
  width: 66px;
  height: 66px;
  padding: 6px;
  border: 0;
  border-radius: 18px;
  background: linear-gradient(180deg, #FFFFFF 0%, #F0F6FF 100%);
  box-shadow: inset 0 -2px 0 rgba(20, 103, 228, .1), 0 6px 12px -8px rgba(20, 103, 228, .5);
  cursor: pointer;
  transition: transform .12s;
}

.bp-studio-pick:active { transform: scale(.9); }
.bp-studio-pick img { width: 100%; height: 100%; }
</style>
