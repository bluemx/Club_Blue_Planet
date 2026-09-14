<template>
  <AuthShell
    compact
    back="/login"
    title="Cuenta infantil"
    subtitle="Pide a tus papás el código de 6 dígitos que aparece en su cuenta."
  >
    <CodeInput v-model="code" @complete="onComplete" />

    <p v-if="error" class="bp-code-error">{{ error }}</p>

    <button
      type="button"
      class="bp-submit q-mt-md"
      :disabled="code.length < 6"
      @click="onComplete(code)"
    >
      <OrnIcon /> Entrar a mi aventura <OrnIcon />
    </button>

    <p class="bp-hint">
      ¿El código no funciona?<br />
      Pídele a un adulto que genere uno nuevo.
    </p>

    <template #footer>
      ¿Eres un adulto?
      <router-link to="/login">Inicia sesión aquí</router-link>
    </template>
  </AuthShell>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import CodeInput from '@/components/CodeInput.vue'
import { OrnIcon } from '@/components/authIcons'
import { apiFetch } from '@/lib/auth'
import { invalidateSession } from '@/lib/session'

const router = useRouter()
const code = ref('')
const error = ref('')

const loading = ref(false)

async function onComplete (value) {
  if (value.length < 6 || loading.value) return

  loading.value = true
  error.value = ''

  try {
    await apiFetch('/api/auth/kid-code/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: value }),
    })
    invalidateSession()
    router.push('/kid')
  } catch (err) {
    error.value = err.status === 429
      ? 'Muchos intentos seguidos. Espera unos minutos.'
      : 'Ese código no es válido. Revísalo con tus papás.'
  } finally {
    loading.value = false
  }
}

watch(code, () => { error.value = '' })
</script>

<style scoped>
.bp-code-error {
  font-size: 11.5px;
  font-weight: 700;
  color: #E14B4B;
  text-align: center;
  margin: 8px 0 0;
}
</style>
