# MNC Admin Dashboard

Dedicated owner/staff dashboard for the loyalty app template.

## Configuration

Set Supabase client env vars before building:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Client-specific dashboard settings live in `src/tenant.ts`:

- `adminTitle`
- `basePath`
- `menuCategories`
- `defaultPushScreen`
- tab labels

For GitHub Pages or path-based deploys, set `VITE_ADMIN_BASE_PATH` or update `tenant.basePath`.

## Commands

```bash
npm run build
npm run lint
npm run deploy
```

## Clone Notes

During the first commercial phase, use one dashboard deployment per restaurant and connect it to that restaurant's Supabase project. This keeps owners isolated and makes debugging much simpler than a shared multi-tenant dashboard.

The points page reads from `loyalty_events`, so every staff point adjustment should leave an auditable history row.
