# Codex Operating Notes

This is the admin dashboard for the restaurant/cafe loyalty app factory. The mobile app template lives in the sibling repository at:

```txt
../mnc
```

For the founder's current Sales Demo v1 work, read `../mnc/docs/sales-demo-operating-brief.md`, `../mnc/docs/sales-demo-v1-plan.md`, and `../mnc/docs/sales-demo-runbook.md` before changing this dashboard. The demo operator panel is selected by Vite mode `preview` and is separate from the production per-client dashboards below; never use a global push action or unscoped point/menu update across demo businesses. Check `../mnc/docs/sales-demo-implementation-status.md` before claiming anything is live.

The owner rejected the independently styled sales-demo portal. Preview mode must share `DashboardChrome`, `MenuPage`, and `PointsPage` with the original MNC/Mozzi dashboard. Keep MNC black/white, Mozzi with a very pale green page background, and preserve the original Menu/Points/Push visual language while using isolated preview tables. Business setup is an operator-only utility hidden from the sales navigation. The `USERS` tab reads isolated synthetic `preview_customers` data; do not present it as real customer analytics.

The founder removed manual email sign-in from the **local preview operator panel**. `npm run preview:dev` binds to `127.0.0.1` and gets an operator session automatically through the already authenticated Supabase CLI; the server-side service key must never reach browser code or files. Keep preview RLS and production dashboard authentication intact. This flow is local-only, not for deploying the preview panel as static public hosting.

Before requesting access again, read `../mnc/docs/service-connections.md` and verify the existing Supabase, Expo/EAS, and GitHub connections. Do not treat a newly started Codex session's missing context as missing authorization.

The dashboard should be treated as the companion product for each mobile app client. Use one dashboard client config per restaurant:

```txt
clients/<slug>/dashboard.config.json
```

`mozzi` is a demo/test fixture, not a real customer.

## Hosting Direction

Prefer one isolated Vercel deployment/project per client, with subdomains like:

```txt
mnc.appkadokawy.pl
mozzi.appkadokawy.pl
<slug>.appkadokawy.pl
```

Each deployment should have client-specific env:

```txt
VITE_CLIENT_SLUG=<slug>
VITE_SUPABASE_URL=<client Supabase URL>
VITE_SUPABASE_ANON_KEY=<client Supabase anon key>
```

## Commands

```bash
npm run client:new -- <slug> "<NAME> ADMIN" /<slug>-admin/
VITE_CLIENT_SLUG=<slug> npm run client:validate -- <slug>
VITE_CLIENT_SLUG=<slug> npm run build
npm run lint
VITE_CLIENT_SLUG=<slug> npm run dev
```

For full launch readiness, run the orchestrator from the mobile repo:

```bash
cd ../mnc
npm run client:launch-check -- <slug> --full
```
