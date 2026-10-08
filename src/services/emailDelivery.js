import { env } from '../config/env.js'

export const emailConfigured = () => Boolean(env.EMAIL_FROM && (env.BREVO_API_KEY || env.RESEND_API_KEY))

// HTTPS works on free Render. Never retry an ambiguous timeout automatically:
// the provider may already have accepted the message.
export async function deliverEmail({ to, subject, html }) {
  if (!emailConfigured()) throw new Error('Email delivery is not configured')
  const brevo = Boolean(env.BREVO_API_KEY)
  const response = await fetch(brevo ? 'https://api.brevo.com/v3/smtp/email' : 'https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(brevo
      ? { 'api-key': env.BREVO_API_KEY }
      : { Authorization: `Bearer ${env.RESEND_API_KEY}` }) },
    body: JSON.stringify(brevo
      ? { sender: { name: 'AgricbyLovely', email: env.EMAIL_FROM }, to: [{ email: to }], subject, htmlContent: html }
      : { from: `AgricbyLovely <${env.EMAIL_FROM}>`, to: [to], subject, html }),
  })
  if (!response.ok) throw new Error(`Email provider rejected the request (HTTP ${response.status})`)
  const result = await response.json()
  if (!(brevo ? result.messageId : result.id)) throw new Error('Email provider did not confirm acceptance')
}

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))
