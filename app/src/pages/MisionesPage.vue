<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Monitorear y aprobar"
      :subtitle="['Revisa el progreso de las misiones', 'y aprueba las tareas completadas.']"
    />

    <div class="bp-sheet">
      <!--
        "Completadas" doubles as the inbox: an approved mission flies into it
        and its counter takes the hit, so the parent sees where it went instead
        of watching the whole list reload.
      -->
      <div class="bp-seg" role="tablist">
        <button
          type="button"
          role="tab"
          class="bp-seg-btn"
          :class="{ 'bp-seg-btn--on': tab === 'activas' }"
          :aria-selected="tab === 'activas'"
          @click="tab = 'activas'"
        >
          <span ref="activeIcon" :key="`ai${bumpActive}`" class="bp-seg-icon" :class="{ 'bp-seg-icon--gulp': bumpActive }">
            <q-icon name="pending_actions" size="18px" />
          </span>
          Activas
          <span :key="`ac${bumpActive}`" class="bp-seg-count" :class="{ 'bp-seg-count--bump': bumpActive }">
            {{ active.length }}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          class="bp-seg-btn"
          :class="{ 'bp-seg-btn--on': tab === 'completadas' }"
          :aria-selected="tab === 'completadas'"
          @click="tab = 'completadas'"
        >
          <span ref="doneIcon" :key="`di${bumpDone}`" class="bp-seg-icon" :class="{ 'bp-seg-icon--gulp': bumpDone }">
            <q-icon name="inbox" size="18px" />
          </span>
          Completadas
          <span :key="`dc${bumpDone}`" class="bp-seg-count bp-seg-count--done" :class="{ 'bp-seg-count--bump': bumpDone }">
            {{ done.length }}
          </span>
        </button>
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>
      <p v-if="actionError" class="bp-auth-error q-mb-sm">{{ actionError }}</p>

      <!-- Keyed by tab: switching tabs swaps the list without playing the
           leave animation on every row. -->
      <TransitionGroup
        v-if="!loading && !error"
        :key="tab"
        tag="div"
        name="bp-fly"
      >
        <MissionRow
          v-for="a in shown"
          :key="a.id"
          :ref="(el) => setRow(a.id, el)"
          :by="{ id: a.childId, avatar: a.childAvatar }"
          :title="a.title"
          :subtitle="`${a.childName} · ${STATE[a.status].label}`"
          :icon="a.icon"
          :color="a.color"
          :points="a.points"
        >
          <template #trailing>
            <q-btn
              v-if="a.hasPhoto"
              flat round dense
              icon="photo"
              color="primary"
              @click="showPhoto(a)"
            >
              <q-tooltip>Ver la foto</q-tooltip>
            </q-btn>
            <q-btn
              round unelevated size="sm"
              :color="a.status === 'lista' ? 'secondary' : 'grey-3'"
              :text-color="a.status === 'lista' ? 'white' : 'grey-6'"
              icon="check"
              :aria-label="a.status === 'lista' ? 'Deshacer aprobación' : 'Aprobar'"
              @click="toggle(a)"
            >
              <q-tooltip>{{ a.status === 'lista' ? 'Deshacer aprobación' : 'Aprobar' }}</q-tooltip>
            </q-btn>
          </template>
        </MissionRow>
      </TransitionGroup>

      <p v-if="!loading && !error && !shown.length" class="bp-hint">
        {{ tab === 'activas'
          ? 'Nada por revisar. ¡Asigna una misión desde Inicio!'
          : 'Aquí llegan las misiones que apruebes.' }}
      </p>
    </div>

    <q-dialog v-model="photoOpen" @hide="onPhotoHidden">
      <div class="bp-photo">
        <header class="bp-photo-head">
          <div>
            <div class="bp-row-title">{{ viewing?.title }}</div>
            <div class="bp-row-subtitle">{{ viewing?.childName }}</div>
          </div>
          <q-btn v-close-popup flat round dense icon="close" color="grey-7" aria-label="Cerrar" />
        </header>

        <!-- The API is another origin: without use-credentials the browser
             drops the session cookie and the image 401s. -->
        <img
          v-if="viewing"
          :src="photoSrc"
          crossorigin="use-credentials"
          class="bp-photo-img"
          alt="Evidencia de la misión"
        />

        <footer class="bp-photo-foot">
          <q-btn v-close-popup flat rounded no-caps label="Cerrar" color="grey-7" class="col" />
          <button type="button" class="bp-submit col" @click="approveFromPhoto">
            Aprobar
          </button>
        </footer>
      </div>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import { assignments, setAssignmentStatus, evidenceUrl, useResource } from '@/lib/api'
import { onNotification } from '@/lib/notifications'
import { flyTo } from '@/lib/fly'

const STATE = {
  pendiente: { label: 'Por hacer' },
  revision: { label: 'Esperando tu revisión' },
  lista: { label: 'Aprobada' },
}

const { data, loading, error, reload } = useResource(assignments)
const list = computed(() => data.value?.assignments ?? [])

// Waiting-for-review first: that's the part of the list a parent acts on.
const ORDER = { revision: 0, pendiente: 1 }
const active = computed(() =>
  list.value
    .filter(a => a.status !== 'lista')
    .sort((x, y) => ORDER[x.status] - ORDER[y.status] || y.createdAt - x.createdAt)
)
const done = computed(() =>
  list.value
    .filter(a => a.status === 'lista')
    .sort((x, y) => (y.approvedAt ?? 0) - (x.approvedAt ?? 0))
)

const tab = ref('activas')
const shown = computed(() => (tab.value === 'activas' ? active.value : done.value))

// A kid finishing a mission changes this list; refresh it in place, no spinner.
const off = onNotification((n) => {
  if (n.kind === 'revision') reload({ quiet: true })
})
onBeforeUnmount(off)

// ------------------------------------------------------------ approve + fly

const rows = new Map()
function setRow (id, comp) {
  if (comp?.$el) rows.set(id, comp.$el)
  else rows.delete(id)
}

const activeIcon = ref(null)
const doneIcon = ref(null)
const bumpActive = ref(0)
const bumpDone = ref(0)
const inFlight = new Set()
const actionError = ref('')

/**
 * Optimistic: the row leaves at once and a copy flies to the other tab while
 * the request is in flight. The old version awaited the request and then
 * reloaded everything, which is what blanked the list on every tap.
 */
async function toggle (a) {
  if (inFlight.has(a.id)) return
  inFlight.add(a.id)
  actionError.value = ''

  const approving = a.status !== 'lista'
  const next = approving ? 'lista' : 'revision'
  const before = { status: a.status, approvedAt: a.approvedAt }

  // Read the row's position before the status change removes it from the list.
  flyTo(rows.get(a.id), approving ? doneIcon.value : activeIcon.value)
    .then(() => {
      // If the save already failed and put it back, don't celebrate a landing
      // on a counter that's about to go down again.
      if (a.status !== next) return
      approving ? bumpDone.value++ : bumpActive.value++
    })

  a.status = next
  a.approvedAt = approving ? Date.now() : null

  try {
    await setAssignmentStatus(a.id, next)
  } catch (err) {
    Object.assign(a, before)   // put it back where it was
    actionError.value = err.data?.error || 'No se pudo guardar. Inténtalo de nuevo.'
  } finally {
    inFlight.delete(a.id)
  }
}

// ------------------------------------------------------------------ photo

const photoOpen = ref(false)
const viewing = ref(null)
let approveAfterClose = null

// Cache-bust so a replaced photo isn't served from the previous view.
const photoSrc = computed(() =>
  viewing.value ? `${evidenceUrl(viewing.value.id)}?v=${viewing.value.reportedAt || 0}` : ''
)

function showPhoto (a) {
  viewing.value = a
  photoOpen.value = true
}

// Approve once the dialog is gone, so the row it flies from is on screen.
function approveFromPhoto () {
  approveAfterClose = viewing.value
  photoOpen.value = false
}

function onPhotoHidden () {
  const a = approveAfterClose
  approveAfterClose = null
  if (a && a.status !== 'lista') toggle(a)
}
</script>
