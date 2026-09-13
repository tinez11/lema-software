Read `Agents.md` before starting

Were adding authentication: Clerk for real identity, plus a PIN layer
for fast worker switching on shared devices.

Install and configure `@clerk/nextjs`. Wrap the root layout in
`ClerkProvider`. Add `clerkMiddleware` protecting every app route except
the sign-in page and static assets.
# Add Clerk Authentication

Set up Clerk authentication with the Clerk CLI.

## Quick Setup

Before running any commands, present the user with a preliminary setup
checklist:

```
Here's what I'll do to get you set up with Clerk.

1. Install or update the Clerk CLI
2. Set up Clerk in this project, or scaffold a new app if it's empty
3. Verify the Next.js proxy matcher when applicable
4. Start your app with Clerk installed.

Shall I proceed?
```

## Step 1: Install or update the Clerk CLI

From the project root, check whether the Clerk CLI is already available:

```bash
command -v clerk && clerk --version
```

If `clerk` is available, make sure it is up to date:

```bash
clerk update --yes
```

If `clerk` is not available, install the latest version using the user's
preferred install method. If they do not have a preference, use npm:

```bash
npm install -g clerk
```

Equivalent install commands are `pnpm install -g clerk`,
`yarn global add clerk`, `bun add -g clerk`,
`brew install clerk/stable/clerk`, or
`curl -fsSL https://clerk.com/install | bash`.

## Step 2: Sign in to Clerk

Immediately after installing or updating the Clerk CLI, from the project
root, run:

```bash
clerk auth login
```

`clerk auth login` is the first command to run after install or update.
Do not list apps, ask which Clerk app to use, or run `clerk init` before
authenticating. It is okay for an agent to run this command and pause while
the user completes the Clerk login flow, then continue from the CLI output.
If the user is already signed in, continue to initialization.

## Step 3: Initialize Clerk

Inspect the current directory to determine whether this is an existing
project or an empty directory.

This setup is linked to the Clerk application `app_3JGm2l4Ov5eFb1AGgSXVS9pHNel`. Always
pass `--app app_3JGm2l4Ov5eFb1AGgSXVS9pHNel` to `clerk init` so the project links to
the right Clerk app.

If this is an existing project, run:

```bash
clerk init --app app_3JGm2l4Ov5eFb1AGgSXVS9pHNel
```

`clerk init` detects the framework and package manager for existing
projects. It installs the correct Clerk SDK and applies framework-specific
setup when supported, such as providers, middleware, auth routes, and
environment configuration. Do not pass `--framework` or `--pm` for
existing projects unless the user explicitly wants to override detection or
the CLI asks for those values.

If the directory is empty, ask the user which framework and package manager
they want to use. If they have no preference, use Next.js and npm. Then
scaffold with explicit framework and package manager options:

```bash
clerk init --framework <framework> --pm <package-manager> --app app_3JGm2l4Ov5eFb1AGgSXVS9pHNel
```

When choosing a package manager, use the user's preference. If the directory
is not truly empty and contains a lockfile or package manager config, use
these signals:

- `pnpm-lock.yaml` -> `pnpm`
- `yarn.lock` -> `yarn`
- `bun.lock` or `bun.lockb` -> `bun`
- `package-lock.json` -> `npm`

If no package manager can be detected and the user has no preference, use
`npm`.

## Step 4: Verify the Next.js matcher

After `clerk init`, if the project uses Next.js, check `proxy.ts` or
`middleware.ts` for Next.js 15 and earlier. Make sure `config.matcher`
includes Clerk's auto-proxy path once, after the API/TRPC matcher:

```ts
'/(api|trpc)(.*)',
'/__clerk/:path*',
```

Add `'/__clerk/:path*'` if it is missing.

## Step 5: Fall back to docs when init is incomplete

If `clerk init` reports that the framework is unsupported, cannot be
detected, or does not support full scaffolding, follow the official
quickstart instead.

`clerk init` currently has full scaffolding for Next.js, Astro, Nuxt,
TanStack Start, React Router, Vue, React, and JavaScript/Vite. It can detect
Expo, Express, and Fastify, but may direct you to docs for the remaining
integration steps.

| Dependency | Quickstart |
|------------|-----------|
| `next` | https://clerk.com/docs/nextjs/getting-started/quickstart |
| `@remix-run/react` | https://clerk.com/docs/remix/getting-started/quickstart |
| `astro` | https://clerk.com/docs/astro/getting-started/quickstart |
| `nuxt` | https://clerk.com/docs/nuxt/getting-started/quickstart |
| `react-router` | https://clerk.com/docs/react-router/getting-started/quickstart |
| `@tanstack/react-start` | https://clerk.com/docs/tanstack-react-start/getting-started/quickstart |
| `react` | https://clerk.com/docs/react/getting-started/quickstart |
| `vue` | https://clerk.com/docs/vue/getting-started/quickstart |
| `vite` or vanilla JS | https://clerk.com/docs/js-frontend/getting-started/quickstart |
| `express` | https://clerk.com/docs/expressjs/getting-started/quickstart |
| `fastify` | https://clerk.com/docs/fastify/getting-started/quickstart |
| `expo` | https://clerk.com/docs/expo/getting-started/quickstart |

Other platforms: Chrome Extension, Android, and iOS at
https://clerk.com/docs/llms.txt

## Step 6: Ensure clear auth controls are visible

Make sure the app has clear sign-in, sign-up, and signed-in user controls so
the user can create and recognize their first account. Integrate them into
the existing layout, navigation, or landing screen so they feel natural and
polished.

For Next.js App Router, use Clerk components from `@clerk/nextjs` such as
`SignInButton`, `SignUpButton`, `Show`, and `UserButton`. Show
sign-in and sign-up actions when signed out, and a user button when signed
in:

```tsx
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs'

<>
  <Show when="signed-out">
    <SignInButton />
    <SignUpButton />
  </Show>
  <Show when="signed-in">
    <UserButton />
  </Show>
</>
```

For other frameworks, use the equivalent Clerk components or helpers. If
clear auth controls already exist, reuse or adapt them instead of
duplicating them.

## Step 7: Verify the setup

After `clerk init` completes, run:

```bash
clerk doctor
```

Then start the app, confirm the sign-in, sign-up, and signed-in user
controls are visible, test the sign-in and sign-up flow, and fix any issues
reported by the CLI.

## Step 8: If using shadcn/ui

If `components.json` exists in the project root and Clerk components are
used:

```bash
npm install @clerk/ui
```

Apply the theme in your provider:
```tsx
import { shadcn } from '@clerk/ui/themes'
<ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>
```

Add to global CSS:
```css
@import '@clerk/ui/themes/shadcn.css';
```

## Critical rules

- Next.js 15+: `auth()` is async. Always `await auth()`
- `ClerkProvider` goes inside `<body>`, not wrapping `<html>`
- Next.js proxy matchers include `'/__clerk/:path*'` after
  `'/(api|trpc)(.*)'`
- Never expose `CLERK_SECRET_KEY` in client code
- Use `@clerk/nextjs`, not `@clerk/clerk-react`
- Do not read or print existing environment variable files; ask the user
  for any missing non-sensitive configuration

Docs: https://clerk.com/docs/cli https://clerk.com/docs/llms.txt

## After Setup

Have the user sign up as their first test user in the nav. After signup
succeeds and a profile icon appears, congratulate them. If a "Configure
your application" callout appears, tell them to click it. Then recommend
exploring: Organizations
(https://clerk.com/docs/guides/organizations/overview), Components
(https://clerk.com/docs/reference/components/overview), and the Dashboard
(https://dashboard.clerk.com/).

Workers are invited manually by the owner through Clerk's own dashboard
— there is no in-app invite screen in this unit.

`User.pinHash` and `User.pinSetAt` already exist on the schema — migrate
if that hasn't landed yet.

Add a Clerk webhook route (`app/api/webhooks/clerk/route.ts`) that
creates a matching Prisma `User` row on `user.created`, defaulting to
`role: WORKER, active: true`. Verify the webhook signature before
trusting the payload. The owner's own `User` row is seeded directly
(not through this webhook) with `role: OWNER` — Clerk has no way to know
who the owner is.

Add `lib/db/users.ts` following the `02-database` convention: a default
read helper with no financial exposure concerns (User has none) plus
whatever the PIN flow needs — `getUserById`, `setPinHash`,
`verifyPinHash`. `verifyPinHash` takes a plaintext PIN and a user id,
hashes server-side, and compares — the plaintext PIN must never be
compared client-side or logged.

Build a first-time PIN setup screen, shown only when a worker's
`pinHash` is null, using the existing `input-otp` primitive. Call
`setPinHash` to store it.

Build the PIN lock screen, shown whenever the app is opened or
foregrounded and `pinHash` is already set. Validate through
`verifyPinHash` — a server round-trip, since the hash lives in Postgres
and comparison must happen server-side, not by reading the hash onto
the client. This differs from the original plan to check `pinHash`
on-device via PowerSync; centralizing it, as decided, means the check
needs a network call, so degrade gracefully with a clear offline message
if a worker is fully offline and hasn't unlocked yet this session.

Lock out PIN entry for 60 seconds after 5 consecutive wrong attempts.
Track attempt count and lockout expiry server-side against the `User`
row, not in client state.

The owner never sees the PIN screen — Clerk's own session covers the
owner directly.

Do not build role-based data visibility (the `...WithPricing()` /
default-helper split from `architecture.md`) yet — that's per-module
Phase 1 work, not this unit.

Do not modify `components/ui/*`.

### Check when done
- Owner signs in through Clerk and reaches the app
- A worker invited via Clerk's dashboard gets a matching Prisma `User`
  row auto-created on first sign-in, with `role: WORKER`
- The webhook rejects a payload with an invalid/missing signature
- That worker is prompted to set a PIN on first login; `pinHash` is
  populated
- Reopening the app (same or a different device) prompts for the PIN
  rather than a full Clerk login, and validates server-side against the
  centrally-stored hash
- A worker with no connection sees a clear offline state on the lock
  screen rather than a silent failure
- 5 wrong PIN attempts in a row lock entry for 60 seconds, tracked
  server-side
- `npm run build` passes
- `npm run lint` passes