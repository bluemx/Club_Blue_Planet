<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Tu familia"
      :subtitle="['Así van tus hijos', 'y sus misiones.']"
    />

    <div class="bp-dash">
      <q-inner-loading :showing="loadingKids" />

      <!-- One card per child: face, points, and whether anything waits on you. -->
      <div v-for="k in kids" :key="k.id" class="bp-tile">
        <KidAvatar :avatar="k.avatar" :seed="k.id" :size="68" :alt="k.name" />
        <div class="bp-tile-name">{{ k.name }}</div>
        <div class="bp-points-pill">
          <q-icon name="star" size="14px" />
          {{ k.points.toLocaleString('es-MX') }}
        </div>
        <span class="bp-tile-meta">
          {{ k.active ? `${k.active} ${k.active === 1 ? 'misión activa' : 'misiones activas'}` : 'Sin misiones activas' }}
        </span>
        <span v-if="k.review" class="bp-tile-flag">{{ k.review }} por revisar</span>
      </div>

      <button type="button" class="bp-tile bp-tile--action" @click="suggestOpen = true">
        <span class="bp-row-badge amber"><q-icon name="lightbulb" /></span>
        <span class="bp-tile-title">Sugerencias de misiones</span>
        <span class="bp-tile-meta">{{ suggested.length }} ideas listas para asignar</span>
        <span class="bp-tile-cta">Ver sugerencias <q-icon name="chevron_right" size="16px" /></span>
      </button>

      <router-link
        to="/misiones"
        class="bp-tile bp-tile--action"
        :class="{ 'bp-tile--wide': kids.length % 2 === 1 }"
      >
        <span class="bp-row-badge blue"><q-icon name="assignment" /></span>
        <span class="bp-tile-title">Misiones</span>
        <span class="bp-tile-stats">
          <span><strong>{{ totals.active }}</strong>activas</span>
          <span><strong>{{ totals.done }}</strong>completadas</span>
        </span>
        <span v-if="totals.review" class="bp-tile-flag">{{ totals.review }} por revisar</span>
        <span class="bp-tile-cta">Ver misiones <q-icon name="chevron_right" size="16px" /></span>
      </router-link>
    </div>

    <!-- The suggestions that used to fill this page, one tap away. -->
    <q-dialog v-model="suggestOpen">
      <div class="bp-suggest">
        <header class="bp-suggest-head">
          <div>
            <h2 class="bp-suggest-title">Sugerencias de misiones</h2>
            <p class="bp-suggest-sub">Toca una para asignarla. Tus hijos ganan puntos al completarla.</p>
          </div>
          <q-btn v-close-popup flat round dense icon="close" color="grey-7" aria-label="Cerrar" />
        </header>

        <div class="bp-suggest-body">
          <q-inner-loading :showing="loadingCatalog" />
          <p v-if="message" class="bp-note-ok">{{ message }}</p>

          <MissionRow
            v-for="m in suggested"
            :key="m.id"
            :title="m.title"
            :subtitle="m.subtitle"
            :icon="m.icon"
            :color="m.color"
            :points="m.points"
            tappable
            @click="openAssign(m)"
          />

          <template v-if="own.length">
            <div class="bp-field-label q-mt-md">Misiones de tu familia</div>
            <MissionRow
              v-for="m in own"
              :key="m.id"
              :title="m.title"
              :subtitle="m.subtitle"
              :icon="m.icon"
              :color="m.color"
              :points="m.points"
              tappable
              @click="openAssign(m)"
            />
          </template>
        </div>

        <footer class="bp-suggest-foot">
          <q-btn to="/nueva" outline rounded no-caps icon="add" label="Crear mi propia misión" class="full-width" />
        </footer>
      </div>
    </q-dialog>

    <AssignDialog
      v-model="assignOpen"
      :mission="picked"
      :children="children"
      @assigned="onAssigned"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import AssignDialog from '@/components/AssignDialog.vue'
import KidAvatar from '@/components/KidAvatar.vue'
import { missions, summary, assignments, useResource } from '@/lib/api'
import { onNotification } from '@/lib/notifications'

const { data: catalog, loading: loadingCatalog } = useResource(missions)
const { data: summaryData, loading: loadingKids, reload: reloadSummary } = useResource(summary)
const { data: assignData, reload: reloadAssignments } = useResource(assignments)

const list = computed(() => catalog.value?.missions ?? [])
// Shipped suggestions have no family; a family's own missions carry its id.
// (This used to test parentId, dropped in migration 0006 — so every family
// mission was being listed as a suggestion.)
const suggested = computed(() => list.value.filter(m => !m.familyId))
const own = computed(() => list.value.filter(m => m.familyId))
const children = computed(() => summaryData.value?.children ?? [])
const all = computed(() => assignData.value?.assignments ?? [])

const kids = computed(() => children.value.map((k) => {
  const theirs = all.value.filter(a => a.childId === k.id)
  return {
    ...k,
    active: theirs.filter(a => a.status !== 'lista').length,
    review: theirs.filter(a => a.status === 'revision').length,
  }
}))

const totals = computed(() => ({
  active: all.value.filter(a => a.status !== 'lista').length,
  done: all.value.filter(a => a.status === 'lista').length,
  review: all.value.filter(a => a.status === 'revision').length,
}))

// A kid finishing a mission or asking for a reward changes these cards.
const off = onNotification((n) => {
  if (n.kind === 'revision' || n.kind === 'canje') {
    reloadAssignments({ quiet: true })
    reloadSummary({ quiet: true })
  }
})
onBeforeUnmount(off)

const suggestOpen = ref(false)
const assignOpen = ref(false)
const picked = ref(null)
const message = ref('')

function openAssign (mission) {
  picked.value = mission
  message.value = ''
  assignOpen.value = true
}

// The popup stays open, so several missions can go out in one sitting.
function onAssigned ({ mission, names }) {
  message.value = `"${mission.title}" asignada a ${names}.`
  reloadAssignments({ quiet: true })
}
</script>

<style scoped>
.bp-dash {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0 14px 14px;
  min-height: 120px;
}

@media (min-width: 600px) {
  .bp-dash { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
}

.bp-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px 14px;
  border: 1px solid #E8F0FB;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 43, 107, .05), 0 12px 26px -12px rgba(20, 103, 228, .24);
  color: inherit;
  font: inherit;
  text-align: center;
  text-decoration: none;
}

.bp-tile--action {
  cursor: pointer;
  transition: transform .18s, box-shadow .18s;
}

.bp-tile--action:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(11, 43, 107, .06), 0 18px 32px -14px rgba(20, 103, 228, .34);
}

.bp-tile--action:active { transform: scale(.98); }

/* An odd number of cards would leave the last one alone in its row. */
@media (max-width: 599px) {
  .bp-tile--wide { grid-column: span 2; }
}

.bp-tile .bp-row-badge { margin-bottom: 2px; }

.bp-tile-name {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
}

.bp-tile-title {
  font-size: 14.5px;
  font-weight: 800;
  line-height: 1.2;
}

.bp-tile-meta {
  font-size: 11.5px;
  font-weight: 700;
  color: #7C93B5;
  line-height: 1.3;
}

.bp-tile-flag {
  padding: 3px 9px;
  border-radius: 999px;
  background: #FFF4DC;
  color: #A36F00;
  font-size: 11px;
  font-weight: 800;
}

.bp-tile-stats {
  display: flex;
  gap: 16px;
  font-size: 11px;
  font-weight: 700;
  color: #7C93B5;
}

.bp-tile-stats strong {
  display: block;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
  color: #0B2A5B;
  font-variant-numeric: tabular-nums;
}

.bp-tile-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: auto;
  padding-top: 4px;
  font-size: 12px;
  font-weight: 800;
  color: #1467E4;
}

.bp-suggest {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 460px;
  max-height: 85vh;
  border-radius: 24px;
  background: #fff;
}

.bp-suggest-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 14px 12px 18px;
  border-bottom: 1px solid #E8F0FB;
}

.bp-suggest-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #0B2A5B;
}

.bp-suggest-sub {
  margin: 2px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: #7C93B5;
}

.bp-suggest-body {
  position: relative;
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 14px;
}

.bp-suggest-foot {
  padding: 12px 14px 16px;
  border-top: 1px solid #E8F0FB;
}

.bp-note-ok {
  margin: 0 0 10px;
  font-size: 11.5px;
  font-weight: 700;
  color: #16A66A;
  text-align: center;
}
</style>
