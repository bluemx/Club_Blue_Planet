<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Completa tareas y reporta"
      :subtitle="['Cumple tus misiones', 'y gana puntos para tus premios.']"
    />

    <!-- A daily prompt, not a settings link: the face is meant to change often. -->
    <router-link to="/kid/avatar" class="bp-sheet bp-me bp-me--hero">
      <span class="bp-me-name">¿Cómo te sientes hoy, {{ me?.name }}?</span>
      <KidAvatar :avatar="me?.avatar" :seed="me?.id" :size="168" class="bp-me-face" />
      <span class="bp-moods" aria-hidden="true">😄 😴 😎 🤪 🥳</span>
      <span class="bp-me-cta"><q-icon name="edit" size="16px" /> ¡Demuéstralo con tu avatar!</span>
    </router-link>

    <!-- The streak: why today's missions matter. -->
    <div v-if="streak" class="bp-sheet bp-streak">
      <span class="bp-streak-fire">🔥</span>
      <span class="col">
        <strong>¡{{ streak }} {{ streak === 1 ? 'día' : 'días' }} seguidos!</strong>
        <span>{{ doneToday ? '¡Hoy ya cumpliste! Vuelve mañana.' : 'Haz una misión hoy para no perder tu racha.' }}</span>
      </span>
    </div>

    <div class="bp-sheet">
      <div class="bp-sheet-note bp-note-warn">
        <q-icon name="family_restroom" color="primary" size="26px" />
        Si las tareas son fuera de casa, debes ir acompañado por tus papás o tutores.
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <p v-if="!loading && !latest.length" class="bp-hint">
        ¡No tienes misiones pendientes! 🎉
      </p>

      <!-- The newest three to do, then the way to the rest. -->
      <div class="bp-mtiles">
        <router-link
          v-for="a in latest"
          :key="a.id"
          to="/kid/misiones"
          class="bp-mtile"
          :class="`bp-mtile--${a.color || 'blue'}`"
        >
          <span class="bp-mtile-icon"><q-icon :name="a.icon || 'eco'" size="24px" /></span>
          <span class="bp-mtile-title">{{ a.title }}</span>
          <span class="bp-mtile-pts"><q-icon name="star" size="14px" /> +{{ a.points }}</span>
        </router-link>

        <router-link to="/kid/misiones" class="bp-mtile bp-mtile--all">
          <span class="bp-mtile-icon"><q-icon name="assignment_turned_in" size="24px" /></span>
          <span class="bp-mtile-title">Ver todas mis misiones</span>
          <q-icon name="arrow_forward" size="20px" class="bp-mtile-go" />
        </router-link>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KidAvatar from '@/components/KidAvatar.vue'
import { currentUser as me } from '@/lib/session'
import { assignments, summary, useResource } from '@/lib/api'

const { data, loading, error } = useResource(assignments)
const { data: summaryData } = useResource(summary)
const streak = computed(() => summaryData.value?.children?.[0]?.streak ?? 0)
// Mexico City day, like the API's streak.
const today = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10)
const doneToday = computed(() => (data.value?.assignments ?? [])
  .some(a => a.reportedAt && new Date(a.reportedAt - 6 * 3600e3).toISOString().slice(0, 10) === today()))
// The API sends newest first.
const latest = computed(() =>
  (data.value?.assignments ?? []).filter(a => a.status === 'pendiente').slice(0, 3)
)
</script>

<style scoped>
.bp-note-warn {
  align-items: flex-start;
}

.bp-streak {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #FFF4E6 0%, #FFE3C7 100%);
  border: 1.5px solid #FFD0A1;
}

.bp-streak-fire { font-size: 34px; line-height: 1; }
.bp-streak .col { display: flex; flex-direction: column; min-width: 0; }
.bp-streak strong { color: #B8420A; font-size: 17px; font-weight: 900; }
.bp-streak span:not(.bp-streak-fire) { color: #8A5A2B; font-size: 12.5px; font-weight: 700; }

.bp-moods {
  font-size: 20px;
  letter-spacing: 4px;
}

.bp-mtiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (min-width: 600px) {
  .bp-mtiles { grid-template-columns: repeat(4, 1fr); }
}

/* Soft 3D: top light, darker lower lip, coloured drop shadow. */
.bp-mtile {
  --c1: #5AA2FF;
  --c2: #1467E4;
  --lip: rgba(8, 60, 150, .45);
  --glow: rgba(20, 103, 228, .55);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 132px;
  padding: 14px;
  border-radius: 22px;
  background: linear-gradient(160deg, var(--c1) 0%, var(--c2) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .45),
    inset 0 -3px 0 var(--lip),
    0 2px 4px rgba(11, 43, 107, .12),
    0 14px 24px -10px var(--glow);
  color: #fff;
  text-decoration: none;
  overflow: hidden;
  transition: transform .18s cubic-bezier(.16, 1, .3, 1), box-shadow .18s;
}

/* A soft highlight blob, for the "gummy" look. */
.bp-mtile::before {
  content: '';
  position: absolute;
  top: -40%;
  right: -30%;
  width: 90%;
  height: 90%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, .28), rgba(255, 255, 255, 0) 70%);
  pointer-events: none;
}

.bp-mtile:hover { transform: translateY(-2px); }

.bp-mtile:active {
  transform: translateY(1px);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, .25), 0 1px 2px rgba(11, 43, 107, .12);
}

.bp-mtile--green  { --c1: #4FD69A; --c2: #13A065; --lip: rgba(6, 90, 55, .45);  --glow: rgba(22, 166, 106, .55); }
.bp-mtile--purple { --c1: #A98BFF; --c2: #7445EA; --lip: rgba(70, 30, 160, .45); --glow: rgba(124, 77, 239, .55); }
.bp-mtile--pink   { --c1: #FF86BA; --c2: #E23F88; --lip: rgba(150, 20, 80, .45); --glow: rgba(232, 67, 142, .55); }
.bp-mtile--amber  { --c1: #FFC857; --c2: #F08C00; --lip: rgba(150, 80, 0, .45);  --glow: rgba(240, 140, 0, .55); }

.bp-mtile--all {
  --lip: rgba(20, 103, 228, .14);
  --glow: rgba(20, 103, 228, .4);
  justify-content: center;
  background: linear-gradient(180deg, #FFFFFF 0%, #EAF2FF 100%);
  color: #1467E4;
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -3px 0 var(--lip),
    0 0 0 1.5px #CFE1FB,
    0 14px 24px -10px var(--glow);
}

.bp-mtile-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, .25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5);
}

.bp-mtile--all .bp-mtile-icon { background: #EAF2FF; }

.bp-mtile-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
  text-shadow: 0 1px 1px rgba(0, 0, 0, .12);
}

.bp-mtile--all .bp-mtile-title { text-shadow: none; }

.bp-mtile-pts {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: auto;
  padding: 3px 9px;
  border-radius: 999px;
  background: #fff;
  color: #0B2A5B;
  font-size: 12px;
  font-weight: 800;
}

.bp-mtile-pts .q-icon { color: #F5B400; }

.bp-mtile-go { position: absolute; right: 12px; bottom: 12px; }

@media (prefers-reduced-motion: reduce) {
  .bp-mtile:hover, .bp-mtile:active { transform: none; }
}
</style>
