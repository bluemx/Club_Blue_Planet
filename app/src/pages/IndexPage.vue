<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Misiones Sugeridas"
      :subtitle="['Elige una misión y asígnasela', 'a uno o varios de tus hijos.']"
    />

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="star" color="primary" size="26px" />
        Toca una misión para asignarla. Tus hijos ganan puntos al completarla.
      </div>

      <q-inner-loading :showing="loading" />
      <p v-if="error" class="bp-auth-error">{{ error }}</p>
      <p v-if="message" class="bp-note-ok">{{ message }}</p>

      <template v-if="!loading && !error">
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
      </template>

      <q-btn
        to="/nueva"
        outline rounded no-caps
        icon="add"
        label="Crear mi propia misión"
        class="bp-cta"
      />
    </div>

    <div v-if="own.length" class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="auto_awesome" color="primary" size="26px" />
        Misiones de tu familia
      </div>

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
    </div>

    <AssignDialog
      v-model="assignOpen"
      :mission="picked"
      :children="children"
      @assigned="onAssigned"
    />
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import MissionRow from '@/components/MissionRow.vue'
import PageHeader from '@/components/PageHeader.vue'
import AssignDialog from '@/components/AssignDialog.vue'
import { missions, summary, useResource } from '@/lib/api'

const { data, loading, error } = useResource(missions)
const { data: summaryData } = useResource(summary)

const list = computed(() => data.value?.missions ?? [])
const suggested = computed(() => list.value.filter(m => !m.parentId))
const own = computed(() => list.value.filter(m => m.parentId))
const children = computed(() => summaryData.value?.children ?? [])

const assignOpen = ref(false)
const picked = ref(null)
const message = ref('')

function openAssign (mission) {
  picked.value = mission
  message.value = ''
  assignOpen.value = true
}

function onAssigned ({ mission, names }) {
  message.value = `"${mission.title}" asignada a ${names}.`
}
</script>

<style scoped>
.bp-note-ok {
  font-size: 11.5px;
  font-weight: 700;
  color: #16A66A;
  text-align: center;
  margin: 0 0 10px;
}
</style>
