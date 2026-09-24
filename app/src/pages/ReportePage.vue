<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Reporte semanal"
      :subtitle="['Cómo les fue a tus hijos', 'semana a semana.']"
    />

    <div class="bp-sheet">
      <div class="bp-week">
        <q-btn flat round dense icon="chevron_left" color="primary" aria-label="Semana anterior" :disable="weeksAgo >= 12" @click="weeksAgo++" />
        <span class="bp-week-label">{{ weekLabel }}</span>
        <q-btn flat round dense icon="chevron_right" color="primary" aria-label="Semana siguiente" :disable="weeksAgo === 0" @click="weeksAgo--" />
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <div v-for="ch in report?.children ?? []" :key="ch.id" class="bp-kidrep">
        <div class="bp-kidrep-head">
          <KidAvatar :avatar="ch.avatar" :seed="ch.id" :size="48" />
          <div class="col">
            <div class="bp-row-title">{{ ch.name }}</div>
            <div class="bp-row-subtitle">
              <template v-if="ch.streak">🔥 Racha de {{ ch.streak }} {{ ch.streak === 1 ? 'día' : 'días' }}</template>
              <template v-else>Sin racha activa</template>
            </div>
          </div>
        </div>

        <div class="bp-kidrep-stats">
          <div>
            <strong>{{ ch.done }}</strong>
            <span>misiones</span>
            <em :class="trend(ch.done, ch.lastWeekDone).cls">{{ trend(ch.done, ch.lastWeekDone).text }}</em>
          </div>
          <div>
            <strong>{{ ch.points }}</strong>
            <span>puntos</span>
            <em :class="trend(ch.points, ch.lastWeekPoints).cls">{{ trend(ch.points, ch.lastWeekPoints).text }}</em>
          </div>
          <div>
            <strong>{{ ch.rewards }}</strong>
            <span>premios</span>
          </div>
        </div>

        <div v-if="ch.byIcon.length" class="bp-kidrep-kinds">
          <span v-for="k in ch.byIcon" :key="k.icon" class="bp-kind">
            <q-icon :name="k.icon" size="16px" /> {{ labelOf(k.icon) }} · {{ k.n }}
          </span>
        </div>
        <p v-else class="bp-hint q-my-sm">No aprobaste misiones de {{ ch.name }} esta semana.</p>

        <router-link v-if="ch.waiting && weeksAgo === 0" to="/misiones" class="bp-kidrep-waiting">
          {{ ch.waiting }} {{ ch.waiting === 1 ? 'misión espera' : 'misiones esperan' }} tu revisión <q-icon name="chevron_right" />
        </router-link>
      </div>

      <p class="bp-hint q-mt-md">
        Cada lunes te enviamos este resumen por correo. Puedes apagarlo en Cuenta.
      </p>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KidAvatar from '@/components/KidAvatar.vue'
import { weekReport } from '@/lib/api'
import { CATEGORIES } from '@/lib/categories'

const weeksAgo = ref(0)
const report = ref(null)
const loading = ref(true)
const error = ref('')

async function load () {
  loading.value = true
  error.value = ''
  try {
    report.value = await weekReport(weeksAgo.value)
  } catch {
    error.value = 'No se pudo cargar el reporte.'
  } finally {
    loading.value = false
  }
}
watch(weeksAgo, load, { immediate: true })

const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })
const weekLabel = computed(() => {
  if (!report.value) return ''
  const range = `${fmt.format(report.value.start)} – ${fmt.format(report.value.end - 1)}`
  return weeksAgo.value === 0 ? `Esta semana · ${range}` : range
})

function trend (now, before) {
  if (now > before) return { text: `↑ ${now - before}`, cls: 'up' }
  if (now < before) return { text: `↓ ${before - now}`, cls: 'down' }
  return { text: '= igual', cls: '' }
}

const labelOf = (icon) => CATEGORIES.find(c => c.icon === icon)?.label ?? 'Otras'
</script>

<style scoped>
.bp-week {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.bp-week-label { color: #0B2A5B; font-size: 14px; font-weight: 800; }

.bp-kidrep {
  padding: 14px 0;
  border-top: 1px solid #EEF3FB;
}

.bp-kidrep-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }

.bp-kidrep-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.bp-kidrep-stats > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  border-radius: 16px;
  background: linear-gradient(180deg, #F7FAFF, #EEF5FF);
}

.bp-kidrep-stats strong { color: #0B2A5B; font-size: 22px; font-weight: 900; line-height: 1.1; }
.bp-kidrep-stats span { color: #6F86A8; font-size: 11.5px; font-weight: 700; }
.bp-kidrep-stats em { font-style: normal; font-size: 11px; font-weight: 800; color: #7C93B5; }
.bp-kidrep-stats em.up { color: #16A66A; }
.bp-kidrep-stats em.down { color: #D9480F; }

.bp-kidrep-kinds { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }

.bp-kind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #EAF2FF;
  color: #1467E4;
  font-size: 12px;
  font-weight: 700;
}

.bp-kidrep-waiting {
  display: inline-flex;
  align-items: center;
  margin-top: 10px;
  color: #C98A0B;
  font-size: 12.5px;
  font-weight: 800;
  text-decoration: none;
}
</style>
