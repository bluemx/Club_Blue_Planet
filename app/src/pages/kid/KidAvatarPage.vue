<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Diseña tu avatar"
      :subtitle="['Así te verán tus papás', 'en la app.']"
    />

    <div class="bp-sheet">
      <div class="bp-av-stage">
        <!-- Re-keyed on every change so the preview pops with each choice. -->
        <img :key="pop" :src="preview" alt="Tu avatar" class="bp-av-preview" draggable="false" />
        <button type="button" class="bp-av-dice" @click="shuffle">
          <q-icon name="casino" size="18px" /> Sorpréndeme
        </button>
      </div>

      <div class="bp-av-parts" role="tablist" aria-label="Partes del avatar">
        <button
          v-for="p in PARTS"
          :key="p.key"
          type="button"
          role="tab"
          class="bp-av-part"
          :class="{ 'is-on': part.key === p.key }"
          :aria-selected="part.key === p.key"
          @click="partKey = p.key"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="bp-av-grid" role="listbox" :aria-label="part.label">
        <button
          v-for="v in part.values"
          :key="String(v)"
          type="button"
          role="option"
          class="bp-av-option"
          :class="{ 'is-on': (draft[part.key] ?? null) === v, 'is-swatch': part.swatch, 'is-locked': isLocked(part.key, v) }"
          :aria-selected="(draft[part.key] ?? null) === v"
          :aria-label="optionLabel(v)"
          @click="choose(v)"
        >
          <span v-if="part.swatch" class="bp-av-swatch" :style="{ background: `#${v}` }" />
          <span v-else-if="v === null" class="bp-av-none"><q-icon name="block" size="26px" /></span>
          <img v-else :src="thumb(v)" alt="" loading="lazy" draggable="false" />
          <span v-if="isLocked(part.key, v)" class="bp-av-lock"><q-icon name="lock" size="16px" /></span>
        </button>
      </div>

      <!-- What a locked piece needs, and how close the kid is. -->
      <div v-if="hint" class="bp-av-hint">
        <q-icon name="lock_open" size="22px" />
        <span>
          <strong>{{ hint.title }}</strong>: gana la insignia «{{ hint.badge }}».
          <template v-if="hint.need"> Llevas {{ hint.progress }} de {{ hint.need }}.</template>
        </span>
      </div>

      <p v-if="error" class="bp-auth-error q-mt-sm">{{ error }}</p>

      <button type="button" class="bp-submit q-mt-md" :disabled="saving || !dirty" @click="save">
        {{ saving ? 'Guardando…' : 'Guardar mi avatar' }}
      </button>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import {
  PARTS, parseAvatar, defaultAvatar, randomAvatar, avatarUri, unlockOf, pieceTitle,
} from '@/lib/avatar'
import { currentUser } from '@/lib/session'
import { apiFetch } from '@/lib/auth'
import { saveAvatar, useResource } from '@/lib/api'

const me = currentUser
const router = useRouter()

// Starts from what they saved, or the default face they've been seeing.
const initial = () => ({ ...(parseAvatar(me.value?.avatar) ?? defaultAvatar(me.value?.id)) })
const draft = ref(initial())
const savedJson = ref(JSON.stringify(draft.value))
const dirty = computed(() => JSON.stringify(draft.value) !== savedJson.value)

const partKey = ref(PARTS[0].key)
const part = computed(() => PARTS.find(p => p.key === partKey.value))

const pop = ref(0)
const preview = computed(() => avatarUri(draft.value))
const thumb = (v) => avatarUri({ ...draft.value, [part.value.key]: v }, null, part.value.zoom ?? null)

const saving = ref(false)
const error = ref('')

// Earned badges open pieces. Until they load, nothing that needs one is open.
const { data: badgeData } = useResource(() => apiFetch('/api/badges'))
const badges = computed(() => Object.fromEntries((badgeData.value?.badges ?? []).map(b => [b.id, b])))
const isLocked = (key, value) => {
  const badge = value && unlockOf(key, value)
  return !!badge && !badges.value[badge]?.earned
}
const optionLabel = (v) => {
  if (v === null) return 'Ninguno'
  const name = part.value.layer ? pieceTitle(part.value.key, v) : `${part.value.label} ${v}`
  return isLocked(part.value.key, v) ? `${name} (bloqueado)` : name
}

const hint = ref(null)

function choose (v) {
  if (isLocked(part.value.key, v)) {
    const b = badges.value[unlockOf(part.value.key, v)]
    hint.value = { title: pieceTitle(part.value.key, v), badge: b?.label ?? 'una insignia', progress: b?.progress, need: b?.need }
    return
  }
  hint.value = null
  draft.value = { ...draft.value, [part.value.key]: v }
  pop.value++
}

function shuffle () {
  hint.value = null
  draft.value = randomAvatar((key, value) => !isLocked(key, value))
  pop.value++
}

async function save () {
  saving.value = true
  error.value = ''
  try {
    const { avatar } = await saveAvatar(draft.value)
    savedJson.value = JSON.stringify(draft.value)
    // The session is cached; keep this screen and the others in step without a refetch.
    if (me.value) me.value = { ...me.value, avatar: JSON.stringify(avatar) }
    // Saved means done: back home, where the new face is the hero.
    router.push('/kid')
  } catch (err) {
    error.value = err.data?.error || 'No se pudo guardar. Inténtalo de nuevo.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bp-av-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 6px 0 14px;
}

.bp-av-preview {
  width: 148px;
  height: 148px;
  border-radius: 50%;
  box-shadow:
    0 0 0 5px #fff,
    0 0 0 7px #CFE1FB,
    0 18px 34px -12px rgba(20, 103, 228, .45);
  animation: bp-av-pop .35s cubic-bezier(.34, 1.56, .64, 1);
}

@keyframes bp-av-pop {
  0%   { transform: scale(.94); }
  100% { transform: scale(1); }
}

.bp-av-dice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 0;
  border-radius: 999px;
  background: #F3EDFF;
  color: #6D3BE0;
  font: inherit;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
}

.bp-av-parts {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 2px 10px;
  scrollbar-width: none;
}

.bp-av-parts::-webkit-scrollbar { display: none; }

.bp-av-part {
  flex: none;
  padding: 7px 12px;
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

.bp-av-part.is-on {
  border-color: #1467E4;
  background: #EAF2FF;
  color: #1467E4;
}

.bp-av-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
  max-height: 290px;
  overflow-y: auto;
  padding: 2px;
}

/* Square by padding, not aspect-ratio: iOS Safari sized the grid rows from
   aspect-ratio too short and the tiles piled on top of each other. The
   contents are placed over the padding box. */
.bp-av-option {
  position: relative;
  height: 0;
  padding: 0 0 calc(100% - 4px); /* minus the 2px borders */
  border: 2px solid transparent;
  border-radius: 18px;
  background: #F4F8FE;
  overflow: hidden;
  cursor: pointer;
  transition: transform .15s, border-color .15s;
}

.bp-av-option > img,
.bp-av-none {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.bp-av-option:active { transform: scale(.94); }

.bp-av-option.is-locked img {
  filter: grayscale(1);
  opacity: .45;
}

.bp-av-lock {
  position: absolute;
  right: 5px;
  bottom: 5px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #0B2A5B;
  color: #FFC531;
  box-shadow: 0 0 0 2px #fff;
}

.bp-av-hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 10px;
  padding: 11px 13px;
  border-radius: 16px;
  background: #FFF6E0;
  color: #7A5400;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.4;
}

.bp-av-hint .q-icon { flex: none; color: #C98A0B; }

.bp-av-option.is-on {
  border-color: #1467E4;
  box-shadow: 0 6px 14px -6px rgba(20, 103, 228, .5);
}

.bp-av-swatch {
  position: absolute;
  inset: 19%; /* a 62% circle, centred */
  border-radius: 50%;
  box-shadow: inset 0 -3px 6px rgba(0, 0, 0, .12), 0 2px 4px rgba(11, 43, 107, .12);
}

.bp-av-none {
  display: grid;
  place-items: center;
  color: #A9BCD6;
}

@media (prefers-reduced-motion: reduce) {
  .bp-av-preview { animation: none; }
}
</style>
