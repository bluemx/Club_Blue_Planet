/**
 * Cloudflare Email Sending.
 *
 * unmensaje.com is onboarded, so this reaches arbitrary recipients. A send that
 * fails with E_SENDER_NOT_VERIFIED / E_RECIPIENT_NOT_ALLOWED means the domain
 * status changed in the dashboard, not that the code is wrong.
 */
export async function sendEmail (env, { to, subject, text, html }) {
  const from = env.MAIL_FROM || 'no-reply@unmensaje.com'

  // Wrangler provides a simulated EMAIL binding locally, so nothing actually
  // arrives in an inbox during development — print the body instead.
  if (!env.EMAIL || env.MAIL_DEBUG === '1') {
    console.log(`[email:dev] to=${to} subject=${subject}\n${text}`)
    if (!env.EMAIL) return { delivered: false, reason: 'no-binding' }
  }

  try {
    await env.EMAIL.send({ from, to, subject, text, html })
    return { delivered: true }
  } catch (error) {
    // Surface the Cloudflare reason (E_SENDER_NOT_VERIFIED /
    // E_RECIPIENT_NOT_ALLOWED) — those need dashboard work, not a code fix.
    console.error('[email] send failed', error?.message || error)
    throw error
  }
}

export function otpEmail ({ otp, type }) {
  const subject = type === 'forget-password'
    ? 'Tu código para recuperar la contraseña'
    : 'Tu código de verificación'

  const lead = type === 'forget-password'
    ? 'Usa este código para elegir una contraseña nueva.'
    : 'Usa este código para confirmar tu correo.'

  const text = `${lead}\n\nCódigo: ${otp}\n\nVence en 10 minutos. Si no lo pediste, ignora este mensaje.`

  const html = `<!doctype html>
<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#EAF3FF;padding:28px">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:20px;padding:26px;text-align:center">
    <h1 style="margin:0 0 6px;font-size:19px;color:#0B2A5B">Club Blue Planet</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#55708F">${lead}</p>
    <div style="font-size:31px;font-weight:800;letter-spacing:7px;color:#1467E4;background:#EDF4FF;border-radius:14px;padding:14px">${otp}</div>
    <p style="margin:18px 0 0;font-size:11.5px;color:#90A3C0">Vence en 10 minutos. Si no lo pediste, ignora este mensaje.</p>
  </div>
</div>`

  return { subject, text, html }
}
