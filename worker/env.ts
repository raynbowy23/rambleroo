// The binding shape is deliberately small; Better Auth's D1 adapter also uses prepare/batch on this native binding.
export interface Statement {
  bind(...values: unknown[]): Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
}
export interface Env {
  DB: { prepare(query: string): Statement; batch(statements: Statement[]): Promise<unknown[]> }
  ASSETS: { fetch(request: Request): Promise<Response> }
  AUTH_URL: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  BETTER_AUTH_SECRET: string
  RESEND_API_KEY: string
  TURNSTILE_SECRET: string
}
