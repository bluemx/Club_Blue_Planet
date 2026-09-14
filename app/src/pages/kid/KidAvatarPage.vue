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
          :class="{ 'is-on': (draft[part.key] ?? null) === v, 'is-swatch': part.swatch }"
          :aria-selected="(draft[part.key] ?? null) === v"
          :aria-label="v === null ? 'Ninguno' : `${part.label} ${v}`"
          @click="choose(v)"
        >
          <span v-if="part.swatch" class="bp-av-swatch" :style="{ background: `#${v}` }" />
          <span v-else-if="v === null" class="bp-av-none"><q-icon name="block" size="26px" /></span>
          <img v-else :src="thumb(v)" alt="" loading="lazy" draggable="false" />
        </button>
      </div>

      <p v-if="error" class="bp-auth-error q-mt-sm">{{ error }}</p>
      <p v-if="saved" class="bp-note-ok">¡Listo! Tus papás ya ven tu nuevo avatar.</p>

      <button type="button" class="bp-submit q-mt-md" :disabled="saving || !dirty" @click="save">
        {{ saving ? 'Guardando…' : 'Guardar mi avatar' }}
      </button>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { PARTS, parseAvatar, defaultAvatar, randomAvatar, avatarUri } from '@/lib/avatar'
import { currentUser } from '@/lib/session'
import { saveAvatar } from '@/lib/api'

const me = currentUser

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
const saved = ref(false)
const error = ref('')

function choose (v) {
  draft.value = { ...draft.value, [part.value.key]: v }
  pop.value++
  saved.value = false
}

function shuffle () {
  draft.value = randomAvatar()
  pop.value++
  saved.value = false
}

async function save () {
  saving.value = true
  error.value = ''
  try {
    const { avatar } = await saveAvatar(draft.value)
    savedJson.value = JSON.stringify(draft.value)
    // The session is cached; keep this screen and the others in step without a refetch.
    if (me.value) me.value = { ...me.value, avatar: JSON.stringify(avatar) }
    saved.value = true
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

.bp-av-option {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 18px;
  background: #F4F8FE;
  overflow: hidden;
  cursor: pointer;
  transition: transform .15s, border-color .15s;
}

.bp-av-option img {
  width: 100%;
  height: 100%;
}

.bp-av-option:active { transform: scale(.94); }

.bp-av-option.is-on {
  border-color: #1467E4;
  box-shadow: 0 6px 14px -6px rgba(20, 103, 228, .5);
}

.bp-av-swatch {
  width: 62%;
  height: 62%;
  border-radius: 50%;
  box-shadow: inset 0 -3px 6px rgba(0, 0, 0, .12), 0 2px 4px rgba(11, 43, 107, .12);
}

.bp-av-none {
  color: #A9BCD6;
}

@media (prefers-reduced-motion: reduce) {
  .bp-av-preview { animation: none; }
}
</style>
