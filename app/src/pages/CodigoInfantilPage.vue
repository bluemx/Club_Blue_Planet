<template>
  <q-page class="bp-gradient-bg bp-page-pad">
    <PageHeader
      title="Código para tu hijo"
      :subtitle="['Comparte este código para que entre', 'con su cuenta infantil.']"
    />

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="lock_clock" color="primary" size="26px" />
        El código cambia cada 24 horas o cuando generes uno nuevo.
      </div>

      <q-select
        v-if="children.length > 1"
        v-model="childId"
        :options="children"
        option-value="id"
        option-label="name"
        emit-value map-options
        outlined dense rounded
        label="¿Para cuál hijo?"
        class="bp-field q-mb-md"
        @update:model-value="regenerate"
      />

      <div class="bp-code-display">
        <span v-for="(char, i) in code" :key="i" class="bp-code-char">{{ char }}</span>
      </div>

      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <p class="bp-code-expiry">
        <q-icon name="schedule" size="14px" />
        Vence en {{ expiresIn }}
      </p>

      <div class="row q-gutter-sm q-mt-md">
        <q-btn
          outline rounded no-caps
          class="col"
          :icon="copied ? 'check' : 'content_copy'"
          :label="copied ? 'Copiado' : 'Copiar'"
          :disable="busy"
          :color="copied ? 'secondary' : 'primary'"
          @click="copy"
        />
        <q-btn
          unelevated rounded no-caps
          class="col"
          color="primary"
          icon="autorenew"
          label="Generar nuevo"
          :loading="busy"
          @click="regenerate"
        />
      </div>
    </div>

    <div class="bp-sheet">
      <div class="bp-sheet-note">
        <q-icon name="help_outline" color="primary" size="26px" />
        ¿Cómo lo usa tu hijo?
      </div>

      <div v-for="(s, i) in steps" :key="s" class="bp-row">
        <div class="bp-row-badge blue">{{ i + 1 }}</div>
        <div class="col">
          <div class="bp-row-title">{{ s }}</div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { copyToClipboard } from 'quasar'
import PageHeader from '@/components/PageHeader.vue'
import { useRoute } from 'vue-router'
import { apiFetch } from '@/lib/auth'

const route = useRoute()

const steps = [
  'Abre la app y toca "Cuenta infantil".',
  'Escribe los 6 dígitos de este código.',
  '¡Listo! Ya puede ver sus misiones.',
]

const children = ref([])
const childId = ref('')
const code = ref('······')
const expiresIn = ref('—')
const copied = ref(false)
const error = ref('')
const busy = ref(false)
let copyTimer

function formatRemaining (expiresAt) {
  const ms = Math.max(0, expiresAt - Date.now())
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h} h ${String(m).padStart(2, '0')} min`
}

async function regenerate () {
  if (!childId.value) return

  busy.value = true
  error.value = ''
  copied.value = false

  try {
    const issued = await apiFetch('/api/auth/kid-code/issue', {
      method: 'POST',
      body: JSON.stringify({ childId: childId.value }),
    })
    code.value = issued.code
    expiresIn.value = formatRemaining(issued.expiresAt)
  } catch (err) {
    error.value = err.status === 401
      ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
      : 'No se pudo generar el código. Inténtalo de nuevo.'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  const { children: list } = await apiFetch('/api/auth/kid-code/children')
  children.value = list

  if (!list.length) {
    error.value = 'Primero agrega a tu hijo.'
    return
  }

  // Honour ?hijo= coming from the children screen, else take the first.
  const wanted = route.query.hijo
  childId.value = list.some(c => c.id === wanted) ? wanted : list[0].id
  await regenerate()
})

async function copy () {
  try {
    await copyToClipboard(code.value)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // clipboard blocked (insecure context / denied) — leave the code on screen
  }
}

onUnmounted(() => clearTimeout(copyTimer))
</script>

<style scoped>
.bp-code-display {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 4px 0 2px;
}

.bp-code-char {
  flex: 1 1 0;
  max-width: 48px;
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: linear-gradient(180deg, #EAF3FF, #D8E9FF);
  border: 1.5px solid #C3DCFA;
  font-size: 23px;
  font-weight: 800;
  color: #0B2A5B;
}

.bp-code-expiry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 700;
  color: #7C93B5;
  margin: 10px 0 0;
}
</style>
