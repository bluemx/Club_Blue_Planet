<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Revisar estadísticas"
      :subtitle="['Analiza el progreso de tus hijos', 'y motívalos a seguir adelante.']"
    />

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="insights" color="primary" size="26px" />
        Resumen general
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <template v-if="!loading && !error">
        <div class="row q-col-gutter-sm q-mb-md">
          <div v-for="s in stats" :key="s.label" class="col-4">
            <div class="bp-stat">
              <div class="bp-stat-value" :class="s.tone">{{ s.value }}</div>
              <div class="bp-stat-label">{{ s.label }}</div>
            </div>
          </div>
        </div>

        <div v-for="child in children" :key="child.id" class="q-mb-md">
          <div class="row items-center justify-between q-mb-xs">
            <span class="bp-row-title">{{ child.name }}</span>
            <span class="bp-points-pill">
              <q-icon name="star" size="14px" />
              {{ child.points }}
            </span>
          </div>
          <q-linear-progress
            rounded size="10px"
            :value="share(child.points)"
            color="primary"
            track-color="blue-1"
          />
        </div>

        <p v-if="!children.length" class="bp-hint">
          Agrega un hijo para ver su progreso.
        </p>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { summary, useResource } from '@/lib/api'

const { data, loading, error } = useResource(summary)

const children = computed(() => data.value?.children ?? [])
const totals = computed(() => data.value?.totals ?? {})

const stats = computed(() => [
  { value: totals.value.missions ?? 0, label: 'Misiones totales', tone: 'text-primary' },
  { value: totals.value.completed ?? 0, label: 'Completadas', tone: 'text-secondary' },
  { value: (totals.value.points ?? 0).toLocaleString('es-MX'), label: 'Puntos', tone: 'text-accent' },
])

// Bars are relative to the strongest child, so one child always reads full.
const top = computed(() => Math.max(1, ...children.value.map(c => c.points)))
const share = (points) => points / top.value
</script>

<style scoped>
.bp-stat {
  border: 1px solid #E8F0FB;
  border-radius: 18px;
  padding: 12px 6px;
  text-align: center;
}

.bp-stat-value {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
}

.bp-stat-label {
  font-size: 10.5px;
  font-weight: 600;
  color: #7C93B5;
  margin-top: 2px;
}
</style>
