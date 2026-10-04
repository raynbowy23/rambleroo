import { betterAuth } from 'better-auth'
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
