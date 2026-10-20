# MNC Admin

The owner and staff dashboard for the [MNC Concept mobile app](https://github.com/zielinskimarcin/mnc): update the menu, manage loyalty points and send notifications from a browser.

I built this alongside the mobile app so the café could manage day-to-day changes without editing code. It later became part of the foundation for [Smaklo](https://github.com/zielinskimarcin/smaklo-showcase), the broader shared platform for branded restaurant and café apps.

## What the dashboard does

The menu page groups products by category and lets an owner add, edit or remove items, including their descriptions, prices and ordering. Both the dashboard and mobile app use the same menu records.

At the counter, staff enter a customer's loyalty code to adjust points or redeem a reward. The points page also shows the event history, so a balance change can be traced to an operation rather than appearing as an unexplained new number.

The push page includes immediate sending, scheduled jobs and campaign/open statistics. The users page adds account and activity information, with administration controls separated from staff access.

## How it is put together

React and TypeScript provide the interface, with Vite handling development and builds. Supabase handles sign-in, database access and server-side operations.

```text
Browser dashboard
    |-- Supabase Auth: session and account role
    |-- PostgreSQL: menu, profiles and loyalty events
    |-- Database RPCs: point adjustments and reward redemption
    `-- Edge Functions: notification sending and dashboard statistics
```

**Staff actions go through backend operations.** The points page calls dedicated database RPCs for adjustments and redemption using the customer's code. It reads `loyalty_events` for the history instead of treating a points total as the complete record.

**The interface follows the account's role.** The app reads the signed-in profile and distinguishes staff from admins. Its client-side checks work alongside the backend's access policies and RPC permissions.

**Branding is configuration.** A dashboard definition controls the title, categories, tab labels, default notification destination and base path. `src/tenant.ts` selects the configuration through `VITE_CLIENT_SLUG`.

The early deployment model uses one dashboard deployment connected to one restaurant's isolated Supabase project. The later platform and preview workflow are described in the [Smaklo showcase](https://github.com/zielinskimarcin/smaklo-showcase).

## Built with

- **React and TypeScript** for the dashboard interface.
- **Vite** for local development and production builds.
- **Supabase Auth, PostgreSQL and database RPCs** for accounts, menu and loyalty operations.
- **Supabase Edge Functions** for notification sending and aggregate dashboard statistics.

## Running a local copy

Install dependencies and provide your own Supabase project settings in the local Vite environment:

```bash
npm install
```

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_CLIENT_SLUG=mozzi
```

`mozzi` is a demonstration fixture, not a customer. The frontend uses a public anon key; privileged service keys belong only on the server.

```bash
VITE_CLIENT_SLUG=mozzi npm run client:validate -- mozzi
VITE_CLIENT_SLUG=mozzi npm run dev
```

The backend tables, functions and authentication setup must match the mobile application. See the mobile project's [launch runbook](https://github.com/zielinskimarcin/mnc/blob/main/docs/client-launch-runbook.md) for the full setup and device checks.

## Configuration and checks

Dashboard definitions live in `clients/<slug>/dashboard.config.json`. They include `adminTitle`, `basePath`, `menuCategories`, `defaultPushScreen` and tab labels.

For a path-based deployment, set `VITE_ADMIN_BASE_PATH` or update the configured `basePath`.

```bash
VITE_CLIENT_SLUG=mozzi npm run build
npm run lint
```

To scaffold another dashboard definition, replace these placeholders with your own values:

```bash
npm run client:new -- your-cafe "YOUR CAFE ADMIN" /your-cafe-admin/
VITE_CLIENT_SLUG=your-cafe npm run client:validate -- your-cafe
```

The existing `npm run deploy` script builds and publishes `dist` through `gh-pages`; run it only after setting the intended repository and environment. For the paired mobile/dashboard readiness check, use `npm run client:launch-check -- <slug> --full` from the mobile checkout.
