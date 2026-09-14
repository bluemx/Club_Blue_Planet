import { emailOTP } from 'better-auth/plugins'
import { kidCode } from './kid-code-plugin.js'
import { sendEmail, otpEmail } from './email.js'

/**
 * Everything except `database`. Shared by the Worker (which supplies the D1
 * binding at request time) and the schema CLI (which supplies a throwaway
 * SQLite file), so the generated schema can never drift from what runs.
 */
export function authOptions (env = {}) {
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: originList(env),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // No mail provider wired yet — turning this on would lock every new
      // account out until one exists.
      requireEmailVerification: false,
    },

    user: {
      additionalFields: {
        // 'parent' owns the family; 'kid' signs in with a 6-digit code.
        role: { type: 'string', required: false, defaultValue: 'parent', input: false },
        // Set on kid accounts: the adult who added them (for display only).
        parentId: { type: 'string', required: false, input: false },
        // The family this user acts in. This — not parentId — grants access,
        // so that two guardians can share one family.
        familyId: { type: 'string', required: false, input: false },
      },
    },

    plugins: [
      kidCode(),
      // The reset UI asks for 6 digits, so use OTP rather than a magic link.
      emailOTP({
        otpLength: 6,
        expiresIn: 600, // 10 min
        async sendVerificationOTP ({ email, otp, type }) {
          const { subject, text, html } = otpEmail({ otp, type })
          await sendEmail(env, { to: email, subject, text, html })
        },
      }),
    ],

    // A 6-digit code is only ~1e6 wide, so redeeming has to be throttled or it
    // is brute-forceable. Memory storage is useless on Workers (every isolate
    // gets its own), so the counters live in D1.
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/kid-code/redeem': { window: 300, max: 5 },
        '/email-otp/send-verification-otp': { window: 600, max: 3 },
        '/email-otp/reset-password': { window: 600, max: 5 },
        '/sign-in/email': { window: 300, max: 10 },
        '/sign-up/email': { window: 3600, max: 5 },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,      // refresh once a day
    },

    advanced: {
      // Without this the rate limiter can't tell callers apart and falls back
      // to ONE shared bucket per path — which would let a single attacker lock
      // every child out of redeeming their code. Cloudflare sets this header
      // itself and it cannot be spoofed by the client.
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
      },

      // The SPA is served from a different origin than the Worker.
      defaultCookieAttributes: {
        sameSite: 'none',
        secure: true,
        httpOnly: true,
      },
    },
  }
}

export function originList (env) {
  return (env.APP_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
}
