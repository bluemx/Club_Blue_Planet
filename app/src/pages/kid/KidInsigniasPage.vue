<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Obtén puntos e insignias"
      :subtitle="['Completa misiones, crea buenos hábitos', 'y gana insignias.']"
    />

    <div class="bp-sheet">
      <div class="bp-sheet-note justify-between">
        <span class="row items-center" style="gap: 10px">
          <q-icon name="workspace_premium" color="primary" size="26px" />
          Tus insignias
        </span>
        <span class="bp-points-pill">
          <q-icon name="star" size="14px" />
          {{ points }}
        </span>
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <div v-if="!loading" class="bp-badges">
        <div
          v-for="b in badges"
          :key="b.id"
          class="bp-badge"
          :class="{ 'is-locked': !b.earned }"
        >
          <span class="bp-badge-medal" :class="b.color">
            <q-icon :name="b.earned ? b.icon : 'lock'" />
          </span>
          <span class="bp-badge-label">{{ b.label }}</span>
          <span v-if="!b.earned" class="bp-badge-progress">{{ b.progress }}/{{ b.need }}</span>
        </div>
      </div>
    </div>

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="history" color="primary" size="26px" />
        Actividad reciente
      </div>

      <MissionRow
        v-for="a in recent"
        :key="a.id"
        :title="a.title"
        :subtitle="a.subtitle"
        :icon="a.icon"
        :color="a.color"
        :points="a.points"
      >
        <template #trailing>
          <q-icon name="check_circle" color="secondary" size="20px" />
        </template>
      </MissionRow>

      <p v-if="!recent.length && !loading" class="bp-hint">
        Cuando completes misiones aparecerán aquí.
      </p>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import { apiFetch } from '@/lib/auth'
import { assignments, summary, useResource } from '@/lib/api'

const { data: badgeData, loading, error } = useResource(() => apiFetch('/api/badges'))
const { data: assignData } = useResource(assignments)
const { data: summaryData } = useResource(summary)

const badges = computed(() => badgeData.value?.badges ?? [])
const points = computed(() => summaryData.value?.totals?.points ?? 0)
const recent = computed(() =>
  (assignData.value?.assignments ?? []).filter(a => a.status === 'lista').slice(0, 5)
)
</script>

<style scoped>
.bp-badges {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.bp-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 4px;
  border: 1px solid #EEF3FB;
  border-radius: 18px;
  text-align: center;
}

.bp-badge-medal {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.bp-badge-medal.blue   { background: linear-gradient(160deg, #EAF3FF, #C9E1FF); color: #1467E4; }
.bp-badge-medal.green  { background: linear-gradient(160deg, #E6FBF0, #C9F2DE); color: #16A66A; }
.bp-badge-medal.purple { background: linear-gradient(160deg, #F3EDFF, #E2D6FF); color: #7C4DEF; }
.bp-badge-medal.pink   { background: linear-gradient(160deg, #FFEDF5, #FFD6E8); color: #E8438E; }
.bp-badge-medal.amber  { background: linear-gradient(160deg, #FFF6E0, #FFE9B8); color: #E0A413; }

.bp-badge-label {
  font-size: 10px;
  font-weight: 700;
  color: #55708F;
  line-height: 1.25;
}

.bp-badge-progress {
  font-size: 9.5px;
  font-weight: 800;
  color: #A9BACF;
}

.bp-badge.is-locked .bp-badge-medal {
  background: #F1F5FA;
  color: #B7C6DA;
}

.bp-badge.is-locked .bp-badge-label {
  color: #A9BACF;
}
</style>
