<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Monitorear y aprobar"
      :subtitle="['Revisa el progreso de las misiones', 'y aprueba las tareas completadas.']"
    />

    <!-- Recurring missions: they come back by themselves; change days or stop here. -->
    <div v-if="routineList.length" class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="event_repeat" color="primary" size="26px" />
        Misiones que se repiten
      </div>
      <MissionRow
        v-for="r in routineList"
        :key="r.id"
        :by="{ id: r.childId, avatar: r.childAvatar }"
        :title="r.title"
        :subtitle="`${r.childName} · cada ${r.label}`"
        :icon="r.icon"
        :color="r.color"
        :points="r.points"
      >
        <template #trailing>
          <q-btn flat round dense icon="edit_calendar" color="primary" :aria-label="`Cambiar días de ${r.title}`" @click="openDays(r)" />
          <q-btn flat round dense icon="stop_circle" color="grey-6" :aria-label="`Dejar de repetir ${r.title}`" :loading="stoppingId === r.id" @click="stop(r)" />
        </template>
      </MissionRow>
    </div>

    <q-dialog v-model="daysOpen">
      <div class="bp-confirm">
        <h2 class="bp-confirm-title">¿Qué días?</h2>
        <p class="bp-confirm-text">{{ editingRoutine?.title }} · {{ editingRoutine?.childName }}</p>
        <div class="bp-days">
          <button
            v-for="(d, i) in DAY_LETTERS"
            :key="i"
            type="button"
            class="bp-day"
            :class="{ 'is-on': days.includes(i) }"
            :aria-pressed="days.includes(i)"
            @click="days = days.includes(i) ? days.filter(x => x !== i) : [...days, i]"
          >
            {{ d }}
          </button>
        </div>
        <div class="bp-confirm-foot q-mt-md">
          <q-btn v-close-popup flat rounded no-caps label="Cancelar" color="grey-7" class="col" />
          <button type="button" class="bp-submit col" :disabled="!days.length || savingDays" @click="saveDays">Guardar</button>
        </div>
      </div>
    </q-dialog>

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
          :subtitle="`${a.childName} · ${needsLook(a) ? '📷 Mandó una foto, ¡revísala!' : STATE[a.status].label}`"
          :icon="a.icon"
          :color="a.color"
          :points="a.points"
          :class="{ 'bp-row--photo': needsLook(a) }"
        >
          <template #trailing>
            <!-- The photo itself, not an icon: it's what the parent approves. -->
            <button
              v-if="a.hasPhoto"
              type="button"
              class="bp-thumb"
              :class="{ 'bp-thumb--new': needsLook(a) }"
              :aria-label="`Ver la foto de ${a.childName}`"
              @click="showPhoto(a)"
            >
              <img
                v-if="!brokenThumbs.has(a.id)"
                :src="photoUrl(a)"
                crossorigin="use-credentials"
                loading="lazy"
                alt=""
                @error="brokenThumbs.add(a.id)"
              />
              <q-icon v-else name="photo" size="26px" />
              <span class="bp-thumb-badge"><q-icon name="visibility" size="12px" />Ver</span>
            </button>
            <q-btn
              round unelevated size="sm"
              :color="a.status === 'lista' ? 'secondary' : 'grey-3'"
              :text-color="a.status === 'lista' ? 'white' : 'grey-6'"
              icon="check"
              :aria-label="checkLabel(a)"
              @click="needsLook(a) ? showPhoto(a) : toggle(a)"
            >
              <q-tooltip>{{ checkLabel(a) }}</q-tooltip>
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
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import { assignments, setAssignmentStatus, evidenceUrl, routines, updateRoutine, stopRoutine, useResource } from '@/lib/api'
import { onNotification } from '@/lib/notifications'
import { flyTo } from '@/lib/fly'

const STATE = {
  pendiente: { label: 'Por hacer' },
  revision: { label: 'Esperando tu revisión' },
  lista: { label: 'Aprobada' },
}

const { data, loading, error, reload } = useResource(assignments)

// ------------------------------------------------------------ routines
const { data: routineData, reload: reloadRoutines } = useResource(routines)
const routineList = computed(() => routineData.value?.routines ?? [])
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const stoppingId = ref(null)
const daysOpen = ref(false)
const editingRoutine = ref(null)
const days = ref([])
const savingDays = ref(false)

async function stop (r) {
  stoppingId.value = r.id
  try {
    await stopRoutine(r.id)
    await Promise.all([reloadRoutines({ quiet: true }), reload({ quiet: true })])
  } finally {
    stoppingId.value = null
  }
}

function openDays (r) {
  editingRoutine.value = r
  days.value = [...r.days]
  daysOpen.value = true
}

async function saveDays () {
  savingDays.value = true
  try {
    await updateRoutine(editingRoutine.value.id, days.value)
    daysOpen.value = false
    await reloadRoutines({ quiet: true })
  } finally {
    savingDays.value = false
  }
}
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

// Cache-bust so a replaced photo isn't served from the previous view. The
// thumbnail and the viewer share this URL, so opening it reuses the download.
const photoUrl = (a) => `${evidenceUrl(a.id)}?v=${a.reportedAt || 0}`
const photoSrc = computed(() => (viewing.value ? photoUrl(viewing.value) : ''))

// A photo waiting for review: the check opens it first, approval happens there.
const needsLook = (a) => a.status === 'revision' && !!a.hasPhoto
const checkLabel = (a) =>
  a.status === 'lista' ? 'Deshacer aprobación' : needsLook(a) ? 'Ver la foto y aprobar' : 'Aprobar'

// Thumbnails that failed to load fall back to an icon.
const brokenThumbs = reactive(new Set())

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

<style scoped>
.bp-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }

.bp-day {
  padding: 9px 0;
  border: 1.5px solid #E1ECFA;
  border-radius: 50%;
  background: #fff;
  color: #55708F;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.bp-day.is-on { border-color: #1467E4; background: #EAF2FF; color: #1467E4; }

/* A photo waiting for review stands out from the rest of the list. */
.bp-row--photo {
  border-color: #FFD27A;
  background: linear-gradient(90deg, #FFF8E8 0%, #FFFFFF 70%);
  box-shadow: 0 12px 24px -16px rgba(240, 150, 0, .7);
}

.bp-thumb {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-right: 10px;
  padding: 0;
  border: 3px solid #fff;
  border-radius: 16px;
  background: #EAF2FF;
  box-shadow: 0 2px 4px rgba(11, 43, 107, .12), 0 10px 18px -8px rgba(20, 103, 228, .45);
  color: #1467E4;
  overflow: hidden;
  cursor: pointer;
  transition: transform .18s cubic-bezier(.16, 1, .3, 1);
}

.bp-thumb:hover { transform: translateY(-2px) rotate(-2deg); }
.bp-thumb:active { transform: translateY(1px); }

.bp-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bp-thumb-badge {
  position: absolute;
  left: 50%;
  bottom: 3px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(11, 42, 91, .78);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  transform: translateX(-50%);
}

/* New evidence pulses until the parent opens it. */
.bp-thumb--new { animation: bp-thumb-ping 1.8s ease-out infinite; }

@keyframes bp-thumb-ping {
  0%   { box-shadow: 0 0 0 0 rgba(255, 176, 32, .75), 0 10px 18px -8px rgba(240, 150, 0, .5); }
  70%  { box-shadow: 0 0 0 10px rgba(255, 176, 32, 0), 0 10px 18px -8px rgba(240, 150, 0, .5); }
  100% { box-shadow: 0 0 0 0 rgba(255, 176, 32, 0), 0 10px 18px -8px rgba(240, 150, 0, .5); }
}

@media (prefers-reduced-motion: reduce) {
  .bp-thumb--new { animation: none; box-shadow: 0 0 0 3px #FFB020; }
  .bp-thumb:hover, .bp-thumb:active { transform: none; }
}
</style>
