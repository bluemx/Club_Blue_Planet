<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Mis misiones"
      :subtitle="['Aquí ves tus misiones', 'y todo lo que ya lograste.']"
    />

    <div class="bp-sheet">
      <!-- Same segments as the parents' Misiones; "Por hacer" is what matters. -->
      <div class="bp-seg" role="tablist">
        <button
          v-for="t in TABS"
          :key="t.status"
          :ref="(el) => { if (t.status === 'revision') revisionTab = el }"
          type="button"
          role="tab"
          class="bp-seg-btn"
          :class="{ 'bp-seg-btn--on': filter === t.status }"
          :aria-selected="filter === t.status"
          @click="filter = t.status"
        >
          {{ t.label }}
          <span
            :key="t.status === 'revision' ? `r${bumpRevision}` : t.status"
            class="bp-seg-count"
            :class="{ 'bp-seg-count--done': t.status === 'lista', 'bp-seg-count--bump': t.status === 'revision' && bumpRevision }"
          >
            {{ counts[t.status] }}
          </span>
        </button>
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <template v-if="!loading && !error">
        <TransitionGroup :key="filter" tag="div" name="bp-fly">
        <MissionRow
          v-for="a in visible"
          :key="a.id"
          :ref="(el) => setRow(a.id, el)"
          :title="a.title"
          :subtitle="a.subtitle"
          :icon="a.icon"
          :color="a.color"
          :points="a.points"
        >
          <template #trailing>
            <q-btn
              v-if="a.status === 'pendiente'"
              unelevated rounded no-caps size="sm"
              color="primary"
              icon="photo_camera"
              label="Tomar foto"
              :loading="busyId === a.id"
              @click="pick(a)"
            />
            <span v-else class="bp-state" :class="a.status">
              <q-icon :name="STATE[a.status].icon" size="14px" />
              {{ STATE[a.status].label }}
            </span>
          </template>
        </MissionRow>
        </TransitionGroup>


        <p v-if="!visible.length" class="bp-hint">
          {{ EMPTY[filter] }}
        </p>
      </template>
    </div>

    <PhotoStudio
      :model-value="!!target"
      :title="target?.title"
      :send="send"
      @update:model-value="(v) => { if (!v) target = null }"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import PhotoStudio from '@/components/PhotoStudio.vue'
import { assignments, uploadEvidence, useResource } from '@/lib/api'
import { onNotification } from '@/lib/notifications'
import { flyTo } from '@/lib/fly'

const STATE = {
  pendiente: { label: 'Por hacer', icon: 'radio_button_unchecked' },
  revision: { label: 'En revisión', icon: 'hourglass_top' },
  lista: { label: 'Lista', icon: 'check_circle' },
}

const TABS = [
  { status: 'pendiente', label: 'Por hacer' },
  { status: 'revision', label: 'En revisión' },
  { status: 'lista', label: 'Realizadas' },
]
const EMPTY = {
  pendiente: '¡Todo hecho! Pídele más misiones a tus papás.',
  revision: 'Nada esperando a tus papás.',
  lista: 'Aquí aparecerán las misiones que tus papás aprueben.',
}

const filter = ref('pendiente')
const busyId = ref(null)

const { data, loading, error, reload } = useResource(assignments)
const list = computed(() => data.value?.assignments ?? [])

// A new mission or an approval changes this list; refresh it in place.
const off = onNotification((n) => {
  if (n.kind === 'asignada' || n.kind === 'aprobada') reload({ quiet: true })
})
onBeforeUnmount(off)

const visible = computed(() => list.value.filter(a => a.status === filter.value))
const counts = computed(() => {
  const c = { pendiente: 0, revision: 0, lista: 0 }
  for (const a of list.value) c[a.status]++
  return c
})

const rows = new Map()
function setRow (id, comp) {
  if (comp?.$el) rows.set(id, comp.$el)
  else rows.delete(id)
}
let revisionTab = null
const bumpRevision = ref(0)

// The mission whose photo is being taken; the studio is open while it's set.
const target = ref(null)

function pick (a) {
  target.value = a
}

/** Called by the studio; a throw keeps it open, stickers and all, to retry. */
async function send (file) {
  const a = target.value
  busyId.value = a.id
  try {
    await uploadEvidence(a.id, file)
  } finally {
    busyId.value = null
  }
  target.value = null
  await nextTick()
  // In place, like the parent's approvals: the mission heads for "En
  // revisión" instead of the whole list reloading under the kid's finger.
  flyTo(rows.get(a.id), revisionTab).then(() => bumpRevision.value++)
  Object.assign(a, { status: 'revision', hasPhoto: 1, reportedAt: Date.now() })
}
</script>

<style scoped>
/* Three segments on a phone: a little tighter than the parents' two. */
.bp-seg-btn {
  gap: 5px;
  padding: 9px 4px;
  font-size: 12px;
}

.bp-state {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.bp-state.pendiente { background: #EEF3FB; color: #7C93B5; }
.bp-state.revision  { background: #FFF4DC; color: #C98A0B; }
.bp-state.lista     { background: #E3FBEE; color: #16A66A; }
</style>
