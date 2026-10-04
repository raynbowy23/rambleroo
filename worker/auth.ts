import { betterAuth } from 'better-auth'
import { captcha, magicLink } from 'better-auth/plugins'
import type { Env } from './env'

const createAuth = (env: Env) =>
  betterAuth({
    baseURL: env.AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    // Better Auth includes its Kysely D1 adapter; no migrations run on a request.
    database: env.DB as NonNullable<Parameters<typeof betterAuth>[0]>['database'],
    trustedOrigins: [new URL(env.AUTH_URL).origin],
    socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } },
    session: { expiresIn: 60 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    plugins: [
      // Email sign-in: a single-use link valid for 15 minutes, sent through Resend from the verified send.rambleroo.app domain.
      magicLink({ expiresIn: 15 * 60, sendMagicLink: ({ email, url }) => sendSignInEmail(env, email, url) }),
      // Turnstile guards the only endpoint that sends email, so the form can't be used to spam inboxes or drain the Resend quota.
      captcha({ provider: 'cloudflare-turnstile', secretKey: env.TURNSTILE_SECRET, endpoints: ['/sign-in/magic-link'] }),
    ],
    account: { storeAccountCookie: false, storeStateStrategy: 'cookie' },
    advanced: {
      database: { validateSchema: false },
      useSecureCookies: true,
      cookiePrefix: 'rambleroo',
      defaultCookieAttributes: { secure: true, httpOnly: true, sameSite: 'lax' },
      ipAddress: { disableIpTracking: true },
    },
  })
type Auth = ReturnType<typeof createAuth>
// One instance per isolate and database binding, so a request does not rebuild the configuration.
const instances = new WeakMap<Env['DB'], Auth>()
export function getAuth(env: Env): Auth {
  let auth = instances.get(env.DB)
  if (!auth) {
    auth = createAuth(env)
    instances.set(env.DB, auth)
  }
  return auth
}

async function sendSignInEmail(env: Env, email: string, url: string) {
  const text = `Here is your link to sign in to Rambleroo:\n\n${url}\n\nIt works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`
  const html = `<p>Here is your link to sign in to Rambleroo:</p><p><a href="${url}">Sign in to Rambleroo</a></p><p>It works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Rambleroo <signin@send.rambleroo.app>',
      to: [email],
      subject: 'Your Rambleroo sign-in link',
      text,
      html,
    }),
  })
  if (!response.ok) throw new Error(`Sign-in email failed (${response.status})`)
}
