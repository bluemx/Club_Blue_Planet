<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Completa tareas y reporta"
      :subtitle="['Cumple tus misiones', 'y gana puntos para tus premios.']"
    />

    <!-- Their own face, and the way into the editor. -->
    <router-link to="/kid/avatar" class="bp-sheet bp-me">
      <KidAvatar :avatar="me?.avatar" :seed="me?.id" :size="64" />
      <span class="bp-me-text">
        <span class="bp-me-name">¡Hola, {{ me?.name }}!</span>
        <span class="bp-me-cta">{{ me?.avatar ? 'Cambiar mi avatar' : '¡Diseña tu avatar!' }}</span>
      </span>
      <q-icon name="chevron_right" size="24px" color="primary" />
    </router-link>

    <div class="bp-sheet">
      <div class="bp-sheet-note bp-note-warn">
        <q-icon name="family_restroom" color="primary" size="26px" />
        Si las tareas son fuera de casa, debes ir acompañado por tus papás o tutores.
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <MissionRow
        v-for="a in pending"
        :key="a.id"
        :title="a.title"
        :subtitle="a.subtitle"
        :icon="a.icon"
        :color="a.color"
        :points="a.points"
        tappable
      />

      <p v-if="!loading && !pending.length" class="bp-hint">
        ¡No tienes misiones pendientes! 🎉
      </p>

      <q-btn
        to="/kid/misiones"
        outline rounded no-caps
        icon="assignment_turned_in"
        label="Ver todas las misiones"
        class="bp-cta"
      />
    </div>

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="auto_awesome" color="primary" size="26px" />
        ¿Cómo reportar la tarea?
      </div>

      <div class="bp-report-grid">
        <button v-for="w in ways" :key="w.label" type="button" class="bp-report">
          <span class="bp-row-badge" :class="w.color">
            <q-icon :name="w.icon" />
          </span>
          <span class="bp-report-label">{{ w.label }}</span>
        </button>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import KidAvatar from '@/components/KidAvatar.vue'
import { currentUser as me } from '@/lib/session'
import { assignments, useResource } from '@/lib/api'

const { data, loading, error } = useResource(assignments)
const pending = computed(() =>
  (data.value?.assignments ?? []).filter(a => a.status !== 'lista')
)

const ways = [
  { label: 'Dibujo', icon: 'draw', color: 'purple' },
  { label: 'Foto', icon: 'photo_camera', color: 'blue' },
  { label: 'Video', icon: 'videocam', color: 'pink' },
  { label: 'Subir archivo', icon: 'upload', color: 'green' },
]
</script>

<style scoped>
.bp-note-warn {
  align-items: flex-start;
}

.bp-report-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.bp-report {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  border: 1px solid #EEF3FB;
  border-radius: 18px;
  background: linear-gradient(180deg, #FFFFFF 0%, #F5F9FF 100%);
  box-shadow: inset 0 -2px 0 rgba(20, 103, 228, .08), 0 8px 16px -10px rgba(20, 103, 228, .35);
  cursor: pointer;
  font-family: inherit;
  transition: border-color .18s, transform .18s;
}

.bp-report:active {
  transform: scale(.97);
  border-color: #B9D4F7;
}

.bp-report-label {
  font-size: 10px;
  font-weight: 700;
  color: #55708F;
  line-height: 1.2;
  text-align: center;
}
</style>
