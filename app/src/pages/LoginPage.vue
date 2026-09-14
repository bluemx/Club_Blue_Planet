<template>
  <AuthShell
    title="¡Bienvenido de vuelta!"
    subtitle="Inicia sesión para continuar tu aventura"
  >
    <q-form class="bp-auth-form" @submit.prevent="onSubmit">
      <q-input
        v-model="email"
        outlined dense rounded hide-bottom-space
        type="email"
        placeholder="Correo electrónico"
        class="bp-field"
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

      <div class="bp-auth-row">
        <q-checkbox v-model="remember" dense size="xs" label="Recordarme" class="bp-remember" />
        <router-link to="/recuperar" class="bp-link">¿Olvidaste tu contraseña?</router-link>
      </div>

      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <button type="submit" class="bp-submit" :disabled="loading">
        <OrnIcon /> {{ loading ? 'Entrando…' : 'Iniciar sesión' }} <OrnIcon />
      </button>
    </q-form>

    <div class="bp-divider"><span>o continúa con</span></div>

    <router-link to="/cuenta-infantil" class="bp-submit bp-submit--ghost">
      <KidIcon /> Cuenta infantil
    </router-link>

    <template #footer>
      ¿Aún no tienes cuenta?
      <router-link to="/registro">Regístrate</router-link>
    </template>
  </AuthShell>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import { MailIcon, LockIcon, OrnIcon, KidIcon } from '@/components/authIcons'
import { signIn, authErrorMessage } from '@/lib/auth'
import { invalidateSession } from '@/lib/session'

const router = useRouter()

const email = ref('')
const password = ref('')
const remember = ref(true)
const showPass = ref(false)
const loading = ref(false)
const error = ref('')

async function onSubmit () {
  loading.value = true
  error.value = ''

  const { error: err } = await signIn.email({
    email: email.value,
    password: password.value,
    rememberMe: remember.value,
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
