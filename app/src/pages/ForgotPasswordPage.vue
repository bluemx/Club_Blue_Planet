<template>
  <AuthShell
    compact
    :back="step === 1 ? '/login' : ''"
    :title="titles[step]"
    :subtitle="subtitles[step]"
  >
    <div class="bp-steps">
      <span v-for="s in 3" :key="s" class="bp-step" :class="{ 'is-on': step >= s }" />
    </div>

    <!-- 1. email -->
    <q-form v-if="step === 1" class="bp-auth-form" @submit.prevent="sendCode">
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

      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <button type="submit" class="bp-submit" :disabled="!validEmail || busy">
        <OrnIcon /> {{ busy ? 'Enviando…' : 'Enviar código' }} <OrnIcon />
      </button>
    </q-form>

    <!-- 2. code -->
    <template v-else-if="step === 2">
      <CodeInput v-model="code" @complete="verifyCode" />

      <p v-if="error" class="bp-err">{{ error }}</p>

      <button type="button" class="bp-submit q-mt-md" :disabled="code.length < 6" @click="verifyCode">
        <OrnIcon /> Verificar código <OrnIcon />
      </button>

      <p class="bp-hint">
        Enviamos el código a <strong>{{ email }}</strong>.<br />
        <a href="#" class="bp-link" @click.prevent="resend">Reenviar código</a>
        <br />
        <small>Si pides otro, solo servirá el del correo más reciente.</small>
      </p>
    </template>

    <!-- 3. new password -->
    <q-form v-else class="bp-auth-form" @submit.prevent="savePassword">
      <q-input
        v-model="password"
        outlined dense rounded hide-bottom-space
        :type="showPass ? 'text' : 'password'"
        placeholder="Nueva contraseña"
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

      <p v-if="error" class="bp-auth-error">{{ error }}</p>

      <button type="submit" class="bp-submit" :disabled="!canSave || busy">
        <OrnIcon /> {{ busy ? 'Guardando…' : 'Guardar contraseña' }} <OrnIcon />
      </button>
    </q-form>

    <template #footer>
      ¿Ya la recordaste?
      <router-link to="/login">Inicia sesión</router-link>
    </template>
  </AuthShell>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import CodeInput from '@/components/CodeInput.vue'
import { MailIcon, LockIcon, ShieldIcon, OrnIcon } from '@/components/authIcons'
import { forgetPassword, emailOtp, authErrorMessage } from '@/lib/auth'

const router = useRouter()

const step = ref(1)
const email = ref('')
const code = ref('')
const password = ref('')
const confirm = ref('')
const showPass = ref(false)
const touched = ref(false)
const error = ref('')

const titles = {
  1: 'Recupera tu cuenta',
  2: 'Revisa tu correo',
  3: 'Nueva contraseña',
}

const subtitles = {
  1: 'Te enviaremos un código de 6 dígitos para restablecer tu contraseña.',
  2: 'Escribe el código de 6 dígitos que te enviamos.',
  3: 'Elige una contraseña de al menos 8 caracteres.',
}

const validEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
const canSave = computed(() => password.value.length >= 8 && confirm.value === password.value)

const busy = ref(false)

async function sendCode () {
  touched.value = true
  if (!validEmail.value || busy.value) return

  busy.value = true
  error.value = ''

  const { error: err } = await forgetPassword.emailOtp({ email: email.value })
  busy.value = false

  // Don't reveal whether the address exists — always advance.
  if (err && err.status === 429) {
    error.value = authErrorMessage(err)
    return
  }
  step.value = 2
}

// The OTP is only checked when the new password is submitted, so this step
// just gates the UI.
function verifyCode () {
  if (code.value.length < 6) return
  error.value = ''
  touched.value = false
  step.value = 3
}

async function resend () {
  code.value = ''
  error.value = ''
  const { error: err } = await forgetPassword.emailOtp({ email: email.value })
  if (err) error.value = authErrorMessage(err)
}

async function savePassword () {
  touched.value = true
  if (!canSave.value || busy.value) return

  busy.value = true
  error.value = ''

  const { error: err } = await emailOtp.resetPassword({
    email: email.value,
    otp: code.value,
    password: password.value,
  })
  busy.value = false

  if (err) {
    // A bad or expired OTP only surfaces here, so send them back to step 2.
    error.value = 'El código es incorrecto o venció. Pide uno nuevo.'
    step.value = 2
    code.value = ''
    return
  }
  router.push('/login')
}

watch(code, () => { error.value = '' })
</script>

<style scoped>
.bp-steps {
  display: flex;
  gap: 5px;
  margin: 0 0 14px;
}

.bp-step {
  flex: 1 1 0;
  height: 4px;
  border-radius: 999px;
  background: #E8F0FB;
  transition: background .25s;
}

.bp-step.is-on {
  background: #1467E4;
}

.bp-err {
  font-size: 11.5px;
  font-weight: 700;
  color: #E14B4B;
  text-align: center;
  margin: 8px 0 0;
}
</style>
