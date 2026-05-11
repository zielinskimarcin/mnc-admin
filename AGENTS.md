# Codex Operating Notes

This is the admin dashboard for the restaurant/cafe loyalty app factory. The mobile app template lives at:

```txt
/Users/marcin/concept-app
```

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
cd /Users/marcin/concept-app
npm run client:launch-check -- <slug> --full
```
