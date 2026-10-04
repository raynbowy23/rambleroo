# Security

Please report vulnerabilities privately through GitHub: **Security → Report a vulnerability** on this repository (https://github.com/raynbowy23/rambleroo/security/advisories/new). Please don't open a public issue for security problems.

Secrets (Google OAuth, Better Auth, Resend, Turnstile) are never committed; they live in Cloudflare Worker secrets and, for local development, in an untracked `.dev.vars` file.
