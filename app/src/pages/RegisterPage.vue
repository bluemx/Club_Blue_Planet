<template>
  <AuthShell
    compact
    back="/login"
    title="Crea tu cuenta"
    subtitle="Crea buenos hábitos en familia"
  >
    <q-form class="bp-auth-form" @submit.prevent="onSubmit">
      <q-input
        v-model="name"
        outlined dense rounded hide-bottom-space
        placeholder="Nombre completo"
        class="bp-field"
        :error="touched && !name"
      >
        <template #prepend>
          <span class="bp-field-tile"><UserIcon /></span>
        </template>
      </q-input>

      <q-input
        v-model="email"
        outlined dense rounded hide-bottom-space
        type="email"
        placeholder="Correo electrónico"
        class="bp-field"
        :error="touched && !validEmail"
      >
        <template #prepend>
          <span class="bp-field-tile"><MailIcon /></span>
        </template>
      </q-input>

      <q-input
        v-model="password"
        outlined dense rounded hide-bottom-space
        :type="showPass ? 'text' : 'password'"
        placeholder="Contraseña"
        class="bp-field"
        :error="touched && password.length < 8"
      >
        <template #prepend>
          <span class="bp-field-tile"><LockIcon /></span>
        </template>
        <template #append>
          <q-icon
            :name="showPass ? 'visibility_off' : 'visibility'"
            class="cursor-pointer bp-eye"
            @click="showPass = !showPass"
          />
        </template>
      </q-input>

      <div class="bp-strength">
        <span
          v-for="step in 3"
          :key="step"
          class="bp-strength-bar"
          :class="{ 'is-on': strength >= step }"
          :data-level="strength"
        />
        <small>{{ strengthLabel }}</small>
      </div>

      <q-input
        v-model="confirm"
        outlined dense rounded hide-bottom-space
        type="password"
        placeholder="Confirmar contraseña"
        class="bp-field"
        :error="touched && confirm !== password"
      >
        <template #prepend>
          <span class="bp-field-tile"><ShieldIcon /></span>
        </template>
      </q-input>

      <q-checkbox v-model="terms" dense size="xs" class="bp-remember bp-terms">
        <template #default>
          <span>
            Acepto los
            <button type="button" class="bp-legal-link" @click.stop="openLegal('terms')">términos</button>
            y el
            <button type="button" class="bp-legal-link" @click.stop="openLegal('privacy')">aviso de privacidad</button>.
          </span>
        </template>
      </q-checkbox>

      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <button type="submit" class="bp-submit" :disabled="!canSubmit || loading">
        <OrnIcon /> {{ loading ? 'Creando…' : 'Crear cuenta' }} <OrnIcon />
      </button>
    </q-form>

    <template #footer>
      ¿Ya tienes cuenta?
      <router-link to="/login">Inicia sesión</router-link>
    </template>

    <LegalDialog v-model="legalOpen" :kind="legalKind" @accept="terms = true" />
  </AuthShell>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import LegalDialog from '@/components/LegalDialog.vue'
import { MailIcon, LockIcon, UserIcon, ShieldIcon, OrnIcon } from '@/components/authIcons'
import { signUp, authErrorMessage } from '@/lib/auth'
import { invalidateSession } from '@/lib/session'

const router = useRouter()

const legalOpen = ref(false)
const legalKind = ref('terms')

function openLegal (kind) {
  legalKind.value = kind
  legalOpen.value = true
}

const name = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const terms = ref(false)
const showPass = ref(false)
const touched = ref(false)

const validEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))

const strength = computed(() => {
  const value = password.value
  if (value.length < 8) return value.length > 0 ? 1 : 0
  let score = 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++
  if (/\d/.test(value) || /[^\w\s]/.test(value)) score++
  return score
})

const strengthLabel = computed(() =>
  ['', 'Débil', 'Media', 'Fuerte'][strength.value] || ''
)

const canSubmit = computed(() =>
  name.value !== '' &&
  validEmail.value &&
  password.value.length >= 8 &&
  confirm.value === password.value &&
  terms.value
)

const loading = ref(false)
const error = ref('')

async function onSubmit () {
  touched.value = true
  if (!canSubmit.value) return

  loading.value = true
  error.value = ''

  const { error: err } = await signUp.email({
    name: name.value,
    email: email.value,
    password: password.value,
  })

  loading.value = false
  if (err) {
    error.value = authErrorMessage(err)
    return
  }
  invalidateSession()
  router.push('/')
}
</script>

<style scoped>
.bp-strength {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 6px;
  margin-top: -2px;
}

.bp-strength-bar {
  flex: 1 1 0;
  height: 4px;
  border-radius: 999px;
  background: #E8F0FB;
  transition: background .2s;
}

.bp-strength-bar.is-on[data-level="1"] { background: #E14B4B; }
.bp-strength-bar.is-on[data-level="2"] { background: #FFC93C; }
.bp-strength-bar.is-on[data-level="3"] { background: #34C77B; }

.bp-strength small {
  font-size: 10px;
  font-weight: 700;
  color: #7C93B5;
  min-width: 34px;
  text-align: right;
}

.bp-terms {
  align-items: flex-start;
  margin: 2px 2px 2px 0;
}

.bp-terms :deep(.q-checkbox__label) {
  font-size: 11px;
  line-height: 1.35;
}

.bp-legal-link {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: #1467E4;
  font-weight: 800;
  text-decoration: underline;
  cursor: pointer;
}
</style>
