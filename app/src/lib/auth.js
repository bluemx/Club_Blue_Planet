import { createAuthClient } from 'better-auth/vue'
import { emailOTPClient } from 'better-auth/client/plugins'

// Neither Quasar's `build.env` nor a Vite `define` survives into client code
// in this setup, so the origin lives here. `import.meta.env.DEV` is Vite's own
// and does: `quasar dev` talks to a local `wrangler dev`, builds to production.
// ponytail: a Capacitor dev build would also point at localhost; give it its
// own origin when the native app lands.
export const API_URL = import.meta.env.DEV
  ? 'http://localhost:8787'
  // Vite exposes VITE_* from the environment; staging builds set it.
  : (import.meta.env.VITE_API_URL || 'https://clubblueplanet.ealbinu.workers.dev')

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [emailOTPClient()],
  fetchOptions: {
    // Sessions are cookie-based and the API is a different origin.
    credentials: 'include',
  },
})

export const { signIn, signUp, signOut, useSession, forgetPassword, emailOtp } = authClient

/** Turn a Better Auth error into something we can show a parent or a kid. */
export function authErrorMessage (error) {
  if (!error) return ''
  if (error.status === 429) return 'Demasiados intentos. Espera unos minutos.'

  const code = error.code || ''
  const map = {
    INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
    USER_ALREADY_EXISTS: 'Ya existe una cuenta con ese correo.',
    PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres.',
  }
  return map[code] || error.message || 'Algo salió mal. Inténtalo de nuevo.'
}

/** Endpoints outside Better Auth's own client. */
export async function apiFetch (path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(data?.message || 'Error'), { status: res.status, data })
  return data
}
