<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Crear una misión"
      :subtitle="['Inventa una misión para tu familia', 'y ponle los puntos que valga.']"
    />

    <!-- AI ideas: a topic from the parent, pitched at one child's age. -->
    <div v-if="children.length" class="bp-sheet bp-ai">
      <div class="bp-sheet-note">
        <q-icon name="auto_awesome" color="purple" size="26px" />
        Ideas con IA para tu hijo
      </div>

      <KidPicker v-if="children.length > 1" v-model="aiChild" :children="children" label="¿Para quién?" class="q-mb-sm" />
      <p v-if="aiKid && !aiKid.birthYear" class="bp-ai-hint">
        Sin edad registrada. <router-link to="/hijos">Agrégala en Hijos</router-link> para ideas a su medida.
      </p>

      <div class="bp-field-label">¿Qué quieres trabajar?</div>
      <div class="bp-ideas">
        <button
          v-for="t in TOPICS"
          :key="t"
          type="button"
          class="bp-idea"
          :class="{ 'is-on': topic === t }"
          @click="topic = t"
        >
          {{ t }}
        </button>
      </div>
      <q-input
        v-model="topic"
        outlined dense rounded hide-bottom-space
        placeholder="O escribe otro tema"
        class="bp-field q-mb-sm"
        maxlength="80"
      />
      <button type="button" class="bp-submit bp-ai-go" :disabled="!topic.trim() || aiLoading || !aiChild" @click="askAi">
        <q-icon name="auto_awesome" size="18px" /> {{ aiLoading ? 'Pensando ideas…' : 'Sugerir misiones' }}
      </button>
      <p v-if="aiError" class="bp-auth-error q-mt-sm q-mb-none">{{ aiError }}</p>

      <div v-if="aiResults.length" class="q-mt-md">
        <div class="bp-field-label">Toca una para usarla</div>
        <MissionRow
          v-for="(i, n) in aiResults"
          :key="n"
          :title="i.title"
          :subtitle="i.subtitle"
          :icon="i.icon"
          :color="i.color"
          :points="i.points"
          tappable
          @click="useIdea(i)"
        />
      </div>
    </div>

    <div ref="formSheet" class="bp-sheet">
      <q-form @submit.prevent="save">
        <div class="bp-field-label">¿Qué hábito quieres reforzar?</div>
        <div class="bp-cat-grid q-mb-md" role="radiogroup" aria-label="Categoría">
          <button
            v-for="c in categories"
            :key="c.label"
            type="button"
            role="radio"
            class="bp-cat"
            :class="{ 'is-on': category.label === c.label }"
            :aria-checked="category.label === c.label"
            @click="category = c"
          >
            <span class="bp-row-badge" :class="c.color">
              <q-icon :name="c.icon" />
            </span>
            <span class="bp-cat-label">{{ c.label }}</span>
          </button>
        </div>

        <div class="bp-field-label">¿Qué hay que hacer?</div>
        <div v-if="category.ideas.length" class="bp-ideas" aria-label="Ideas">
          <button
            v-for="idea in category.ideas"
            :key="idea"
            type="button"
            class="bp-idea"
            :class="{ 'is-on': title === idea }"
            @click="title = idea"
          >
            {{ idea }}
          </button>
        </div>
        <q-input
          v-model="title"
          outlined dense rounded hide-bottom-space
          :placeholder="category.ideas.length ? 'O escribe la tuya' : 'Ej. Ayuda a tu abuela'"
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

        <div class="bp-field-label">¿Cuántos puntos vale?</div>
        <div class="bp-presets">
          <button
            v-for="p in PRESETS"
            :key="p.points"
            type="button"
            class="bp-preset"
            :class="{ 'is-on': points === p.points }"
            @click="points = p.points"
          >
            <strong>{{ p.points }}</strong> {{ p.label }}
          </button>
        </div>
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
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import AssignDialog from '@/components/AssignDialog.vue'
import KidPicker from '@/components/KidPicker.vue'
import MissionRow from '@/components/MissionRow.vue'
import { OrnIcon } from '@/components/authIcons'
import { createMission, summary, aiIdeas, useResource } from '@/lib/api'
import { CATEGORIES } from '@/lib/categories'

const router = useRouter()

const categories = CATEGORIES
// Rough guide to what a mission is worth; the +/− fine-tunes it.
const PRESETS = [
  { points: 20, label: 'fácil' },
  { points: 50, label: 'normal' },
  { points: 100, label: 'reto' },
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

// ------------------------------------------------------------ AI ideas
const TOPICS = ['Mejorar su higiene', 'Ser responsable', 'Aprender algo nuevo', 'Ayudar en casa', 'Comer mejor', 'Moverse más', 'Llevarse bien con sus hermanos']
const topic = ref('')
const aiChild = ref('')
const aiKid = computed(() => children.value.find(k => k.id === aiChild.value))
const aiLoading = ref(false)
const aiError = ref('')
const aiResults = ref([])
const formSheet = ref(null)

watch(children, (list) => { if (!aiChild.value && list.length) aiChild.value = list[0].id }, { immediate: true })

async function askAi () {
  aiLoading.value = true
  aiError.value = ''
  aiResults.value = []
  try {
    aiResults.value = (await aiIdeas(aiChild.value, topic.value.trim())).ideas
  } catch (err) {
    aiError.value = err.status === 429
      ? 'Pediste muchas ideas seguidas. Espera unos minutos.'
      : err.data?.error || 'No se pudieron pedir ideas.'
  } finally {
    aiLoading.value = false
  }
}

// Fill the form below with the idea; the parent reviews it and saves.
async function useIdea (i) {
  title.value = i.title
  subtitle.value = i.subtitle || ''
  category.value = categories.find(c => c.icon === i.icon) ?? categories[categories.length - 1]
  points.value = i.points
  await nextTick()
  formSheet.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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
.bp-ai {
  border: 1.5px solid #E4DAFF;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8F4FF 100%);
}

.bp-ai-hint {
  margin: 0 0 8px;
  color: #7A5400;
  font-size: 12px;
  font-weight: 600;
}

.bp-ai-go {
  background: linear-gradient(180deg, #A98BFF 0%, #7445EA 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .45), inset 0 -2px 0 rgba(70, 30, 160, .45), 0 14px 24px -10px rgba(124, 77, 239, .6);
}

.bp-cat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

@media (min-width: 600px) {
  .bp-cat-grid { grid-template-columns: repeat(4, 1fr); }
}

.bp-ideas,
.bp-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.bp-idea,
.bp-preset {
  padding: 7px 12px;
  border: 1.5px solid #E1ECFA;
  border-radius: 999px;
  background: #fff;
  color: #55708F;
  font: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}

.bp-preset { flex: 1; }
.bp-preset strong { color: #0B2A5B; }

.bp-idea.is-on,
.bp-preset.is-on {
  border-color: #1467E4;
  background: #EAF2FF;
  color: #1467E4;
}

.bp-preset.is-on strong { color: #1467E4; }

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
  text-align: center;
  line-height: 1.15;
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
