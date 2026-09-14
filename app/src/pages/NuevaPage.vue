<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Crear una misión"
      :subtitle="['Inventa una misión para tu familia', 'y ponle los puntos que valga.']"
    />

    <div class="bp-sheet">
      <q-form @submit.prevent="save">
        <div class="bp-field-label">¿Qué hay que hacer?</div>
        <q-input
          v-model="title"
          outlined dense rounded hide-bottom-space
          placeholder="Ej. Regar las plantas"
          class="bp-field q-mb-md"
          maxlength="80"
        />

        <div class="bp-field-label">Una pista para tu hijo (opcional)</div>
        <q-input
          v-model="subtitle"
          outlined dense rounded hide-bottom-space
          placeholder="Ej. Todas las mañanas antes de la escuela"
          class="bp-field q-mb-md"
          maxlength="120"
        />

        <div class="bp-field-label">Categoría</div>
        <div class="bp-cat-grid q-mb-md">
          <button
            v-for="c in categories"
            :key="c.label"
            type="button"
            class="bp-cat"
            :class="{ 'is-on': category.label === c.label }"
            @click="category = c"
          >
            <span class="bp-row-badge" :class="c.color">
              <q-icon :name="c.icon" />
            </span>
            <span class="bp-cat-label">{{ c.label }}</span>
          </button>
        </div>

        <div class="bp-field-label">¿Cuántos puntos vale?</div>
        <div class="bp-points-row q-mb-md">
          <q-btn round flat dense icon="remove" color="primary" @click="bump(-10)" />
          <span class="bp-points-value">
            <q-icon name="star" size="20px" />
            {{ points }}
          </span>
          <q-btn round flat dense icon="add" color="primary" @click="bump(10)" />
        </div>

        <p v-if="error" class="bp-auth-error q-mb-sm">{{ error }}</p>

        <button type="submit" class="bp-submit" :disabled="!title.trim() || saving">
          <OrnIcon /> {{ saving ? 'Guardando…' : 'Crear misión' }} <OrnIcon />
        </button>
      </q-form>
    </div>

    <AssignDialog
      v-model="assignOpen"
      :mission="created"
      :children="children"
      @assigned="onAssigned"
    />
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import AssignDialog from '@/components/AssignDialog.vue'
import { OrnIcon } from '@/components/authIcons'
import { createMission, summary, useResource } from '@/lib/api'

const router = useRouter()

const categories = [
  { label: 'Orden', icon: 'bed', color: 'blue' },
  { label: 'Higiene', icon: 'clean_hands', color: 'green' },
  { label: 'Escuela', icon: 'school', color: 'amber' },
  { label: 'Lectura', icon: 'menu_book', color: 'purple' },
  { label: 'Ejercicio', icon: 'directions_run', color: 'green' },
  { label: 'Casa', icon: 'cleaning_services', color: 'pink' },
]

const title = ref('')
const subtitle = ref('')
const category = ref(categories[0])
const points = ref(50)
const saving = ref(false)
const error = ref('')

const assignOpen = ref(false)
const created = ref(null)

const { data: summaryData } = useResource(summary)
const children = computed(() => summaryData.value?.children ?? [])

const bump = (n) => { points.value = Math.min(500, Math.max(10, points.value + n)) }

async function save () {
  const value = title.value.trim()
  if (!value) return

  saving.value = true
  error.value = ''

  try {
    created.value = await createMission({
      title: value,
      subtitle: subtitle.value.trim() || null,
      icon: category.value.icon,
      color: category.value.color,
      points: points.value,
    })
    // Creating a mission nobody has is useless — offer assignment right away.
    assignOpen.value = true
  } catch (err) {
    error.value = err.data?.error || 'No se pudo crear la misión.'
  } finally {
    saving.value = false
  }
}

function onAssigned () {
  router.push('/')
}
</script>

<style scoped>
.bp-cat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.bp-cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  border: 1.5px solid #EEF3FB;
  border-radius: 18px;
  background: #fff;
  cursor: pointer;
  font-family: inherit;
  transition: border-color .18s, background .18s;
}

.bp-cat.is-on {
  border-color: #1467E4;
  background: #F2F7FF;
}

.bp-cat-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #55708F;
}

.bp-points-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8px;
  border: 1px solid #E8F0FB;
  border-radius: 18px;
}

.bp-points-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 26px;
  font-weight: 800;
  color: #0B2A5B;
  min-width: 90px;
  justify-content: center;
}

.bp-points-value .q-icon {
  color: #FFC531;
}
</style>
