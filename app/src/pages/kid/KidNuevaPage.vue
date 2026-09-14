<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Propón tu aventura"
      :subtitle="['¿Se te ocurre una nueva misión?', '¡Cuéntanos y tus papás la revisan!']"
    />

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="lightbulb" color="primary" size="26px" />
        Piensa en algo que puedas hacer de verdad, en tu casa o tu escuela.
      </div>

      <q-input
        v-model="title"
        outlined dense rounded hide-bottom-space
        placeholder="Mi aventura es…"
        class="q-mb-md"
      />

      <div class="bp-field-label">¿De qué trata?</div>
      <div class="bp-cat-grid q-mb-md">
        <button
          v-for="c in categories"
          :key="c.label"
          type="button"
          class="bp-cat"
          :class="{ 'is-on': category === c.label }"
          @click="category = c.label"
        >
          <span class="bp-row-badge" :class="c.color">
            <q-icon :name="c.icon" />
          </span>
          <span class="bp-cat-label">{{ c.label }}</span>
        </button>
      </div>

      <div class="bp-field-label">¿Qué tan difícil es?</div>
      <q-btn-toggle
        v-model="difficulty"
        spread no-caps rounded unelevated
        toggle-color="primary"
        color="blue-1"
        text-color="primary"
        class="q-mb-md bp-toggle"
        :options="[
          { label: 'Fácil', value: 'facil' },
          { label: 'Media', value: 'media' },
          { label: 'Difícil', value: 'dificil' },
        ]"
      />

      <p v-if="error" class="bp-auth-error">{{ error }}</p>
      <p v-if="sent" class="bp-note-ok">¡Enviada! Tus papás la van a revisar.</p>

      <button
        type="button"
        class="bp-submit"
        :disabled="!title.trim() || saving"
        @click="send"
      >
        {{ saving ? 'Enviando…' : 'Enviar a mis papás' }}
      </button>

      <p class="bp-hint">Tus papás la revisarán antes de que sea una misión.</p>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { proposeMission } from '@/lib/api'

const title = ref('')
const saving = ref(false)
const error = ref('')
const sent = ref(false)
const category = ref('Orden')
const difficulty = ref('facil')

const categories = [
  { label: 'Orden', icon: 'bed', color: 'blue' },
  { label: 'Higiene', icon: 'clean_hands', color: 'green' },
  { label: 'Escuela', icon: 'school', color: 'amber' },
  { label: 'Lectura', icon: 'menu_book', color: 'purple' },
  { label: 'Ejercicio', icon: 'directions_run', color: 'green' },
  { label: 'Casa', icon: 'cleaning_services', color: 'pink' },
]

async function send () {
  const value = title.value.trim()
  if (!value || saving.value) return

  saving.value = true
  error.value = ''
  sent.value = false

  const chosen = categories.find(c => c.label === category.value)

  try {
    await proposeMission({
      title: value,
      difficulty: difficulty.value,
      icon: chosen?.icon,
      color: chosen?.color,
    })
    sent.value = true
    title.value = ''
  } catch (err) {
    error.value = err.data?.error || 'No se pudo enviar.'
  } finally {
    saving.value = false
  }
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

.bp-toggle {
  border: 1px solid #E8F0FB;
}
</style>
